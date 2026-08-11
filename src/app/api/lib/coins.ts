export async function getUserCoins(access_token: string, currency: string): Promise<{ "balance": number }> {
    return await (fetch(`${process.env.COINS_API_URL}/balance?currency=${currency}`, {
        headers: {
            "Authorization": access_token,
            "X-Api-Key": process.env.COINS_API_KEY!,
        }
    }).then(res => res.json()));
}

/** Rejet définitif par le wallet (solde insuffisant) : pas la peine de réessayer. */
export class InsufficientCoinsError extends Error {}

type TransferParams = {
    fromUserId: number;
    toUserId: number;
    amount: number;
    currency: string;
    idempotencyKey: string;
    reason: string;
};

/**
 * Mouvement direct entre deux comptes côté wallet (utilisateur <-> escrow de
 * bataille, ou escrow -> gagnant). Pas de JWT utilisateur ici : c'est un
 * appel de service à service, authentifié par la clé partagée, avec les
 * comptes source/destination passés explicitement — un compte escrow n'a de
 * toute façon pas de session.
 *
 * Distingue volontairement deux familles d'échec : un solde insuffisant est
 * définitif (`InsufficientCoinsError`, à ne jamais rejouer), tout le reste
 * (réseau, timeout, panne du wallet) est transitoire et laissé à la charge
 * de l'appelant, qui doit pouvoir rejouer sans risque avec la même
 * `idempotencyKey`.
 */
export async function transferCoins(params: TransferParams): Promise<void> {
    let resp: Response;
    try {
        resp = await fetch(`${process.env.COINS_API_URL}/transfer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": process.env.COINS_API_KEY!,
            },
            body: JSON.stringify({
                amount: params.amount,
                currency: params.currency,
                fromUserId: params.fromUserId,
                toUserId: params.toUserId,
                reason: params.reason,
                idempotencyKey: params.idempotencyKey,
            }),
            signal: AbortSignal.timeout(5_000),
        });
    } catch (e) {
        throw new Error("Transfer request failed", {cause: e});
    }

    if (resp.status === 204) return;
    if (resp.status === 400) throw new InsufficientCoinsError();
    throw new Error(`Unexpected wallet response: ${resp.status}`);
}

/**
 * Solde d'un compte arbitraire, y compris un compte système sans JWT (ex.
 * escrow:battle:{battleId}). Sert à la réconciliation (Phase 6), hors du
 * chemin critique.
 */
export async function getSystemAccountBalance(userId: number, currency: string): Promise<number> {
    const resp = await fetch(
        `${process.env.COINS_API_URL}/internal/balance?currency=${currency}&userId=${userId}`,
        {headers: {"X-Api-Key": process.env.COINS_API_KEY!}},
    );
    if (!resp.ok) throw new Error(`Unexpected wallet response: ${resp.status}`);
    const {balance} = await resp.json();
    return balance;
}
