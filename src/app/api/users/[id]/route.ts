import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'rvs-crm-secret-key-change-in-production-2026'
);

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    if (!token) return false;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.role === 'ADMIN';
    } catch {
        return false;
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    try {
        const id = (await params).id;
        const { name, email, role, password } = await request.json();

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role) updateData.role = role;

        // Admin force resets password
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, email: true, role: true }
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    try {
        const id = (await params).id;

        // Optional security measure: prevent self-deletion or deleting the last admin
        const count = await prisma.user.count({ where: { role: 'ADMIN' } });
        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (count === 1 && targetUser?.role === 'ADMIN') {
            return NextResponse.json({ error: 'Cannot delete the last remaining ADMIN account.' }, { status: 400 });
        }

        await prisma.user.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
