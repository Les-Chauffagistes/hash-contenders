/*
  Warnings:

  - The primary key for the `BetOnBestShare` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `diff` on the `BetOnBestShare` table. All the data in the column will be lost.
  - The primary key for the `BetOnWinner` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[betId]` on the table `BetOnBestShare` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[betId]` on the table `BetOnWinner` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BetOnBestShare" DROP CONSTRAINT "BetOnBestShare_pkey",
DROP COLUMN "diff";

-- AlterTable
ALTER TABLE "BetOnWinner" DROP CONSTRAINT "BetOnWinner_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "BetOnBestShare_betId_key" ON "BetOnBestShare"("betId");

-- CreateIndex
CREATE UNIQUE INDEX "BetOnWinner_betId_key" ON "BetOnWinner"("betId");
