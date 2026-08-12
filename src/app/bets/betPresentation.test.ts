import {describe, expect, it} from "vitest";
import {
    battleLabel,
    describePrediction,
    describeState,
    isAwaitingOutcome,
    isBattleAwaitingOutcome,
} from "@/app/bets/betPresentation";
import type {BattleSummary, UserBattleBets, UserBetItem} from "@/contracts/bets";

const battle: BattleSummary = {
    id: 42,
    contender_1_name: "Alice",
    contender_2_name: "Bob",
    is_finished: false,
    rounds: 5,
    start_height: 10,
    contenders_pv: 100,
};

const base = {
    id: "bet-id",
    createdAt: "2026-08-11T10:00:00.000Z",
    amount: 100,
    result: "pending",
    status: "confirmed",
} satisfies Omit<UserBetItem, "type" | "details">;

const winnerBet: UserBetItem = {...base, type: "betOnWinner", details: {winnerIndex: 2}};
const bestShareBet: UserBetItem = {...base, type: "betOnBestShare", details: {diff: 250e9}};

function battleBets(overrides: Partial<UserBattleBets> = {}): UserBattleBets {
    return {
        battleId: "42",
        battle,
        stake: 100,
        payout: null,
        bets: [winnerBet],
        ...overrides,
    };
}

describe("describePrediction", () => {
    it("resolves the predicted winner index to the contender name", () => {
        expect(describePrediction(winnerBet, battle)).toEqual({label: "Vainqueur visé", value: "Bob"});
    });

    it("falls back to the contender index when the battle is missing", () => {
        expect(describePrediction(winnerBet, null).value).toBe("Contender 2");
    });

    it("formats the targeted difficulty with its unit", () => {
        expect(describePrediction(bestShareBet, battle)).toEqual({
            label: "Meilleur share ≥",
            value: "250 G",
        });
    });
});

describe("describeState", () => {
    it("reports the escrow status while the bet is not confirmed", () => {
        expect(describeState({...winnerBet, status: "pending", result: "pending"}).label).toBe("À confirmer");
        expect(describeState({...winnerBet, status: "void", result: "pending"}).label).toBe("Annulé");
    });

    it("hides the outcome of a voided bet", () => {
        expect(describeState({...winnerBet, status: "void", result: "won"}).label).toBe("Annulé");
    });

    it("reports the outcome once the bet is confirmed", () => {
        expect(describeState({...winnerBet, result: "won"})).toEqual({label: "Gagné", tone: "won"});
        expect(describeState({...winnerBet, result: "lost"})).toEqual({label: "Perdu", tone: "lost"});
        expect(describeState({...winnerBet, result: "cancelled"})).toEqual({label: "Annulé", tone: "void"});
        expect(describeState(winnerBet)).toEqual({label: "En jeu", tone: "confirmed"});
    });
});

describe("isAwaitingOutcome", () => {
    it("only holds for a bet still in play", () => {
        expect(isAwaitingOutcome(winnerBet)).toBe(true);
        expect(isAwaitingOutcome({...winnerBet, status: "pending"})).toBe(true);
        expect(isAwaitingOutcome({...winnerBet, status: "void"})).toBe(false);
        expect(isAwaitingOutcome({...winnerBet, result: "won"})).toBe(false);
    });
});

describe("battleLabel", () => {
    it("names both contenders", () => {
        expect(battleLabel(battleBets())).toBe("Alice vs Bob");
    });

    it("falls back to the battle id when the referee did not return it", () => {
        expect(battleLabel(battleBets({battleId: "99", battle: null}))).toBe("Bataille #99");
    });
});

describe("isBattleAwaitingOutcome", () => {
    it("holds as soon as one bet is still in play", () => {
        const settled = battleBets({
            bets: [{...winnerBet, result: "won"}, {...bestShareBet, result: "lost"}],
        });
        expect(isBattleAwaitingOutcome(settled)).toBe(false);

        const ongoing = battleBets({bets: [{...winnerBet, result: "won"}, bestShareBet]});
        expect(isBattleAwaitingOutcome(ongoing)).toBe(true);
    });
});
