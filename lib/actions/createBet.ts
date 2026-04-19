"use server";

import { cookies } from "next/headers";
import { decodeAccessToken } from "@/app/api/lib/auth";
import { prisma } from "@/server/db";
import { createBetSchema, submitBet } from "@/services/bets/create";
import {
    BattleFinishedError,
    BattleNotFoundError,
    BetCreationError,
    BurnFailedError,
    InsufficientBalanceError,
    InvalidBetDataError,
    InvalidBetTypeError,
} from "@/services/bets/errors";

type FormState = {
    errors?: Record<string, string>;
    success?: boolean;
};

export async function createBetAction(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token")?.value;
    if (!access_token) return { errors: { _form: "Non authentifié" } };

    const me = await decodeAccessToken(access_token);
    if (!me) return { errors: { _form: "Non authentifié" } };

    const battleId = formData.get("battle_id");
    const amount = formData.get("amount");
    const betType = formData.get("bet_type");
    const winnerIndex = formData.get("winner_index");

    const errors: Record<string, string> = {};

    if (!battleId) errors.battle_id = "Veuillez sélectionner une bataille";
    if (!amount || Number(amount) <= 0) errors.amount = "Montant invalide";
    if (!winnerIndex) errors.winner_index = "Veuillez choisir un gagnant";

    if (Object.keys(errors).length > 0) return { errors };

    const body = {
        battle_id: Number(battleId),
        amount: Number(amount),
        bet: {
            type: betType as string,
            winner_index: Number(winnerIndex),
        },
    };

    const parsed = createBetSchema.safeParse(body);
    if (parsed.error) {
        return { errors: { _form: parsed.error.message } };
    }

    try {
        await submitBet(prisma, parsed.data, access_token);
    } catch (e) {
        if (e instanceof BattleNotFoundError) return { errors: { _form: "Bataille introuvable" } };
        if (e instanceof BattleFinishedError) return { errors: { _form: "La bataille est déjà terminée" } };
        if (e instanceof InsufficientBalanceError) return { errors: { _form: "Solde insuffisant pour placer ce pari" } };
        if (e instanceof BetCreationError) return { errors: { _form: "Impossible de créer le pari, veuillez réessayer" } };
        if (e instanceof BurnFailedError) return { errors: { _form: "Impossible de débiter les coins, pari annulé" } };
        if (e instanceof InvalidBetTypeError) return { errors: { _form: "Type de pari invalide" } };
        if (e instanceof InvalidBetDataError) return { errors: { _form: "Données du pari invalides" } };
        console.error("[createBetAction]", e);
        return { errors: { _form: "Une erreur inattendue s'est produite, veuillez réessayer" } };
    }

    return { success: true };
}
