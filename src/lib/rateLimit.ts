import prisma from './db';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if an IP is rate limited.
 * Cleans up expired entries automatically.
 */
export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const now = new Date();

    const entry = await prisma.rateLimit.findUnique({ where: { ip } });

    if (!entry || entry.expiresAt <= now) {
        // No entry or window expired — clean up if stale
        if (entry) await prisma.rateLimit.delete({ where: { ip } }).catch(() => {});
        return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= MAX_ATTEMPTS) {
        const retryAfterMs = entry.expiresAt.getTime() - now.getTime();
        return { allowed: false, retryAfterMs };
    }

    return { allowed: true, retryAfterMs: 0 };
}

/**
 * Records a failed login attempt for a given IP.
 */
export async function recordFailedAttempt(ip: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + WINDOW_MS);

    await prisma.rateLimit.upsert({
        where: { ip },
        create: { ip, count: 1, firstAttempt: now, expiresAt },
        update: {
            count: { increment: 1 },
            // Only reset expiresAt if the window had already expired
            expiresAt,
        },
    });
}

/**
 * Clears the rate limit for a given IP (on successful login).
 */
export async function clearRateLimit(ip: string): Promise<void> {
    await prisma.rateLimit.delete({ where: { ip } }).catch(() => {});
}
