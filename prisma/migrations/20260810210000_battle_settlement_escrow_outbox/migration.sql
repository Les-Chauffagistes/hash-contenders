-- AlterEnum
-- Renomme les valeurs en place (pas de recréation de type) pour préserver les
-- lignes Bet existantes : "settled" (débit escrow réussi) devient "confirmed",
-- "canceled" (débit refusé) devient "void". Le nom seul change, jamais la
-- ligne qu'il décrit.
ALTER TYPE "BetStatus" RENAME VALUE 'settled' TO 'confirmed';
ALTER TYPE "BetStatus" RENAME VALUE 'canceled' TO 'void';

-- CreateEnum
CREATE TYPE "PayoutDirection" AS ENUM ('debit_to_escrow', 'escrow_to_winner', 'escrow_to_refund');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'dispatched', 'failed', 'dead');

-- CreateTable
CREATE TABLE "battle_settlement" (
    "battleId" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "potTotal" BIGINT NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "battle_settlement_pkey" PRIMARY KEY ("battleId")
);

-- CreateTable
CREATE TABLE "battle_refund" (
    "battleId" TEXT NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "battle_refund_pkey" PRIMARY KEY ("battleId")
);

-- CreateTable
CREATE TABLE "BattleClosure" (
    "battleId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleClosure_pkey" PRIMARY KEY ("battleId")
);

-- CreateTable
CREATE TABLE "payout_outbox" (
    "id" BIGSERIAL NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "direction" "PayoutDirection" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "payout_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_outbox_idempotencyKey_key" ON "payout_outbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payout_outbox_status_nextAttemptAt_idx" ON "payout_outbox"("status", "nextAttemptAt");
