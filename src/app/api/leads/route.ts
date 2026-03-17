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

        const leads = await prisma.lead.findMany({
            where: {
                AND: [
                    search ? {
                        OR: [
                            { name: { contains: search } },
                            { email: { contains: search } },
                            { company: { contains: search } },
                        ]
                    } : {},
                    status ? { status } : {},
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { interactions: true, sequences: true } }
            }
        });

        return Response.json(leads);
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
