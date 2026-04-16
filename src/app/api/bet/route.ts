import { createBetSchema, verifyBet, handleBet } from "@/services/bets/create";
import { cookies } from "next/headers";
import { decodeAccessToken } from "../lib/auth";
import { prisma } from "@/server/db";




export async function POST(request: Request) {
    const cookieStore = await cookies();
    console.log(cookieStore)

    const access_token = cookieStore.get("access_token")?.value;
    console.debug("checking cookies")
    if (!access_token) return new Response("Unauthorized", { status: 401 });

    const me = await decodeAccessToken(access_token);
    console.debug("decoding current user", me.pseudo)
    if (!me) return new Response("Unauthorized", { status: 401 });

    const json = await request.json();
    const bet = createBetSchema.safeParse(json);
    if (bet.error) {
        return new Response(bet.error.message, { status: 400 });
    }

    console.log(bet.data);
    let result;
    try {
        result = verifyBet(prisma, bet.data);
        await handleBet(prisma, result, access_token);
    } catch (e) {
        return new Response(e.message, { status: 400 });
    }


    return new Response("ok");
}