import {decodeAccessToken, extractUserAccessToken} from "@/app/api/lib/auth";
import {getUserBets} from "@/app/services/bets";
import {prisma} from "@/server/db";
import {NextResponse} from "next/server";
import {UnauthorizedError} from "@/app/api/lib/exceptions";

export async function GET(req: Request) {
    try {
        const access_token = await extractUserAccessToken();
        const user = await decodeAccessToken(access_token);
        const bets = await getUserBets(prisma, user);
        console.log(bets)
        return NextResponse.json({bets});
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({"error": "Unauthorized"}, {status: 401});
        }
        console.error(error);
    }
}