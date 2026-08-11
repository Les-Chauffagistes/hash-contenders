import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {PrismaPg} from "@prisma/adapter-pg";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {PrismaClient} from "@/generated/prisma/client";
import type {BattleStatus} from "../../../models/BattleStatus";

vi.mock("@/app/api", () => ({
  getBattleStatus: vi.fn(),
}));

import {getBattleStatus} from "@/app/api";
import {settleBattle} from "@/services/settlement/settleBattle";

const execFileAsync = promisify(execFile);

function battleStatus(overrides: Partial<BattleStatus> & {hits?: BattleStatus["hits"]} = {}): BattleStatus {
  return {
    owner_user_id: 1,
    battle_id: 123,
    rounds: 10,
    contenders_base_pv: 100,
    start_height: 1,
    is_finished: true,
    hits: [],
    current_round: 3,
    contender_info: [
      {name: "alpha", pv: 3, current_round_best_diff: 0},
      {name: "beta", pv: 0, current_round_best_diff: 0},
    ],
    ...overrides,
  };
}

let container: StartedPostgreSqlContainer;
let db: PrismaClient;

async function createConfirmedBetOnWinner(battleId: string, userId: number, amount: number, winnerIndex: number, idempotencyKey: string) {
  const bet = await db.bet.create({
    data: {battleId, userId, amount, status: "confirmed", idempotencyKey},
  });
  await db.betOnWinner.create({data: {betId: bet.id, winnerIndex}});
  return bet;
}

async function createConfirmedBetOnBestShare(battleId: string, userId: number, amount: number, diff: bigint, idempotencyKey: string) {
  const bet = await db.bet.create({
    data: {battleId, userId, amount, status: "confirmed", idempotencyKey},
  });
  await db.betOnBestShare.create({data: {betId: bet.id, diff}});
  return bet;
}

