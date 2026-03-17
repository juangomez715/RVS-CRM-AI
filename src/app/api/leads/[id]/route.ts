import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
            interactions: { orderBy: { createdAt: 'desc' } },
            sequences: { include: { sequence: true } }
        }
    });

    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    return Response.json(lead);
}

const ALLOWED_FIELDS = ['name', 'company', 'email', 'phone', 'status', 'aiStatus', 'score', 'aiNotes', 'source'] as const;
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'];
const VALID_AI_STATUSES = ['ACTIVE', 'PAUSED'];

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
        if (key in body) updates[key] = body[key];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
        return Response.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    if (updates.aiStatus && !VALID_AI_STATUSES.includes(updates.aiStatus)) {
        return Response.json({ error: `Invalid aiStatus. Must be ACTIVE or PAUSED` }, { status: 400 });
    }

    try {
        const lead = await prisma.lead.update({ where: { id }, data: updates });

        await writeAuditLog({
            action: 'LEAD_UPDATED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Lead: ${lead.name} (${id}) — fields: ${Object.keys(updates).join(', ')}`,
        });

        return Response.json(lead);
    } catch (error: any) {
        if (error.code === 'P2025') return Response.json({ error: 'Lead not found' }, { status: 404 });
        console.error('[Leads] PATCH error:', error);
        return Response.json({ error: 'Failed to update lead' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    try {
        const lead = await prisma.lead.delete({ where: { id } });

        await writeAuditLog({
            action: 'LEAD_DELETED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `Lead: ${lead.name} (${id})`,
        });

        return Response.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') return Response.json({ error: 'Lead not found' }, { status: 404 });
        console.error('[Leads] DELETE error:', error);
        return Response.json({ error: 'Failed to delete lead' }, { status: 500 });
    }
}
