import {getBattleStatus} from "@/clients/referee";
import type {BattleResult} from "@/services/bets/baseBet";

/**
 * Traduit la réponse du référee (Python) en résultat de bataille utilisable
 * pour le settlement. Appelé HORS transaction Postgres : le résultat est
 * ensuite passé en valeur simple au calcul, qui lui n'appelle plus jamais le
 * réseau.
 */
export async function fetchBattleResult(battleId: number | string): Promise<BattleResult> {
  const status = await getBattleStatus(battleId, true);

  const [contender1, contender2] = status.contender_info;
  const winnerIndex =
    contender1 && contender2
      ? contender1.pv > contender2.pv
        ? 1
        : contender2.pv > contender1.pv
          ? 2
          : null
      : null;

  const maxDiffAchieved = status.hits.reduce(
    (max, round) => Math.max(max, round.contender_1_best_diff, round.contender_2_best_diff),
    0,
  );

  return {
    battleId: status.battle_id.toString(),
    isFinished: status.is_finished,
    winnerIndex,
    maxDiffAchieved,
  };
}
