import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeAuditLog, getClientIp } from '@/lib/audit';

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('rvs_session')?.value;
    return token ? await verifyToken(token) : null;
}

function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Parse header row (handle quoted fields)
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx]?.trim() || '';
        });
        rows.push(row);
    }
    return rows;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// Map common CSV column name variations to our field names
function mapField(row: Record<string, string>, ...keys: string[]): string | null {
    for (const key of keys) {
        if (row[key] && row[key].trim()) return row[key].trim();
    }
    return null;
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });
        if (!file.name.endsWith('.csv')) return Response.json({ error: 'File must be a CSV' }, { status: 400 });
        if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });

        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length === 0) return Response.json({ error: 'CSV is empty or has no data rows' }, { status: 400 });
        if (rows.length > 100000) return Response.json({ error: 'Max 100,000 leads per CSV upload' }, { status: 400 });

        // Build lead records from CSV rows
        const leadsToCreate = rows
            .map(row => {
                const name = mapField(row, 'name', 'full name', 'fullname', 'contact', 'first name', 'firstname');
                if (!name) return null; // Name required

                return {
                    name,
                    company: mapField(row, 'company', 'organization', 'org', 'employer', 'account') || null,
                    email: mapField(row, 'email', 'email address', 'emailaddress', 'e-mail') || null,
                    phone: mapField(row, 'phone', 'phone number', 'phonenumber', 'mobile', 'tel', 'telephone') || null,
                    source: mapField(row, 'source') || 'csv_import',
                    status: 'New' as const,
                    score: 0,
                };
            })
            .filter(Boolean) as Array<{
                name: string;
                company: string | null;
                email: string | null;
                phone: string | null;
                source: string;
                status: string;
                score: number;
            }>;

        if (leadsToCreate.length === 0) {
            return Response.json({ error: 'No valid leads found. CSV must have a "name" column.' }, { status: 400 });
        }

        // Deduplicate against existing leads by email
        const emails = leadsToCreate.map(l => l.email).filter(Boolean) as string[];
        const existingEmails = emails.length > 0
            ? (await prisma.lead.findMany({
                where: { email: { in: emails } },
                select: { email: true }
            })).map(l => l.email as string)
            : [];

        const existingEmailSet = new Set(existingEmails);
        const newLeads = leadsToCreate.filter(l => !l.email || !existingEmailSet.has(l.email));

        if (newLeads.length === 0) {
            return Response.json({
                success: true,
                created: 0,
                skipped: leadsToCreate.length,
                message: 'All leads already exist (matched by email).'
            });
        }

        // Batch insert in chunks of 1000 for large files
        const CHUNK_SIZE = 1000;
        let totalCreated = 0;
        for (let i = 0; i < newLeads.length; i += CHUNK_SIZE) {
            const chunk = newLeads.slice(i, i + CHUNK_SIZE);
            const result = await prisma.lead.createMany({ data: chunk });
            totalCreated += result.count;
        }

        await writeAuditLog({
            action: 'LEADS_CSV_IMPORT',
            userId: session.userId,
            userEmail: session.name,
            ip: getClientIp(request),
            details: `CSV Import: ${totalCreated} created, ${leadsToCreate.length - newLeads.length} skipped (duplicates)`,
        });

        return Response.json({
            success: true,
            created: totalCreated,
            skipped: leadsToCreate.length - newLeads.length,
            total: rows.length,
            message: `${totalCreated} leads imported successfully.`
        });

    } catch (error: any) {
        console.error('[CSV Import] Error:', error);
        return Response.json({ error: 'CSV import failed: ' + error.message }, { status: 500 });
    }
}
