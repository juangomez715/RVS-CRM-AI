import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/gmail';
import { verifyOAuthState, encrypt } from '@/lib/crypto';
import { google } from 'googleapis';
import prisma from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const cookieStore = await cookies();

    // 1. CSRF: verify state matches the cookie
    const savedState = cookieStore.get('oauth_state')?.value;
    cookieStore.delete('oauth_state'); // One-time use — delete immediately

    if (!savedState || !state || !verifyOAuthState(state) || state !== savedState) {
        console.warn('[Gmail OAuth] CSRF state mismatch — possible attack attempt.');
        return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=invalid_state`);
    }

    if (error || !code) {
        return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=${error || 'no_code'}`);
    }

    try {
        const tokens = await exchangeCodeForTokens(code);

        if (!tokens.access_token || !tokens.refresh_token) {
            return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=no_tokens`);
        }

        // 2. Get the authenticated user's email
        const oauth2 = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2.setCredentials({ access_token: tokens.access_token });
        const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
        const userInfo = await oauth2Api.userinfo.get();
        const email = userInfo.data.email || '';

        // 3. Encrypt tokens before persisting (AES-256-GCM)
        const encryptedAccess = encrypt(tokens.access_token);
        const encryptedRefresh = encrypt(tokens.refresh_token);

        // 4. Upsert integration
        const existing = await prisma.integration.findFirst({ where: { provider: 'gmail' } });

        if (existing) {
            await prisma.integration.update({
                where: { id: existing.id },
                data: {
                    accountId: email,
                    accessToken: encryptedAccess,
                    refreshToken: encryptedRefresh,
                    expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                    isActive: true,
                    metadata: JSON.stringify({ connectedAt: new Date().toISOString() }),
                },
            });
        } else {
            await prisma.integration.create({
                data: {
                    provider: 'gmail',
                    accountId: email,
                    accessToken: encryptedAccess,
                    refreshToken: encryptedRefresh,
                    expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                    isActive: true,
                    metadata: JSON.stringify({ connectedAt: new Date().toISOString() }),
                },
            });
        }

        return NextResponse.redirect(`${appUrl}/settings?gmail=success&email=${encodeURIComponent(email)}`);
    } catch (err: any) {
        console.error('[Gmail OAuth Callback Error]', err.message);
        return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=token_exchange_failed`);
    }
}
