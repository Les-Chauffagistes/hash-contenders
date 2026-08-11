import {beforeEach, describe, expect, it, vi} from "vitest";
import {UnauthorizedError} from "@/lib/errors";

vi.mock("@/server/auth", () => ({
  extractUserAccessToken: vi.fn(),
}));

vi.mock("@/server/captcha", () => ({
  verifyTurnstileToken: vi.fn(),
}));

import {extractUserAccessToken} from "@/server/auth";
import {verifyTurnstileToken} from "@/server/captcha";
import {POST} from "@/app/api/coins/claim/route";
import {NextRequest} from "next/server";

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost/api/coins/claim", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {"Content-Type": "application/json"},
  });
}

describe("POST /api/coins/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(extractUserAccessToken).mockResolvedValue("access-token");
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
  });

  it("claims the configured currency through the coins service", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({claimed: 12}), {status: 200}),
    );

    const response = await POST(buildRequest({captchaToken: "valid-token"}));

    expect(response.status).toBe(204);
    expect(verifyTurnstileToken).toHaveBeenCalledWith("valid-token");
    expect(fetch).toHaveBeenCalledWith(
      `${process.env.COINS_API_URL}/claim?currency=test-coins`,
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it("returns 401 when authentication fails", async () => {
    vi.mocked(extractUserAccessToken).mockRejectedValue(new UnauthorizedError());

    const response = await POST(buildRequest({captchaToken: "valid-token"}));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 and does not claim coins when the captcha is invalid", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false);

    const response = await POST(buildRequest({captchaToken: "invalid-token"}));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
