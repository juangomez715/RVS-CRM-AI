import { NextResponse } from 'next/server';
import { getGmailOAuthUrl } from '@/lib/gmail';
import { generateOAuthState } from '@/lib/crypto';
import { cookies } from 'next/headers';

export async function GET() {
    // Generate a signed CSRF state token
    const state = generateOAuthState();

    // Store state in a short-lived, HttpOnly, SameSite=Strict cookie
    (await cookies()).set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'lax' needed to survive Google's redirect back
        maxAge: 60 * 10, // 10 minutes
        path: '/',
    });

    const url = getGmailOAuthUrl(state);
    return NextResponse.redirect(url);
}
