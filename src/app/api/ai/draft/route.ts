import { generateAIResponse } from '@/lib/ai';

export async function POST(request: Request) {
    try {
        const { context, leadName } = await request.json();

        if (!context) {
            return new Response(JSON.stringify({ error: "Chat context is required" }), { status: 400 });
        }

        // Direct the AI to draft a response acting as a human staff member
        const systemPrompt = `You are a helpful AI assistant drafting an email/message on behalf of a human staff member at RVS CRM.
Your goal is to read the conversation history and suggest a professional, concise, and helpful reply to the lead named ${leadName}.
Do not include subject lines or "[Your Name]". Just write the raw text of the message draft.`;

        const fullPrompt = `System: ${systemPrompt}\n\nConversation History:\n${context}\n\nDraft a reply acting as the human representative:`;

        const responseText = await generateAIResponse(fullPrompt, 'qwen3.5:0.8b');

        return new Response(JSON.stringify({ draft: responseText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("AI Copilot Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate draft" }), { status: 500 });
    }
}
