import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/crypto';
import { LinkedInIntegration } from '@/lib/linkedin';
import { writeAuditLog, getClientIp } from '@/lib/audit';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

/**
 * POST /api/integrations/linkedin
 * Save and verify a LinkedIn li_at session cookie.
 * Body: { liAt: string }
 */
export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { liAt } = await request.json();
    if (!liAt?.trim()) {
        return NextResponse.json({ error: 'li_at cookie value is required' }, { status: 400 });
    }

    // Verify the cookie works before saving
    const li = new LinkedInIntegration(liAt.trim());
    const valid = await li.checkSession();

    if (!valid) {
        return NextResponse.json({
            error: 'Session invalid. Make sure you copied the li_at cookie correctly and you are logged in to LinkedIn.'
        }, { status: 401 });
    }

    // Encrypt before storing
    const encryptedToken = encrypt(liAt.trim());

    const existing = await prisma.integration.findFirst({ where: { provider: 'linkedin' } });

    if (existing) {
        await prisma.integration.update({
            where: { id: existing.id },
            data: { accessToken: encryptedToken, isActive: true, updatedAt: new Date() }
        });
    } else {
        await prisma.integration.create({
            data: { provider: 'linkedin', accessToken: encryptedToken, isActive: true }
        });
    }

    await writeAuditLog({
        action: 'INTEGRATION_SAVED',
        userId: session.userId,
        userEmail: session.name,
        ip: getClientIp(request),
        details: 'LinkedIn li_at session saved and verified.',
    });

    return NextResponse.json({ success: true, message: 'LinkedIn session verified and saved.' });
}

/**
 * GET /api/integrations/linkedin
 * Check if the saved LinkedIn session is still active.
 */
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const li = await LinkedInIntegration.init();
        const active = await li.checkSession();
        return NextResponse.json({ connected: active });
    } catch {
        return NextResponse.json({ connected: false });
    }
}
