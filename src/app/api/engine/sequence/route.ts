import prisma from '@/lib/db';
import { generateAIResponse } from '@/lib/ai';
import { sendEmailWithShield } from '@/lib/mailer';
import { NextResponse } from 'next/server';

/**
 * AI ENGINE: SEQUENCE RUNNER
 * Triggered by cron job, Vercel cron, or n8n HTTP node.
 *
 * Fixes vs original:
 * - Atomic step claiming: currentStep is incremented inside a transaction BEFORE
 *   sending the email, preventing duplicate sends if the cron fires twice.
 * - All due steps per lead are executed in order (not just the first one).
 * - AI JSON parsing uses regex extraction before JSON.parse to handle extra text.
 * - Tag replacement applies to both manual and AI-generated steps.
 */

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'rvs-cron-secret'}`) {
        return NextResponse.json({ error: 'Unauthorized CRON ping' }, { status: 401 });
    }

    try {
        console.log('[Engine Cron] Initiating Sequence Run...');

        const activeSequences = await prisma.leadSequence.findMany({
            where: { status: 'ACTIVE' },
            include: {
                lead: true,
                sequence: {
                    include: { steps: { orderBy: { dayOffset: 'asc' } } }
                }
            }
        });

        const results: any[] = [];

        for (const ls of activeSequences) {
            if (!ls.lead.email) {
                results.push({ leadId: ls.lead.id, skipped: true, reason: 'No email address' });
                continue;
            }

            const daysSinceEnroll = Math.floor(
                (Date.now() - new Date(ls.enrolledAt).getTime()) / (1000 * 60 * 60 * 24)
            );

            // All steps that are due AND haven't been executed yet, in order
            const pendingSteps = ls.sequence.steps.filter((s, index) =>
                s.dayOffset <= daysSinceEnroll && index >= ls.currentStep
            );

            for (const step of pendingSteps) {
                const stepIndex = ls.sequence.steps.findIndex(s => s.id === step.id);

                // --- ATOMIC CLAIM ---
                // Increment currentStep inside a transaction BEFORE sending the email.
                // If the cron fires again concurrently, the second run will find
                // currentStep already incremented and skip this step — no duplicate send.
                let interaction;
                try {
                    interaction = await prisma.$transaction(async (tx) => {
                        // Re-read inside transaction to get the latest currentStep
                        const fresh = await tx.leadSequence.findUnique({ where: { id: ls.id } });
                        if (!fresh || fresh.currentStep !== ls.currentStep + (stepIndex - ls.currentStep)) {
                            throw new Error('Step already claimed by another process');
                        }

                        const created = await tx.interaction.create({
                            data: {
                                leadId: ls.lead.id,
                                channel: 'Email',
                                sender: 'AI_AUTOMATION',
                                content: `[PENDING SEND] Subject: ${step.subject}`,
                            }
                        });

                        await tx.leadSequence.update({
                            where: { id: ls.id },
                            data: {
                                currentStep: stepIndex + 1,
                                lastExecutedAt: new Date(),
                                // Mark COMPLETED if this was the last step
                                status: stepIndex + 1 >= ls.sequence.steps.length ? 'COMPLETED' : 'ACTIVE',
                            }
                        });

                        return created;
                    });
                } catch (claimError: any) {
                    console.warn(`[Engine] Step claim skipped for lead ${ls.lead.id}:`, claimError.message);
                    break; // Stop processing steps for this lead in this run
                }

                // --- BUILD EMAIL CONTENT ---
                let finalSubject = step.subject;
                let finalBody = step.content;

                // Apply all template variable tokens for both manual and AI steps
                const firstName = ls.lead.name?.split(' ')[0] || '';
                const replaceTags = (str: string) =>
                    str
                        .replace(/\{\{first_name\}\}/g, firstName)
                        .replace(/\{\{full_name\}\}/g, ls.lead.name || '')
                        .replace(/\{\{name\}\}/g, ls.lead.name || '')       // legacy alias
                        .replace(/\{\{company\}\}/g, ls.lead.company || '')
                        .replace(/\{\{email\}\}/g, ls.lead.email || '')
                        .replace(/\{\{phone\}\}/g, ls.lead.phone || '')
                        .replace(/\{\{source\}\}/g, ls.lead.source || '')
                        .replace(/\{\{score\}\}/g, String(ls.lead.score ?? ''))
                        .replace(/\{\{status\}\}/g, ls.lead.aiStatus || ls.lead.status || '');

                finalSubject = replaceTags(finalSubject);
                finalBody = replaceTags(finalBody);

                if (step.isAIGenerated) {
                    const activeAgent = await prisma.agent.findFirst({ where: { isActive: true } });
                    if (activeAgent) {
                        const instruction = `${activeAgent.systemPrompt}
[Knowledge Base]: ${activeAgent.knowledgeBase || 'None'}
[Lead]: Name: ${ls.lead.name}, Company: ${ls.lead.company || 'Unknown'}, Notes: ${ls.lead.aiNotes || ''}

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
                            } catch {
                                console.warn('[Engine] AI draft JSON parse failed, using template content.');
                            }
                        }
                    }
                }

                // --- SEND EMAIL ---
                try {
                    await sendEmailWithShield(ls.lead.email, finalSubject, finalBody, interaction.trackingId ?? undefined);

                    // Update interaction with final content after successful send
                    await prisma.interaction.update({
                        where: { id: interaction.id },
                        data: { content: `Subject: ${finalSubject}\n\n${finalBody}` }
                    });

                    results.push({ leadId: ls.lead.id, stepId: step.id, success: true });
                } catch (sendError: any) {
                    // Step is already claimed (currentStep incremented) — log failure but don't retry
                    // to avoid double-sending. Manual retry can be done from the UI.
                    console.error(`[Engine] Send failed for lead ${ls.lead.id}, step ${step.id}:`, sendError.message);
                    await prisma.interaction.update({
                        where: { id: interaction.id },
                        data: { content: `[SEND FAILED] ${sendError.message}\n\nSubject: ${finalSubject}\n\n${finalBody}` }
                    });
                    results.push({ leadId: ls.lead.id, stepId: step.id, success: false, error: sendError.message });
                }

                // Re-sync currentStep for next iteration in this loop
                ls.currentStep = stepIndex + 1;
            }
        }

        return NextResponse.json({ success: true, executed: results.length, results });

    } catch (error) {
        console.error('[Engine Cron] Fatal error:', error);
        return NextResponse.json({ error: 'Failed Engine Execution' }, { status: 500 });
    }
}
