import { ResultStatus, BetStatus } from "@/generated/prisma/enums";

export type BattleSummary = {
    id: number;
    contender_1_name: string;
    contender_2_name: string;
    is_finished: boolean;
    rounds: number;
    start_height: number;
    contenders_pv: number;
};

export type UserBetListItem = {
    id: string;
    battleId: string;
    createdAt: string;
    amount: number;
    result: ResultStatus | null;
    status: BetStatus;
    betOnWinner: {
        winnerIndex: number;
    } | null;
    battle: BattleSummary | null;
};
