import {describe, expect, it} from "vitest";
import type {BattleResult, ConfirmedBet} from "@/services/bets/baseBet";
import {betOnBestShareHandler} from "@/services/bets/betOnBestShare";

type Persisted = {diff: bigint};

function bet(userId: number, amount: number, diff: bigint): ConfirmedBet<Persisted> {
  return {id: `bet-${userId}-${diff}`, userId: BigInt(userId), amount, specialized: {diff}};
}

function battleResult(maxDiffAchieved: number): BattleResult {
  return {battleId: "1", isFinished: true, winnerIndex: 1, maxDiffAchieved};
}

const computePayouts = betOnBestShareHandler.computePayouts;

describe("betOnBestShare.computePayouts", () => {
  it("donne tout le pot au pari le plus élevé effectivement atteint", () => {
    const bets = [
      bet(10, 30, BigInt(100)), // atteint, mais pas le plus élevé
      bet(11, 20, BigInt(400)), // atteint, le plus élevé -> gagne
      bet(12, 50, BigInt(600)), // non atteint
    ];

    const payouts = computePayouts(bets, battleResult(500));

    expect([...payouts]).toEqual([[BigInt(11), 100]]);
  });

  it("répartit le pot au prorata des mises en cas d'égalité sur la difficulté gagnante", () => {
    const bets = [
      bet(20, 30, BigInt(400)),
      bet(21, 70, BigInt(400)),
      bet(22, 50, BigInt(100)), // atteint mais plus faible : ne touche rien
    ];

    const payouts = computePayouts(bets, battleResult(500));

    // Pot = 150, réparti entre les deux ex aequo au prorata (30/100 et 70/100),
    // le reste de la division entière allant à la plus grosse mise.
    expect(payouts.get(BigInt(20))).toBe(Math.floor((150 * 30) / 100));
    expect(payouts.get(BigInt(21))).toBe(150 - Math.floor((150 * 30) / 100));
    expect(payouts.has(BigInt(22))).toBe(false);
    expect([...payouts.values()].reduce((sum, amount) => sum + amount, 0)).toBe(150);
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
