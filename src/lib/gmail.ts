import { google } from 'googleapis';
import prisma from './db';
import { encrypt, decrypt } from './crypto';

function createOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
    );
}

export function getGmailOAuthUrl(state: string): string {
    const client = createOAuthClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        state, // CSRF protection
        scope: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ],
    });
}

export async function exchangeCodeForTokens(code: string) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    return tokens;
}

export async function getConnectedGmailAccount() {
    return prisma.integration.findFirst({
        where: { provider: 'gmail', isActive: true },
    });
}

async function getRefreshedClient(integrationId: string, encryptedAccessToken: string, encryptedRefreshToken: string) {
    const accessToken = decrypt(encryptedAccessToken);
    const refreshToken = decrypt(encryptedRefreshToken);

    const client = createOAuthClient();
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

    // Auto-refresh handler: persist new tokens encrypted when refreshed
    client.on('tokens', async (tokens) => {
        const updateData: any = {};
        if (tokens.access_token) updateData.accessToken = encrypt(tokens.access_token);
        if (tokens.expiry_date) updateData.expiresAt = Math.floor(tokens.expiry_date / 1000);
        if (Object.keys(updateData).length > 0) {
            await prisma.integration.update({ where: { id: integrationId }, data: updateData });
        }
    });

    return client;
}

export async function sendViaGmail(
    to: string,
    subject: string,
    html: string,
    trackingId?: string
): Promise<{ success: boolean; messageId: string }> {
    const integration = await getConnectedGmailAccount();
    if (!integration?.accessToken || !integration?.refreshToken || !integration?.accountId) {
        throw new Error('Gmail is not connected. Please connect your Gmail account in Settings.');
    }

    const auth = await getRefreshedClient(integration.id, integration.accessToken, integration.refreshToken);

    let finalHtml = html;
    if (trackingId) {
        const trackingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/track/open/${trackingId}`;
        finalHtml += `<img src="${trackingUrl}" width="1" height="1" style="display:none;visibility:hidden;opacity:0;" alt="" />`;
    }

    const rawMessage = [
        `From: RVS Intelligence CRM <${integration.accountId}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        finalHtml,
    ].join('\r\n');

    const encoded = Buffer.from(rawMessage).toString('base64url');
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded },
    });

    return { success: true, messageId: res.data.id || '' };
}

export async function syncGmailInbox(): Promise<{ synced: number; errors: string[] }> {
    const integration = await getConnectedGmailAccount();
    if (!integration?.accessToken || !integration?.refreshToken) {
        throw new Error('Gmail is not connected.');
    }

    const auth = await getRefreshedClient(integration.id, integration.accessToken, integration.refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    // Pull metadata from last sync time
    let lastSync: Date | undefined;
    try {
        const meta = integration.metadata ? JSON.parse(integration.metadata) : {};
        if (meta.lastSyncAt) lastSync = new Date(meta.lastSyncAt);
    } catch {}

    // Build query: inbox primary, after last sync
    let query = 'in:inbox category:primary -from:me';
    if (lastSync) {
        const unixTime = Math.floor(lastSync.getTime() / 1000);
        query += ` after:${unixTime}`;
    }

    const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    let synced = 0;
    const errors: string[] = [];

    for (const msg of messages) {
        try {
            const full = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'full',
            });

            const headers = full.data.payload?.headers || [];
            const from = headers.find(h => h.name === 'From')?.value || '';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
            const gmailMsgId = full.data.id!;

            // Parse from email/name
            const emailMatch = from.match(/<([^>]+)>/);
            const fromEmail = emailMatch ? emailMatch[1].trim() : from.trim();

            // Extract body
            let body = '';
            const payload = full.data.payload;
            if (payload?.body?.data) {
                body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
            } else if (payload?.parts) {
                const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
                const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                const part = htmlPart || textPart;
                if (part?.body?.data) {
                    body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
                }
            }

            // Find matching Lead by email
            const lead = await prisma.lead.findFirst({
                where: { email: fromEmail.toLowerCase() },
            });

            if (!lead) continue; // Only sync replies from known leads

            // Avoid duplicate — check by trackingId used as external gmailMsgId
            const existing = await prisma.interaction.findFirst({
                where: { leadId: lead.id, content: { contains: gmailMsgId } },
            });
            if (existing) continue;

            await prisma.interaction.create({
                data: {
                    leadId: lead.id,
                    channel: 'Email',
                    sender: 'LEAD',
                    content: `[Gmail:${gmailMsgId}] Subject: ${subject}\n\n${body.replace(/<[^>]*>/g, '').trim()}`,
                    repliedAt: new Date(),
                },
            });

            synced++;
        } catch (err: any) {
            errors.push(`Message ${msg.id}: ${err.message}`);
        }
    }

    // Update lastSyncAt in metadata
    const currentMeta = integration.metadata ? JSON.parse(integration.metadata) : {};
    await prisma.integration.update({
        where: { id: integration.id },
        data: { metadata: JSON.stringify({ ...currentMeta, lastSyncAt: new Date().toISOString() }) },
    });

    return { synced, errors };
}
