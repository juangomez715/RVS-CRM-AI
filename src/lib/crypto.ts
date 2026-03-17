import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a single string: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by encrypt().
 */
export function decrypt(payload: string): string {
    const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) {
        throw new Error('Invalid encrypted payload format.');
    }

    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Generates a signed OAuth state token to prevent CSRF.
 * Format: `randomHex.HMAC-SHA256(randomHex)`
 */
export function generateOAuthState(): string {
    const key = process.env.ENCRYPTION_KEY!;
    const random = randomBytes(24).toString('hex');
    const hmac = createHmac('sha256', key).update(random).digest('hex');
    return `${random}.${hmac}`;
}

/**
 * Verifies a state token received from OAuth callback.
 */
export function verifyOAuthState(state: string): boolean {
    try {
        const key = process.env.ENCRYPTION_KEY!;
        const [random, receivedHmac] = state.split('.');
        if (!random || !receivedHmac) return false;
        const expectedHmac = createHmac('sha256', key).update(random).digest('hex');
        // Constant-time comparison to prevent timing attacks
        return receivedHmac.length === expectedHmac.length &&
            createHmac('sha256', key).update(receivedHmac).digest('hex') ===
            createHmac('sha256', key).update(expectedHmac).digest('hex');
    } catch {
        return false;
    }
}
