import prisma from './db';
import { decrypt } from './crypto';

/**
 * LINKEDIN INTEGRATION
 *
 * Uses LinkedIn's internal Voyager API with a li_at session cookie.
 * This is the same API LinkedIn's own frontend uses.
 *
 * Setup: Save your li_at cookie value in Settings → LinkedIn.
 * The cookie expires when you log out of LinkedIn or after ~1 year of inactivity.
 */

const VOYAGER = 'https://www.linkedin.com/voyager/api';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const humanDelay = () =>
    new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 2000));

export interface LinkedInProfile {
    url: string;
    name: string;
    headline: string;
    location: string;
    entityUrn: string;
}

export interface LinkedInResearchResult {
    source: 'LinkedIn_Voyager';
    timestamp: string;
    profile: LinkedInProfile;
}

/** Extracts the profile slug from a LinkedIn URL */
function extractSlug(profileUrl: string): string {
    const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
    if (!match) throw new Error(`Invalid LinkedIn URL: ${profileUrl}`);
    return match[1].replace(/\/$/, '');
}

/** Base headers for all Voyager requests */
function baseHeaders(cookie: string): Record<string, string> {
    return {
        Cookie: `li_at=${cookie}`,
        'X-RestLi-Protocol-Version': '2.0.0',
        'X-Li-Lang': 'en_US',
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.linkedin.normalized+json+2.1',
    };
}

export class LinkedInIntegration {
    private cookie: string;
    private csrfToken: string | null = null;

    constructor(cookie: string) {
        this.cookie = cookie;
    }

    /** Loads the active LinkedIn integration from DB, decrypting the token if needed */
    static async init(): Promise<LinkedInIntegration> {
        const li = await prisma.integration.findFirst({
            where: { provider: 'linkedin', isActive: true }
        });

        if (!li?.accessToken) {
            throw new Error('LinkedIn: No active session. Save your li_at cookie in Settings.');
        }

        let cookie = li.accessToken;
        try {
            cookie = decrypt(li.accessToken);
        } catch {
            // Stored as plaintext (legacy) — use as-is
        }

        return new LinkedInIntegration(cookie);
    }

    /**
     * Fetches a CSRF token by calling /me.
     * LinkedIn requires the JSESSIONID cookie value as csrf-token for POST requests.
     */
    private async fetchCsrfToken(): Promise<string> {
        if (this.csrfToken) return this.csrfToken;

        const res = await fetch(`${VOYAGER}/me`, {
            headers: baseHeaders(this.cookie),
            signal: AbortSignal.timeout(10000),
        });

        // Extract JSESSIONID from Set-Cookie response header
        const setCookie = res.headers.get('set-cookie') || '';
        const match = setCookie.match(/JSESSIONID="([^"]+)"/);
        this.csrfToken = match?.[1] ?? 'ajax:0';
        return this.csrfToken;
    }

    private async headersWithCsrf(): Promise<Record<string, string>> {
        const csrf = await this.fetchCsrfToken();
        return {
            ...baseHeaders(this.cookie),
            'csrf-token': csrf,
            Cookie: `li_at=${this.cookie}; JSESSIONID="${csrf}"`,
            'Content-Type': 'application/json',
        };
    }

    /** Checks if the session cookie is still valid */
    async checkSession(): Promise<boolean> {
        try {
            const res = await fetch(`${VOYAGER}/me`, {
                headers: baseHeaders(this.cookie),
                signal: AbortSignal.timeout(8000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /** Fetches a LinkedIn profile by URL */
    async researchProfile(profileUrl: string): Promise<LinkedInResearchResult> {
        const slug = extractSlug(profileUrl);
        await humanDelay();

        const res = await fetch(
            `${VOYAGER}/identity/profiles/${slug}`,
            {
                headers: baseHeaders(this.cookie),
                signal: AbortSignal.timeout(12000),
            }
        );

        if (res.status === 401 || res.status === 403) {
            throw new Error('LinkedIn session expired. Update your li_at cookie in Settings.');
        }
        if (res.status === 404) {
            throw new Error(`LinkedIn profile not found: ${profileUrl}`);
        }
        if (!res.ok) {
            throw new Error(`LinkedIn API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Voyager returns normalized JSON — profile is usually in data or included[0]
        const raw = data?.data ?? data?.included?.[0] ?? {};

        const profile: LinkedInProfile = {
            url: profileUrl,
            name: [raw.firstName, raw.lastName].filter(Boolean).join(' ') || slug,
            headline: raw.headline || '',
            location: raw.locationName || '',
            entityUrn: raw.entityUrn || raw.objectUrn || '',
        };

        return {
            source: 'LinkedIn_Voyager',
            timestamp: new Date().toISOString(),
            profile,
        };
    }

    /**
     * Sends a direct message to a LinkedIn profile.
     * Uses the Voyager messaging/conversations endpoint.
     */
    async sendSequenceMessage(
        profileUrl: string,
        message: string
    ): Promise<{ success: boolean; trackingId: string }> {
        // Resolve recipient URN first
        const research = await this.researchProfile(profileUrl);
        const recipientUrn = research.profile.entityUrn;

        if (!recipientUrn) {
            throw new Error(`Could not resolve LinkedIn URN for: ${profileUrl}`);
        }

        const headers = await this.headersWithCsrf();
        await humanDelay();

        const payload = {
            keyVersion: 'LEGACY_INBOX',
            conversationCreate: {
                eventCreate: {
                    value: {
                        'com.linkedin.voyager.messaging.create.MessageCreate': {
                            attributedBody: { text: message, attributes: [] },
                            attachments: [],
                        },
                    },
                },
                recipients: [recipientUrn],
                subtype: 'MEMBER_TO_MEMBER',
            },
        };

        const res = await fetch(`${VOYAGER}/messaging/conversations?action=create`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
        });

        if (res.status === 401 || res.status === 403) {
            throw new Error('LinkedIn session expired. Update your li_at cookie in Settings.');
        }
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`LinkedIn messaging failed (${res.status}): ${body}`);
        }

        const trackingId = `li_${Date.now()}`;
        return { success: true, trackingId };
    }
}
