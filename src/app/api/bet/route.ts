import {createBetSchema, submitBet} from "@/services/bets/create";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BurnFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError,
} from "@/services/bets/errors";
import {extractUserAccessToken} from "../lib/auth";
import {prisma} from "@/server/db";
import {NextResponse} from "next/server";


export async function POST(request: Request) {
    const access_token = await extractUserAccessToken();

    const json = await request.json();
    const bet = createBetSchema.safeParse(json);
    if (bet.error) {
        return new Response(bet.error.message, {status: 400});
    }

    try {
        await submitBet(prisma, bet.data, access_token);
    } catch (e) {
        if (e instanceof BattleNotFoundError) return NextResponse.json({error: "Bataille introuvable"}, {status: 404});
        if (e instanceof BattleFinishedError) return NextResponse.json({error: "La bataille est déjà terminée"}, {status: 409});
        if (e instanceof InsufficientBalanceError) return NextResponse.json({error: "Solde insuffisant pour placer ce pari"}, {status: 422});
        if (e instanceof BetCreationError) return NextResponse.json({error: "Impossible de créer le pari, veuillez réessayer"}, {status: 500});
        if (e instanceof BurnFailedError) return NextResponse.json({error: "Impossible de débiter les coins, pari annulé"}, {status: 502});
        if (e instanceof InvalidBetTypeError) return NextResponse.json({error: "Type de pari invalide"}, {status: 400});
        if (e instanceof InvalidBetDataError) return NextResponse.json({error: "Données du pari invalides"}, {status: 400});
        console.error("[POST /api/bet]", e);
        return NextResponse.json({error: "Une erreur inattendue s'est produite"}, {status: 500});
    }


    return new Response("ok");
}