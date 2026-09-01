import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {verifyTurnstileToken} from "@/server/captcha";

describe("verifyTurnstileToken", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
  });

  it("returns false for a missing token without calling Cloudflare", async () => {
    const result = await verifyTurnstileToken(undefined);

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns true when Cloudflare reports success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({success: true}), {status: 200}),
    );

    const result = await verifyTurnstileToken("valid-token");

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({method: "POST"}),
    );
  });

  it("returns false when Cloudflare reports failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({success: false}), {status: 200}),
    );

    const result = await verifyTurnstileToken("invalid-token");

    expect(result).toBe(false);
  });

  it("returns false when the request to Cloudflare fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await verifyTurnstileToken("valid-token");

    expect(result).toBe(false);
  });

  it("returns false when the secret key is not configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const result = await verifyTurnstileToken("valid-token");

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
