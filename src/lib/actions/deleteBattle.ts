"use server";

import { deleteBattleById } from "@/clients/referee";
import { extractUserAccessToken } from "@/server/auth";
import { UnauthorizedError } from "@/lib/errors";

type DeleteBattleResult =
    | { success: true }
    | { success: false; error: string };

export async function deleteBattleAction(battleId: number): Promise<DeleteBattleResult> {
    if (!Number.isInteger(battleId) || battleId <= 0) {
        return { success: false, error: "Bataille invalide." };
    }

    let accessToken: string;
    try {
        accessToken = await extractUserAccessToken();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return { success: false, error: "Vous devez être connecté pour supprimer cette bataille." };
        }
        throw error;
    }

    try {
        await deleteBattleById(battleId, accessToken);
        return { success: true };
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return { success: false, error: "Votre session a expiré. Veuillez vous reconnecter." };
        }
        console.error("[deleteBattleAction]", error);
        return { success: false, error: "Impossible de supprimer cette bataille." };
    }
}
