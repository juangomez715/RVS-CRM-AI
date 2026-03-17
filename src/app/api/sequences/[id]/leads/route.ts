import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * GET /api/sequences/[id]/leads
 * Returns all leads enrolled in a sequence with their progress.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sequenceId } = await params;

    const sequence = await prisma.sequence.findUnique({
        where: { id: sequenceId },
        include: { steps: { orderBy: { dayOffset: 'asc' } } }
    });
    if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

    const enrollments = await prisma.leadSequence.findMany({
        where: { sequenceId },
        include: { lead: true },
        orderBy: { enrolledAt: 'desc' },
    });

    const totalSteps = sequence.steps.length;

    const data = enrollments.map(e => ({
        enrollmentId: e.id,
        status: e.status,
        currentStep: e.currentStep,
        totalSteps,
        progress: totalSteps > 0 ? Math.round((e.currentStep / totalSteps) * 100) : 0,
        enrolledAt: e.enrolledAt,
        lastExecutedAt: e.lastExecutedAt,
        nextStep: sequence.steps[e.currentStep] ?? null,
        lead: {
            id: e.lead.id,
            name: e.lead.name,
            email: e.lead.email,
            company: e.lead.company,
            score: e.lead.score,
            aiStatus: e.lead.aiStatus,
        }
    }));

    return NextResponse.json({ sequenceId, sequenceName: sequence.name, total: data.length, enrollments: data });
}
