/**
 * N8N Multi-Action Webhook
 * POST /api/webhooks/n8n/action?type=<action>
 *
 * Supported actions:
 *   - create_lead      : Create a new lead (default, same as /api/webhooks/n8n)
 *   - update_status    : Update lead status by email
 *   - qualify          : Re-run AI qualification on an existing lead
 *   - enroll_sequence  : Enroll a lead in a sequence by email + sequenceId
 *   - bulk_create      : Create multiple leads at once (array payload)
 *   - tag_source       : Update the source tag of an existing lead
 */

import prisma from '@/lib/db';
import { qualifyLead } from '@/lib/ai';
import { writeAuditLog, getClientIp } from '@/lib/audit';

const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Meeting', 'Closed'];

function verifySecret(request: Request): boolean {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    const incoming = request.headers.get('x-webhook-secret');
    if (!secret || !incoming) return false;
    const enc = new TextEncoder();
    const a = enc.encode(incoming);
    const b = enc.encode(secret);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

function jsonResponse(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function POST(request: Request) {
    if (!verifySecret(request)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('type') || 'create_lead';

    try {
        const data = await request.json();
        const ip = getClientIp(request);

        switch (action) {

            // ── CREATE LEAD ────────────────────────────────────────────────────
            case 'create_lead': {
                if (!data.email && !data.name) {
                    return jsonResponse({ error: 'name or email required' }, 400);
                }

                // Dedup by email
                if (data.email) {
                    const existing = await prisma.lead.findFirst({ where: { email: data.email } });
                    if (existing) {
                        return jsonResponse({ success: true, message: 'Lead already exists', id: existing.id, duplicate: true });
                    }
                }

                const context = `Name: ${data.name || 'N/A'}\nCompany: ${data.company || 'N/A'}\nMessage: ${data.message || data.notes || 'N/A'}\nSource: ${data.source || 'n8n'}`;
                const qualification = await qualifyLead(context);

                const lead = await prisma.lead.create({
                    data: {
                        name: data.name || 'Unknown Prospect',
                        company: data.company || null,
                        email: data.email || null,
                        phone: data.phone || null,
                        source: data.source || 'n8n',
                        status: qualification.score > 70 ? 'Qualified' : 'New',
                        score: qualification.score,
                        aiNotes: `${qualification.reasoning} | n8n: ${new Date().toLocaleDateString()}`,
                        aiStatus: 'ACTIVE',
                    }
                });

                if (data.sequenceId) {
                    const seq = await prisma.sequence.findUnique({ where: { id: data.sequenceId } });
                    if (seq) {
                        await prisma.leadSequence.create({ data: { leadId: lead.id, sequenceId: seq.id, status: 'ACTIVE' } });
                    }
                }

                await writeAuditLog({ action: 'WEBHOOK_N8N_CREATE', ip, details: `Lead: ${lead.name} score=${qualification.score}` });
                return jsonResponse({ success: true, id: lead.id, score: qualification.score }, 201);
            }

            // ── UPDATE STATUS ──────────────────────────────────────────────────
            case 'update_status': {
                if (!data.email && !data.id) return jsonResponse({ error: 'email or id required' }, 400);
                if (!data.status) return jsonResponse({ error: 'status required' }, 400);
                if (!VALID_STATUSES.includes(data.status)) {
                    return jsonResponse({ error: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` }, 400);
                }

                const where = data.id ? { id: data.id } : { email: data.email };
                const lead = await prisma.lead.findFirst({ where });
                if (!lead) return jsonResponse({ error: 'Lead not found' }, 404);

                const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status: data.status } });
                await writeAuditLog({ action: 'WEBHOOK_N8N_UPDATE_STATUS', ip, details: `Lead ${lead.id} → ${data.status}` });
                return jsonResponse({ success: true, id: updated.id, status: updated.status });
            }

            // ── RE-QUALIFY ─────────────────────────────────────────────────────
            case 'qualify': {
                if (!data.email && !data.id) return jsonResponse({ error: 'email or id required' }, 400);

                const where = data.id ? { id: data.id } : { email: data.email };
                const lead = await prisma.lead.findFirst({ where });
                if (!lead) return jsonResponse({ error: 'Lead not found' }, 404);

                const context = `Name: ${lead.name}\nCompany: ${lead.company || 'N/A'}\nExtra context: ${data.message || data.notes || 'N/A'}`;
                const qualification = await qualifyLead(context);

                const updated = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        score: qualification.score,
                        status: qualification.score > 70 ? 'Qualified' : lead.status,
                        aiNotes: `${qualification.reasoning} | Re-qualified: ${new Date().toLocaleDateString()}`,
                    }
                });

                await writeAuditLog({ action: 'WEBHOOK_N8N_QUALIFY', ip, details: `Lead ${lead.id} score=${qualification.score}` });
                return jsonResponse({ success: true, id: updated.id, score: qualification.score, reasoning: qualification.reasoning });
            }

            // ── ENROLL SEQUENCE ────────────────────────────────────────────────
            case 'enroll_sequence': {
                if (!data.sequenceId) return jsonResponse({ error: 'sequenceId required' }, 400);
                if (!data.email && !data.id) return jsonResponse({ error: 'email or id required' }, 400);

                const where = data.id ? { id: data.id } : { email: data.email };
                const lead = await prisma.lead.findFirst({ where });
                if (!lead) return jsonResponse({ error: 'Lead not found' }, 404);

                const seq = await prisma.sequence.findUnique({ where: { id: data.sequenceId } });
                if (!seq) return jsonResponse({ error: 'Sequence not found' }, 404);

                const existing = await prisma.leadSequence.findFirst({
                    where: { leadId: lead.id, sequenceId: seq.id }
                });
                if (existing) return jsonResponse({ success: true, message: 'Already enrolled', enrollmentId: existing.id });

                const enrollment = await prisma.leadSequence.create({
                    data: { leadId: lead.id, sequenceId: seq.id, status: 'ACTIVE' }
                });

                await writeAuditLog({ action: 'WEBHOOK_N8N_ENROLL', ip, details: `Lead ${lead.id} enrolled in seq ${seq.id}` });
                return jsonResponse({ success: true, enrollmentId: enrollment.id }, 201);
            }

            // ── BULK CREATE ────────────────────────────────────────────────────
            case 'bulk_create': {
                const items = Array.isArray(data) ? data : data.leads;
                if (!Array.isArray(items) || items.length === 0) {
                    return jsonResponse({ error: 'Payload must be an array of leads or { leads: [...] }' }, 400);
                }
                if (items.length > 5000) {
                    return jsonResponse({ error: 'Max 5000 leads per bulk request' }, 400);
                }

                const emails = items.map((l: any) => l.email).filter(Boolean);
                const existingEmails = emails.length > 0
                    ? (await prisma.lead.findMany({ where: { email: { in: emails } }, select: { email: true } })).map(l => l.email)
                    : [];
                const emailSet = new Set(existingEmails);

                const toCreate = items
                    .filter((l: any) => !l.email || !emailSet.has(l.email))
                    .map((l: any) => ({
                        name: l.name || 'Unknown',
                        company: l.company || null,
                        email: l.email || null,
                        phone: l.phone || null,
                        source: l.source || 'n8n_bulk',
                        status: 'New',
                        score: 0,
                    }));

                const result = await prisma.lead.createMany({ data: toCreate });

                await writeAuditLog({ action: 'WEBHOOK_N8N_BULK', ip, details: `Bulk: ${result.count} created, ${items.length - toCreate.length} skipped` });
                return jsonResponse({ success: true, created: result.count, skipped: items.length - toCreate.length }, 201);
            }

            // ── TAG SOURCE ─────────────────────────────────────────────────────
            case 'tag_source': {
                if (!data.email && !data.id) return jsonResponse({ error: 'email or id required' }, 400);
                if (!data.source) return jsonResponse({ error: 'source required' }, 400);

                const where = data.id ? { id: data.id } : { email: data.email };
                const lead = await prisma.lead.findFirst({ where });
                if (!lead) return jsonResponse({ error: 'Lead not found' }, 404);

                const updated = await prisma.lead.update({ where: { id: lead.id }, data: { source: data.source } });
                return jsonResponse({ success: true, id: updated.id, source: updated.source });
            }

            default:
                return jsonResponse({
                    error: `Unknown action: ${action}`,
                    available: ['create_lead', 'update_status', 'qualify', 'enroll_sequence', 'bulk_create', 'tag_source']
                }, 400);
        }

    } catch (error: any) {
        console.error(`[N8N Webhook /${action}] Error:`, error.message);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}

// GET — return documentation for N8N node configuration
export async function GET(request: Request) {
    if (!verifySecret(request)) return jsonResponse({ error: 'Unauthorized' }, 401);

    return jsonResponse({
        endpoint: '/api/webhooks/n8n/action',
        authentication: 'Header: x-webhook-secret: <your_secret>',
        actions: {
            create_lead: {
                method: 'POST',
                url: '?type=create_lead',
                payload: { name: 'string', email: 'string?', phone: 'string?', company: 'string?', message: 'string?', source: 'string?', sequenceId: 'string?' }
            },
            update_status: {
                method: 'POST',
                url: '?type=update_status',
                payload: { email: 'string OR id: string', status: 'New|Contacted|Qualified|Meeting|Closed' }
            },
            qualify: {
                method: 'POST',
                url: '?type=qualify',
                payload: { email: 'string OR id: string', message: 'string?' }
            },
            enroll_sequence: {
                method: 'POST',
                url: '?type=enroll_sequence',
                payload: { email: 'string OR id: string', sequenceId: 'string' }
            },
            bulk_create: {
                method: 'POST',
                url: '?type=bulk_create',
                payload: [{ name: 'string', email: 'string?', company: 'string?', source: 'string?' }]
            },
            tag_source: {
                method: 'POST',
                url: '?type=tag_source',
                payload: { email: 'string OR id: string', source: 'string' }
            }
        }
    });
}
