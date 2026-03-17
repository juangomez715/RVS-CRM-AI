import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { signToken } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/rateLimit';
import { writeAuditLog, getClientIp } from '@/lib/audit';

export async function POST(request: Request) {
    try {
        // Layer 2: Rate Limiting
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const rateCheck = await checkRateLimit(ip);

        if (!rateCheck.allowed) {
            const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
            return new Response(
                JSON.stringify({ error: `Too many login attempts. Try again in ${retryMinutes} minutes.` }),
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
            );
        }

        const { email, password } = await request.json();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            await recordFailedAttempt(ip);
            await writeAuditLog({ action: 'LOGIN_FAILED', ip, userEmail: email, details: 'User not found' });
            return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            await recordFailedAttempt(ip);
            await writeAuditLog({ action: 'LOGIN_FAILED', ip, userId: user.id, userEmail: email, details: 'Wrong password' });
            return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
        }

        // Layer 1: Sign a JWT instead of plain JSON
        await clearRateLimit(ip);
        await writeAuditLog({ action: 'LOGIN_SUCCESS', ip, userId: user.id, userEmail: user.email });
        const token = await signToken({ userId: user.id, role: user.role, name: user.name });

        const cookieStore = await cookies();
        cookieStore.set('rvs_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });

        return new Response(JSON.stringify({ success: true, role: user.role }), { status: 200 });

    } catch (error) {
        console.error("Login Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
