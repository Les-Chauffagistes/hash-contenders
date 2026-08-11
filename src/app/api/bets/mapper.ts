import type {BattleSummary, UserBetListItem} from "@/contracts/bets";
import type {UserBetWithBattle} from "@/services/bets/read";

function toSafeNumber(value: bigint): number {
    const converted = Number(value);
    if (!Number.isSafeInteger(converted)) {
        throw new RangeError(`BigInt ${value} cannot be safely converted to a number`);
    }
    return converted;
}

function toBattleSummary(battle: UserBetWithBattle["battle"]): BattleSummary | null {
    if (!battle) return null;

    return {
        id: battle.id,
        contender_1_name: battle.contender_1_name,
        contender_2_name: battle.contender_2_name,
        is_finished: battle.is_finished,
        rounds: battle.rounds,
        start_height: battle.start_height,
        contenders_pv: battle.contenders_pv,
    };
}

export function toUserBetListItem(bet: UserBetWithBattle): UserBetListItem {
    const {betOnWinner, betOnBestShare, battle, ...base} = bet;
    const specializationCount = Number(betOnWinner !== null) + Number(betOnBestShare !== null);
    if (specializationCount !== 1) {
        throw new Error(`Bet ${bet.id} must have exactly one specialization`);
    }

    const itemBase = {
        ...base,
        createdAt: base.createdAt.toISOString(),
        battle: toBattleSummary(battle),
    };

    if (betOnWinner) {
        return {
            ...itemBase,
            type: "betOnWinner",
            details: {winnerIndex: betOnWinner.winnerIndex},
        };
    }

    if (betOnBestShare) {
        return {
            ...itemBase,
            type: "betOnBestShare",
            details: {diff: toSafeNumber(betOnBestShare.diff)},
        };
    }

    throw new Error(`Bet ${bet.id} must have exactly one specialization`);
}
