export async function getUserCoins(access_token: string, currency: string): Promise<{ "balance": number }> {
    return await (fetch(`${process.env.COINS_API_URL}/balance?currency=${currency}`, {
        headers: {
            "Authorization": access_token,
            "X-Api-Key": process.env.COINS_API_KEY!,
        }
    }).then(res => res.json()));
}