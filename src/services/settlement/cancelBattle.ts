import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {BET_HANDLERS} from "@/services/bets/registry";
import {refundKey} from "@/services/payouts/idempotencyKeys";

type Breakdown = Record<string, Record<string, number>>;

/**
 * Annule une bataille supprimée côté référee et rembourse intégralement
 * chaque parieur. Symétrique de `settleBattle`, appelable depuis n'importe où
 * (webhook de suppression, sweep périodique), sûr à appeler plusieurs fois en
 * concurrence :
 * - le verrou advisory (même clé que `settleBattle`, la bataille ne peut pas
 *   être réglée et annulée en même temps) sérialise les appels concurrents ;
 * - la PRIMARY KEY sur battle_refund.battleId EST le mécanisme
 *   exactly-once, comme battle_settlement.battleId pour `settleBattle`.
 *
 * Une bataille déjà réglée (battle_settlement existe) n'est jamais annulée :
 * ses paris ont déjà un résultat définitif (won/lost/cancelled) et des
 * payouts committés, les rejouer romprait l'exactly-once du settlement.
 */
export async function cancelBattle(db: PrismaClient, battleId: number | string): Promise<void> {
  const id = battleId.toString();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;

    const alreadySettled = await tx.battleSettlement.findUnique({where: {battleId: id}});
    if (alreadySettled) return;

    const alreadyRefunded = await tx.battleRefund.findUnique({where: {battleId: id}});
    if (alreadyRefunded) return;

    await tx.battleClosure.upsert({
      where: {battleId: id},
      create: {battleId: id},
      update: {},
    });

    const refundsByUser = new Map<bigint, number>();
    const breakdown: Breakdown = {};

    for (const handler of Object.values(BET_HANDLERS)) {
      const bets = await handler.loadConfirmedBets(tx, id);
      if (bets.length === 0) continue;

      breakdown[handler.type] = {};
      for (const bet of bets) {
        refundsByUser.set(bet.userId, (refundsByUser.get(bet.userId) ?? 0) + bet.amount);
        breakdown[handler.type][bet.userId.toString()] = bet.amount;
      }

      await tx.bet.updateMany({
        where: {id: {in: bets.map((bet) => bet.id)}},
        data: {result: "cancelled"},
      });
    }

    await tx.battleRefund.create({
      data: {battleId: id, breakdown: breakdown as unknown as Prisma.InputJsonValue},
    });

    await Promise.all(
      [...refundsByUser].map(([userId, amount]) =>
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
    );
  });
}
