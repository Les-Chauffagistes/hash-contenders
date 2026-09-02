import {PrismaClient} from "@/generated/prisma/client";
import {getAllBattles} from "@/clients/referee";
import {settleBattle} from "@/services/settlement/settleBattle";
import {cancelBattle} from "@/services/settlement/cancelBattle";

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

/**
 * Filet de sécurité de l'annulation : symétrique de `sweepUnsettledBattles`
 * pour les batailles supprimées côté référee plutôt que terminées. Le
 * référee n'a pas de table Battle après un DELETE, donc aucune requête ne
 * peut jamais faire réapparaître ces batailles dans `getAllBattles()` — un
 * pari `confirmed` dont la bataille est absente de cette liste est
 * définitivement orphelin, jamais juste "pas encore fini".
 */
export async function sweepOrphanedBets(db: PrismaClient): Promise<number> {
  const confirmedBattles = await db.bet.findMany({
    where: {status: "confirmed", result: "pending"},
    select: {battleId: true},
    distinct: ["battleId"],
  });
  if (confirmedBattles.length === 0) return 0;

  const battles = await getAllBattles();
  const existingIds = new Set(battles.map((battle) => battle.id.toString()));

  const orphanedIds = confirmedBattles.map((bet) => bet.battleId).filter((id) => !existingIds.has(id));
  for (const battleId of orphanedIds) {
    await cancelBattle(db, battleId);
  }
  return orphanedIds.length;
}
