import {PrismaClient} from "@/generated/prisma/client";
import {z} from "zod";
import {getBattleStatus} from "@/app/api";
import {burnUserCoins, getUserCoins} from "@/app/api/lib/coins";
import {decodeAccessToken} from "@/app/api/lib/auth";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BurnFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError
} from "@/services/bets/errors";

const CURRENCY = process.env.BETS_CURRENCY!;

export const createBetSchema = z.object({
    battle_id: z.number().int(),
    amount: z.number().int(),
    bet: z.object({
        type: z.string()
    }).loose()
})

const betOnWinnerSchema = z.object({
    winner_index: z.number().gte(1).lte(2).int()
})

// Dumy example
const betOnBestShare = z.object({
    winner_index: z.number()
})


type BetResult =
    | { type: "betOnWinner"; data: z.infer<typeof createBetSchema> & z.infer<typeof betOnWinnerSchema> }
    | { type: "betOnBestShare"; data: z.infer<typeof createBetSchema> & z.infer<typeof betOnBestShare> }


export function verifyBet(prisma: PrismaClient, bet: z.infer<typeof createBetSchema>): BetResult {
    switch (bet.bet.type) {
        case "betOnWinner": {
            const parsed = betOnWinnerSchema.safeParse(bet.bet);
            if (!parsed.success) throw new InvalidBetDataError();
            return {type: "betOnWinner", data: {...bet, ...parsed.data}};
        }
        case "betOnBestShare": {
            const parsed = betOnBestShare.safeParse(bet.bet);
            if (!parsed.success) throw new InvalidBetDataError();
            return {type: "betOnBestShare", data: {...bet, ...parsed.data}};
        }
        default:
            throw new InvalidBetTypeError();
    }
}

async function handleBetOnWinner(db: PrismaClient, bet: {
    type: "betOnWinner";
    data: z.infer<typeof createBetSchema> & z.infer<typeof betOnWinnerSchema>;
}, access_token: string) {
    const battleId = bet.data.battle_id;
    const battle = await getBattleStatus(battleId);
    if (!battle) throw new BattleNotFoundError();
    if (battle.is_finished) throw new BattleFinishedError();

    const result = await getUserCoins(access_token, CURRENCY);
    if (result.balance < bet.data.amount) throw new InsufficientBalanceError();

    const user = await decodeAccessToken(access_token);

    let storedBetId: string;

    // Creates a 'pending' bet
    try {
        await db.$transaction(async (tx) => {
            // primary table
            const storedBet = await tx.bet.create({
                data: {
                    battleId: battleId.toString(),
                    amount: bet.data.amount,
                    userId: Number.parseInt(user.user_id)
                }
            })

            // specialized table
            await tx.betOnWinner.create({
                data: {
                    winnerIndex: bet.data.winner_index,
                    betId: storedBet.id
                }
            })

            storedBetId = storedBet.id;
        })
    } catch {
        throw new BetCreationError();
    }

    try {
        await burnUserCoins(access_token, CURRENCY, bet.data.amount, JSON.stringify(bet.data));
    } catch {
        // Cancel bet if burning failed
        await db.bet.update({
            where: { id: storedBetId! },
            data: { status: "canceled" }
        })
        throw new BurnFailedError();
    }
    await db.bet.update({
        where: {
            id: storedBetId!
        },
        data: {
            status: "settled"
        }
    })
}

export async function handleBet(db: PrismaClient, bet: BetResult, access_token: string) {
    switch (bet.type) {
        case "betOnWinner":
            await handleBetOnWinner(db, bet, access_token);
            break;

        case "betOnBestShare":
            break;
    }
}

export async function submitBet(db: PrismaClient, data: z.infer<typeof createBetSchema>, access_token: string) {
    const result = verifyBet(db, data);
    await handleBet(db, result, access_token);
}