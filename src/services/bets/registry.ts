import {BetHandler} from "@/services/bets/baseBet";
import {betOnWinnerHandler} from "@/services/bets/betOnWinner";
import {betOnBestShareHandler} from "@/services/bets/betOnBestShare";

/**
 * Registre unique des types de pari, partagé entre placement (`create.ts`)
 * et règlement (`settleBattle.ts`). Ajouter un type = un fichier exportant
 * un handler et une ligne ici.
 */
export const BET_HANDLERS: Record<string, BetHandler> = {
  [betOnWinnerHandler.type]: betOnWinnerHandler,
  [betOnBestShareHandler.type]: betOnBestShareHandler,
};
