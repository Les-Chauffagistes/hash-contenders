import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {PrismaPg} from "@prisma/adapter-pg";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
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
import {getUserCoins, transferCoins} from "@/clients/wallet";
import {decodeAccessToken} from "@/server/auth";
import {submitBet} from "@/services/bets/create";
import {settleBattle} from "@/services/settlement/settleBattle";
import {dispatchOutboxBatch} from "@/services/payouts/dispatch";
import {escrowUserId} from "@/services/payouts/escrow";

const execFileAsync = promisify(execFile);

let container: StartedPostgreSqlContainer;
let db: PrismaClient;

/**
 * Ledger en mémoire qui tient lieu de wallet-service : transferCoins y
 * applique le même mouvement (débit source, crédit destination) que le vrai
 * coins-service ferait, sans dépendre d'un service réellement démarré. Ça
 * permet de vérifier l'invariant de bout en bout (aucun coin créé ni perdu,
 * l'escrow retombe à zéro) sur le vrai pipeline Next (submitBet ->
 * dispatchOutboxBatch -> settleBattle -> dispatchOutboxBatch).
 */
class FakeWallet {
  private balances = new Map<number, number>();

  set(userId: number, amount: number) {
    this.balances.set(userId, amount);
  }

  get(userId: number): number {
    return this.balances.get(userId) ?? 0;
  }

  transfer(fromUserId: number, toUserId: number, amount: number) {
    this.balances.set(fromUserId, this.get(fromUserId) - amount);
    this.balances.set(toUserId, this.get(toUserId) + amount);
  }
}

const battleId = 999;

function battleStatus(overrides: Partial<BattleStatus> = {}): BattleStatus {
  return {
    owner_user_id: 1,
    battle_id: battleId,
    rounds: 10,
    contenders_base_pv: 100,
    start_height: 1,
    is_finished: false,
    hits: [],
    current_round: 1,
    contender_info: [
      {name: "alpha", pv: 3, current_round_best_diff: 0},
      {name: "beta", pv: 0, current_round_best_diff: 0},
    ],
    ...overrides,
  };
}

describe("pipeline complet : pari -> escrow -> settlement -> payout", () => {
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

  it("l'escrow retombe exactement à zéro après un settlement complet", async () => {
    const wallet = new FakeWallet();
    wallet.set(1, 1_000);
    wallet.set(2, 1_000);
    wallet.set(3, 1_000);

    vi.mocked(decodeAccessToken).mockImplementation(async (token: string) => ({
      user_id: token,
      pseudo: `user-${token}`,
    }));
    vi.mocked(getUserCoins).mockImplementation(async (access_token: string) => ({
      balance: wallet.get(Number(access_token)),
    }));
    vi.mocked(transferCoins).mockImplementation(async (params) => {
      wallet.transfer(params.fromUserId, params.toUserId, params.amount);
    });
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({is_finished: false}));

    // Trois paris confirmés : user 1 et 3 sur le vainqueur (1), user 2 sur le
    // perdant (2). Chaque pari passe par le vrai submitBet (debit escrow
    // synchrone, fast path).
    await submitBet(
      db,
      {battle_id: battleId, amount: 100, idempotency_key: crypto.randomUUID(), bet: {type: "betOnWinner", winner_index: 1}},
      "1",
    );
    await submitBet(
      db,
      {battle_id: battleId, amount: 50, idempotency_key: crypto.randomUUID(), bet: {type: "betOnWinner", winner_index: 2}},
      "2",
    );
    await submitBet(
      db,
      {battle_id: battleId, amount: 30, idempotency_key: crypto.randomUUID(), bet: {type: "betOnWinner", winner_index: 1}},
      "3",
    );

    const escrow = escrowUserId(battleId);
    expect(wallet.get(escrow)).toBe(180); // 100 + 50 + 30, tout est en escrow
    expect(wallet.get(1)).toBe(900);
    expect(wallet.get(2)).toBe(950);
    expect(wallet.get(3)).toBe(970);

    // La bataille se termine : user 1 gagne.
    vi.mocked(getBattleStatus).mockResolvedValue(battleStatus({is_finished: true}));
    await settleBattle(db, battleId);

    // Dispatch des payouts escrow -> gagnants.
    await dispatchOutboxBatch(db);

    expect(wallet.get(escrow)).toBe(0);
    // Pot 180 réparti entre user 1 (100) et user 3 (30) au prorata : floor(18000/130)=138
    // et floor(5400/130)=41, reste 1 donné à la plus grosse mise (user 1) -> 139/41.
    expect(wallet.get(1)).toBe(900 + 139);
    expect(wallet.get(3)).toBe(970 + 41);
    expect(wallet.get(2)).toBe(950); // perdant : ne récupère rien, ne reperd rien de plus
    expect(wallet.get(1) - 900 + (wallet.get(3) - 970)).toBe(180);

    // La somme totale de coins dans le système est invariante (aucun coin
    // créé ni détruit par le passage en escrow).
    const total = [1, 2, 3, escrow].reduce((sum, id) => sum + wallet.get(id), 0);
    expect(total).toBe(1_000 + 1_000 + 1_000);
  });
});
