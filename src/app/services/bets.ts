import { components } from "@les-chauffagistes/authentication-types";
import { PrismaClient } from "@/generated/prisma/client";
import { Battle } from "../../../models/Battle";
import { UserBetListItem } from "@/app/bets/types";
import {config} from "@/lib/config";

export async function getUserBets(db: PrismaClient, user: components["schemas"]["User"]) {
    return db.bet.findMany({
        where: { userId: Number.parseInt(user.user_id) },
        orderBy: { createdAt: "desc" },
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

export async function getBattlesByIds(battleIds: number[]): Promise<Battle[]> {
    if (battleIds.length === 0) return [];

    const response = await fetch(`${config.API_URL}/v1/battles/by-ids`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: battleIds }),
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch battles: ${response.status}`);
    }

    return response.json();
}

export function mergeBetsWithBattles(
    bets: Awaited<ReturnType<typeof getUserBets>>,
    battles: Battle[]
): UserBetListItem[] {
    const battlesById = new Map(battles.map((battle) => [String(battle.id), battle]));

    return bets.map((bet) => ({
        ...bet,
        createdAt: bet.createdAt.toISOString(),
        battle: battlesById.get(bet.battleId) ?? null,
    }));
}
