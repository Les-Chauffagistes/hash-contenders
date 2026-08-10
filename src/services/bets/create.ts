import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {z} from "zod";
import {getBattleStatus} from "@/app/api";
import {burnUserCoins, getUserCoins} from "@/app/api/lib/coins";
import {decodeAccessToken} from "@/app/api/lib/auth";
import {BetContext, BetHandler, CreateBetSchema, CURRENCY} from "@/services/bets/baseBet";
import {betOnWinnerHandler} from "@/services/bets/betOnWinner";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BetError,
    BurnFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError
} from "@/services/bets/errors";

/**
 * Types de paris acceptés. Ajouter un type = un fichier exportant un handler et
 * une ligne ici ; le déroulé ci-dessous n'a pas à changer.
 */
const HANDLERS: Record<string, BetHandler> = {
    [betOnWinnerHandler.type]: betOnWinnerHandler,
};

/**
 * Déroulé commun à tous les paris. Le handler du type concerné n'intervient que
 * pour valider son payload, ses règles propres, et écrire sa table spécialisée.
 */
export async function submitBet(db: PrismaClient, data: z.infer<typeof CreateBetSchema>, access_token: string) {
    const handler = HANDLERS[data.bet.type];
    if (!handler) throw new InvalidBetTypeError();

    const parsed = handler.schema.safeParse(data.bet);
    if (!parsed.success) throw new InvalidBetDataError();

    // Rejeu d'une soumission déjà traitée (double clic, retry réseau) : on ne
    // recrée rien et on ne rebrûle pas de coins.
    const previousAttempt = await db.bet.findUnique({
        where: {idempotencyKey: data.idempotency_key},
        select: {status: true},
    });
    if (previousAttempt) {
        if (previousAttempt.status === "canceled") throw new BurnFailedError();
        return;
    }

    const battle = await getBattleStatus(data.battle_id);
    if (!battle) throw new BattleNotFoundError();
    if (battle.is_finished) throw new BattleFinishedError();

    const user = await decodeAccessToken(access_token);
    const ctx: BetContext = {
        db,
        userId: Number.parseInt(user.user_id),
        access_token,
        battle,
        submission: data,
    };

    await handler.checkPreconditions(parsed.data, ctx);

    const {balance} = await getUserCoins(access_token, CURRENCY);
    if (balance < data.amount) throw new InsufficientBalanceError();

    let storedBetId: string;

    // Crée un pari 'pending' : ligne principale et ligne spécialisée ensemble.
    try {
        await db.$transaction(async (tx) => {
            const storedBet = await tx.bet.create({
                data: {
                    battleId: data.battle_id.toString(),
                    amount: data.amount,
                    userId: ctx.userId,
                    idempotencyKey: data.idempotency_key,
                }
            });

            await handler.persist(tx, storedBet.id, parsed.data);

            storedBetId = storedBet.id;
        });
    } catch (e) {
        // Deux soumissions concurrentes de la même clé : l'autre requête a créé
        // le pari, celle-ci n'a rien à faire de plus.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
        // Un refus métier levé par le handler garde son sens.
        if (e instanceof BetError) throw e;
        throw new BetCreationError();
    }

    try {
        await burnUserCoins(access_token, CURRENCY, data.amount, storedBetId!, JSON.stringify(data));
    } catch {
        // Le débit a échoué : le pari ne doit pas rester actif.
        await db.bet.update({
            where: {id: storedBetId!},
            data: {status: "canceled"}
        });
        throw new BurnFailedError();
    }

    await db.bet.update({
        where: {id: storedBetId!},
        data: {status: "settled"}
    });
}
