import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const integrations = await prisma.integration.findMany();
        return NextResponse.json(integrations);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const data = await request.json();

        // Upsert based on provider
        const integration = await prisma.integration.findFirst({
            where: { provider: data.provider }
        });

        if (integration) {
            const updated = await prisma.integration.update({
                where: { id: integration.id },
                data: {
                    isActive: data.isActive !== undefined ? data.isActive : integration.isActive,
                    accountId: data.accountId || integration.accountId,
                    metadata: data.metadata || integration.metadata
                }
            });
            return NextResponse.json(updated);
        } else {
            const created = await prisma.integration.create({
                data: {
                    provider: data.provider,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    accountId: data.accountId,
                    metadata: data.metadata
                }
            });
            return NextResponse.json(created);
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
    }
}

/**
 * PATCH /api/integrations
 * Merges delivery settings into SMTP metadata without overwriting encryptedPassword.
 * Body: { provider: 'smtp', settings: { dailyLimit, delayMin, delayMax, warmingActive } }
 */
export async function PATCH(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { provider, settings } = await request.json();
        if (!provider || !settings) {
            return NextResponse.json({ error: 'provider and settings are required' }, { status: 400 });
        }

        const integration = await prisma.integration.findFirst({ where: { provider } });
        if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });

        const existingMeta = integration.metadata ? JSON.parse(integration.metadata) : {};
        const merged = { ...existingMeta, ...settings };

        await prisma.integration.update({
            where: { id: integration.id },
            data: { metadata: JSON.stringify(merged) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
