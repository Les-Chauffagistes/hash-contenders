/**
 * Lecture d'un pari : traduit la seule partie qui varie d'un type à l'autre —
 * `details` — en un couple libellé/valeur affichable tel quel, et l'état du
 * pari en un badge.
 *
 * Pendant de `create/forms/index.ts` côté lecture : un type de pari se déclare
 * dans `@/contracts/bets`, puis ici pour son rendu en liste. Volontairement
 * sans JSX : les composants se contentent d'habiller ce que ce module produit.
 */

import UnitConverter from "@/lib/UnitConverter";
import type {
    BattleSummary,
    BetDetailsByType,
    BetResult,
    BetTypeId,
    SpecializedBet,
    UserBattleBets,
    UserBetItem,
} from "@/contracts/bets";

export type BetPrediction = {
    /** Ce que le pari prédit, formulé dans les termes de ce type. */
    label: string;
    /** La prédiction elle-même, mise en avant sur la carte. */
    value: string;
};

type BetPredictors = {
    [Type in BetTypeId]: (
        details: BetDetailsByType[Type],
        battle: BattleSummary | null,
    ) => BetPrediction;
};

/** « Contender 2 » ne dit rien au joueur : on remonte au nom dès qu'on l'a. */
function contenderName(battle: BattleSummary | null, index: number): string {
    if (!battle) return `Contender ${index}`;
    return index === 1 ? battle.contender_1_name : battle.contender_2_name;
}

/** Record exhaustif : ajouter un `BetTypeId` sans son rendu ne compile pas. */
const PREDICTORS: BetPredictors = {
    betOnWinner: ({winnerIndex}, battle) => ({
        label: "Vainqueur visé",
        value: contenderName(battle, winnerIndex),
    }),
    betOnBestShare: ({diff}) => ({
        label: "Meilleur share ≥",
        value: UnitConverter.fromNumberToString(diff),
    }),
};

/** La bataille vient du `UserBattleBets` qui porte le pari — lui ne l'a plus. */
export function describePrediction(bet: SpecializedBet, battle: BattleSummary | null): BetPrediction {
    // Indexer le Record par le discriminant donne une union de fonctions, dont
    // TS ne sait plus qu'elle est appariée au `details` du *même* membre de
    // l'union. Le cast rétablit cet appariement, garanti par la construction de
    // `BetPredictors` au-dessus des mêmes clés.
    const describe = PREDICTORS[bet.type] as (
        details: SpecializedBet["details"],
        battle: BattleSummary | null,
    ) => BetPrediction;

    return describe(bet.details, battle);
}

export type BetStateTone = "pending" | "confirmed" | "won" | "lost" | "void";

export type BetState = {
    label: string;
    tone: BetStateTone;
};

export function describeResult(result: BetResult): BetState {
    switch (result) {
        case "won":
            return {label: "Gagné", tone: "won"};
        case "lost":
            return {label: "Perdu", tone: "lost"};
        case "cancelled":
            return {label: "Annulé", tone: "void"};
        case "pending":
            return {label: "En jeu", tone: "confirmed"};
    }
}

/**
 * `status` (le débit escrow a-t-il abouti) et `result` (l'issue de la bataille)
 * sont deux axes distincts, et le badge n'en montre qu'un. L'ordre ci-dessous
 * fixe la priorité : tant que la mise n'est pas prélevée ou que le pari est
 * annulé, l'issue n'a pas de sens à être affichée.
 */
export function describeState(bet: UserBetItem): BetState {
    if (bet.status === "pending") return {label: "À confirmer", tone: "pending"};
    if (bet.status === "void") return {label: "Annulé", tone: "void"};
    return describeResult(bet.result);
}

/** Un pari confirmé dont l'issue n'est pas encore connue. */
export function isAwaitingOutcome(bet: UserBetItem): boolean {
    return bet.status !== "void" && bet.result === "pending";
}

/** « Alice vs Bob », ou un repli sur l'identifiant si le référee n'a rien rendu. */
export function battleLabel(battleBets: UserBattleBets): string {
    const {battle} = battleBets;
    if (!battle) return `Bataille #${battleBets.battleId}`;
    return `${battle.contender_1_name} vs ${battle.contender_2_name}`;
}

/** Range la bataille dans la section « En cours » de l'écran. */
export function isBattleAwaitingOutcome(battleBets: UserBattleBets): boolean {
    return battleBets.bets.some(isAwaitingOutcome);
}
