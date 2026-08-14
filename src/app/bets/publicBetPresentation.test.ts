import {describe, expect, it} from "vitest";
import type {BattleBetItem} from "@/contracts/bets";
import {
    filterAndSortBattleBets,
    playerLabel,
    type BattleBetFilters,
} from "@/app/bets/publicBetPresentation";

function bet(overrides: Partial<BattleBetItem> = {}): BattleBetItem {
    return {
        id: "bet-1",
        player: {id: "3", pseudo: "Alice"},
        createdAt: "2026-08-11T10:00:00.000Z",
        amount: 100,
        result: "pending",
        type: "betOnWinner",
        details: {winnerIndex: 1},
        ...overrides,
    } as BattleBetItem;
}

const defaultFilters: BattleBetFilters = {
    query: "",
    type: "all",
    result: "all",
    sort: "newest",
};

describe("playerLabel", () => {
    it("uses the pseudo and falls back to the player id", () => {
        expect(playerLabel(bet())).toBe("Alice");
        expect(playerLabel(bet({player: {id: "8", pseudo: null}}))).toBe("Joueur #8");
    });
});

describe("filterAndSortBattleBets", () => {
    const bets = [
        bet({id: "old", player: {id: "3", pseudo: "Alice"}, amount: 100}),
        bet({
            id: "recent",
            player: {id: "7", pseudo: "Bob"},
            createdAt: "2026-08-12T10:00:00.000Z",
            amount: 250,
            result: "won",
            type: "betOnBestShare",
            details: {diff: 2_500},
        }),
    ];

    it("filters by player, type and result", () => {
        expect(filterAndSortBattleBets(bets, {...defaultFilters, query: "bo"}).map(({id}) => id))
            .toEqual(["recent"]);
        expect(filterAndSortBattleBets(bets, {...defaultFilters, type: "betOnWinner"}).map(({id}) => id))
            .toEqual(["old"]);
        expect(filterAndSortBattleBets(bets, {...defaultFilters, result: "won"}).map(({id}) => id))
            .toEqual(["recent"]);
    });

    it("sorts without mutating the API response", () => {
        const originalOrder = bets.map(({id}) => id);

        expect(filterAndSortBattleBets(bets, {...defaultFilters, sort: "amount-asc"}).map(({id}) => id))
            .toEqual(["old", "recent"]);
        expect(filterAndSortBattleBets(bets, {...defaultFilters, sort: "oldest"}).map(({id}) => id))
            .toEqual(["old", "recent"]);
        expect(bets.map(({id}) => id)).toEqual(originalOrder);
    });
});
