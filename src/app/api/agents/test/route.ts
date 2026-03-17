import { generateAIResponse } from '@/lib/ai';

export async function POST(request: Request) {
    try {
        const { systemPrompt, message, model = 'qwen3.5:0.8b' } = await request.json();

        if (!message) {
            return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
        }

        // Construct a simple prompt for the raw generation endpoint
        // Qwen uses ChatML typically, but for a simple raw prompt we can structure it like this:
        const fullPrompt = `${systemPrompt ? `System: ${systemPrompt}\n\n` : ''}User: ${message}\n\nAssistant:`;

        const responseText = await generateAIResponse(fullPrompt, model);

        return new Response(JSON.stringify({ response: responseText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("Test Agent Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate response" }), { status: 500 });
    }
}
