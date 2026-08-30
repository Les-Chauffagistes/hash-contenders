import {Battle} from "../../models/Battle";
import {BattleStatus} from "../../models/BattleStatus";
import {CreateBattle} from "../../models/CreateBattle";
import {Round} from "../../models/Hit";
import {User} from "../../models/User"
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

export async function deleteBattleById(battleId: number | string, accessToken: string): Promise<void> {
    const res = await fetch(`${config.API_URL}/v1/battle/${battleId}`, {
        method: "DELETE",
        headers: {
            "Authorization": accessToken
        }
    });
    if (res.status === 401) {
        throw new UnauthorizedError();
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`deleteBattleById failed: ${res.status} ${res.statusText} - ${text}`);
    }
}

export async function createBattle(battle: CreateBattle, accessToken: string): Promise<Battle> {
    const res = await fetch(`${config.API_URL}/v1/battle`, {
        method: "POST",
        headers: {
            "Authorization": accessToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(battle)
    });
    if (res.status === 401) {
        throw new UnauthorizedError();
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`createBattle failed: ${res.status} ${res.statusText} - ${text}`);
    }
    return res.json();
}

async function authFetch(input: RequestInfo, init?: RequestInit) {
    let res = await fetch(input, {
        ...init,
        credentials: "include"
    });

    if (res.status === 401) {
        const refreshed = await refreshToken();
        if (!refreshed.ok) return res;

        res = await fetch(input, {
            ...init,
            credentials: "include"
        });
    }

    return res;
}

export async function getMe(): Promise<User | null> {
    const res = await authFetch(`${config.AUTH_API_URL}/me`);
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


export async function getBitcoinBlockHeight(): Promise<number> {
    return fetch(`${config.BITCOIN_API_URL}/v1/bitcoin-block-height`).then(res => res.text()).then(Number.parseInt)
}