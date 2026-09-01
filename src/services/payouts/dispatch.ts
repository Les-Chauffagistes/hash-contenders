import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {CURRENCY} from "@/services/bets/baseBet";
import {burnUserCoins, InsufficientCoinsError, transferCoins} from "@/clients/wallet";
import {escrowUserId} from "@/services/payouts/escrow";
import {parseBetDebitKey} from "@/services/payouts/idempotencyKeys";
import {logger} from "@/lib/logger";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

type PayoutDirection = "debit_to_escrow" | "escrow_to_winner" | "escrow_to_refund" | "escrow_to_burn";

type OutboxRow = {
  id: bigint;
  battleId: string;
  userId: bigint;
  amount: bigint;
  direction: PayoutDirection;
  idempotencyKey: string;
  attempts: number;
};

const REASON: Record<PayoutDirection, string> = {
  debit_to_escrow: "Bet placed",
  escrow_to_winner: "Battle settlement payout",
  escrow_to_refund: "Battle settlement refund",
  escrow_to_burn: "Battle settlement burn (no winner)",
};

function counterparties(row: OutboxRow): {fromUserId: number; toUserId: number} {
  const escrow = escrowUserId(row.battleId);
  const user = Number(row.userId);
  return row.direction === "debit_to_escrow"
    ? {fromUserId: user, toUserId: escrow}
    : {fromUserId: escrow, toUserId: user};
}

/** Backoff exponentiel plafonné à 5 minutes, +/- 20% de jitter pour éviter les vagues synchronisées. */
function nextAttemptWithBackoff(attempts: number): Date {
  const baseMs = Math.min(2 ** attempts * 1_000, 5 * 60_000);
  const jitterMs = Math.random() * baseMs * 0.2;
  return new Date(Date.now() + baseMs + jitterMs);
}

/**
 * Traite un lot de payout_outbox. `FOR UPDATE SKIP LOCKED` verrouille les
 * lignes candidates pour la durée de la transaction : c'est ce qui rend le
 * dispatcher sûr si Next tourne sur plusieurs replicas (chacun saute les
 * lignes déjà prises par un autre). Cette transaction n'écrit jamais le
 * *montant* d'un paiement — cette décision a déjà été committée par
 * `submitBet`/`settleBattle` — elle ne fait que sérialiser qui traite quelle
 * ligne, puis rejouer l'appel wallet déjà décidé avec sa clé déterministe.
 *
 * Rend le nombre de lignes traitées (0 = rien à faire à ce tick).
 */
export async function dispatchOutboxBatch(db: PrismaClient): Promise<number> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, "battleId", "userId", amount, direction, "idempotencyKey", attempts
        FROM payout_outbox
        WHERE status = 'pending' AND "nextAttemptAt" <= now()
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT ${BATCH_SIZE}
      `;

      for (const row of rows) {
        await dispatchRow(tx, row);
      }

      return rows.length;
    },
    // Le lot appelle le wallet séquentiellement, réseau compris : timeout
    // généreux pour ne pas avorter la transaction en plein traitement.
    {timeout: 120_000, maxWait: 10_000},
  );
}

async function dispatchRow(tx: Prisma.TransactionClient, row: OutboxRow): Promise<void> {
  try {
    if (row.direction === "escrow_to_burn") {
      // Pas de contrepartie : `userId` porte déjà le compte escrow dont le
      // solde doit être détruit (settleBattle l'a posé à escrowUserId).
      await burnUserCoins({
        params: {
          userId: Number(row.userId),
          amount: Number(row.amount),
          currency: CURRENCY,
          idempotencyKey: row.idempotencyKey,
          reason: REASON[row.direction],
        },
      });
    } else {
      const {fromUserId, toUserId} = counterparties(row);
      await transferCoins({
        fromUserId,
        toUserId,
        amount: Number(row.amount),
        currency: CURRENCY,
        idempotencyKey: row.idempotencyKey,
        reason: REASON[row.direction],
      });
    }
  } catch (e) {
    if (e instanceof InsufficientCoinsError) {
      await markDefinitiveFailure(tx, row);
      return;
    }
    await markTransientFailure(tx, row, e);
    return;
  }

  await tx.payoutOutbox.update({where: {id: row.id}, data: {status: "dispatched"}});
  if (row.direction === "debit_to_escrow") {
    await confirmBet(tx, row.idempotencyKey);
  }
}

/**
 * Répercute un dispatch réussi de debit_to_escrow sur le Bet correspondant.
 * Couvre le crash entre le COMMIT de submitBet et son appel wallet : le pari
 * est resté 'pending', c'est ici qu'il devient 'confirmed'. Idempotent (le
 * WHERE status='pending' rend un second appel sans effet si le fast path a
 * déjà confirmé).
 */
async function confirmBet(tx: Prisma.TransactionClient, idempotencyKey: string): Promise<void> {
  const parsed = parseBetDebitKey(idempotencyKey);
  if (!parsed) return;
  await tx.bet.updateMany({
    where: {id: parsed.betId, status: "pending"},
    data: {status: "confirmed"},
  });
}

/** Rejet définitif du wallet (solde insuffisant) : état terminal, jamais de retry. */
async function markDefinitiveFailure(tx: Prisma.TransactionClient, row: OutboxRow): Promise<void> {
  await tx.payoutOutbox.update({
    where: {id: row.id},
    data: {status: "failed", lastError: "insufficient balance"},
  });

  if (row.direction === "debit_to_escrow") {
    const parsed = parseBetDebitKey(row.idempotencyKey);
    if (parsed) {
      await tx.bet.updateMany({
        where: {id: parsed.betId, status: "pending"},
        data: {status: "void"},
      });
    }
    return;
  }

  // Un escrow_to_winner/refund/burn refusé pour solde insuffisant signifie
  // que l'escrow de la bataille n'a pas ce qu'il devrait avoir : ce n'est pas
  // un cas attendu, la réconciliation (Phase 6) est censée l'avoir détecté avant.
  logger.error(`[payoutOutbox] solde escrow insuffisant pour la ligne ${row.id} (${row.direction})`, row);
}

/** Erreur réseau/timeout/panne wallet : transitoire, on rejoue plus tard avec la même clé. */
async function markTransientFailure(tx: Prisma.TransactionClient, row: OutboxRow, error: unknown): Promise<void> {
  const attempts = row.attempts + 1;
  const lastError = error instanceof Error ? error.message : String(error);

  if (attempts >= MAX_ATTEMPTS) {
    await tx.payoutOutbox.update({
      where: {id: row.id},
      data: {status: "dead", attempts, lastError},
    });
    logger.error(`[payoutOutbox] ligne ${row.id} passée en dead après ${attempts} tentatives`, {
      battleId: row.battleId,
      userId: row.userId.toString(),
      direction: row.direction,
      lastError,
    });
    return;
  }

  await tx.payoutOutbox.update({
    where: {id: row.id},
    data: {attempts, lastError, nextAttemptAt: nextAttemptWithBackoff(attempts)},
  });
}
