/*
  Warnings:

  - Added the required column `diff` to the `BetOnBestShare` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BetOnBestShare" ADD COLUMN     "diff" BIGINT NOT NULL;
