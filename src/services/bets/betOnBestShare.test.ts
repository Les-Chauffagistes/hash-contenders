import {describe, expect, it, vi} from "vitest";
import type {BattleResult, ConfirmedBet, BetContext, TransactionClient} from "@/services/bets/baseBet";
import {betOnBestShareHandler} from "@/services/bets/betOnBestShare";
import {BettingClosedError, InvalidBetDataError} from "@/services/bets/errors";

type Persisted = {diff: bigint};

function bet(userId: number, amount: number, diff: bigint): ConfirmedBet<Persisted> {
  return {id: `bet-${userId}-${diff}`, userId: BigInt(userId), amount, specialized: {diff}};
}

function battleResult(maxDiffAchieved: number): BattleResult {
  return {battleId: "1", isFinished: true, winnerIndex: 1, maxDiffAchieved};
}

const computePayouts = betOnBestShareHandler.computePayouts;

describe("betOnBestShare.computePayouts", () => {
  it("distribue 60/30/10 entre les 3 meilleures diffs distinctes atteintes", () => {
    const bets = [
      bet(1, 50, BigInt(400)), // rang 1 -> 60%
      bet(2, 50, BigInt(300)), // rang 2 -> 30%
      bet(3, 50, BigInt(200)), // rang 3 -> 10%
      bet(4, 50, BigInt(100)), // rang 4, atteint mais hors du top 3 -> rien
    ];

    const payouts = computePayouts(bets, battleResult(500));

    // Pot = 200, tickets à 50 : 60%=120, 30%=60, 10%=20, exact sans reste.
    expect([...payouts]).toEqual([
      [BigInt(1), 120],
      [BigInt(2), 60],
      [BigInt(3), 20],
    ]);
    expect(payouts.has(BigInt(4))).toBe(false);
    expect([...payouts.values()].reduce((sum, amount) => sum + amount, 0)).toBe(200);
  });

  it("distribue 70/30 quand seules 2 diffs distinctes sont atteintes", () => {
    const bets = [
      bet(10, 30, BigInt(100)), // atteint, 2e rang -> 30%
      bet(11, 20, BigInt(400)), // atteint, 1er rang -> 70%
      bet(12, 50, BigInt(600)), // non atteint
    ];

    const payouts = computePayouts(bets, battleResult(500));

    // Pot = 100 (toutes les mises, y compris le pari non atteint).
    expect([...payouts]).toEqual([
      [BigInt(11), 70],
      [BigInt(10), 30],
    ]);
  });

  it("répartit la part d'un rang au prorata des mises entre ses ex-aequo", () => {
    const bets = [
      bet(20, 30, BigInt(400)),
      bet(21, 70, BigInt(400)),
      bet(22, 50, BigInt(100)), // atteint, seul sur son rang
    ];

    const payouts = computePayouts(bets, battleResult(500));

    // Pot = 150, 2 rangs distincts -> 70/30. Rang 1 (diff 400, ex-aequo) :
    // tierPot = 105, réparti au prorata (30/100 et 70/100), reste à la plus
    // grosse mise. Rang 2 (diff 100, seul) : tierPot = 45.
    const tier1 = Math.floor((150 * 70) / 100);
    const share20 = Math.floor((tier1 * 30) / 100);
    expect(payouts.get(BigInt(20))).toBe(share20);
    expect(payouts.get(BigInt(21))).toBe(tier1 - share20);
    expect(payouts.get(BigInt(22))).toBe(Math.floor((150 * 30) / 100));
    expect([...payouts.values()].reduce((sum, amount) => sum + amount, 0)).toBe(150);
  });

  it("ne paie que 3 rangs même si plus de 3 diffs distinctes sont atteintes, en partageant le dernier rang entre ses ex-aequo", () => {
    const bets = [
      bet(1, 50, BigInt(400)), // rang 1
      bet(2, 50, BigInt(300)), // rang 2
      bet(3, 50, BigInt(200)), // rang 3, ex-aequo
      bet(4, 50, BigInt(200)), // rang 3, ex-aequo
      bet(5, 50, BigInt(100)), // atteint mais hors top 3 -> rien
    ];

    const payouts = computePayouts(bets, battleResult(500));

    // Pot = 250. 60%=150, 30%=75, 10%=25 réparti à parts égales entre 3 et 4.
    expect(payouts.get(BigInt(1))).toBe(150);
    expect(payouts.get(BigInt(2))).toBe(75);
    expect(payouts.get(BigInt(3))! + payouts.get(BigInt(4))!).toBe(25);
    expect(payouts.has(BigInt(5))).toBe(false);
  });

  it("cumule les parts d'un même utilisateur ex aequo avec lui-même", () => {
    const bets = [bet(30, 40, BigInt(400)), bet(30, 60, BigInt(400))];

    const payouts = computePayouts(bets, battleResult(400));

    expect([...payouts]).toEqual([[BigInt(30), 100]]);
  });

  it("ne rend aucun gagnant si aucune difficulté prédite n'a été atteinte", () => {
    const bets = [bet(40, 30, BigInt(600)), bet(41, 20, BigInt(700))];

    expect(computePayouts(bets, battleResult(500)).size).toBe(0);
  });

  it("compte comme gagnant un pari exactement égal à la difficulté atteinte", () => {
    const payouts = computePayouts([bet(50, 25, BigInt(500))], battleResult(500));

    expect([...payouts]).toEqual([[BigInt(50), 25]]);
  });

  it("tronque une difficulté atteinte fractionnaire au lieu d'arrondir vers le haut", () => {
    const bets = [bet(60, 30, BigInt(500)), bet(61, 20, BigInt(501))];

    const payouts = computePayouts(bets, battleResult(500.7));

    expect([...payouts]).toEqual([[BigInt(60), 50]]);
  });

  it("compare les difficultés en bigint, sans perte de précision au-delà de 2^53", () => {
    // Les deux difficultés valent le même Number une fois converties : seule
    // une comparaison en bigint distingue le pari dépassé du pari atteint.
    const reached = BigInt("9007199254740992"); // 2^53
    const missed = BigInt("9007199254740993"); // 2^53 + 1, Number() le ramène à 2^53
    expect(Number(missed)).toBe(Number(reached));

    const payouts = computePayouts([bet(70, 30, reached), bet(71, 20, missed)], battleResult(Number(reached)));

    expect([...payouts]).toEqual([[BigInt(70), 50]]);
  });
});

