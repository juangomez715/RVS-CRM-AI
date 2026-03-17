import prisma from '@/lib/db';
import { sendEmail } from '@/lib/mailer';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { leadId, subject = 'Conversation Update', content } = await request.json();

        if (!leadId || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        if (!lead || !lead.email) {
            return NextResponse.json({ error: 'Lead email is missing or lead not found' }, { status: 404 });
        }

        const sent = await sendEmail(lead.email, subject, content);

        if (!sent.success) {
            return NextResponse.json({ error: 'SMTP Transport failed' }, { status: 500 });
        }

        const newInteraction = await prisma.interaction.create({
            data: {
                leadId,
                channel: 'Email',
                sender: 'HUMAN',
                content: `Sub: ${subject}\n\n${content}`,
                repliedAt: new Date()
            }
        });

        await writeAuditLog({
            action: 'EMAIL_SENT',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `To: ${lead.email} | Lead: ${leadId} | Subject: ${subject}`,
        });

        return NextResponse.json({
            id: newInteraction.id,
            channel: newInteraction.channel,
            sender: newInteraction.sender,
            content: newInteraction.content,
            createdAt: new Date(newInteraction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

    } catch (error: any) {
        console.error('Manual Send Error:', error.message);
        return NextResponse.json({ error: error.message || 'Failed to transmit message' }, { status: 500 });
    }
}
