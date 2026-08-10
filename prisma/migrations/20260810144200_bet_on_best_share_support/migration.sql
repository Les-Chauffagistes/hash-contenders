-- CreateTable
CREATE TABLE "BetOnBestShare" (
    "betId" TEXT NOT NULL,
    "diff" INTEGER NOT NULL,

    CONSTRAINT "BetOnBestShare_pkey" PRIMARY KEY ("betId")
);

-- AddForeignKey
ALTER TABLE "BetOnBestShare" ADD CONSTRAINT "BetOnBestShare_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
