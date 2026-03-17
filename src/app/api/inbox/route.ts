import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const leads = await prisma.lead.findMany({
            where: {
                interactions: { some: {} }
            },
            include: {
                interactions: { orderBy: { createdAt: 'asc' } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const mappedLeads = leads.map(l => ({
            id: l.id,
            name: l.name,
            company: l.company || 'Unknown',
            email: l.email,
            aiStatus: l.aiStatus,
            interactions: l.interactions.map(int => ({
                id: int.id,
                channel: int.channel,
                sender: int.sender,
                content: int.content,
                createdAt: new Date(int.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }))
        }));

        return NextResponse.json(mappedLeads);
    } catch (error) {
        console.error('Failed to load inbox', error);
        return NextResponse.json({ error: 'Failed to load inbox data' }, { status: 500 });
    }
}
