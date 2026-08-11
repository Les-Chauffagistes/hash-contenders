import {PrismaClient} from "@/generated/prisma/client";
import {getSystemAccountBalance} from "@/app/api/lib/coins";
import {escrowUserId} from "@/services/payouts/escrow";
import {CURRENCY} from "@/services/bets/baseBet";

const RECENT_BATTLES_LIMIT = 50;

export type EscrowDrift = {battleId: string; escrowBalance: number};

/**
 * Vérifie, pour les batailles réglées les plus récentes dont l'outbox est
 * entièrement traitée (plus aucune ligne 'pending'), que leur compte escrow
 * est bien retombé à zéro. Hors du chemin critique : ne bloque rien, ne
 * corrige rien, se contente de signaler une dérive pour investigation
 * manuelle — le settlement lui-même reste la source de vérité.
 *
 * Se limite volontairement à une fenêtre glissante des dernières batailles
 * réglées plutôt que de tout revérifier indéfiniment : une bataille dont
 * l'escrow a déjà été vérifié à zéro, et dont l'outbox est terminale, ne
 * peut plus dériver toute seule.
 */
export async function reconcileEscrowBalances(db: PrismaClient): Promise<EscrowDrift[]> {
  const settlements = await db.battleSettlement.findMany({
    orderBy: {settledAt: "desc"},
    take: RECENT_BATTLES_LIMIT,
    select: {battleId: true},
  });

  const drifted: EscrowDrift[] = [];

  for (const {battleId} of settlements) {
    const stillPending = await db.payoutOutbox.count({
      where: {battleId, status: "pending"},
    });
    if (stillPending > 0) continue; // pas encore entièrement dispatché, trop tôt pour juger

    const balance = await getSystemAccountBalance(escrowUserId(battleId), CURRENCY);
    if (balance !== 0) {
      console.error(`[reconciliation] escrow:battle:${battleId} devrait être à zéro, vaut ${balance}`);
      drifted.push({battleId, escrowBalance: balance});
    }
  }

  return drifted;
}
