import prisma from '@/lib/db';
import { qualifyLead } from '@/lib/ai';
import { writeAuditLog, getClientIp } from '@/lib/audit';

function verifyWebhookSecret(request: Request): boolean {
    const secret = process.env.N8N_WEBHOOK_SECRET;
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
        console.log("[Data Influx] n8n Webhook Received:", data.email || data.name);

        if (!data.email && !data.phone && !data.name) {
            return new Response(JSON.stringify({ error: "Empty payload. Identifiers required." }), { status: 400 });
        }

        // 1. DUPLICATE CHECK: Search by Email or LinkedIn URL to prevent mixing data
        const existingLead = await prisma.lead.findFirst({
            where: {
                OR: [
                    data.email ? { email: data.email } : {},
                    data.linkedinUrl ? { aiNotes: { contains: data.linkedinUrl } } : {}
                ].filter(o => Object.keys(o).length > 0)
            }
        });

        if (existingLead) {
            console.log(`[Data Influx] Existing lead detected: ${existingLead.id}. Merging context.`);
            // Update context if new data arrived
            const updated = await prisma.lead.update({
                where: { id: existingLead.id },
                data: {
                    company: data.company || existingLead.company,
                    phone: data.phone || existingLead.phone,
                }
            });
            return new Response(JSON.stringify({ success: true, message: "Lead updated", id: updated.id }), { status: 200 });
        }

        // 2. AI QUALIFICATION ENGINE
        const inputContext = `
            Lead Name: ${data.name || 'N/A'}
            Company: ${data.company || 'N/A'}
            Bio/Message: ${data.message || data.notes || 'No context provided.'}
            Source: ${data.source || 'n8n Inbound'}
        `;
        const qualification = await qualifyLead(inputContext);

        // 3. PERSISTENCE
        const lead = await prisma.lead.create({
            data: {
                name: data.name || "Unknown Prospect",
                company: data.company || "Unknown Org",
                email: data.email || null,
                phone: data.phone || null,
                source: data.source || "n8n_inbound",
                status: qualification.score > 70 ? "Qualified" : "New",
                score: qualification.score,
                aiNotes: `${qualification.reasoning} | Generated via n8n Node: ${new Date().toLocaleDateString()}`,
                aiStatus: 'ACTIVE' // Auto-enable AI follow up by default
            }
        });

        // 4. AUTO-ENROLLMENT (If sequenceId is passed from n8n)
        if (data.sequenceId) {
            const seq = await prisma.sequence.findUnique({ where: { id: data.sequenceId } });
            if (seq) {
                await prisma.leadSequence.create({
                    data: {
                        leadId: lead.id,
                        sequenceId: seq.id,
                        status: 'ACTIVE'
                    }
                });
                console.log(`[Data Influx] Lead ${lead.id} auto-enrolled in sequence: ${seq.name}`);
            }
        }

        await writeAuditLog({
            action: 'WEBHOOK_N8N',
            ip: getClientIp(request),
            details: `Lead created: ${lead.name} (${lead.id}) score=${qualification.score}`,
        });

        return new Response(JSON.stringify({
            success: true,
            message: "Lead qualified and stored.",
            id: lead.id,
            score: qualification.score
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("Critical Webhook Failure:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}
