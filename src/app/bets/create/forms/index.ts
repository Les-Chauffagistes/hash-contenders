import { ComponentType } from "react";
import { BetTypeId } from "@/app/bets/betTypes";
import { BetTypeFormProps } from "./types";
import BetOnWinnerForm from "./BetOnWinnerForm";
import BetOnBestShareForm from "./BetOnBestShareForm";

/**
 * Formulaire métier associé à chaque type de pari. Le Record est exhaustif :
 * ajouter un `BetTypeId` sans son formulaire est une erreur de compilation.
 */
export const BET_TYPE_FORMS: Record<BetTypeId, ComponentType<BetTypeFormProps>> = {
    betOnWinner: BetOnWinnerForm,
    betOnBestShare: BetOnBestShareForm,
};

export type { BetTypeFormProps };