import {NextResponse} from "next/server";
import {getPseudosByUserId} from "@/clients/auth";
import {getBattlesByIds, getBattleStatus} from "@/clients/referee";
import {prisma} from "@/server/db";
import {findBattleBets} from "@/services/bets/read";
import {toBattleBetsView} from "@/app/api/bets/mapper";

/**
 * Vue publique des paris d'une bataille, sans authentification comme la page
 * bataille qu'elle sert. Ce qu'elle expose est réduit à dessein : paris
 * confirmés uniquement, pseudo de l'auteur, aucun montant de gain individuel,
 * et les positions betOnBestShare restent masquées tant que la bataille n'a
 * pas démarré (voir `toBattleBetsView`).
 */
async function fetchCurrentRound(battleId: number): Promise<number | null> {
    try {
        return (await getBattleStatus(battleId)).current_round;
    } catch {
        // État inconnu : échec non bloquant, traité comme "pas démarré" —
        // fail-safe côté confidentialité plutôt que de tout révéler par défaut.
        return null;
    }
}

export async function GET(request: Request, {params}: {params: Promise<{battle_id: string}>}) {
    const {battle_id} = await params;

    try {
        const bets = await findBattleBets(prisma, battle_id);
        const battleId = Number(battle_id);
        const isValidBattleId = Number.isSafeInteger(battleId);

        const [battles, pseudos, currentRound] = await Promise.all([
            isValidBattleId ? getBattlesByIds([battleId]) : [],
            getPseudosByUserId(bets.map((bet) => bet.userId)),
            isValidBattleId ? fetchCurrentRound(battleId) : Promise.resolve(null),
        ]);
        const betOnBestShareRevealed = (currentRound ?? 0) > 0;

        return NextResponse.json(
            toBattleBetsView(battle_id, battles[0] ?? null, bets, pseudos, betOnBestShareRevealed),
        );
    } catch (error) {
        console.error(`[GET /api/battles/${battle_id}/bets]`, error);
        return NextResponse.json({error: "Internal server error"}, {status: 500});
    }
}
