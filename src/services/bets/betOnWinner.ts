import {z} from "zod";
import {assertBettingOpen, BattleResult, BetContext, ConfirmedBet, defineBetHandler, TransactionClient} from "@/services/bets/baseBet";
import {BetCreationError} from "./errors";
import {splitProportionally} from "@/services/settlement/splitProportionally";


export const BetOnWinnerSchema = z.object({
  winner_index: z.number().gte(1).lte(2).int(),
});

type Persisted = {winnerIndex: number};

export const betOnWinnerHandler = defineBetHandler<typeof BetOnWinnerSchema, Persisted>({
  type: "betOnWinner",
  schema: BetOnWinnerSchema,

  /**
   * Ferme les paris une fois la bataille démarrée (comme betOnBestShare), et
   * refuse qu'un joueur mise sur les deux contenders d'une même bataille.
   */
  async checkPreconditions(data: z.infer<typeof BetOnWinnerSchema>, ctx: BetContext) {
    assertBettingOpen(ctx.battle);

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

  async loadConfirmedBets(tx: TransactionClient, battleId: string): Promise<ConfirmedBet<Persisted>[]> {
    const rows = await tx.bet.findMany({
      where: {battleId, status: "confirmed", betOnWinner: {isNot: null}},
      include: {betOnWinner: true},
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      specialized: {winnerIndex: row.betOnWinner!.winnerIndex},
    }));
  },

  /** Gagne qui a prédit l'index du vainqueur réel. Égalité (winnerIndex null) : personne ne peut gagner. */
  computePayouts(bets: ConfirmedBet<Persisted>[], battleResult: BattleResult): Map<bigint, number> {
    if (battleResult.winnerIndex === null) return new Map();

    const winners = bets.filter((bet) => bet.specialized.winnerIndex === battleResult.winnerIndex);
    if (winners.length === 0) return new Map();

    const pot = bets.reduce((sum, bet) => sum + bet.amount, 0);
    return splitProportionally(pot, winners);
  },
});
