import { Battle } from "../../models/Battle";
import { BattleStatus } from "../../models/BattleStatus";
import { CreateBattle } from "../../models/CreateBattle";
import { Round } from "../../models/Hit";

export async function getBattleStatus(battleId: number | string, includeHits: boolean = false): Promise<BattleStatus> {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/status/${battleId}${includeHits ? "?includes=hits" : ""}`).then(data => data.json());
}

export async function getBattleHits(battleId: number | string): Promise<Round[]> {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/hits/${battleId}`).then(data => data.json());
}

export async function getAllBattles(): Promise<Battle[]> {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/battles`).then(data => data.json());
}

export async function createBattle(battle: CreateBattle): Promise<Battle> {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/battle`, {
        method: "POST",
        body: JSON.stringify(battle)
    }).then(data => data.json());
}