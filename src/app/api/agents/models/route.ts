import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const ollamaHost = process.env.OLLAMA_URL || 'http://localhost:11434';
        const res = await fetch(`${ollamaHost}/api/tags`);

        if (!res.ok) {
            throw new Error('Failed to fetch from Ollama');
        }

        const data = await res.json();
        const models = data.models.map((m: any) => ({
            name: m.name,
            size: (m.size / 1024 / 1024 / 1024).toFixed(1) + 'GB',
            family: m.details?.family || 'unknown'
        }));

        return NextResponse.json({ models });
    } catch (error) {
        console.error("Failed to list Ollama models:", error);
        // Fallback or empty list
        return NextResponse.json({ error: "Ollama instance disconnected or unavailable", models: [] }, { status: 503 });
    }
}
