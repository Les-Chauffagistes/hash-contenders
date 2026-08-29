import {tracedFetch} from "@chauffagistes/cmn";

export async function getUserCoins(access_token: string, currency: string): Promise<{ "balance": number }> {
    return await (tracedFetch(`${process.env.COINS_API_URL}/balance?currency=${currency}`, {
        headers: {
            "Authorization": access_token,
            "X-Api-Key": process.env.COINS_API_KEY!,
        }
    }).then(res => res.json()));
}

export async function burnUserCoins(access_token: string, currency: string, amount: number, idempotencyKey: string, reason: string = "Bet created") {
    const resp =  await tracedFetch(
        `${process.env.COINS_API_URL}/burn`,
        {
            method: 'DELETE',
            headers: {
                "Authorization": access_token,
                "X-Api-Key": process.env.COINS_API_KEY!,
            },
            body: JSON.stringify({
                "currency": currency,
                "amount": amount,
                "idempotencyKey": idempotencyKey,
                "reason": reason,
                "destination": "Hash Contenders"
            })
        }
    )
    if (!resp.ok) {
        throw new Error("Burn amount exceeds balance")
    }
}