"use server";

import { createBattle } from "@/app/api";
import { CreateBattle } from "../../models/CreateBattle";

type FormState = {
  errors?: Record<string, string>;
  success?: boolean;
};

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

    if (typeof contender1Address != "string" || contender1Address.length == 0) errors.contender_1_address = "Adresse invalide"
    if (typeof contender2Address != "string" || contender2Address.length == 0) errors.contender_2_address = "Adresse invalide"
    if (typeof contender1Name != "string" || contender1Name.length == 0) errors.contender_1_name = "Nom invalide"
    if (typeof contender2Name != "string" || contender2Name.length == 0) errors.contender_2_name = "Nom invalide"
    if (typeof contendersPv != "string" || contendersPv.length == 0) errors.contenders_pv = "PV invalides"
    if (typeof rounds != "string" || rounds.length == 0 || Number.parseInt(rounds) <= 0) errors.rounds = "Nombre de rounds invalide"
    if (typeof startHeight != "string" || startHeight.length == 0) errors.start_height = "Hauteur de block invalide"

    if (Object.keys(errors).length > 0) return { errors };
    
    

    const battle: CreateBattle = {
        "are_addresses_privates": areAddressesPrivates === "on",
        "contender_1_address": contender1Address,
        "contender_1_name": contender1Name,
        "contender_2_address": contender2Address,
        "contender_2_name": contender2Name,
        "contenders_pv": Number.parseInt(contendersPv),
        "rounds": Number.parseInt(rounds),
        "start_height": Number.parseInt(startHeight)
    }

    try {
        const res = await createBattle(battle);
        console.log(res)
        return { success: true };
    } catch {
        console.log("error submitting request")
        return { errors: { _form: "Erreur serveur" } };
    }

}