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

vi.mock("@/clients/referee", () => ({
  getBattleStatus: vi.fn(),
}));

vi.mock("@/clients/wallet", () => ({
  transferCoins: vi.fn(),
  getUserCoins: vi.fn(),
  InsufficientCoinsError: class InsufficientCoinsError extends Error {},
}));

vi.mock("@/server/auth", () => ({
  decodeAccessToken: vi.fn(),
}));

import {getBattleStatus} from "@/clients/referee";
import {transferCoins, getUserCoins} from "@/clients/wallet";
import {decodeAccessToken} from "@/server/auth";
import {betOnWinnerHandler} from "@/services/bets/betOnWinner";
import {submitBet} from "@/services/bets/create";
import {BettingClosedError, EscrowDebitFailedError, InvalidBetDataError} from "@/services/bets/errors";

const execFileAsync = promisify(execFile);

const battle: BattleStatus = {
  owner_user_id: 1,
  battle_id: 123,
  rounds: 10,
  contenders_base_pv: 100,
  start_height: 1,
  is_finished: false,
  hits: [],
  current_round: 0,
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
    vi.mocked(transferCoins).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await db.payoutOutbox.deleteMany();
    await db.betOnWinner.deleteMany();
    await db.betOnBestShare.deleteMany();
    await db.bet.deleteMany();
  });

  it("persiste un pari sur le gagnant et sa relation", async () => {
    const idempotencyKey = "430f844f-a821-4055-b0ca-75fe30f32030";

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
      status: "confirmed",
      result: "pending",
      betOnWinner: {
        winnerIndex: 2,
      },
      betOnBestShare: null,
    });

    const outboxRow = await db.payoutOutbox.findUnique({
      where: {idempotencyKey: `bet:123:${storedBet!.id}`},
    });
    expect(outboxRow).toMatchObject({
      battleId: "123",
      userId: BigInt(42),
      amount: BigInt(50),
      direction: "debit_to_escrow",
      status: "dispatched",
    });
  });

  it("persiste un pari sur la meilleure share avec un bigint", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 0});
    const idempotencyKey = "ef7d9363-50ce-428d-b893-b257b94fcac7";

    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 50,
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
      status: "confirmed",
      betOnWinner: null,
      betOnBestShare: {
        diff: BigInt(2_500_000_000),
      },
    });
  });

  it("refuse un pari betOnBestShare une fois la bataille démarrée", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 1});

    await expect(
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "3d3f9b8f-6f2f-4b7b-9a5b-6a2b6f6f9b8a",
          bet: {type: "betOnBestShare", diff: "2.5G"},
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BettingClosedError);

    expect(await db.bet.count()).toBe(0);
  });

  it("refuse un pari betOnWinner une fois la bataille démarrée", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 1});

    await expect(
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "4e2f9b8f-6f2f-4b7b-9a5b-6a2b6f6f9b8c",
          bet: {type: "betOnWinner", winner_index: 1},
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BettingClosedError);

    expect(await db.bet.count()).toBe(0);
  });

  it("refuse un pari betOnBestShare dont le montant n'est pas le prix fixe du ticket", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 0});

    await expect(
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 75,
          idempotency_key: "7a2f9b8f-6f2f-4b7b-9a5b-6a2b6f6f9b8b",
          bet: {type: "betOnBestShare", diff: "2.5G"},
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(InvalidBetDataError);

    expect(await db.bet.count()).toBe(0);
  });

  it("édite le ticket existant au lieu d'en créer un nouveau, sans nouveau débit", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 0});

    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: "5b6f6f9b-8a3d-4f9b-8f6f-2f4b7b9a5b6a",
        bet: {type: "betOnBestShare", diff: "2.5G"},
      },
      "access-token",
    );
    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: "9b8a3d4f-9b8f-6f2f-4b7b-9a5b6a2b6f6f",
        bet: {type: "betOnBestShare", diff: "3G"},
      },
      "access-token",
    );

    expect(await db.bet.count({where: {battleId: "123", userId: 42}})).toBe(1);
    expect(await db.betOnBestShare.count()).toBe(1);
    const storedBet = await db.bet.findFirst({
      where: {battleId: "123", userId: 42},
      include: {betOnBestShare: true},
    });
    expect(storedBet).toMatchObject({betOnBestShare: {diff: BigInt(3_000_000_000)}});
    expect(transferCoins).toHaveBeenCalledOnce();
  });

  it("ne crée qu'un seul ticket lors d'une édition concurrente", async () => {
    vi.mocked(getBattleStatus).mockResolvedValue({...battle, current_round: 0});

    await submitBet(
      db,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: "2f4b7b9a-5b6a-2b6f-6f9b-8a3d4f9b8f6f",
        bet: {type: "betOnBestShare", diff: "2.5G"},
      },
      "access-token",
    );

    await Promise.all([
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "6a2b6f6f-9b8a-3d4f-9b8f-6f2f4b7b9a5b",
          bet: {type: "betOnBestShare", diff: "3G"},
        },
        "access-token",
      ),
      submitBet(
        db,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "8f6f2f4b-7b9a-5b6a-2b6f-6f9b8a3d4f9b",
          bet: {type: "betOnBestShare", diff: "4G"},
        },
        "access-token",
      ),
    ]);

    expect(await db.bet.count({where: {battleId: "123", userId: 42}})).toBe(1);
    expect(await db.betOnBestShare.count()).toBe(1);
    expect(transferCoins).toHaveBeenCalledOnce();
  });

  it("conserve le pari en void et l'outbox en failed lorsque le débit est refusé définitivement", async () => {
    const idempotencyKey = "1215178c-8117-4432-a24e-f9d7ab0b4f6b";
    const {InsufficientCoinsError} = await import("@/clients/wallet");
    vi.mocked(transferCoins).mockRejectedValueOnce(new InsufficientCoinsError());

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
    ).rejects.toBeInstanceOf(EscrowDebitFailedError);

    const storedBet = await db.bet.findUnique({
      where: {idempotencyKey},
      include: {betOnWinner: true},
    });

    expect(storedBet).toMatchObject({
      status: "void",
      betOnWinner: {
        winnerIndex: 1,
      },
    });

    const outboxRow = await db.payoutOutbox.findUnique({
      where: {idempotencyKey: `bet:123:${storedBet!.id}`},
    });
    expect(outboxRow).toMatchObject({status: "failed"});
  });

  it("laisse le pari et l'outbox pending lorsque le wallet échoue pour une raison transitoire", async () => {
    const idempotencyKey = "6f5f5e59-2f76-4f0a-9f38-6a1b0d0f7f19";
    vi.mocked(transferCoins).mockRejectedValueOnce(new Error("coins API unavailable"));

    await submitBet(
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
    );

    const storedBet = await db.bet.findUnique({where: {idempotencyKey}});
    expect(storedBet).toMatchObject({status: "pending"});

    const outboxRow = await db.payoutOutbox.findUnique({
      where: {idempotencyKey: `bet:123:${storedBet!.id}`},
    });
    expect(outboxRow).toMatchObject({status: "pending"});
  });

  it("ne crée et ne débite qu'une fois lors d'un rejeu concurrent", async () => {
    const submission = {
      battle_id: 123,
      amount: 50,
      idempotency_key: "de437c19-e7ee-4f76-b3ec-f9ce1a48302b",
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
    expect(transferCoins).toHaveBeenCalledOnce();
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
