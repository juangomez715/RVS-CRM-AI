import { generateAIResponse } from '@/lib/ai';

export async function POST(request: Request) {
    try {
        const { systemPrompt, message, model = 'qwen3.5:0.8b' } = await request.json();

        if (!message) {
            return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
        }

        const responseText = await generateAIResponse(message, model, systemPrompt);

        return new Response(JSON.stringify({ response: responseText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("Test Agent Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate response" }), { status: 500 });
    }
}
