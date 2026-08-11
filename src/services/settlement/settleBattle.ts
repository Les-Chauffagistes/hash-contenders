import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {BET_HANDLERS} from "@/services/bets/registry";
import {fetchBattleResult} from "@/services/settlement/battleResult";
import {refundKey, settleKey} from "@/services/payouts/idempotencyKeys";

type Breakdown = Record<
  string,
  {
    pot: number;
    winners: Record<string, number>;
    refunded: boolean;
  }
>;

/**
 * Règle le pari-mutuel d'une bataille terminée. Appelable depuis n'importe
 * où (fast path Python, sweep périodique, retry manuel), sûre à appeler
 * plusieurs fois en concurrence :
 * - le verrou advisory (pris en premier, à l'intérieur de la transaction)
 *   sérialise les appels concurrents pour cette bataille ;
 * - la PRIMARY KEY sur battle_settlement.battleId EST le mécanisme
 *   exactly-once — un deuxième settlement se casse dessus et rollback, il
 *   n'y a aucun flag applicatif à vérifier ailleurs.
 *
 * Aucun appel réseau dans la transaction : le résultat de la bataille est
 * récupéré avant de l'ouvrir, et passé en valeur figée au calcul.
 */
export async function settleBattle(db: PrismaClient, battleId: number | string): Promise<void> {
  const battleResult = await fetchBattleResult(battleId);
  if (!battleResult.isFinished) return;

  const id = battleResult.battleId;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;

    const alreadySettled = await tx.battleSettlement.findUnique({where: {battleId: id}});
    if (alreadySettled) return;

    // Ferme la bataille aux paris : hash-contenders ne possède pas de table
    // Battle (le référee Python en reste propriétaire), c'est le pendant
    // local, côté `bets`, de cette clôture.
    await tx.battleClosure.create({data: {battleId: id}});

    let potTotal = 0;
    const winningsByUser = new Map<bigint, number>();
    const refundsByUser = new Map<bigint, number>();
    const betResults: {id: string; result: "won" | "lost" | "cancelled"}[] = [];
    const breakdown: Breakdown = {};

    // L'ensemble des paris pris en compte est figé ici : chaque handler ne
    // lit que les paris `confirmed` de la bataille, dans cette transaction.
    // Un pari qui se confirmerait après ce point (retard du débit escrow)
    // n'est simplement jamais compté — signalé par la réconciliation (Phase 6).
    for (const handler of Object.values(BET_HANDLERS)) {
      const bets = await handler.loadConfirmedBets(tx, id);
      if (bets.length === 0) continue;

      const pot = bets.reduce((sum, bet) => sum + bet.amount, 0);
      potTotal += pot;

      const winnerShares = handler.computePayouts(bets, battleResult);

      if (winnerShares.size === 0) {
        // Aucun pari de ce type ne satisfait la condition de victoire :
        // rembourser chaque parieur sa propre mise plutôt que de laisser des
        // fonds bloqués en escrow sans destinataire légitime.
        for (const bet of bets) {
          refundsByUser.set(bet.userId, (refundsByUser.get(bet.userId) ?? 0) + bet.amount);
          betResults.push({id: bet.id, result: "cancelled"});
        }
      } else {
        for (const bet of bets) {
          betResults.push({id: bet.id, result: winnerShares.has(bet.userId) ? "won" : "lost"});
        }
        for (const [userId, amount] of winnerShares) {
          winningsByUser.set(userId, (winningsByUser.get(userId) ?? 0) + amount);
        }
      }

      breakdown[handler.type] = {
        pot,
        winners: Object.fromEntries([...winnerShares].map(([userId, amount]) => [userId.toString(), amount])),
        refunded: winnerShares.size === 0,
      };
    }

    await tx.battleSettlement.create({
      data: {battleId: id, potTotal, breakdown: breakdown as unknown as Prisma.InputJsonValue},
    });

    await Promise.all(betResults.map((bet) => tx.bet.update({where: {id: bet.id}, data: {result: bet.result}})));

    await Promise.all([
      ...[...winningsByUser].map(([userId, amount]) =>
        tx.payoutOutbox.create({
          data: {
            battleId: id,
            userId,
            amount,
            direction: "escrow_to_winner",
            idempotencyKey: settleKey(id, userId),
          },
        }),
      ),
      ...[...refundsByUser].map(([userId, amount]) =>
        tx.payoutOutbox.create({
          data: {
            battleId: id,
            userId,
            amount,
            direction: "escrow_to_refund",
            idempotencyKey: refundKey(id, userId),
          },
        }),
      ),
    ]);
  });
}
