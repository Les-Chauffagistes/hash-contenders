import type {components} from "@les-chauffagistes/authentication-types";
import {Prisma, type PrismaClient} from "@/generated/prisma/client";

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

const battleBetSelect = {
  id: true,
  userId: true,
  createdAt: true,
  amount: true,
  result: true,
  betOnWinner: true,
  betOnBestShare: true,
} satisfies Prisma.BetSelect;

export type BattleBetRecord = Prisma.BetGetPayload<{select: typeof battleBetSelect}>;

/**
 * Les paris d'une bataille, tous joueurs — la vue publique.
 *
 * `status` n'est pas sélectionné : le filtre `confirmed` le rend inutile en
 * aval, et ce qui n'est pas lu ne peut pas fuir dans une réponse publique.
 */
export async function findBattleBets(
  db: PrismaClient,
  battleId: string,
): Promise<BattleBetRecord[]> {
  return db.bet.findMany({
    where: {battleId, status: "confirmed"},
    orderBy: {createdAt: "desc"},
    select: battleBetSelect,
  });
}

const payoutSelect = {
  battleId: true,
  direction: true,
  amount: true,
} satisfies Prisma.PayoutOutboxSelect;

export type UserPayoutRecord = Prisma.PayoutOutboxGetPayload<{select: typeof payoutSelect}>;

/**
 * Versements dus à l'utilisateur au titre du règlement des batailles.
 * `payout_outbox` fait foi : c'est la décision committée par `settleBattle`, et
 * ses lignes ne sont jamais supprimées — seul leur statut évolue.
 *
 * `failed` et `dead` sont écartés : dans les deux cas le wallet n'a pas crédité
 * et ne le fera pas sans intervention (rejet définitif pour solde d'escrow
 * insuffisant, ou tentatives épuisées), les compter annoncerait au joueur des
 * coins qu'il n'a pas. `pending` est compté : le montant est committé, il ne
 * reste au dispatcher qu'à le rejouer.
 */
export async function findUserPayouts(
  db: PrismaClient,
  user: components["schemas"]["User"],
): Promise<UserPayoutRecord[]> {
  return db.payoutOutbox.findMany({
    where: {
      userId: BigInt(user.user_id),
      direction: {in: ["escrow_to_winner", "escrow_to_refund"]},
      status: {in: ["pending", "dispatched"]},
    },
    select: payoutSelect,
  });
}
