import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { generateAIResponse } from '@/lib/ai';
import { sendEmail } from '@/lib/mailer';

/**
 * POST /api/sequences/[id]/test
 * Sends a preview of a specific step to a test email address.
 *
 * Body: {
 *   stepIndex: number,   // Which step to preview (0-based)
 *   testEmail: string    // Where to send the preview
 * }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sequenceId } = await params;
    const { stepIndex = 0, testEmail } = await request.json();

    if (!testEmail) return NextResponse.json({ error: 'testEmail is required' }, { status: 400 });

    const sequence = await prisma.sequence.findUnique({
        where: { id: sequenceId },
        include: { steps: { orderBy: { dayOffset: 'asc' } } }
    });
    if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    if (sequence.steps.length === 0) return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 });

    const step = sequence.steps[stepIndex];
    if (!step) return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 404 });

    let finalSubject = step.subject.replace(/\{\{name\}\}/g, 'Test Lead').replace(/\{\{company\}\}/g, 'Test Co.');
    let finalBody = step.content.replace(/\{\{name\}\}/g, 'Test Lead').replace(/\{\{company\}\}/g, 'Test Co.');

    // If AI-generated, rewrite with the active agent
    if (step.isAIGenerated) {
        const activeAgent = await prisma.agent.findFirst({ where: { isActive: true } });
        if (activeAgent) {
            const instruction = `${activeAgent.systemPrompt}
[Knowledge Base]: ${activeAgent.knowledgeBase || 'None'}
[Lead]: Name: Test Lead, Company: Test Co.

Task: Rewrite this email template naturally.
Template Subject: ${finalSubject}
Template Body: ${finalBody}

Respond ONLY in valid JSON: {"subject": "...", "body": "..."}`;

            const aiRaw = await generateAIResponse(instruction, activeAgent.llmModel);
            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const aiDraft = JSON.parse(jsonMatch[0]);
                    if (aiDraft.subject) finalSubject = aiDraft.subject;
                    if (aiDraft.body) finalBody = aiDraft.body;
                } catch { /* keep template content */ }
            }
        }
    }

    // Wrap body in a preview banner
    const previewHtml = `
        <div style="background:#fff3cd;border:1px solid #ffc107;padding:10px 16px;margin-bottom:16px;font-family:sans-serif;font-size:12px;color:#856404;border-radius:4px;">
            <strong>[TEST PREVIEW]</strong> — Sequence: <em>${sequence.name}</em> · Step ${stepIndex + 1} of ${sequence.steps.length} · Day ${step.dayOffset}
        </div>
        ${finalBody}
    `;

    await sendEmail(testEmail, `[TEST] ${finalSubject}`, previewHtml);

    return NextResponse.json({
        success: true,
        sentTo: testEmail,
        subject: finalSubject,
        stepIndex,
        dayOffset: step.dayOffset,
        isAIGenerated: step.isAIGenerated,
    });
}
