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

vi.mock("@/app/api/lib/coins", () => ({
  burnUserCoins: vi.fn(),
  getUserCoins: vi.fn(),
}));

vi.mock("@/app/api/lib/auth", () => ({
  decodeAccessToken: vi.fn(),
}));

import {getBattleStatus} from "@/app/api";
import {burnUserCoins, getUserCoins} from "@/app/api/lib/coins";
import {decodeAccessToken} from "@/app/api/lib/auth";
import {betOnWinnerHandler} from "@/services/bets/betOnWinner";
import {submitBet} from "@/services/bets/create";
import {BurnFailedError} from "@/services/bets/errors";

const execFileAsync = promisify(execFile);

const battle: BattleStatus = {
  owner_user_id: 1,
  battle_id: 123,
  rounds: 10,
  contenders_base_pv: 100,
  start_height: 1,
  is_finished: false,
  hits: [],
  current_round: 1,
  contender_info: [],
};

let container: StartedPostgreSqlContainer;
let db: PrismaClient;

describe("submitBet avec PostgreSQL", () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const connectionString = container.getConnectionUri();

    await execFileAsync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
    });

    db = new PrismaClient({
      adapter: new PrismaPg({connectionString}),
    });
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    await container?.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBattleStatus).mockResolvedValue(battle);
    vi.mocked(decodeAccessToken).mockResolvedValue({
      user_id: "42",
      pseudo: "mineur",
    });
    vi.mocked(getUserCoins).mockResolvedValue({balance: 1_000});
    vi.mocked(burnUserCoins).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await db.betOnWinner.deleteMany();
    await db.betOnBestShare.deleteMany();
    await db.bet.deleteMany();
  });

  it("persiste un pari sur le gagnant et sa relation", async () => {
    const idempotencyKey = "430f844f-a821-4055-b0ca-75fe30f32030"; // gitleaks:allow

    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: idempotencyKey,
        bet: {
          type: "betOnWinner",
          winner_index: 2,
        },
      },
      "access-token",
    );

    const storedBet = await db.bet.findUnique({
      where: {idempotencyKey},
      include: {
        betOnWinner: true,
        betOnBestShare: true,
      },
    });

    expect(storedBet).toMatchObject({
      battleId: "123",
      userId: BigInt(42),
      amount: 50,
      status: "settled",
      result: "pending",
      betOnWinner: {
        winnerIndex: 2,
      },
      betOnBestShare: null,
    });
  });

  it("persiste un pari sur la meilleure share avec un bigint", async () => {
    const idempotencyKey = "ef7d9363-50ce-428d-b893-b257b94fcac7"; // gitleaks:allow

    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 75,
        idempotency_key: idempotencyKey,
        bet: {
          type: "betOnBestShare",
          diff: "2.5G",
        },
      },
      "access-token",
    );

    const storedBet = await db.bet.findUnique({
      where: {idempotencyKey},
      include: {
        betOnWinner: true,
        betOnBestShare: true,
      },
    });

    expect(storedBet).toMatchObject({
      status: "settled",
      betOnWinner: null,
      betOnBestShare: {
        diff: BigInt(2_500_000_000),
      },
    });
  });

  it("conserve le pari en canceled lorsque le débit échoue", async () => {
    const idempotencyKey = "1215178c-8117-4432-a24e-f9d7ab0b4f6b"; // gitleaks:allow
    vi.mocked(burnUserCoins).mockRejectedValueOnce(new Error("coins API unavailable"));

    await expect(
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: idempotencyKey,
          bet: {
            type: "betOnWinner",
            winner_index: 1,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BurnFailedError);

    const storedBet = await db.bet.findUnique({
      where: {idempotencyKey},
      include: {betOnWinner: true},
    });

    expect(storedBet).toMatchObject({
      status: "canceled",
      betOnWinner: {
        winnerIndex: 1,
      },
    });
  });

  it("ne crée et ne débite qu'une fois lors d'un rejeu concurrent", async () => {
    const submission = {
      battle_id: 123,
      amount: 50,
      idempotency_key: "de437c19-e7ee-4f76-b3ec-f9ce1a48302b", // gitleaks:allow
      bet: {
        type: "betOnWinner",
        winner_index: 1,
      },
    };

    await Promise.all([
      submitBet(db, submission, "access-token"),
      submitBet(db, submission, "access-token"),
    ]);

    expect(
      await db.bet.count({
        where: {idempotencyKey: submission.idempotency_key},
      }),
    ).toBe(1);
    expect(burnUserCoins).toHaveBeenCalledOnce();
  });

  it("rollback la ligne Bet si l'insertion spécialisée viole une contrainte", async () => {
    const idempotencyKey = "d39484f1-8305-4ec5-bf54-d5d449543146";

    await expect(
      db.$transaction(async (tx) => {
        const storedBet = await tx.bet.create({
          data: {
            battleId: "123",
            amount: 50,
            userId: 42,
            idempotencyKey,
          },
        });

        await betOnWinnerHandler.persist(tx, storedBet.id, {winner_index: 3});
      }),
    ).rejects.toThrow();

    expect(await db.bet.findUnique({where: {idempotencyKey}})).toBeNull();
  });
});
