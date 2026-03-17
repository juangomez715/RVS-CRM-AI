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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { name, goal, isActive, steps } = await request.json();

        await prisma.sequence.update({
            where: { id },
            data: { name, goal, isActive }
        });

        if (steps && Array.isArray(steps)) {
            await prisma.sequenceStep.deleteMany({ where: { sequenceId: id } });

            if (steps.length > 0) {
                await prisma.sequenceStep.createMany({
                    data: steps.map((s: any) => ({
                        sequenceId: id,
                        dayOffset: Number(s.dayOffset),
                        subject: s.subject,
                        content: s.content || '',
                        isAIGenerated: s.isAIGenerated || false
                    }))
                });
            }
        }

        await writeAuditLog({
            action: 'SEQUENCE_UPDATED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Sequence: ${id}${steps ? ` | steps updated: ${steps.length}` : ''}`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Sequence Update Error:', error);
        return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { id } = await params;
        await prisma.sequence.delete({ where: { id } });

        await writeAuditLog({
            action: 'SEQUENCE_DELETED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Sequence: ${id}`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
    }
}
