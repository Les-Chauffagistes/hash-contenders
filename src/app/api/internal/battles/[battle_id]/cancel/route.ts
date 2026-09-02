import {NextResponse} from "next/server";
import {prisma} from "@/server/db";
import {cancelBattle} from "@/services/settlement/cancelBattle";
import {logger} from "@/lib/logger";

/**
 * Fast path déclenché par le référee (Python) fire-and-forget quand le
 * propriétaire supprime sa bataille : timeout court côté appelant, réponse
 * ignorée. Volontairement sans authentification, comme /settle — la PRIMARY
 * KEY sur battle_refund rend un appel surnuméraire ou malveillant inoffensif
 * (au pire un no-op). Le sweep périodique rattrape les notifications
 * manquées ; ce endpoint peut disparaître sans rien casser.
 */
export async function POST(request: Request, {params}: {params: Promise<{battle_id: string}>}) {
    const {battle_id} = await params;

    try {
        await cancelBattle(prisma, battle_id);
    } catch (e) {
        logger.error(`[POST /api/internal/battles/${battle_id}/cancel]`, e);
        return NextResponse.json({error: "cancellation failed"}, {status: 500});
    }

    return new Response(null, {status: 204});
}
