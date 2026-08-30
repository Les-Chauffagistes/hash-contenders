"use server";

import { cookies, headers } from "next/headers";
import { resolveTraceId, runWithTraceId } from "@chauffagistes/cmn";
import { decodeAccessToken } from "@/app/api/lib/auth";
import { UnauthorizedError } from "@/app/api/lib/exceptions";
import { prisma } from "@/server/db";
import { getBetType } from "@/app/bets/betTypes";
import { submitBet } from "@/services/bets/create";
import { CreateBetSchema } from "@/services/bets/baseBet";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BurnFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError,
} from "@/services/bets/errors";
import { logger } from "@/lib/logger";

export type FormState = {
    errors?: Record<string, string>;
    success?: boolean;
    /**
     * Le token était absent ou expiré au moment de la validation : aucune écriture
     * n'a été faite, le client peut rafraîchir sa session et rejouer l'action.
     */
    authExpired?: boolean;
};

export async function createBetAction(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    // Contrairement à /api/bet, une Server Action n'est jamais enveloppée par
    // withRequestLogging (ça n'existe que pour les Route Handlers) : rien ne pose
    // sinon le contexte de trace, et chaque appel sortant (getUserCoins,
    // burnUserCoins) générait indépendamment son propre trace_id aléatoire.
    // `headers()` donne accès aux en-têtes de la requête entrante même depuis une
    // Server Action, d'où le traceparent posé par Traefik.
    const traceId = resolveTraceId(await headers());
    return runWithTraceId(traceId, () => submitCreateBet(formData, traceId));
}

async function submitCreateBet(formData: FormData, traceId: string): Promise<FormState> {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token")?.value;
    if (!access_token) return { errors: { _form: "Non authentifié" }, authExpired: true };

    try {
        await decodeAccessToken(access_token);
    } catch {
        return { errors: { _form: "Session expirée" }, authExpired: true };
    }

    const battleId = formData.get("battle_id");
    const amount = formData.get("amount");
    const idempotencyKey = formData.get("idempotency_key");

    // Le type choisi détermine quels champs métier lire : chaque type de pari
    // déclare son extraction dans le registre partagé avec le formulaire.
    const betType = getBetType(formData.get("bet_type")?.toString());
    if (!betType) return { errors: { _form: "Type de pari invalide" } };

    const errors: Record<string, string> = {};

    if (!battleId) errors.battle_id = "Veuillez sélectionner une bataille";
    if (!amount || Number(amount) <= 0) errors.amount = "Montant invalide";

    const parsedFields = betType.parseFields(formData);
    Object.assign(errors, parsedFields.errors);

    if (Object.keys(errors).length > 0) return { errors };

    const body = {
        battle_id: Number(battleId),
        amount: Number(amount),
        idempotency_key: idempotencyKey as string,
        bet: {
            type: betType.id,
            ...parsedFields.fields,
        },
    };

    const parsed = CreateBetSchema.safeParse(body);
    if (parsed.error) {
        return { errors: { _form: parsed.error.message } };
    }

    try {
        await submitBet(prisma, parsed.data, access_token, traceId);
    } catch (e) {
        // Levée par decodeAccessToken avant toute écriture : rejouable côté client.
        if (e instanceof UnauthorizedError) return { errors: { _form: "Session expirée" }, authExpired: true };
        if (e instanceof BattleNotFoundError) return { errors: { _form: "Bataille introuvable" } };
        if (e instanceof BattleFinishedError) return { errors: { _form: "La bataille est déjà terminée" } };
        if (e instanceof InsufficientBalanceError) return { errors: { _form: "Solde insuffisant pour placer ce pari" } };
        if (e instanceof BetCreationError) return { errors: { _form: "Impossible de créer le pari, veuillez réessayer" } };
        if (e instanceof BurnFailedError) return { errors: { _form: "Impossible de débiter les coins, pari annulé" } };
        if (e instanceof InvalidBetTypeError) return { errors: { _form: "Type de pari invalide" } };
        if (e instanceof InvalidBetDataError) return { errors: { _form: "Données du pari invalides" } };
        logger.error("[createBetAction]", e);
        return { errors: { _form: "Une erreur inattendue s'est produite, veuillez réessayer" } };
    }

    logger.info("pari soumis", {battle_id: body.battle_id, amount: body.amount, bet_type: betType.id});
    return { success: true };
}
