import {logger} from "@/lib/logger";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify endpoint.
 * Returns false (instead of throwing) on any missing token, network error or unsuccessful verification,
 * so callers can simply reject the request when this returns false.
 */
export async function verifyTurnstileToken(token: unknown): Promise<boolean> {
    if (typeof token !== "string" || token.length === 0) return false;

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        logger.error("[verifyTurnstileToken] Missing TURNSTILE_SECRET_KEY environment variable");
        return false;
    }

    try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({secret, response: token}),
            signal: AbortSignal.timeout(5_000),
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.success === true;
    } catch (error) {
        logger.error("[verifyTurnstileToken]", error);
        return false;
    }
}
