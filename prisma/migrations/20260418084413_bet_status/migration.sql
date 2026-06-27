-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('pending', 'settled');

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "status" "BetStatus" NOT NULL DEFAULT 'pending';
