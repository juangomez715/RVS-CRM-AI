import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const data = await request.json();
        const { host, port, secure, username, password } = data;

        if (!host || !port || !username || !password) {
            return NextResponse.json({ error: 'Missing required SMTP fields' }, { status: 400 });
        }

        const portNum = Number(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host,
            port: portNum,
            secure: Boolean(secure),
            auth: { user: username, pass: password },
        });

        await transporter.verify();

        // Encrypt password before persisting
        const encryptedPassword = encrypt(password);

        const metadata = {
            host,
            port: portNum,
            secure: Boolean(secure),
            username,
            encryptedPassword,      // stored encrypted
            dailyLimit: 150,
            delayMin: 3,
            delayMax: 7,
            warmingActive: true,
        };

        const existing = await prisma.integration.findFirst({ where: { provider: 'smtp' } });

        if (existing) {
            await prisma.integration.update({
                where: { id: existing.id },
                data: { isActive: true, accountId: username, metadata: JSON.stringify(metadata) }
            });
        } else {
            await prisma.integration.create({
                data: { provider: 'smtp', isActive: true, accountId: username, metadata: JSON.stringify(metadata) }
            });
        }

        await writeAuditLog({
            action: 'INTEGRATION_SAVED',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `SMTP configured: ${username}@${host}:${portNum}`,
        });

        return NextResponse.json({ success: true, message: 'SMTP configuration verified and saved.' });

    } catch (error: any) {
        console.error('SMTP Verification Error:', error.message);
        return NextResponse.json({
            error: 'Authentication failed. Check your credentials, App Passwords, or Host settings.'
        }, { status: 401 });
    }
}
