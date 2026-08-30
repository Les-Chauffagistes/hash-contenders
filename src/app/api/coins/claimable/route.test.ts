import {beforeEach, describe, expect, it, vi} from "vitest";
import {UnauthorizedError} from "@/lib/errors";

vi.mock("@/server/auth", () => ({
  extractUserAccessToken: vi.fn(),
}));

import {extractUserAccessToken} from "@/server/auth";
import {GET} from "@/app/api/coins/claimable/route";

describe("GET /api/coins/claimable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(extractUserAccessToken).mockResolvedValue("access-token");
  });

  it("bounds the request to the coins service", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({claimable: 12}), {status: 200}),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBe(12);
    expect(fetch).toHaveBeenCalledWith(
      `${process.env.COINS_API_URL}/claimable?currency=test-coins`,
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it("returns a gateway timeout when the coins service times out", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );

    const response = await GET();

    expect(response.status).toBe(504);
    consoleError.mockRestore();
  });

  it("returns 401 when authentication fails", async () => {
    vi.mocked(extractUserAccessToken).mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
