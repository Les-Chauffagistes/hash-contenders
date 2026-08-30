import { extractUserAccessToken } from "@/server/auth";
import {UnauthorizedError} from "@/lib/errors";
import {CURRENCY} from "@/services/bets/baseBet";
import {verifyTurnstileToken} from "@/server/captcha";
import { NextRequest, NextResponse } from "next/server";
import {logger} from "@/lib/logger";


export async function POST(request: NextRequest) {
  try {
    const accessToken = await extractUserAccessToken();

    const body = await request.json().catch(() => null);
    const captchaValid = await verifyTurnstileToken(body?.captchaToken);
    if (!captchaValid) {
      return NextResponse.json({"error": "Invalid captcha"}, {status: 400});
    }

    const response = await fetch(
      `${process.env.COINS_API_URL}/claim?currency=${encodeURIComponent(CURRENCY)}`,
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
      return NextResponse.json({"error": "Failed to claim coins"}, {status});
    }
    return new NextResponse(null, {status: 204});
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({"error": "Unauthorized"}, {status: 401});
    }

    logger.error("[POST /api/coins/claim]", error);
    const status = error instanceof DOMException && error.name === "TimeoutError"
      ? 504
      : 502;
    return NextResponse.json({"error": "Failed to claim coins"}, {status});
  }
}