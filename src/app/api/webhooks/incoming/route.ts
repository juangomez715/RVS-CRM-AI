import prisma from '@/lib/db';
import { generateAIResponse } from '@/lib/ai';
import { writeAuditLog, getClientIp } from '@/lib/audit';

function verifyWebhookSecret(request: Request): boolean {
    const secret = process.env.INCOMING_WEBHOOK_SECRET;
    const incoming = request.headers.get('x-webhook-secret');
    if (!secret || !incoming) return false;
    const enc = new TextEncoder();
    const a = enc.encode(incoming);
    const b = enc.encode(secret);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export async function POST(request: Request) {
    if (!verifyWebhookSecret(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const data = await request.json();
        const { senderEmail, subject, textBody, provider = 'Email' } = data;

        if (!senderEmail || !textBody) {
            return new Response(JSON.stringify({ error: "Missing sender or body" }), { status: 400 });
        }

        // 1. Find the Lead
        const lead = await prisma.lead.findFirst({
            where: { email: senderEmail }
        });

        if (!lead) {
            // Unsolicited email from unknown sender, skip or create new lead
            return new Response(JSON.stringify({ success: false, message: "Sender not found in CRM" }), { status: 200 });
        }

        // 2. Pause any active sequences since they replied!
        await prisma.leadSequence.updateMany({
            where: { leadId: lead.id, status: 'ACTIVE' },
            data: { status: 'PAUSED' }
        });

        // 3. Log Interaction
        await prisma.interaction.create({
            data: {
                leadId: lead.id,
                channel: provider,
                sender: 'LEAD',
                content: `Subject: ${subject}\n\n${textBody}`,
                repliedAt: new Date(),
            }
        });

        // 4. Autonomous Copilot Draft Generation
        if (lead.aiStatus === 'ACTIVE') {
            const activeAgent = await prisma.agent.findFirst({ where: { isActive: true } });
            if (activeAgent) {
                const prompt = `
                    ${activeAgent.systemPrompt}
                    \n[Knowledge Base Context]:\n${activeAgent.knowledgeBase || 'None'}
                    \nTask: The user replied to our campaign. Draft an elegant, short response.
                    \nLead Data: ${lead.name}
                    \nLead Reply: ${textBody}
                    \nRespond ONLY with the email draft text. No pleasantries like "Here is your draft". Provide subject and body if needed.
                `;

                const draftText = await generateAIResponse(prompt, activeAgent.llmModel);

                // Save an AI interaction showing the draft created silently in the background
                await prisma.interaction.create({
                    data: {
                        leadId: lead.id,
                        channel: 'System_Draft',
                        sender: 'AI',
                        content: `[AUTO-DRAFTED BY ${activeAgent.name}]\n\n${draftText}`
                    }
                });
            }
        }

        await writeAuditLog({
            action: 'WEBHOOK_INCOMING',
            ip: getClientIp(request),
            details: `Reply from: ${senderEmail} | Lead: ${lead.id}`,
        });

        return new Response(JSON.stringify({ success: true, message: "Reply processed securely." }), { status: 200 });

    } catch (error) {
        console.error("Incoming webhook error:", error);
        return new Response(JSON.stringify({ error: "Failed to process incoming payload" }), { status: 500 });
    }
}
