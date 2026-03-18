import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

export async function GET() {
    try {
        const [ollamaRec, openrouterKey] = await Promise.all([
            prisma.integration.findFirst({ where: { provider: 'ollama', isActive: true } }),
            Promise.resolve(process.env.OPENROUTER_API_KEY || ''),
        ]);

        const ollamaEnabled = !!ollamaRec;
        const openrouterConfigured = !!openrouterKey;
        const provider = ollamaEnabled ? 'ollama' : openrouterConfigured ? 'openrouter' : 'none';

        return NextResponse.json({
            provider,
            ollamaEnabled,
            openrouterConfigured,
            model: ollamaEnabled ? (ollamaRec?.metadata ? JSON.parse(ollamaRec.metadata).model : 'local') : OPENROUTER_MODEL,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to load AI status' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { ollamaEnabled } = await request.json();

        if (ollamaEnabled) {
            // Enable Ollama integration record
            const existing = await prisma.integration.findFirst({ where: { provider: 'ollama' } });
            if (existing) {
                await prisma.integration.update({ where: { id: existing.id }, data: { isActive: true } });
            } else {
                await prisma.integration.create({
                    data: { provider: 'ollama', isActive: true }
                });
            }
        } else {
            // Disable Ollama
            await prisma.integration.updateMany({
                where: { provider: 'ollama' },
                data: { isActive: false }
            });
        }

        const openrouterConfigured = !!process.env.OPENROUTER_API_KEY;
        const provider = ollamaEnabled ? 'ollama' : openrouterConfigured ? 'openrouter' : 'none';

        return NextResponse.json({ ollamaEnabled, openrouterConfigured, provider });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update AI status' }, { status: 500 });
    }
}
