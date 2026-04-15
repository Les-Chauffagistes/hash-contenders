-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('pending', 'won', 'lost', 'cancelled');

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "result" "ResultStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetOnWinner" (
    "betId" TEXT NOT NULL,
    "winnerIndex" INTEGER NOT NULL,

    CONSTRAINT "BetOnWinner_pkey" PRIMARY KEY ("betId")
);

-- AddForeignKey
ALTER TABLE "BetOnWinner" ADD CONSTRAINT "BetOnWinner_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BetOnWinner"
ADD CONSTRAINT "winner_index_valid"
CHECK ("winnerIndex" IN (1, 2));