import type {components} from "@les-chauffagistes/authentication-types";
import {Prisma, type PrismaClient} from "@/generated/prisma/client";
import type {Battle} from "../../../models/Battle";

const betSelect = {
  id: true,
  battleId: true,
  createdAt: true,
  amount: true,
  result: true,
  status: true,
  betOnWinner: true,
  betOnBestShare: true,
} satisfies Prisma.BetSelect;

export type UserBetRecord = Prisma.BetGetPayload<{select: typeof betSelect}>;

export type UserBetWithBattle = UserBetRecord & {
  battle: Battle | null;
};

export async function findUserBets(
  db: PrismaClient,
  user: components["schemas"]["User"],
): Promise<UserBetRecord[]> {
  return db.bet.findMany({
    where: {userId: BigInt(user.user_id)},
    orderBy: {createdAt: "desc"},
    select: betSelect,
  });
}

export function mergeBetsWithBattles(
  bets: UserBetRecord[],
  battles: Battle[],
): UserBetWithBattle[] {
  const battlesById = new Map(battles.map((battle) => [String(battle.id), battle]));

  return bets.map((bet) => ({
    ...bet,
    battle: battlesById.get(bet.battleId) ?? null,
  }));
}
