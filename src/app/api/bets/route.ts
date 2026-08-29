import {decodeAccessToken, extractUserAccessToken} from "@/app/api/lib/auth";
import {getBattlesByIds, getUserBets, mergeBetsWithBattles} from "@/app/services/bets";
import {prisma} from "@/server/db";
import {NextResponse} from "next/server";
import {UnauthorizedError} from "@/app/api/lib/exceptions";
import {logger} from "@/lib/logger";
import {withRequestLogging} from "@chauffagistes/cmn";

export const GET = withRequestLogging(async (req: Request) => {
    try {
        const access_token = await extractUserAccessToken();
        const user = await decodeAccessToken(access_token);
        const bets = await getUserBets(prisma, user);
        const battleIds = [...new Set(bets.map((bet) => Number(bet.battleId)).filter(Number.isFinite))];
        const battles = await getBattlesByIds(battleIds);
        return NextResponse.json(mergeBetsWithBattles(bets, battles));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({"error": "Unauthorized"}, {status: 401});
        }
        logger.error(error);
        return NextResponse.json({"error": "Internal server error"}, {status: 500});
    }
});
