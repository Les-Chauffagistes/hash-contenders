import {describe, expect, it} from "vitest";
import {toBattleBetsView, toUserBetItem, toUserBetsOverview} from "@/app/api/bets/mapper";
import type {BattleBetRecord, UserBetRecord, UserPayoutRecord} from "@/services/bets/read";
import type {Battle} from "../../../../models/Battle";

const battle: Battle = {
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
} satisfies Omit<UserBetRecord, "betOnWinner" | "betOnBestShare">;

function winnerBet(overrides: Partial<UserBetRecord> = {}): UserBetRecord {
    return {
        ...baseBet,
        betOnWinner: {betId: baseBet.id, winnerIndex: 1},
        betOnBestShare: null,
        ...overrides,
    };
}

describe("toUserBetItem", () => {
    it("projects a winner bet without the battle it belongs to", () => {
        const item = toUserBetItem({
            ...baseBet,
            betOnWinner: {betId: "bet-id", winnerIndex: 2},
            betOnBestShare: null,
        });

        expect(item).toEqual({
            id: "bet-id",
            createdAt: "2026-08-11T10:00:00.000Z",
            amount: 100,
            result: "pending",
            status: "confirmed",
            type: "betOnWinner",
            details: {winnerIndex: 2},
        });
    });

    it("projects a best share bet, its difficulty widened to a number", () => {
        const item = toUserBetItem({
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
        expect(() => toUserBetItem({...baseBet, ...specializations})).toThrow(
            "Bet bet-id must have exactly one specialization",
        );
    });

    it("rejects a difficulty that cannot be represented safely as a number", () => {
        expect(() =>
            toUserBetItem({
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

describe("toUserBetsOverview", () => {
    it("gathers the bets of a battle, sums the stake and attaches the summary", () => {
        const overview = toUserBetsOverview(
            [
                winnerBet({id: "a", amount: 100}),
                winnerBet({id: "b", amount: 250}),
            ],
            [battle],
            [],
        );

        expect(overview.battles).toHaveLength(1);
        expect(overview.battles[0].battleId).toBe("42");
        expect(overview.battles[0].battle?.contender_1_name).toBe("Alice");
        expect(overview.battles[0].bets.map((bet) => bet.id)).toEqual(["a", "b"]);
        expect(overview.battles[0].stake).toBe(350);
        expect(overview.battles[0].payout).toBeNull();
    });

    it("keeps the incoming order of both bets and battles", () => {
        const overview = toUserBetsOverview(
            [
                winnerBet({id: "a", battleId: "7"}),
                winnerBet({id: "b", battleId: "42"}),
                winnerBet({id: "c", battleId: "7"}),
            ],
            [battle],
            [],
        );

        expect(overview.battles.map((entry) => entry.battleId)).toEqual(["7", "42"]);
        expect(overview.battles[0].bets.map((bet) => bet.id)).toEqual(["a", "c"]);
    });

    it("splits winnings from refunds and attaches them to their own battle", () => {
        const payouts: UserPayoutRecord[] = [
            {battleId: "42", direction: "escrow_to_winner", amount: BigInt(350)},
            {battleId: "42", direction: "escrow_to_winner", amount: BigInt(50)},
            {battleId: "7", direction: "escrow_to_refund", amount: BigInt(100)},
        ];

        const overview = toUserBetsOverview(
            [winnerBet({battleId: "42"}), winnerBet({battleId: "7"})],
            [battle],
            payouts,
        );

        expect(overview.battles[0].payout).toEqual({winnings: 400, refunds: 0});
        expect(overview.battles[1].payout).toEqual({winnings: 0, refunds: 100});
    });

    it("ignores the escrow debit, which is the stake already carried by the bet", () => {
        const overview = toUserBetsOverview(
            [winnerBet()],
            [battle],
            [{battleId: "42", direction: "debit_to_escrow", amount: BigInt(100)}],
        );

        expect(overview.battles[0].payout).toBeNull();
    });

    it("leaves the battle summary null when the referee did not return it", () => {
        const overview = toUserBetsOverview([winnerBet({battleId: "99"})], [], []);

        expect(overview.battles[0].battle).toBeNull();
        expect(overview.battles[0].battleId).toBe("99");
    });
});

describe("toBattleBetsView", () => {
    const publicBet = (overrides: Partial<BattleBetRecord> = {}): BattleBetRecord => ({
        id: "bet-id",
        userId: BigInt(3),
        createdAt: new Date("2026-08-11T10:00:00.000Z"),
        amount: 100,
        result: "pending",
        betOnWinner: {betId: "bet-id", winnerIndex: 1},
        betOnBestShare: null,
        ...overrides,
    });

    it("names each player and totals the pot", () => {
        const view = toBattleBetsView(
            "42",
            battle,
            [publicBet({id: "a"}), publicBet({id: "b", userId: BigInt(7), amount: 250})],
            new Map([["3", "Testuser"], ["7", "Alice"]]),
        );

        expect(view.pot).toBe(350);
        expect(view.battle?.contender_1_name).toBe("Alice");
        expect(view.bets.map((bet) => bet.player)).toEqual([
            {id: "3", pseudo: "Testuser"},
            {id: "7", pseudo: "Alice"},
        ]);
    });

    it("leaves the pseudo null when the directory did not return the player", () => {
        const view = toBattleBetsView("42", battle, [publicBet()], new Map());

        expect(view.bets[0].player).toEqual({id: "3", pseudo: null});
    });

    it("never exposes the escrow status", () => {
        const view = toBattleBetsView("42", battle, [publicBet()], new Map());

        expect(view.bets[0]).not.toHaveProperty("status");
    });
});
