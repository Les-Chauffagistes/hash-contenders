export const BET_TYPE_IDS = ["betOnWinner", "betOnBestShare"] as const;

export type BetTypeId = (typeof BET_TYPE_IDS)[number];

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

type BetListItemBase = {
  id: string;
  battleId: string;
  createdAt: string;
  amount: number;
  result: "pending" | "won" | "lost" | "cancelled";
  status: "pending" | "confirmed" | "void";
  battle: BattleSummary | null;
};

type SpecializedBet = {
  [Type in BetTypeId]: {
    type: Type;
    details: BetDetailsByType[Type];
  };
}[BetTypeId];

export type UserBetListItem = BetListItemBase & SpecializedBet;

export const BetNames: Record<BetTypeId, string> = {
  betOnWinner: "Pari sur le gagnant",
  betOnBestShare: "Pari sur le meilleur share",
};
