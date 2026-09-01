import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {z} from "zod";
import {getBattleStatus} from "@/clients/referee";
import {getUserCoins, transferCoins, InsufficientCoinsError} from "@/clients/wallet";
import {decodeAccessToken} from "@/server/auth";
import {BetContext, CreateBetSchema, CURRENCY} from "@/services/bets/baseBet";
import {getBetHandler} from "@/services/bets/registry";
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
import {withTraceContext, type Context} from "@chauffagistes/cmn";

/**
 * Déroulé commun à tous les paris. Le handler du type concerné n'intervient que
 * pour valider son payload, ses règles propres, et écrire sa table spécialisée.
 *
 * Le pari passe par un compte escrow scopé à la bataille (pattern outbox) :
 * la ligne payout_outbox est écrite dans la même transaction que le Bet, puis
 * l'appel au wallet a lieu après le COMMIT. C'est cette ligne, pas l'appel
 * réseau, qui rend un crash survivable — voir payout_outbox dans schema.prisma.
 */
export async function submitBet(db: PrismaClient, data: z.infer<typeof CreateBetSchema>, access_token: string, parentCtx?: Context) {
    // Pas de contexte de trace ambiant à faire survivre ici : l'appelant Server
    // Action (createBetAction) n'est enveloppé par aucun middleware équivalent à
    // withRequestLogging, donc rien ne pose de span actif pour tout ce chemin.
    // Le contexte extrait par l'appelant est passé explicitement en paramètre et
    // réinjecté autour de chaque appel sortant, pas parce qu'un contexte ambiant
    // se perdrait sinon.
    const withTrace = <T>(fn: () => Promise<T>): Promise<T> => parentCtx ? withTraceContext(parentCtx, fn) : fn();

    const handler = getBetHandler(data.bet.type);
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

    const battleId = data.battle_id.toString();

    // Un handler qui déclare `findEditableBet` porte un pari déjà payé
    // (ticket à prix fixe, un seul par (user, battle)) : le retrouver ici
    // évite un contrôle de solde inutile — l'édition ne débite rien.
    const editableBet = handler.findEditableBet
        ? await handler.findEditableBet(db, ctx.userId, battleId)
        : null;

    if (!editableBet) {
        const {balance} = await withTrace(() => getUserCoins(access_token, CURRENCY));
        if (balance < data.amount) throw new InsufficientBalanceError();
    }

    let storedBetId: string;
    let isEdit = false;

    // Crée un pari 'pending' : ligne principale, ligne spécialisée, et la
    // ligne outbox du débit escrow, ensemble. Ou, si un pari éditable existe
    // déjà pour ce (user, battle, type), met simplement à jour sa donnée
    // spécialisée : pas de nouveau `Bet`, pas de nouveau débit.
    try {
        await db.$transaction(async (tx) => {
            if (handler.findEditableBet) {
                // Sérialise les soumissions concurrentes du même utilisateur pour
                // ce (type, battle) : ferme la fenêtre de course entre la lecture
                // ci-dessus (hors transaction) et cette re-lecture qui fait foi.
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${handler.type}:${battleId}:${ctx.userId}`}))`;

                const existing = await handler.findEditableBet(tx, ctx.userId, battleId);
                if (existing) {
                    isEdit = true;
                    storedBetId = existing.id;
                    await handler.persist(tx, existing.id, parsed.data);
                    return;
                }
            }

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

    // Édition d'un ticket déjà payé : la donnée spécialisée est à jour, rien
    // d'autre à faire — pas de débit, le pari garde son statut actuel.
    if (isEdit) return;

    // Après COMMIT, jamais avant : aucun appel réseau n'a eu lieu pendant la
    // transaction. L'appel synchrone donne un retour immédiat à l'utilisateur ;
    // s'il échoue autrement que par un rejet définitif, la ligne outbox déjà
    // écrite laisse le dispatcher rejouer plus tard avec la même clé.
    const idempotencyKey = betDebitKey(battleId, storedBetId!);
    try {
        await withTrace(() => transferCoins({
            fromUserId: ctx.userId,
            toUserId: escrowUserId(data.battle_id),
            amount: data.amount,
            currency: CURRENCY,
            idempotencyKey,
            reason: "Bet placed",
        }));
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
