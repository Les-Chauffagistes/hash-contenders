import {components} from "@les-chauffagistes/authentication-types"
import type {UserBetListItem} from "@/contracts/bets";
import {UnauthorizedError} from "@/lib/errors";
import {config} from "@/lib/config";

export {
    getAllBattles,
    getBattleHits,
    getBattleStatus,
    getBitcoinBlockHeight,
} from "@/clients/referee";

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

export async function getMe(): Promise<components["schemas"]["User"] | null> {
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
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        throw new Error(`Unable to fetch user bets: ${res.status}`);
    }
    return res.json();
}