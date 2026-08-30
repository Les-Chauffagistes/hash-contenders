import {submitBet} from "@/services/bets/create";
import {CreateBetSchema} from "@/services/bets/baseBet";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BettingClosedError,
    EscrowDebitFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError,
} from "@/services/bets/errors";
import {extractUserAccessToken} from "@/server/auth";
import {prisma} from "@/server/db";
import {NextResponse} from "next/server";
import {logger} from "@/lib/logger";
import {withRequestLogging, resolveTraceId} from "@chauffagistes/cmn";


export const POST = withRequestLogging(async (request: Request) => {
    // Résolu une seconde fois ici (withRequestLogging l'a déjà fait pour poser le
    // contexte ambiant) : resolveTraceId est pure et déterministe sur les mêmes
    // headers, donc on retombe sur la même valeur. On la passe explicitement à
    // submitBet pour survivre à la perte de contexte Prisma en aval (voir
    // create.ts).
    const traceId = resolveTraceId(request.headers);
    const access_token = await extractUserAccessToken();

    const json = await request.json();
    const bet = CreateBetSchema.safeParse(json);
    if (bet.error) {
        return new Response(bet.error.message, {status: 400});
    }

    try {
        await submitBet(prisma, bet.data, access_token, traceId);
    } catch (e) {
        if (e instanceof BattleNotFoundError) return NextResponse.json({error: "Bataille introuvable"}, {status: 404});
        if (e instanceof BattleFinishedError) return NextResponse.json({error: "La bataille est déjà terminée"}, {status: 409});
        if (e instanceof BettingClosedError) return NextResponse.json({error: "Les paris sont clos, la bataille a démarré"}, {status: 409});
        if (e instanceof InsufficientBalanceError) return NextResponse.json({error: "Solde insuffisant pour placer ce pari"}, {status: 422});
        if (e instanceof BetCreationError) return NextResponse.json({error: "Impossible de créer le pari, veuillez réessayer"}, {status: 500});
        if (e instanceof EscrowDebitFailedError) return NextResponse.json({error: "Impossible de débiter les coins, pari annulé"}, {status: 502});
        if (e instanceof InvalidBetTypeError) return NextResponse.json({error: "Type de pari invalide"}, {status: 400});
        if (e instanceof InvalidBetDataError) return NextResponse.json({error: "Données du pari invalides"}, {status: 400});
        logger.error("[POST /api/bet]", e);
        return NextResponse.json({error: "Une erreur inattendue s'est produite"}, {status: 500});
    }


    return new Response("ok");
});