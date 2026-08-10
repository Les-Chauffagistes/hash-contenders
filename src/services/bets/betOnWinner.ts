import {z} from "zod";
import {BetContext, defineBetHandler, TransactionClient} from "@/services/bets/baseBet";
import {BetCreationError} from "./errors";


export const BetOnWinnerSchema = z.object({
  winner_index: z.number().gte(1).lte(2).int(),
});

export const betOnWinnerHandler = defineBetHandler({
  type: "betOnWinner",
  schema: BetOnWinnerSchema,

  /** Un joueur ne peut pas miser sur les deux contenders d'une même bataille. */
  async checkPreconditions(data: z.infer<typeof BetOnWinnerSchema>, ctx: BetContext) {
    const conflictingBet = await ctx.db.bet.findFirst({
      where: {
        userId: ctx.userId,
        battleId: ctx.submission.battle_id.toString(),
        betOnWinner: {winnerIndex: {not: data.winner_index}},
      },
      select: {id: true},
    });
    if (conflictingBet) throw new BetCreationError("Pari conflictuel");
  },

  async persist(tx: TransactionClient, betId: string, data: z.infer<typeof BetOnWinnerSchema>) {
    await tx.betOnWinner.create({
      data: {
        winnerIndex: data.winner_index,
        betId,
      },
    });
  },
});
