import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {PrismaPg} from "@prisma/adapter-pg";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {PrismaClient} from "@/generated/prisma/client";

vi.mock("@/app/api/lib/coins", () => ({
  transferCoins: vi.fn(),
  InsufficientCoinsError: class InsufficientCoinsError extends Error {},
}));

import {transferCoins, InsufficientCoinsError} from "@/app/api/lib/coins";
import {dispatchOutboxBatch} from "@/services/payouts/dispatch";

const execFileAsync = promisify(execFile);

let container: StartedPostgreSqlContainer;
let db: PrismaClient;

async function createBet(battleId: string, userId: number, status: "pending" | "confirmed" | "void" = "pending") {
  return db.bet.create({
    data: {battleId, userId, amount: 100, status, idempotencyKey: crypto.randomUUID()},
  });
}

describe("dispatchOutboxBatch", () => {
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
    await db.bet.deleteMany();
  });

  it("marque dispatched et confirme le pari sur un débit escrow réussi", async () => {
    vi.mocked(transferCoins).mockResolvedValue(undefined);
    const bet = await createBet("1", 10, "pending");
    await db.payoutOutbox.create({
      data: {
        battleId: "1",
        userId: 10,
        amount: 100,
        direction: "debit_to_escrow",
        idempotencyKey: `bet:1:${bet.id}`,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    const processed = await dispatchOutboxBatch(db);

    expect(processed).toBe(1);
    expect(transferCoins).toHaveBeenCalledWith({
      fromUserId: 10,
      toUserId: -1,
      amount: 100,
      currency: "test-coins",
      idempotencyKey: `bet:1:${bet.id}`,
      reason: "Bet placed",
    });
    const outbox = await db.payoutOutbox.findFirst({where: {battleId: "1"}});
    expect(outbox?.status).toBe("dispatched");
    expect((await db.bet.findUnique({where: {id: bet.id}}))?.status).toBe("confirmed");
  });

  it("calcule les bons comptes escrow pour un paiement gagnant", async () => {
    vi.mocked(transferCoins).mockResolvedValue(undefined);
    await db.payoutOutbox.create({
      data: {
        battleId: "2",
        userId: 20,
        amount: 55,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:2:20",
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    await dispatchOutboxBatch(db);

    expect(transferCoins).toHaveBeenCalledWith({
      fromUserId: -2,
      toUserId: 20,
      amount: 55,
      currency: "test-coins",
      idempotencyKey: "settle:2:20",
      reason: "Battle settlement payout",
    });
  });

  it("passe le pari en void et l'outbox en failed sur un rejet définitif", async () => {
    vi.mocked(transferCoins).mockRejectedValue(new InsufficientCoinsError());
    const bet = await createBet("3", 30, "pending");
    await db.payoutOutbox.create({
      data: {
        battleId: "3",
        userId: 30,
        amount: 100,
        direction: "debit_to_escrow",
        idempotencyKey: `bet:3:${bet.id}`,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    await dispatchOutboxBatch(db);

    const outbox = await db.payoutOutbox.findFirst({where: {battleId: "3"}});
    expect(outbox?.status).toBe("failed");
    expect((await db.bet.findUnique({where: {id: bet.id}}))?.status).toBe("void");
  });

  it("incrémente attempts et repousse next_attempt_at sur une erreur transitoire", async () => {
    vi.mocked(transferCoins).mockRejectedValue(new Error("network timeout"));
    await db.payoutOutbox.create({
      data: {
        battleId: "4",
        userId: 40,
        amount: 20,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:4:40",
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    await dispatchOutboxBatch(db);

    const outbox = await db.payoutOutbox.findFirst({where: {battleId: "4"}});
    expect(outbox?.status).toBe("pending");
    expect(outbox?.attempts).toBe(1);
    expect(outbox?.lastError).toBe("network timeout");
    expect(outbox!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("passe en dead après le nombre maximal de tentatives, jamais un retry silencieux", async () => {
    vi.mocked(transferCoins).mockRejectedValue(new Error("network timeout"));
    await db.payoutOutbox.create({
      data: {
        battleId: "5",
        userId: 50,
        amount: 20,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:5:50",
        attempts: 9,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    await dispatchOutboxBatch(db);

    const outbox = await db.payoutOutbox.findFirst({where: {battleId: "5"}});
    expect(outbox?.status).toBe("dead");
    expect(outbox?.attempts).toBe(10);
  });

  it("ignore les lignes dont next_attempt_at n'est pas encore atteint", async () => {
    await db.payoutOutbox.create({
      data: {
        battleId: "6",
        userId: 60,
        amount: 20,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:6:60",
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    });

    const processed = await dispatchOutboxBatch(db);

    expect(processed).toBe(0);
    expect(transferCoins).not.toHaveBeenCalled();
  });

  it("ignore les lignes déjà dispatched ou dead", async () => {
    await db.payoutOutbox.create({
      data: {
        battleId: "7",
        userId: 70,
        amount: 20,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:7:70",
        status: "dispatched",
      },
    });
    await db.payoutOutbox.create({
      data: {
        battleId: "7",
        userId: 71,
        amount: 20,
        direction: "escrow_to_winner",
        idempotencyKey: "settle:7:71",
        status: "dead",
      },
    });

    const processed = await dispatchOutboxBatch(db);

    expect(processed).toBe(0);
    expect(transferCoins).not.toHaveBeenCalled();
  });
});
