const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Free model on OpenRouter — change if needed
const OPENROUTER_FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

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
        signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);

    const data: OllamaResponse = await res.json();
    return data.response;
}

async function generateViaOpenRouter(prompt: string): Promise<string> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set.');
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'RVS CRM AI',
        },
        body: JSON.stringify({
            model: OPENROUTER_FALLBACK_MODEL,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter error: ${res.status} — ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
}

export async function generateAIResponse(prompt: string, model: string = 'qwen3.5:0.8b'): Promise<string> {
    // 1. Try Ollama first (local)
    try {
        const response = await generateViaOllama(prompt, model);
        return response;
    } catch (ollamaError) {
        console.warn('[AI] Ollama unavailable, falling back to OpenRouter:', (ollamaError as Error).message);
    }

    // 2. Fallback to OpenRouter (cloud, free tier)
    try {
        const response = await generateViaOpenRouter(prompt);
        return response;
    } catch (fallbackError) {
        console.error('[AI] OpenRouter fallback also failed:', (fallbackError as Error).message);
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