describe("betOnBestShare.checkPreconditions", () => {
  function ctx(overrides: Partial<BetContext["battle"]> & {amount?: number}): BetContext {
    const {amount = 50, ...battleOverrides} = overrides;
    return {
      db: {} as BetContext["db"],
      userId: 1,
      access_token: "token",
      battle: {
        owner_user_id: 1,
        battle_id: 1,
        rounds: 10,
        contenders_base_pv: 100,
        start_height: 1,
        is_finished: false,
        hits: [],
        current_round: 0,
        contender_info: [],
        ...battleOverrides,
      },
      submission: {battle_id: 1, amount, idempotency_key: "id", bet: {type: "betOnBestShare"}},
    };
  }

  it("refuse une soumission une fois la bataille démarrée", async () => {
    await expect(
      betOnBestShareHandler.checkPreconditions({diff: "100"}, ctx({current_round: 1})),
    ).rejects.toBeInstanceOf(BettingClosedError);
  });

  it("refuse un montant différent du prix fixe du ticket", async () => {
    await expect(
      betOnBestShareHandler.checkPreconditions({diff: "100"}, ctx({amount: 75})),
    ).rejects.toBeInstanceOf(InvalidBetDataError);
  });

  it("accepte le prix fixe avant le démarrage de la bataille", async () => {
    await expect(
      betOnBestShareHandler.checkPreconditions({diff: "100"}, ctx({})),
    ).resolves.toBeUndefined();
  });
});

describe("betOnBestShare.findEditableBet", () => {
  it("retrouve le pari pending ou confirmed de ce type pour (user, battle), en excluant void", async () => {
    const findFirst = vi.fn().mockResolvedValue({id: "existing-bet"});
    const tx = {bet: {findFirst}} as unknown as TransactionClient;

    const result = await betOnBestShareHandler.findEditableBet!(tx, 42, "123");

    expect(findFirst).toHaveBeenCalledWith({
      where: {userId: 42, battleId: "123", status: {in: ["pending", "confirmed"]}, betOnBestShare: {isNot: null}},
      select: {id: true},
    });
    expect(result).toEqual({id: "existing-bet"});
  });
});
