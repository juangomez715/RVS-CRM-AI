import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

/**
 * POST /api/sequences/[id]/enroll
 * Enroll one or more leads into a sequence manually.
 *
 * Body: { leadIds: string[] }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sequenceId } = await params;
    const { leadIds } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return NextResponse.json({ error: 'leadIds must be a non-empty array' }, { status: 400 });
    }

    const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
    if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    if (!sequence.isActive) return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 });

    const enrolled: string[] = [];
    const skipped: string[] = [];

    for (const leadId of leadIds) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) { skipped.push(leadId); continue; }

        // Skip if already enrolled and active
        const existing = await prisma.leadSequence.findFirst({
            where: { leadId, sequenceId, status: 'ACTIVE' }
        });
        if (existing) { skipped.push(leadId); continue; }

        await prisma.leadSequence.create({
            data: { leadId, sequenceId, status: 'ACTIVE', currentStep: 0 }
        });
        enrolled.push(leadId);
    }

    await writeAuditLog({
        action: 'SEQUENCE_UPDATED',
        userId: session.userId,
        userEmail: session.name,
        ip: getClientIp(request),
        details: `Enrolled ${enrolled.length} lead(s) into sequence ${sequenceId}. Skipped: ${skipped.length}`,
    });

    return NextResponse.json({ enrolled: enrolled.length, skipped: skipped.length, enrolledIds: enrolled });
}

/**
 * DELETE /api/sequences/[id]/enroll
 * Unenroll (pause) a lead from a sequence.
 *
 * Body: { leadId: string }
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sequenceId } = await params;
    const { leadId } = await request.json();

    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

    const updated = await prisma.leadSequence.updateMany({
        where: { leadId, sequenceId, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
    });

    if (updated.count === 0) {
        return NextResponse.json({ error: 'No active enrollment found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
