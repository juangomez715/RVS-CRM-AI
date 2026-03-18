import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const agents = await prisma.agent.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(agents);
    } catch (error) {
        return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });

        await prisma.agent.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // If 'id' is sent, we update the existing agent
        if (data.id) {
            const updated = await prisma.agent.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    tone: data.tone,
                    systemPrompt: data.systemPrompt,
                    llmModel: data.llmModel,
                    knowledgeBase: data.knowledgeBase,
                    isActive: data.isActive
                }
            });
            return NextResponse.json(updated);
        } else {
            // Otherwise create a new agent
            const newAgent = await prisma.agent.create({
                data: {
                    name: data.name || "New Agent",
                    tone: data.tone || "Neutral",
                    systemPrompt: data.systemPrompt || "You are a helpful assistant.",
                    llmModel: data.llmModel || "qwen3.5:0.8b",
                    knowledgeBase: data.knowledgeBase || "",
                    isActive: true
                }
            });
            return NextResponse.json(newAgent);
        }
    } catch (error) {
        console.error("Agent Save Error:", error);
        return NextResponse.json({ error: "Failed to save agent profile" }, { status: 500 });
    }
}