describe("settleBattle", () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const connectionString = container.getConnectionUri();

    await execFileAsync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: {...process.env, DATABASE_URL: connectionString},
    });

    db = new PrismaClient({adapter: new PrismaPg({connectionString})});
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    await container?.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.payoutOutbox.deleteMany();
    await db.battleSettlement.deleteMany();
    await db.battleClosure.deleteMany();
    await db.betOnWinner.deleteMany();
    await db.betOnBestShare.deleteMany();
    await db.bet.deleteMany();
  });

  it("ne fait rien si la bataille n'est pas terminée", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 1, is_finished: false}));

    await settleBattle(db, 1);

    expect(await db.battleSettlement.findUnique({where: {battleId: "1"}})).toBeNull();
  });

  it("répartit le pot entre les gagnants au prorata, sans reste", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 2}));

    // Gagnants (winnerIndex 1) : 30 et 70 -> pot total gagnant 100, plus le
    // perdant à 50 -> pot global 150, réparti entre les deux gagnants.
    await createConfirmedBetOnWinner("2", 10, 30, 1, "k1");
    await createConfirmedBetOnWinner("2", 11, 70, 1, "k2");
    await createConfirmedBetOnWinner("2", 12, 50, 2, "k3");

    await settleBattle(db, 2);

    const settlement = await db.battleSettlement.findUnique({where: {battleId: "2"}});
    expect(settlement?.potTotal).toBe(BigInt(150));

    const payouts = await db.payoutOutbox.findMany({where: {battleId: "2", direction: "escrow_to_winner"}});
    const total = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(total).toBe(150);

    const byUser = new Map(payouts.map((p) => [p.userId.toString(), Number(p.amount)]));
    expect(byUser.get("10")).toBe(Math.floor((150 * 30) / 100));
    expect(byUser.get("11")).toBe(150 - Math.floor((150 * 30) / 100));

    const loser = await db.bet.findFirst({where: {battleId: "2", userId: 12}});
    expect(loser?.result).toBe("lost");
    const winner = await db.bet.findFirst({where: {battleId: "2", userId: 10}});
    expect(winner?.result).toBe("won");
  });

  it("rembourse chaque parieur si personne n'a prédit le bon vainqueur", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 3}));

    await createConfirmedBetOnWinner("3", 20, 40, 2, "k4");
    await createConfirmedBetOnWinner("3", 21, 60, 2, "k5");

    await settleBattle(db, 3);

    const refunds = await db.payoutOutbox.findMany({where: {battleId: "3", direction: "escrow_to_refund"}});
    expect(refunds).toHaveLength(2);
    expect(refunds.map((r) => Number(r.amount)).sort()).toEqual([40, 60]);
    expect(await db.payoutOutbox.count({where: {battleId: "3", direction: "escrow_to_winner"}})).toBe(0);

    const bets = await db.bet.findMany({where: {battleId: "3"}});
    expect(bets.every((b) => b.result === "cancelled")).toBe(true);
  });

  it("rembourse tous les paris sur le vainqueur en cas d'égalité", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(
      battleStatus({
        battle_id: 4,
        contender_info: [
          {name: "alpha", pv: 5, current_round_best_diff: 0},
          {name: "beta", pv: 5, current_round_best_diff: 0},
        ],
      }),
    );

    await createConfirmedBetOnWinner("4", 30, 100, 1, "k6");

    await settleBattle(db, 4);

    const refunds = await db.payoutOutbox.findMany({where: {battleId: "4", direction: "escrow_to_refund"}});
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(100);
  });

  it("un parieur unique gagnant récupère exactement sa mise", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 5}));

    await createConfirmedBetOnWinner("5", 40, 77, 1, "k7");

    await settleBattle(db, 5);

    const payouts = await db.payoutOutbox.findMany({where: {battleId: "5", direction: "escrow_to_winner"}});
    expect(payouts).toHaveLength(1);
    expect(Number(payouts[0].amount)).toBe(77);
  });

  it("ne compte pas un pari resté pending (non confirmé avant la clôture)", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 6}));

    await createConfirmedBetOnWinner("6", 50, 100, 1, "k8");
    const lateBet = await db.bet.create({
      data: {battleId: "6", userId: 51, amount: 999, status: "pending", idempotencyKey: "k9"},
    });
    await db.betOnWinner.create({data: {betId: lateBet.id, winnerIndex: 1}});

    await settleBattle(db, 6);

    const settlement = await db.battleSettlement.findUnique({where: {battleId: "6"}});
    expect(settlement?.potTotal).toBe(BigInt(100));
    expect(
      await db.payoutOutbox.count({where: {battleId: "6", userId: 51}}),
    ).toBe(0);
  });

  it("règle betOnWinner et betOnBestShare séparément dans le même settlement", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(
      battleStatus({
        battle_id: 7,
        hits: [
          {date: new Date(), battle_id: 7, contender_1_best_diff: 500, contender_2_best_diff: 100, block_height: 1, winner: null},
        ],
      }),
    );

    await createConfirmedBetOnWinner("7", 60, 100, 1, "k10");
    await createConfirmedBetOnBestShare("7", 61, 20, BigInt(400), "k11"); // gagne : 400 <= 500
    await createConfirmedBetOnBestShare("7", 62, 30, BigInt(600), "k12"); // perd : 600 > 500

    await settleBattle(db, 7);

    const settlement = await db.battleSettlement.findUnique({where: {battleId: "7"}});
    expect(settlement?.potTotal).toBe(BigInt(150));

    const winnerPayouts = await db.payoutOutbox.findMany({where: {battleId: "7", direction: "escrow_to_winner"}});
    // betOnWinner : seul gagnant, récupère son pot (100). betOnBestShare :
    // seul gagnant (userId 61), récupère tout le pot du type (50).
    expect(winnerPayouts.map((p) => Number(p.amount)).sort((a, b) => a - b)).toEqual([50, 100]);
  });

  it("exactly-once : deux settlements concurrents ne produisent qu'un seul jeu de payouts", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 8}));

    await createConfirmedBetOnWinner("8", 70, 100, 1, "k13");
    await createConfirmedBetOnWinner("8", 71, 50, 2, "k14");

    await Promise.all([settleBattle(db, 8), settleBattle(db, 8)]);

    expect(await db.battleSettlement.count({where: {battleId: "8"}})).toBe(1);
    expect(await db.payoutOutbox.count({where: {battleId: "8"}})).toBe(1);
  });

  it("un second appel après settlement est un no-op silencieux", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({battle_id: 9}));

    await createConfirmedBetOnWinner("9", 80, 100, 1, "k15");

    await settleBattle(db, 9);
    await settleBattle(db, 9);

    expect(await db.battleSettlement.count({where: {battleId: "9"}})).toBe(1);
    expect(await db.payoutOutbox.count({where: {battleId: "9"}})).toBe(1);
  });
});
