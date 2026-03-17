import { SignJWT, jwtVerify } from 'jose';

// Secret key for signing JWTs. In production, use a strong env variable.
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'rvs-crm-secret-key-change-in-production-2026'
);

const ALGORITHM = 'HS256';

export interface SessionPayload {
    userId: string;
    role: string;
    name: string;
}

/**
 * Signs a JWT token with the given payload.
 * Token expires in 7 days.
 */
export async function signToken(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: ALGORITHM })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);
}

/**
 * Verifies and decodes a JWT token.
 * Returns the payload or null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return {
            userId: payload.userId as string,
            role: payload.role as string,
            name: payload.name as string,
        };
    } catch (error) {
        return null;
    }
}
