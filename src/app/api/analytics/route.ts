import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * GET /api/analytics
 * Returns email and sequence performance metrics.
 *
 * Query params:
 *   days=7|14|30  (default: 7)
 */
export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
        totalLeads,
        newLeadsInPeriod,
        qualifiedLeads,
        // Email metrics — outbound only
        totalSent,
        totalOpened,
        totalClicked,
        totalReplied,
        totalBounced,
        totalSpam,
        // Sequence metrics
        activeSequences,
        activeEnrollments,
        completedEnrollments,
        // Lead score distribution
        leadScores,
        // Daily sends for chart
        dailySends,
    ] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { createdAt: { gte: since } } }),
        prisma.lead.count({ where: { status: 'Qualified' } }),

        prisma.interaction.count({
            where: { sender: { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] }, createdAt: { gte: since } }
        }),
        prisma.interaction.count({
            where: { sender: { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] }, readAt: { not: null }, createdAt: { gte: since } }
        }),
        prisma.interaction.count({
            where: { sender: { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] }, clickedAt: { not: null }, createdAt: { gte: since } }
        }),
        prisma.interaction.count({
            where: { sender: { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] }, repliedAt: { not: null }, createdAt: { gte: since } }
        }),
        prisma.interaction.count({
            where: { bouncedAt: { not: null }, createdAt: { gte: since } }
        }),
        prisma.interaction.count({
            where: { spamAt: { not: null }, createdAt: { gte: since } }
        }),

        prisma.sequence.count({ where: { isActive: true } }),
        prisma.leadSequence.count({ where: { status: 'ACTIVE' } }),
        prisma.leadSequence.count({ where: { status: 'COMPLETED' } }),

        prisma.lead.groupBy({
            by: ['score'],
            _count: { score: true },
            where: { score: { not: null } },
        }),

        prisma.interaction.groupBy({
            by: ['createdAt'],
            _count: { id: true },
            where: {
                sender: { in: ['HUMAN', 'AI', 'AI_AUTOMATION'] },
                createdAt: { gte: since }
            },
        }),
    ]);

    // Compute rates (avoid division by zero)
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
    const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;

    // Group daily sends by date string
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
        dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const row of dailySends) {
        const dateKey = new Date(row.createdAt).toISOString().slice(0, 10);
        if (dateKey in dailyMap) dailyMap[dateKey] += row._count.id;
    }
    const dailyChart = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Lead score buckets
    const scoreBuckets = { cold: 0, warm: 0, hot: 0 };
    for (const row of leadScores) {
        const s = row.score ?? 0;
        if (s < 40) scoreBuckets.cold += row._count.score;
        else if (s < 70) scoreBuckets.warm += row._count.score;
        else scoreBuckets.hot += row._count.score;
    }

    return NextResponse.json({
        period: { days, since },
        leads: {
            total: totalLeads,
            newInPeriod: newLeadsInPeriod,
            qualified: qualifiedLeads,
            qualificationRate: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0,
            scoreBuckets,
        },
        email: {
            sent: totalSent,
            opened: totalOpened,
            clicked: totalClicked,
            replied: totalReplied,
            bounced: totalBounced,
            spam: totalSpam,
            openRate,
            clickRate,
            replyRate,
            bounceRate,
        },
        sequences: {
            active: activeSequences,
            activeEnrollments,
            completedEnrollments,
        },
        chart: {
            dailySends: dailyChart,
        },
    });
}
