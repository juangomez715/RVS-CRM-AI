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

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const sequences = await prisma.sequence.findMany({
            include: {
                _count: { select: { steps: true, leads: true } },
                steps: { orderBy: { dayOffset: 'asc' } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(sequences);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to load sequences' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, goal } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const sequence = await prisma.sequence.create({
            data: { name: name.trim(), goal, isActive: true },
            include: { steps: true, _count: { select: { steps: true, leads: true } } }
        });

        await writeAuditLog({
            action: 'SEQUENCE_CREATED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Sequence: ${sequence.name} (${sequence.id})`,
        });

        return NextResponse.json(sequence);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
    }
}
