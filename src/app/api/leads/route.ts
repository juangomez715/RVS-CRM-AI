import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const source = searchParams.get('source') || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50')));
        const skip = (page - 1) * limit;

        const where = {
            AND: [
                search ? {
                    OR: [
                        { name: { contains: search } },
                        { email: { contains: search } },
                        { company: { contains: search } },
                    ]
                } : {},
                status ? { status } : {},
                source ? { source } : {},
            ]
        };

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: { select: { interactions: true, sequences: true } }
                }
            }),
            prisma.lead.count({ where })
        ]);

        return Response.json({
            leads,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('[Leads] GET error:', error);
        return Response.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, company, email, phone, source, status } = await request.json();

        if (!name?.trim()) {
            return Response.json({ error: 'Name is required' }, { status: 400 });
        }

        const lead = await prisma.lead.create({
            data: {
                name: name.trim(),
                company: company?.trim() || null,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                source: source || 'manual',
                status: status || 'New',
            }
        });

        await writeAuditLog({
            action: 'LEAD_CREATED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Lead: ${lead.name} (${lead.id})`,
        });

        return Response.json(lead, { status: 201 });
    } catch (error) {
        console.error('[Leads] POST error:', error);
        return Response.json({ error: 'Failed to create lead' }, { status: 500 });
    }
}
