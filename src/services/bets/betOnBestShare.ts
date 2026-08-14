import { z } from "zod";
import {assertBettingOpen, BattleResult, ConfirmedBet, defineBetHandler, TransactionClient} from "@/services/bets/baseBet";
import {BEST_SHARE_TICKET_PRICE} from "@/contracts/bets";
import UnitConverter from "@/lib/UnitConverter";
import {splitProportionally} from "@/services/settlement/splitProportionally";
import {InvalidBetDataError} from "@/services/bets/errors";


export const BetOnBestShareSchema = z.object({
  diff: z.string(),
});

type Persisted = {diff: bigint};

/** Répartition du pot selon le nombre de rangs de diff distincts atteints. */
const TIER_PERCENTAGES: Record<number, number[]> = {
  1: [100],
  2: [70, 30],
  3: [60, 30, 10],
};

export const betOnBestShareHandler = defineBetHandler<typeof BetOnBestShareSchema, Persisted>({
  type: "betOnBestShare",
  schema: BetOnBestShareSchema,

  /**
   * Ticket à prix fixe, modifiable gratuitement tant que la bataille n'a pas
   * démarré. `current_round > 0` est le même seuil que celui déjà utilisé
   * côté frontend (`BattleCard.tsx`) pour savoir si une bataille a démarré.
   */
  async checkPreconditions(_data, ctx) {
    assertBettingOpen(ctx.battle);
    if (ctx.submission.amount !== BEST_SHARE_TICKET_PRICE) {
      throw new InvalidBetDataError(`Le prix du ticket est fixe à ${BEST_SHARE_TICKET_PRICE}`);
    }
  },

  /**
   * Un seul ticket par (user, battle) : `createBet.ts` édite ce pari en
   * place plutôt que d'en créer un nouveau dès qu'il en trouve un.
   * `void` est exclu (un débit raté ne doit pas bloquer une nouvelle
   * tentative) ; `pending` est inclus (modifier la diff pendant qu'un débit
   * est encore en cours est sûr, `persist` ne touche jamais l'escrow).
   */
  async findEditableBet(tx: TransactionClient, userId: number, battleId: string) {
    return tx.bet.findFirst({
      where: {userId, battleId, status: {in: ["pending", "confirmed"]}, betOnBestShare: {isNot: null}},
      select: {id: true},
    });
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
   * Récompense les 3 diffs distinctes les plus élevées parmi celles
   * effectivement atteintes par la bataille (`diff <= maxDiffAchieved`) :
   * 60/30/10 du pot à 3 rangs distincts, 70/30 à 2, 100% à 1 seul. À
   * égalité sur un même rang, la part du rang se répartit au prorata des
   * mises entre les ex-aequo. Aucune diff atteinte : aucun gagnant, Map
   * vide — `settleBattle` applique alors `refundRate`.
   */
  computePayouts(bets: ConfirmedBet<Persisted>[], battleResult: BattleResult): Map<bigint, number> {
    const maxAchieved = BigInt(Math.floor(battleResult.maxDiffAchieved));
    const reached = bets.filter((bet) => bet.specialized.diff <= maxAchieved);
    if (reached.length === 0) return new Map();

    const pot = bets.reduce((sum, bet) => sum + bet.amount, 0);

    const byDiff = new Map<bigint, {userId: bigint; amount: number}[]>();
    for (const bet of reached) {
      const list = byDiff.get(bet.specialized.diff) ?? [];
      list.push({userId: bet.userId, amount: bet.amount});
      byDiff.set(bet.specialized.diff, list);
    }

    const ranksDesc = [...byDiff.keys()]
      .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
      .slice(0, 3);
    const percentages = TIER_PERCENTAGES[ranksDesc.length];

    const shares = new Map<bigint, number>();
    ranksDesc.forEach((diff, i) => {
      const tierPot = Math.floor((pot * percentages[i]) / 100);
      for (const [userId, amount] of splitProportionally(tierPot, byDiff.get(diff)!)) {
        shares.set(userId, (shares.get(userId) ?? 0) + amount);
      }
    });
    return shares;
  },

  /** Aucun gagnant : 80% remboursé, 20% brûlé (reste en escrow, jamais reversé). */
  refundRate: 0.8,
});
