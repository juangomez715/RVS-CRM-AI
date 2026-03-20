const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Free models on OpenRouter — upgrade to paid for better quality
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

async function generateViaOllama(prompt: string, model: string): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);

    const data: OllamaResponse = await res.json();
    return data.response;
}

async function generateViaOpenRouter(prompt: string, systemPrompt?: string): Promise<string> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set. Get a free key at openrouter.ai/keys');
    }

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'RVS CRM AI',
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter error: ${res.status} — ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
}

// Check if Ollama is manually enabled via the Integration table
async function isOllamaEnabled(): Promise<boolean> {
    try {
        const { default: prisma } = await import('./db');
        const rec = await prisma.integration.findFirst({
            where: { provider: 'ollama', isActive: true }
        });
        return !!rec;
    } catch {
        return false;
    }
}

export async function getAIProviderStatus(): Promise<{
    provider: 'openrouter' | 'ollama' | 'none';
    ollamaEnabled: boolean;
    openrouterConfigured: boolean;
    model: string;
}> {
    const ollamaEnabled = await isOllamaEnabled();
    const openrouterConfigured = !!OPENROUTER_API_KEY;
    const provider = ollamaEnabled ? 'ollama' : openrouterConfigured ? 'openrouter' : 'none';
    return { provider, ollamaEnabled, openrouterConfigured, model: ollamaEnabled ? 'local' : OPENROUTER_MODEL };
}

export async function generateAIResponse(prompt: string, model: string = 'qwen3.5:0.8b', systemPrompt?: string): Promise<string> {
    const ollamaEnabled = await isOllamaEnabled();

    // If Ollama is manually enabled, use it first (local inference)
    if (ollamaEnabled) {
        try {
            // Ollama /api/generate doesn't support separate system messages — prepend if present
            const fullPrompt = systemPrompt ? `System: ${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:` : prompt;
            const response = await generateViaOllama(fullPrompt, model);
            return response;
        } catch (ollamaError) {
            console.warn('[AI] Ollama unavailable, falling back to OpenRouter:', (ollamaError as Error).message);
        }
    }

    // Primary default: OpenRouter (cloud, free tier, no local hardware needed)
    try {
        const response = await generateViaOpenRouter(prompt, systemPrompt);
        return response;
    } catch (openRouterError) {
        console.error('[AI] OpenRouter failed:', (openRouterError as Error).message);
        // Last resort: try Ollama even if not explicitly enabled
        if (!ollamaEnabled) {
            try {
                const fullPrompt = systemPrompt ? `System: ${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:` : prompt;
                return await generateViaOllama(fullPrompt, model);
            } catch { /* ignore */ }
        }
        return 'Error: AI engine is temporarily unavailable. Please try again later.';
    }
}

export async function qualifyLead(message: string): Promise<{ score: number; reasoning: string }> {
    const prompt = `You are an expert Lead Qualifier for RVS CRM (a dental medical sales company).
Analyze the following lead message and provide:
1. A qualification score from 0 to 100 (High score = strong intent to buy/schedule).
2. A very brief reasoning (10 words max).

Lead Message: "${message}"

Respond strictly in JSON format like this:
{"score": 85, "reasoning": "Strong interest in pricing and scheduling."}`;

    try {
        const rawResponse = await generateAIResponse(prompt);
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed.score === 'number' && typeof parsed.reasoning === 'string') {
                return parsed;
            }
        }
        return { score: 0, reasoning: 'Could not parse AI response.' };
    } catch {
        return { score: 0, reasoning: 'AI error during qualification.' };
    }
}
