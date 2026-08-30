import {describe, expect, it} from "vitest";
import {assertBettingOpen} from "@/services/bets/baseBet";
import {BettingClosedError} from "@/services/bets/errors";
import type {BattleStatus} from "../../../models/BattleStatus";

function battle(overrides: Partial<BattleStatus> = {}): BattleStatus {
  return {
    owner_user_id: 1,
    battle_id: 1,
    rounds: 10,
    contenders_base_pv: 100,
    start_height: 1,
    is_finished: false,
    hits: [],
    current_round: 0,
    contender_info: [],
    ...overrides,
  };
}

describe("assertBettingOpen", () => {
  it("ne fait rien tant que la bataille n'a pas démarré", () => {
    expect(() => assertBettingOpen(battle({current_round: 0}))).not.toThrow();
  });

  it("refuse dès que la bataille a démarré", () => {
    expect(() => assertBettingOpen(battle({current_round: 1}))).toThrow(BettingClosedError);
  });
});
