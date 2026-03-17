import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'rvs-crm-secret-key-change-in-production-2026'
);

// Layer 3: OWASP Security Headers
function addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    return response;
}

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('rvs_session');

    const isLoginPage = request.nextUrl.pathname.startsWith('/login');
    const isApiRoute = request.nextUrl.pathname.startsWith('/api');
    const isWebhook = request.nextUrl.pathname.startsWith('/api/webhooks');
    const isTrackingRoute = request.nextUrl.pathname.startsWith('/api/track');
    const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth');
    const isStaticAsset = request.nextUrl.pathname.match(/\.(png|jpg|svg|ico|gif|css|js)$/);

    // Allow static assets through
    if (isStaticAsset) {
        return addSecurityHeaders(NextResponse.next());
    }

    // Allow webhooks and tracking pixels to bypass auth
    if (isWebhook || isTrackingRoute) {
        return addSecurityHeaders(NextResponse.next());
    }

    // Allow auth routes to bypass (login/logout handle their own auth)
    if (isAuthRoute) {
        return addSecurityHeaders(NextResponse.next());
    }

    // Layer 4: Validate JWT for protected API routes
    if (isApiRoute && !isAuthRoute) {
        if (!sessionCookie) {
            return addSecurityHeaders(
                NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            );
        }
        try {
            await jwtVerify(sessionCookie.value, JWT_SECRET);
        } catch {
            return addSecurityHeaders(
                NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
            );
        }
        return addSecurityHeaders(NextResponse.next());
    }

    // If there's no session and trying to access a protected page
    if (!sessionCookie && !isLoginPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If there's a session and trying to access the login page, redirect to dashboard
    if (sessionCookie && isLoginPage) {
        try {
            await jwtVerify(sessionCookie.value, JWT_SECRET);
            return NextResponse.redirect(new URL('/dashboard', request.url));
        } catch {
            // Invalid JWT, clear cookie and let them login
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('rvs_session');
            return response;
        }
    }

    // Validate JWT for page access
    if (sessionCookie) {
        try {
            const { payload } = await jwtVerify(sessionCookie.value, JWT_SECRET);

            // Role-based Access Control for the /agents page
            if (request.nextUrl.pathname.startsWith('/agents')) {
                if (payload.role !== 'ADMIN') {
                    return NextResponse.redirect(new URL('/dashboard', request.url));
                }
            }
        } catch {
            // Invalid JWT — clear the cookie and redirect to login
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('rvs_session');
            return response;
        }
    }

    // Root redirect
    if (request.nextUrl.pathname === '/') {
        if (sessionCookie) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return addSecurityHeaders(NextResponse.next());
}

export const config = {
    matcher: [
        '/((?!_next|favicon.ico).*)',
    ],
};
