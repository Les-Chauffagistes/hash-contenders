import {describe, expect, it} from "vitest";
import {toUserBetListItem} from "@/app/api/bets/mapper";
import type {UserBetWithBattle} from "@/services/bets/read";

const battle = {
    id: 42,
    owner_user_id: 1,
    are_addresses_privates: false,
    contender_1_address: "address-1",
    contender_1_name: "Alice",
    contender_2_address: "address-2",
    contender_2_name: "Bob",
    contenders_pv: 100,
    rounds: 5,
    start_height: 10,
    is_finished: false,
};

const baseBet = {
    id: "bet-id",
    battleId: "42",
    createdAt: new Date("2026-08-11T10:00:00.000Z"),
    amount: 100,
    result: "pending",
    status: "confirmed",
    battle,
} satisfies Omit<UserBetWithBattle, "betOnWinner" | "betOnBestShare">;

describe("toUserBetListItem", () => {
    it("projects a winner bet and the battle summary", () => {
        const item = toUserBetListItem({
            ...baseBet,
            betOnWinner: {betId: "bet-id", winnerIndex: 2},
            betOnBestShare: null,
        });

        expect(item).toEqual({
            id: "bet-id",
            battleId: "42",
            createdAt: "2026-08-11T10:00:00.000Z",
            amount: 100,
            result: "pending",
            status: "confirmed",
            type: "betOnWinner",
            details: {winnerIndex: 2},
            battle: {
                id: 42,
                contender_1_name: "Alice",
                contender_2_name: "Bob",
                is_finished: false,
                rounds: 5,
                start_height: 10,
                contenders_pv: 100,
            },
        });
    });

    it("converts a best-share difficulty to a safe JSON number", () => {
        const item = toUserBetListItem({
            ...baseBet,
            betOnWinner: null,
            betOnBestShare: {betId: "bet-id", diff: BigInt(2_500)},
        });

        expect(item.type).toBe("betOnBestShare");
        expect(item.details).toEqual({diff: 2_500});
    });

    it.each([
        {betOnWinner: null, betOnBestShare: null},
        {
            betOnWinner: {betId: "bet-id", winnerIndex: 1},
            betOnBestShare: {betId: "bet-id", diff: BigInt(2_500)},
        },
    ])("rejects a bet without exactly one specialization", (specializations) => {
        expect(() => toUserBetListItem({...baseBet, ...specializations})).toThrow(
            "Bet bet-id must have exactly one specialization",
        );
    });

    it("rejects a difficulty that cannot be represented safely as a number", () => {
        expect(() =>
            toUserBetListItem({
                ...baseBet,
                betOnWinner: null,
                betOnBestShare: {
                    betId: "bet-id",
                    diff: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
                },
            }),
        ).toThrow(RangeError);
    });
});
