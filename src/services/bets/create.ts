import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {z} from "zod";
import {getBattleStatus} from "@/app/api";
import {getUserCoins, transferCoins, InsufficientCoinsError} from "@/app/api/lib/coins";
import {decodeAccessToken} from "@/app/api/lib/auth";
import {BetContext, CreateBetSchema, CURRENCY} from "@/services/bets/baseBet";
import {BET_HANDLERS} from "@/services/bets/registry";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BetError,
    EscrowDebitFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError
} from "@/services/bets/errors";
import { escrowUserId } from "@/services/payouts/escrow";
import { betDebitKey } from "@/services/payouts/idempotencyKeys";

/**
 * Déroulé commun à tous les paris. Le handler du type concerné n'intervient que
 * pour valider son payload, ses règles propres, et écrire sa table spécialisée.
 *
 * Le pari passe par un compte escrow scopé à la bataille (pattern outbox) :
 * la ligne payout_outbox est écrite dans la même transaction que le Bet, puis
 * l'appel au wallet a lieu après le COMMIT. C'est cette ligne, pas l'appel
 * réseau, qui rend un crash survivable — voir payout_outbox dans schema.prisma.
 */
export async function submitBet(db: PrismaClient, data: z.infer<typeof CreateBetSchema>, access_token: string) {
    const handler = BET_HANDLERS[data.bet.type];
    if (!handler) throw new InvalidBetTypeError();

    const parsed = handler.schema.safeParse(data.bet);
    if (!parsed.success) throw new InvalidBetDataError();

    // Rejeu d'une soumission déjà traitée (double clic, retry réseau) : on ne
    // recrée rien et on ne redébite pas.
    const previousAttempt = await db.bet.findUnique({
        where: {idempotencyKey: data.idempotency_key},
        select: {status: true},
    });
    if (previousAttempt) {
        if (previousAttempt.status === "void") throw new EscrowDebitFailedError();
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

    const battleId = data.battle_id.toString();
    let storedBetId: string;

    // Crée un pari 'pending' : ligne principale, ligne spécialisée, et la
    // ligne outbox du débit escrow, ensemble.
    try {
        await db.$transaction(async (tx) => {
            const storedBet = await tx.bet.create({
                data: {
                    battleId,
                    amount: data.amount,
                    userId: ctx.userId,
                    idempotencyKey: data.idempotency_key,
                }
            });

            await handler.persist(tx, storedBet.id, parsed.data);

            await tx.payoutOutbox.create({
                data: {
                    battleId,
                    userId: ctx.userId,
                    amount: data.amount,
                    direction: "debit_to_escrow",
                    idempotencyKey: betDebitKey(battleId, storedBet.id),
                }
            });

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

    // Après COMMIT, jamais avant : aucun appel réseau n'a eu lieu pendant la
    // transaction. L'appel synchrone donne un retour immédiat à l'utilisateur ;
    // s'il échoue autrement que par un rejet définitif, la ligne outbox déjà
    // écrite laisse le dispatcher rejouer plus tard avec la même clé.
    const idempotencyKey = betDebitKey(battleId, storedBetId!);
    try {
        await transferCoins({
            fromUserId: ctx.userId,
            toUserId: escrowUserId(data.battle_id),
            amount: data.amount,
            currency: CURRENCY,
            idempotencyKey,
            reason: "Bet placed",
        });
    } catch (e) {
        if (!(e instanceof InsufficientCoinsError)) {
            // Erreur réseau ou timeout : on ne marque rien, le poller reprendra.
            return;
        }
        // Rejet définitif : le pari ne doit pas rester actif, et l'outbox ne
        // doit plus jamais être rejouée pour cette clé.
        await db.$transaction([
            db.bet.update({where: {id: storedBetId!}, data: {status: "void"}}),
            db.payoutOutbox.update({
                where: {idempotencyKey},
                data: {status: "failed", lastError: "insufficient balance"},
            }),
        ]);
        throw new EscrowDebitFailedError();
    }

    await db.$transaction([
        db.bet.update({where: {id: storedBetId!}, data: {status: "confirmed"}}),
        db.payoutOutbox.update({where: {idempotencyKey}, data: {status: "dispatched"}}),
    ]);
}
