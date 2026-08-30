export const BET_TYPE_IDS = ["betOnWinner", "betOnBestShare"] as const;

export type BetTypeId = (typeof BET_TYPE_IDS)[number];

/** Prix fixe du ticket betOnBestShare : la mise n'est plus libre pour ce type. */
export const BEST_SHARE_TICKET_PRICE = 50;

export type BetDetailsByType = {
  betOnWinner: {
    winnerIndex: number;
  };
  betOnBestShare: {
    diff: number;
  };
};

export type BattleSummary = {
  id: number;
  contender_1_name: string;
  contender_2_name: string;
  is_finished: boolean;
  rounds: number;
  start_height: number;
  contenders_pv: number;
};

/** Issue du pari une fois la bataille réglée. */
export type BetResult = "pending" | "won" | "lost" | "cancelled";

/** État du débit escrow. Ne sort jamais vers un autre joueur que son auteur. */
export type BetEscrowStatus = "pending" | "confirmed" | "void";

type BetItemBase = {
  id: string;
  createdAt: string;
  amount: number;
  result: BetResult;
  status: BetEscrowStatus;
};

/**
 * L'appariement type ↔ details, sous forme d'union discriminée. Exporté parce
 * que les mappers le construisent : le dériver avec un `Pick` sur un type de
 * pari complet ne marcherait pas, `Pick` ne distribue pas sur une union et
 * élargirait `type` et `details` chacun de leur côté.
 */
export type SpecializedBet = {
  [Type in BetTypeId]: {
    type: Type;
    details: BetDetailsByType[Type];
  };
}[BetTypeId];

/**
 * Un pari, tel qu'il se lit sous sa bataille : ni `battleId` ni `battle`, qui
 * sont portés une seule fois par le `UserBattleBets` qui le contient.
 */
export type UserBetItem = BetItemBase & SpecializedBet;

/**
 * Ce que le règlement d'une bataille a rapporté à l'utilisateur.
 *
 * Attaché à la bataille et non au pari : `settleBattle` répartit le pot par
 * utilisateur et par type de pari, et `splitProportionally` cumule en une seule
 * part les paris gagnants d'un même joueur — il n'existe donc pas de montant
 * par pari à exposer, et en dériver un reviendrait à recalculer autrement ce
 * que le settlement a figé.
 */
export type UserBattlePayout = {
    /**
     * Total crédité au titre des gains, **mise comprise** : le pot d'un type de
     * pari inclut la mise des gagnants. Le gain net se lit en retranchant les
     * mises du joueur sur cette bataille.
     */
    winnings: number;
    /** Mises rendues au joueur faute de gagnant pour un type de pari. */
    refunds: number;
};

/**
 * Les paris d'un joueur sur une bataille, et ce qu'elle lui a rapporté.
 *
 * C'est l'unité de lecture des paris : l'écran « mes paris » en affiche une
 * liste, une vue « mes paris sur cette bataille » en affichera un seul. La
 * bataille est le niveau auquel le règlement produit ses montants — le pari
 * n'en porte aucun.
 */
export type UserBattleBets = {
    battleId: string;
    /** `null` si le référee n'a pas rendu la bataille (identifiant inconnu, service muet). */
    battle: BattleSummary | null;
    /** Total misé par le joueur sur cette bataille, paris non confirmés compris. */
    stake: number;
    /** `null` tant que la bataille n'est pas réglée. */
    payout: UserBattlePayout | null;
    bets: UserBetItem[];
};

export type UserBetsOverview = {
    battles: UserBattleBets[];
};

/** Le joueur derrière un pari, tel qu'il s'affiche aux autres. */
export type BattlePlayer = {
    id: string;
    /** `null` si l'annuaire n'a pas rendu ce joueur (compte supprimé, service muet). */
    pseudo: string | null;
};

/**
 * Un pari dans la vue publique d'une bataille.
 *
 * Pas de `status` : l'état du débit escrow d'un joueur ne regarde que lui, et
 * la vue ne liste que des paris confirmés de toute façon. Pas de montant de
 * gain non plus — c'est `UserBattlePayout`, rendu au seul joueur concerné.
 */
export type BattleBetItem = {
    id: string;
    player: BattlePlayer;
    createdAt: string;
    amount: number;
    result: BetResult;
} & SpecializedBet;

export type BattleBetsView = {
    battleId: string;
    battle: BattleSummary | null;
    /**
     * Mises confirmées visibles : betOnWinner toujours inclus, betOnBestShare
     * inclus seulement si `betOnBestShareRevealed`.
     */
    pot: number;
    /**
     * `false` tant que la bataille n'a pas démarré : les paris betOnBestShare
     * sont alors absents de `bets` et exclus de `pot` ; betOnWinner reste
     * visible normalement.
     */
    betOnBestShareRevealed: boolean;
    bets: BattleBetItem[];
};

export const BetNames: Record<BetTypeId, string> = {
  betOnWinner: "Pari sur le gagnant",
  betOnBestShare: "Pari sur le meilleur share",
};
