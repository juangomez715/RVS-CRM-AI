import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'rvs-crm-secret-key-change-in-production-2026'
);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rvs_session')?.value;

        if (!token) {
            return NextResponse.json({ role: null, authenticated: false }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, JWT_SECRET);

        return NextResponse.json({
            role: payload.role as string,
            userId: payload.userId as string,
            name: payload.name as string,
            authenticated: true
        });
    } catch (error) {
        return NextResponse.json({ role: null, authenticated: false }, { status: 401 });
    }
}
