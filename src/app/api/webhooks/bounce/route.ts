import prisma from '@/lib/db';
import { writeAuditLog, getClientIp } from '@/lib/audit';

/**
 * POST /api/webhooks/bounce
 * Receives bounce and spam events from SMTP providers (Postmark, SendGrid, Mailgun, etc.)
 *
 * Expected payload:
 * {
 *   trackingId: string,          // The trackingId of the Interaction
 *   event: 'bounce' | 'spam',    // Event type
 *   reason?: string              // Optional bounce reason
 * }
 *
 * Authenticate by setting the header: x-webhook-secret: <BOUNCE_WEBHOOK_SECRET>
 */

function verifyWebhookSecret(request: Request): boolean {
    const secret = process.env.BOUNCE_WEBHOOK_SECRET;
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
        const { trackingId, event, reason } = await request.json();

        if (!trackingId || !event) {
            return new Response(JSON.stringify({ error: 'trackingId and event are required' }), { status: 400 });
        }
        if (!['bounce', 'spam'].includes(event)) {
            return new Response(JSON.stringify({ error: 'event must be bounce or spam' }), { status: 400 });
        }

        const interaction = await prisma.interaction.findUnique({ where: { trackingId } });
        if (!interaction) {
            return new Response(JSON.stringify({ error: 'Interaction not found' }), { status: 404 });
        }

        const now = new Date();

        await prisma.interaction.update({
            where: { trackingId },
            data: event === 'bounce'
                ? { bouncedAt: now }
                : { spamAt: now },
        });

        // Update lead score down on bounce/spam
        await prisma.lead.update({
            where: { id: interaction.leadId },
            data: {
                score: { decrement: event === 'spam' ? 20 : 10 },
            },
        });

        await writeAuditLog({
            action: event === 'bounce' ? 'EMAIL_BOUNCED' : 'EMAIL_SPAM',
            ip: getClientIp(request),
            details: `trackingId=${trackingId} leadId=${interaction.leadId}${reason ? ` reason=${reason}` : ''}`,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error('[Bounce Webhook] Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to process event' }), { status: 500 });
    }
}
