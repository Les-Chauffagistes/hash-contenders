import { z } from "zod";
import { cookies } from "next/headers";
import { decodeAccessToken } from "../lib/auth";

const createBetSchema = z.object({
    battle_id: z.number().int(),
    amount: z.number().int(),
    bet: z.object({
        type: z.string()
    }).loose()
})

const betOnWinnerSchema = z.object({
    winner_index: z.number().gte(1).lte(2).int()
})

// Dumy example
const betOnBestShare = z.object({
    winner_index: z.number()
})

type BetResult =
    | { type: "betOnWinner"; data: z.infer<typeof betOnWinnerSchema> }
    | { type: "betOnBestShare"; data: z.infer<typeof betOnBestShare> }


function verifyBet(bet: z.infer<typeof createBetSchema>): BetResult {
    switch (bet.bet.type) {
        case "betOnWinner": {
            const parsed = betOnWinnerSchema.safeParse(bet.bet);
            if (!parsed.success) throw new Error(parsed.error.message);
            return { type: "betOnWinner", data: parsed.data };
        }
        case "betOnBestShare": {
            const parsed = betOnBestShare.safeParse(bet.bet);
            if (!parsed.success) throw new Error(parsed.error.message);
            return { type: "betOnBestShare", data: parsed.data };
        }
        default:
            throw new Error("Invalid bet type");
    }
}

function handleBet(bet: BetResult) {
    switch (bet.type) {
        case "betOnWinner":
            // TODO
            // Vérifier que la battle existe
            // Vérifier que la battle n'est pas en cours
            // Vérifier que l'utilisateur possède le montant requis
            // Enregistrer le pari en db (2 entrées: bet et betOnWinner)
            break;
        case "betOnBestShare":
            // bet.data est typé comme z.infer<typeof betOnBestShare> ici
            break;
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    console.log(cookieStore)

    const access_token = cookieStore.get("access_token")?.value;
    console.debug("checking cookies")
    if (!access_token) return new Response("Unauthorized", { status: 401 });

    const me = await decodeAccessToken(access_token);
    console.debug("decoding current user", me.pseudo)
    if (!me) return new Response("Unauthorized", { status: 401 });

    const json = await request.json();
    const bet = createBetSchema.safeParse(json);
    if (bet.error) {
        return new Response(bet.error.message, { status: 400 });
    }

    console.log(bet.data);
    let parsedBet;
    try {
        parsedBet = verifyBet(bet.data);
    } catch (e) {
        return new Response(e.message, { status: 400 });
    }

    return new Response("ok");
}