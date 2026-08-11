import { extractUserAccessToken } from "@/server/auth";
import {UnauthorizedError} from "@/lib/errors";
import {CURRENCY} from "@/services/bets/baseBet";
import { NextResponse } from "next/server";


export async function GET() {
  try {
    const accessToken = await extractUserAccessToken();
    const response = await fetch(
      `${process.env.COINS_API_URL}/claimable?currency=${encodeURIComponent(CURRENCY)}`,
      {
        headers: {
          "X-Api-Key": process.env.COINS_API_KEY!,
          "Authorization": accessToken,
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) {
      const status = response.status === 401 ? 401 : 502;
      return NextResponse.json({"error": "Failed to get claimable coins"}, {status});
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object"
      || payload === null
      || !("claimable" in payload)
      || typeof payload.claimable !== "number"
    ) {
      return NextResponse.json({"error": "Invalid claimable coins response"}, {status: 502});
    }
    return NextResponse.json(payload.claimable);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({"error": "Unauthorized"}, {status: 401});
    }

    console.error("[GET /api/coins/claimable]", error);
    const status = error instanceof DOMException && error.name === "TimeoutError"
      ? 504
      : 502;
    return NextResponse.json({"error": "Failed to get claimable coins"}, {status});
  }
}