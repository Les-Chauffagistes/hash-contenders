import { components} from "@les-chauffagistes/authentication-types";
import {PrismaClient} from "@/generated/prisma/client";


export async function getUserBets(db: PrismaClient, user: components["schemas"]["User"]) {
    return db.bet.findMany({
        where: {userId: Number.parseInt(user.user_id)},
        select: {
            id: true,
            battleId: true,
            createdAt: true,
            amount: true,
            result: true,
            status: true,
            betOnWinner: true,
        },
    });
}