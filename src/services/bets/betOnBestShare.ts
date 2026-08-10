import { z } from "zod";
import { defineBetHandler } from "@/services/bets/baseBet";
import UnitConverter from "@/lib/UnitConverter";


export const BetOnBestShareSchema = z.object({
  diff: z.string(),
});

export const betOnBestShareHandler = defineBetHandler({
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
});