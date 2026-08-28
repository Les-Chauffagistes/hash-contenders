import {beforeEach, describe, expect, it, vi} from "vitest";
import {Prisma, type PrismaClient} from "@/generated/prisma/client";
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
import {
  BattleFinishedError,
  BetCreationError,
  BurnFailedError,
  InsufficientBalanceError,
  InvalidBetDataError,
  InvalidBetTypeError,
} from "@/services/bets/errors";
import {submitBet} from "@/services/bets/create";

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

type TransactionMock = {
  bet: {
    create: ReturnType<typeof vi.fn>;
  };
  betOnWinner: {
    create: ReturnType<typeof vi.fn>;
  };
  betOnBestShare: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createDb() {
  const tx: TransactionMock = {
    bet: {
      create: vi.fn().mockResolvedValue({id: "bet-id"}),
    },
    betOnWinner: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    betOnBestShare: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };

  const db = {
    bet: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn(
      async (callback: (transaction: TransactionMock) => Promise<void>) => callback(tx),
    ),
  };

  return {db, prisma: db as unknown as PrismaClient, tx};
}

describe("submitBet", () => {
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

  it("refuse un type de pari inconnu avant tout accès à la base", async () => {
    const {db, prisma} = createDb();

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "ea8502b9-1d07-4cbb-9224-3c3696589906", // gitleaks:allow
          bet: {type: "unknown"},
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(InvalidBetTypeError);

    expect(db.bet.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un payload invalide avant tout accès à la base", async () => {
    const {db, prisma} = createDb();

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "e317444f-d90c-43e6-b05d-4f8c1e9da81d", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 3,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(InvalidBetDataError);

    expect(db.bet.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("ignore le rejeu d'un pari déjà traité", async () => {
    const {db, prisma} = createDb();
    db.bet.findUnique.mockResolvedValue({status: "settled"});

    await submitBet(
      prisma,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: "22d9860f-3094-48ca-b349-b8aed69ee3bc", // gitleaks:allow
        bet: {
          type: "betOnWinner",
          winner_index: 1,
        },
      },
      "access-token",
    );

    expect(getBattleStatus).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(burnUserCoins).not.toHaveBeenCalled();
  });

  it("signale à nouveau l'échec du débit d'un pari annulé", async () => {
    const {db, prisma} = createDb();
    db.bet.findUnique.mockResolvedValue({status: "canceled"});

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "6cc4bbad-6395-4898-a887-d9998d1762f6", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 1,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BurnFailedError);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(burnUserCoins).not.toHaveBeenCalled();
  });

  it("refuse un pari sur une bataille terminée", async () => {
    const {db, prisma} = createDb();
    vi.mocked(getBattleStatus).mockResolvedValueOnce({...battle, is_finished: true});

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "5eaa8de2-4344-4df3-a46e-1c5f76221f73", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 1,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BattleFinishedError);

    expect(decodeAccessToken).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un pari en conflit avec un pari existant", async () => {
    const {db, prisma} = createDb();
    db.bet.findFirst.mockResolvedValue({id: "conflicting-bet"});

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "61c00fc2-cd07-4c83-890e-13769a221863", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 2,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BetCreationError);

    expect(getUserCoins).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse le pari lorsque le solde est insuffisant", async () => {
    const {db, prisma} = createDb();
    vi.mocked(getUserCoins).mockResolvedValueOnce({balance: 49});

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "9db0bb3d-0754-4b5e-992d-e666a8b4653c", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 1,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(burnUserCoins).not.toHaveBeenCalled();
  });

  it("insère le pari sur le gagnant et sa spécialisation dans la même transaction", async () => {
    const {db, prisma, tx} = createDb();
    const submission = {
      battle_id: 123,
      amount: 50,
      idempotency_key: "f6d66273-8b71-4a49-a66f-8f552a7c56c2", // gitleaks:allow
      bet: {
        type: "betOnWinner",
        winner_index: 2,
      },
    };

    await submitBet(prisma, submission, "access-token");

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.bet.create).toHaveBeenCalledWith({
      data: {
        battleId: "123",
        amount: 50,
        userId: 42,
        idempotencyKey: submission.idempotency_key,
      },
    });
    expect(tx.betOnWinner.create).toHaveBeenCalledWith({
      data: {
        winnerIndex: 2,
        betId: "bet-id",
      },
    });
    expect(tx.betOnBestShare.create).not.toHaveBeenCalled();
    expect(burnUserCoins).toHaveBeenCalledWith(
      "access-token",
      "test-coins",
      50,
      "bet-id",
      JSON.stringify(submission),
    );
    expect(db.bet.update).toHaveBeenCalledWith({
      where: {id: "bet-id"},
      data: {status: "settled"},
    });
  });

  it("insère le pari sur la meilleure share avec la difficulté convertie", async () => {
    const {db, prisma, tx} = createDb();
    const submission = {
      battle_id: 123,
      amount: 75,
      idempotency_key: "b459fd4f-1d68-44bf-a5ce-f4225789e4c4", // gitleaks:allow
      bet: {
        type: "betOnBestShare",
        diff: "2.5K",
      },
    };

    await submitBet(prisma, submission, "access-token");

    expect(tx.bet.create).toHaveBeenCalledWith({
      data: {
        battleId: "123",
        amount: 75,
        userId: 42,
        idempotencyKey: submission.idempotency_key,
      },
    });
    expect(tx.betOnBestShare.create).toHaveBeenCalledWith({
      data: {
        diff: 2_500,
        betId: "bet-id",
      },
    });
    expect(tx.betOnWinner.create).not.toHaveBeenCalled();
    expect(db.bet.update).toHaveBeenCalledWith({
      where: {id: "bet-id"},
      data: {status: "settled"},
    });
  });

  it("n'effectue ni débit ni mise à jour si l'insertion spécialisée échoue", async () => {
    const {db, prisma, tx} = createDb();
    tx.betOnWinner.create.mockRejectedValue(new Error("database unavailable"));

    const submission = {
      battle_id: 123,
      amount: 50,
      idempotency_key: "f4162283-93b4-4114-bb24-b94749ce1659",
      bet: {
        type: "betOnWinner",
        winner_index: 1,
      },
    };

    await expect(submitBet(prisma, submission, "access-token")).rejects.toBeInstanceOf(
      BetCreationError,
    );
    expect(burnUserCoins).not.toHaveBeenCalled();
    expect(db.bet.update).not.toHaveBeenCalled();
  });

  it("ignore une collision d'idempotence créée par une requête concurrente", async () => {
    const {db, prisma} = createDb();
    db.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.7.0",
      }),
    );

    await submitBet(
      prisma,
      {
        battle_id: 123,
        amount: 50,
        idempotency_key: "2390744a-b6ad-4cee-b918-adac8b9f8e36", // gitleaks:allow
        bet: {
          type: "betOnWinner",
          winner_index: 1,
        },
      },
      "access-token",
    );

    expect(burnUserCoins).not.toHaveBeenCalled();
    expect(db.bet.update).not.toHaveBeenCalled();
  });

  it("annule le pari si le débit des coins échoue", async () => {
    const {db, prisma} = createDb();
    vi.mocked(burnUserCoins).mockRejectedValueOnce(new Error("coins API unavailable"));

    await expect(
      submitBet(
        prisma,
        {
          battle_id: 123,
          amount: 50,
          idempotency_key: "97fe4c30-5f60-40f0-9676-7dedcb4637dc", // gitleaks:allow
          bet: {
            type: "betOnWinner",
            winner_index: 1,
          },
        },
        "access-token",
      ),
    ).rejects.toBeInstanceOf(BurnFailedError);

    expect(db.bet.update).toHaveBeenCalledOnce();
    expect(db.bet.update).toHaveBeenCalledWith({
      where: {id: "bet-id"},
      data: {status: "canceled"},
    });
  });
});
