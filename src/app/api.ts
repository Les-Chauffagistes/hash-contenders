import {Battle} from "../../models/Battle";
import {BattleStatus} from "../../models/BattleStatus";
import {CreateBattle} from "../../models/CreateBattle";
import {Round} from "../../models/Hit";
import {components} from "@les-chauffagistes/authentication-types"
import {UnauthorizedError} from "@/app/api/lib/exceptions";
import {UserBetListItem} from "@/app/bets/types";
import {config} from "@/lib/config";


export async function getBattleStatus(battleId: number | string, includeHits: boolean = false): Promise<BattleStatus> {
    return await fetch(`${config.API_URL}/v1/status/${battleId}${includeHits ? "?includes=hits" : ""}`).then(data => data.json());
}

export async function getBattleHits(battleId: number | string): Promise<Round[]> {
    return await fetch(`${config.API_URL}/v1/hits/${battleId}`).then(data => data.json());
}

export async function getAllBattles(): Promise<Battle[]> {
    return await fetch(`${config.API_URL}/v1/battles`).then(data => data.json());
}

export async function createBattle(battle: CreateBattle): Promise<Battle> {
    return await fetch(`${config.API_URL}/v1/battle`, {
        method: "POST",
        body: JSON.stringify(battle)
    }).then(data => data.json());
}

async function authFetch(input: RequestInfo, init?: RequestInit) {
    let res = await fetch(input, {
        ...init,
        credentials: "include"
    });

    if (res.status === 401) {
        const refreshed = await refreshToken();
        if (!refreshed) return res;

        res = await fetch(input, {
            ...init,
            credentials: "include"
        });
    }

    return res;
}

export async function getMe(): Promise<components["schemas"]["User"] | null> {
    const url = `${config.AUTH_API_URL}/me`;
    console.log(url)
    const res = await authFetch(url);
    if (!res.ok) return null;
    return res.json();
}

export async function refreshToken() {
    return await fetch(`${config.AUTH_API_URL}/refresh`, {credentials: "include", method: "POST"});
}

export async function logOut() {
    await fetch(`${config.AUTH_API_URL}/logout`, {
        method: "DELETE",
        credentials: "include",
        mode: "cors"
    })
}

export async function getUserBets(): Promise<UserBetListItem[]> {
    const res = await authFetch(`${config.BASE_URL}/api/bets`);
    if (!res.ok) throw new UnauthorizedError();
    return res.json();
}
