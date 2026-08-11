import { z } from "zod";
import {BattleResult, ConfirmedBet, defineBetHandler, TransactionClient} from "@/services/bets/baseBet";
import UnitConverter from "@/lib/UnitConverter";
import {splitProportionally} from "@/services/settlement/splitProportionally";


export const BetOnBestShareSchema = z.object({
  diff: z.string(),
});

type Persisted = {diff: bigint};

export const betOnBestShareHandler = defineBetHandler<typeof BetOnBestShareSchema, Persisted>({
  type: "betOnBestShare",
  schema: BetOnBestShareSchema,

  /** Un jour ne peut pas miser sur une difficulté plus faible à une de ses propres paris **/
  async checkPreconditions(data, ctx) {
    const parsedDiff = UnitConverter.fromStringToNumber(data.diff);
    const conflictingBet = await ctx.db.bet.findFirst({
      where: {
        userId: ctx.userId,
        battleId: ctx.submission.battle_id.toString(),
        betOnBestShare: {diff: {gte: parsedDiff}},
      },
      select: {id: true},
    });
    if (conflictingBet) throw new Error("Pari conflictuel");
  },

  async persist(tx, betId, data) {
    await tx.betOnBestShare.create({
      data: {
        diff: UnitConverter.fromStringToNumber(data.diff),
        betId,
      },
    });
  },

  async loadConfirmedBets(tx: TransactionClient, battleId: string): Promise<ConfirmedBet<Persisted>[]> {
    const rows = await tx.bet.findMany({
      where: {battleId, status: "confirmed", betOnBestShare: {isNot: null}},
      include: {betOnBestShare: true},
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      specialized: {diff: row.betOnBestShare!.diff},
    }));
  },

  /**
   * Règle provisoire, isolée ici pour rester facile à corriger : un pari
   * gagne si la difficulté prédite a bien été atteinte ou dépassée par la
   * bataille (cohérent avec checkPreconditions, qui suppose des paris à la
   * hausse — un pari plus faible qu'un précédent est refusé). À confirmer
   * avec le produit ; ne touche à rien d'autre dans le settlement si la
   * règle change.
   */
  computePayouts(bets: ConfirmedBet<Persisted>[], battleResult: BattleResult): Map<bigint, number> {
    const winners = bets.filter((bet) => Number(bet.specialized.diff) <= battleResult.maxDiffAchieved);
    if (winners.length === 0) return new Map();

    const pot = bets.reduce((sum, bet) => sum + bet.amount, 0);
    return splitProportionally(pot, winners);
  },
});
