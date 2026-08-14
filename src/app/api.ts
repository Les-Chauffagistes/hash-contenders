import {components} from "@les-chauffagistes/authentication-types"
import type {BattleBetsView, UserBetsOverview} from "@/contracts/bets";
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

export async function getUserBetsOverview(): Promise<UserBetsOverview> {
    const res = await authFetch(`${config.BASE_URL}/api/bets`);
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        throw new Error(`Unable to fetch user bets: ${res.status}`);
    }
    return res.json();
}

export async function getBattleBetsView(battleId: string, signal?: AbortSignal): Promise<BattleBetsView> {
    const res = await fetch(`${config.BASE_URL}/api/battles/${encodeURIComponent(battleId)}/bets`, {signal});
    if (!res.ok) {
        throw new Error(`Unable to fetch battle bets: ${res.status}`);
    }
    return res.json();
}

export async function getClaimable(): Promise<number> {
    const res = await authFetch(`${config.BASE_URL}/api/coins/claimable`);
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        throw new Error(`Unable to fetch claimable coins: ${res.status}`);
    }
    return res.json();
}

export async function claimCoins(captchaToken: string): Promise<void> {
    const res = await authFetch(`${config.BASE_URL}/api/coins/claim`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({captchaToken}),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        throw new Error(`Unable to claim coins: ${res.status}`);
    }
}

export async function getBalance(): Promise<number> {
    const res = await authFetch(`${config.BASE_URL}/api/coins/balance`);
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        throw new Error(`Unable to fetch balance: ${res.status}`);
    }
    return await res.json();
}