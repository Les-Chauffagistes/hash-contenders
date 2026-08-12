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

  /** Aucune condition. Un nouveau pari en remplace un autre **/
  async checkPreconditions(_data, _ctx) {
    return
  },

  async persist(tx, betId, data) {
    await tx.betOnBestShare.upsert({
      where: {betId},
      update: {
        diff: UnitConverter.fromStringToNumber(data.diff),
        betId,
      },
      create: {
        diff: UnitConverter.fromStringToNumber(data.diff),
        betId,
      }
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
   * Règle provisoire, isolée ici pour rester facile à corriger : gagne le
   * pari dont la difficulté prédite est la plus élevée parmi celles
   * effectivement atteintes par la bataille (cohérent avec
   * checkPreconditions, qui suppose des paris à la hausse — un pari plus
   * faible qu'un précédent est refusé). À égalité de difficulté, le pot est
   * réparti au prorata des mises. À confirmer avec le produit ; ne touche à
   * rien d'autre dans le settlement si la règle change.
   */
  computePayouts(bets: ConfirmedBet<Persisted>[], battleResult: BattleResult): Map<bigint, number> {
    const maxAchieved = BigInt(Math.floor(battleResult.maxDiffAchieved));
    const reached = bets.filter((bet) => bet.specialized.diff <= maxAchieved);
    if (reached.length === 0) return new Map();

    const bestDiff = reached.reduce((max, bet) => (bet.specialized.diff > max ? bet.specialized.diff : max), reached[0].specialized.diff);
    const winners = reached.filter((bet) => bet.specialized.diff === bestDiff);

    const pot = bets.reduce((sum, bet) => sum + bet.amount, 0);
    return splitProportionally(pot, winners);
  },
});
