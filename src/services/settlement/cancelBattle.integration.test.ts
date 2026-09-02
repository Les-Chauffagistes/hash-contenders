import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {PrismaPg} from "@prisma/adapter-pg";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {PrismaClient} from "@/generated/prisma/client";
import {cancelBattle} from "@/services/settlement/cancelBattle";

const execFileAsync = promisify(execFile);

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

describe("cancelBattle", () => {
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

  beforeEach(() => {});

  afterEach(async () => {
    await db.payoutOutbox.deleteMany();
    await db.battleRefund.deleteMany();
    await db.battleSettlement.deleteMany();
    await db.battleClosure.deleteMany();
    await db.betOnWinner.deleteMany();
    await db.betOnBestShare.deleteMany();
    await db.bet.deleteMany();
  });

  it("rembourse intégralement chaque parieur confirmed d'une bataille supprimée", async () => {
    await createConfirmedBetOnWinner("1", 10, 30, 1, "k1");
    await createConfirmedBetOnWinner("1", 11, 70, 2, "k2");

    await cancelBattle(db, 1);

    const refunds = await db.payoutOutbox.findMany({where: {battleId: "1", direction: "escrow_to_refund"}});
    expect(refunds.map((r) => Number(r.amount)).sort()).toEqual([30, 70]);
    expect(await db.payoutOutbox.count({where: {battleId: "1", direction: "escrow_to_winner"}})).toBe(0);

    const bets = await db.bet.findMany({where: {battleId: "1"}});
    expect(bets.every((b) => b.result === "cancelled")).toBe(true);

    expect(await db.battleClosure.findUnique({where: {battleId: "1"}})).not.toBeNull();
    expect(await db.battleRefund.findUnique({where: {battleId: "1"}})).not.toBeNull();
  });

  it("agrège le remboursement d'un même parieur sur plusieurs types de pari", async () => {
    await createConfirmedBetOnWinner("2", 20, 40, 1, "k3");
    await createConfirmedBetOnBestShare("2", 20, 25, BigInt(500), "k4");

    await cancelBattle(db, 2);

    const refunds = await db.payoutOutbox.findMany({where: {battleId: "2", direction: "escrow_to_refund"}});
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(65);
  });

  it("ignore les paris pending (non confirmés)", async () => {
    const lateBet = await db.bet.create({
      data: {battleId: "3", userId: 30, amount: 99, status: "pending", idempotencyKey: "k5"},
    });
    await db.betOnWinner.create({data: {betId: lateBet.id, winnerIndex: 1}});

    await cancelBattle(db, 3);

    expect(await db.payoutOutbox.count({where: {battleId: "3"}})).toBe(0);
    const bet = await db.bet.findUnique({where: {id: lateBet.id}});
    expect(bet?.result).toBe("pending");
  });

  it("exactly-once : deux annulations concurrentes ne produisent qu'un seul jeu de remboursements", async () => {
    await createConfirmedBetOnWinner("4", 40, 100, 1, "k6");

    await Promise.all([cancelBattle(db, 4), cancelBattle(db, 4)]);

    expect(await db.battleRefund.count({where: {battleId: "4"}})).toBe(1);
    expect(await db.payoutOutbox.count({where: {battleId: "4"}})).toBe(1);
  });

  it("un second appel après annulation est un no-op silencieux", async () => {
    await createConfirmedBetOnWinner("5", 50, 100, 1, "k7");

    await cancelBattle(db, 5);
    await cancelBattle(db, 5);

    expect(await db.battleRefund.count({where: {battleId: "5"}})).toBe(1);
    expect(await db.payoutOutbox.count({where: {battleId: "5"}})).toBe(1);
  });

  it("ne rembourse jamais une bataille déjà réglée (battle_settlement existant)", async () => {
    await createConfirmedBetOnWinner("6", 60, 100, 1, "k8");
    await db.battleSettlement.create({data: {battleId: "6", potTotal: 100, breakdown: {}}});
    await db.bet.updateMany({where: {battleId: "6"}, data: {result: "won"}});
    await db.payoutOutbox.create({
      data: {battleId: "6", userId: 60, amount: 100, direction: "escrow_to_winner", idempotencyKey: "settle:6:60"},
    });

    await cancelBattle(db, 6);

    expect(await db.battleRefund.findUnique({where: {battleId: "6"}})).toBeNull();
    expect(await db.payoutOutbox.count({where: {battleId: "6", direction: "escrow_to_refund"}})).toBe(0);
    const bet = await db.bet.findFirst({where: {battleId: "6"}});
    expect(bet?.result).toBe("won");
  });
});
