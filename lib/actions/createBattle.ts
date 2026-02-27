"use server";

import { createBattle } from "@/app/api";
import { CreateBattle } from "../../models/CreateBattle";

type FormState = {
    errors?: Record<string, string>;
    success?: boolean;
};

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.length > 0;
}

export async function createBattleAction(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const errors: Record<string, string> = {};
    const contender1Address = formData.get("contender_1_address");
    const contender2Address = formData.get("contender_2_address");
    const contender1Name = formData.get("contender_1_name");
    const contender2Name = formData.get("contender_2_name");
    const contendersPv = formData.get("contenders_pv");
    const rounds = formData.get("rounds");
    const startHeight = formData.get("start_height");
    const areAddressesPrivates = formData.get("are_addresses_privates");

    if (!isNonEmptyString(contender1Address)) errors.contender_1_address = "Adresse invalide"
    if (isNonEmptyString(contender2Address)) errors.contender_2_address = "Adresse invalide"
    if (isNonEmptyString(contender1Name)) errors.contender_1_name = "Nom invalide"
    if (isNonEmptyString(contender2Name)) errors.contender_2_name = "Nom invalide"
    if (isNonEmptyString(contendersPv)) errors.contenders_pv = "PV invalides"
    if (isNonEmptyString(rounds)) errors.rounds = "Nombre de rounds invalide"
    if (isNonEmptyString(startHeight)) errors.start_height = "Hauteur de block invalide"

    if (
        !isNonEmptyString(contender1Address) ||
        !isNonEmptyString(contender2Address) ||
        !isNonEmptyString(contender1Name) ||
        !isNonEmptyString(contender2Name) ||
        !isNonEmptyString(contendersPv) ||
        !isNonEmptyString(rounds) ||
        !isNonEmptyString(startHeight) ||
        Number.parseInt(rounds) <= 0
    ) {
        return { errors };
    }

    const battle: CreateBattle = {
        are_addresses_privates: areAddressesPrivates === "on",
        contender_1_address: contender1Address,
        contender_1_name: contender1Name,
        contender_2_address: contender2Address,
        contender_2_name: contender2Name,
        contenders_pv: Number.parseInt(contendersPv),
        rounds: Number.parseInt(rounds),
        start_height: Number.parseInt(startHeight)
    };

    try {
        const res = await createBattle(battle);
        console.log(res)
        return { success: true };
    } catch {
        console.log("error submitting request")
        return { errors: { _form: "Erreur serveur" } };
    }

}