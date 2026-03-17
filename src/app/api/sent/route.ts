import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const skip = parseInt(searchParams.get('skip') || '0');

    const OUTBOUND = { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] };

    const [messages, total, opened, clicked, replied, bounced, spam] = await Promise.all([
        prisma.interaction.findMany({
            where: { sender: OUTBOUND, channel: 'Email' },
            include: { lead: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip,
        }),
        prisma.interaction.count({ where: { sender: OUTBOUND, channel: 'Email' } }),
        prisma.interaction.count({ where: { sender: OUTBOUND, readAt: { not: null } } }),
        prisma.interaction.count({ where: { sender: OUTBOUND, clickedAt: { not: null } } }),
        prisma.interaction.count({ where: { sender: OUTBOUND, repliedAt: { not: null } } }),
        prisma.interaction.count({ where: { bouncedAt: { not: null } } }),
        prisma.interaction.count({ where: { spamAt: { not: null } } }),
    ]);

    const rate = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    const formatted = messages.map(m => {
        // Content is stored as "Sub: {subject}\n\n{body}" or "Subject: {subject}\n\n{body}"
        const subjectMatch = m.content.match(/^Sub(?:ject)?:\s*([^\n]+)/);
        const subject = subjectMatch?.[1]?.trim() || '(No subject)';
        const body = m.content.replace(/^Sub(?:ject)?:\s*[^\n]+\n\n/, '');

        return {
            id: m.id,
            leadName: m.lead.name,
            to: m.lead.email || '—',
            subject,
            content: body,
            sentAt: m.createdAt,
            readAt: m.readAt,
            clickedAt: m.clickedAt,
            repliedAt: m.repliedAt,
            bouncedAt: m.bouncedAt,
            spamAt: m.spamAt,
            sender: m.sender,
        };
    });

    return NextResponse.json({
        stats: {
            total,
            openRate: rate(opened),
            clickRate: rate(clicked),
            replyRate: rate(replied),
            bounceRate: rate(bounced),
            spamRate: rate(spam),
        },
        messages: formatted,
        pagination: { limit, skip, total },
    });
}
