import { NextResponse } from 'next/server';
import { syncGmailInbox } from '@/lib/gmail';
import { cookies } from 'next/headers';

export async function POST() {
    const sessionCookie = (await cookies()).get('rvs_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await syncGmailInbox();
        return NextResponse.json({
            success: true,
            synced: result.synced,
            errors: result.errors,
            message: `Synced ${result.synced} new message(s) from Gmail.`,
        });
    } catch (err: any) {
        console.error('[Inbox Sync Error]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
