import {BetHandler} from "@/services/bets/baseBet";
import {betOnWinnerHandler} from "@/services/bets/betOnWinner";
import {betOnBestShareHandler} from "@/services/bets/betOnBestShare";
import type {BetTypeId} from "@/contracts/bets";

/**
 * Registre unique des types de pari, partagé entre placement (`create.ts`)
 * et règlement (`settleBattle.ts`). Ajouter un type = un fichier exportant
 * un handler et une ligne ici.
 */
export const BET_HANDLERS: Record<BetTypeId, BetHandler> = {
  betOnWinner: betOnWinnerHandler,
  betOnBestShare: betOnBestShareHandler,
};

function isBetTypeId(type: string): type is BetTypeId {
  return Object.hasOwn(BET_HANDLERS, type);
}

export function getBetHandler(type: string): BetHandler | undefined {
  return isBetTypeId(type) ? BET_HANDLERS[type] : undefined;
}
