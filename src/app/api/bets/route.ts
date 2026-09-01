import {getBattlesByIds} from "@/clients/referee";
import {UnauthorizedError} from "@/lib/errors";
import {prisma} from "@/server/db";
import {extractAuthenticatedUser} from "@/server/auth";
import {findUserBets, findUserPayouts} from "@/services/bets/read";
import {NextResponse} from "next/server";
import {toUserBetsOverview} from "@/app/api/bets/mapper";
import {logger} from "@/lib/logger";
import {withRequestLogging} from "@chauffagistes/cmn";

export const GET = withRequestLogging(async () => {
    try {
        const {user} = await extractAuthenticatedUser();
        const [bets, payouts] = await Promise.all([
            findUserBets(prisma, user),
            findUserPayouts(prisma, user),
        ]);
        const battleIds = [
            ...new Set(
                bets
                    .map((bet) => Number(bet.battleId))
                    .filter(Number.isSafeInteger),
            ),
        ];
        const battles = await getBattlesByIds(battleIds);
        return NextResponse.json(toUserBetsOverview(bets, battles, payouts));
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({"error": "Unauthorized"}, {status: 401});
        }
        logger.error(error);
        return NextResponse.json({"error": "Internal server error"}, {status: 500});
    }
});
