import {NextResponse} from "next/server";
import {getPseudosByUserId} from "@/clients/auth";
import {getBattlesByIds} from "@/clients/referee";
import {prisma} from "@/server/db";
import {findBattleBets} from "@/services/bets/read";
import {toBattleBetsView} from "@/app/api/bets/mapper";

/**
 * Vue publique des paris d'une bataille, sans authentification comme la page
 * bataille qu'elle sert. Ce qu'elle expose est réduit à dessein : paris
 * confirmés uniquement, pseudo de l'auteur, aucun montant de gain individuel.
 */
export async function GET(request: Request, {params}: {params: Promise<{battle_id: string}>}) {
    const {battle_id} = await params;

    try {
        const bets = await findBattleBets(prisma, battle_id);
        const battleId = Number(battle_id);

        const [battles, pseudos] = await Promise.all([
            Number.isSafeInteger(battleId) ? getBattlesByIds([battleId]) : [],
            getPseudosByUserId(bets.map((bet) => bet.userId)),
        ]);

        return NextResponse.json(toBattleBetsView(battle_id, battles[0] ?? null, bets, pseudos));
    } catch (error) {
        console.error(`[GET /api/battles/${battle_id}/bets]`, error);
        return NextResponse.json({error: "Internal server error"}, {status: 500});
    }
}
