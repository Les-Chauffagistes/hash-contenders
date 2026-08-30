import {PrismaClient} from "@/generated/prisma/client";
import {getAllBattles} from "@/clients/referee";
import {settleBattle} from "@/services/settlement/settleBattle";

/**
 * Filet de sécurité du settlement : le fast path (webhook fire-and-forget du
 * référee) peut se perdre sans que personne ne le remarque, ce sweep répare
 * ça. Interroge les batailles terminées côté référee, et règle celles qui
 * n'ont pas encore de ligne battle_settlement. Peut tourner alors que le
 * fast path est totalement retiré : le système continue de fonctionner.
 */
export async function sweepUnsettledBattles(db: PrismaClient): Promise<number> {
  const battles = await getAllBattles();
  const finishedIds = battles.filter((battle) => battle.is_finished).map((battle) => battle.id.toString());
  if (finishedIds.length === 0) return 0;

  const settled = await db.battleSettlement.findMany({
    where: {battleId: {in: finishedIds}},
    select: {battleId: true},
  });
  const settledIds = new Set(settled.map((s) => s.battleId));

  const unsettledIds = finishedIds.filter((id) => !settledIds.has(id));
  for (const battleId of unsettledIds) {
    await settleBattle(db, battleId);
  }
  return unsettledIds.length;
}
