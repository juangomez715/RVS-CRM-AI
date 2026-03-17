import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;

    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const skip = parseInt(searchParams.get('skip') || '0');
    const action = searchParams.get('action') || '';

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where: action ? { action } : {},
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip,
        }),
        prisma.auditLog.count({ where: action ? { action } : {} }),
    ]);

    return Response.json({ logs, total, limit, skip });
}
