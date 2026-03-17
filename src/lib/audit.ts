import prisma from '@/lib/db';

export type AuditAction =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'LEAD_CREATED'
    | 'LEAD_UPDATED'
    | 'LEAD_DELETED'
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DELETED'
    | 'SEQUENCE_CREATED'
    | 'SEQUENCE_UPDATED'
    | 'SEQUENCE_DELETED'
    | 'AGENT_SAVED'
    | 'INTEGRATION_SAVED'
    | 'EMAIL_SENT'
    | 'WEBHOOK_N8N'
    | 'WEBHOOK_INCOMING'
    | 'EMAIL_BOUNCED'
    | 'EMAIL_SPAM';

interface AuditParams {
    action: AuditAction;
    userId?: string;
    userEmail?: string;
    ip?: string;
    details?: string;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
    try {
        await prisma.auditLog.create({ data: params });
    } catch (error) {
        console.error('[AuditLog] Failed to write:', error);
    }
}

/** Extracts IP from request headers */
export function getClientIp(request: Request): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}
