import {NextResponse} from "next/server";
import {prisma} from "@/server/db";
import {settleBattle} from "@/services/settlement/settleBattle";
import {logger} from "@/lib/logger";

/**
 * Fast path déclenché par le référee (Python) fire-and-forget à la fin d'une
 * bataille : timeout court côté appelant, réponse ignorée. Volontairement
 * sans authentification — settleBattle est conçu pour être appelable par
 * n'importe qui, n'importe quand : la PRIMARY KEY sur battle_settlement rend
 * un appel surnuméraire ou malveillant inoffensif (au pire un no-op). Le
 * sweep périodique (instrumentation.ts) rattrape de toute façon les appels
 * qui n'arrivent jamais ; ce endpoint peut disparaître sans rien casser.
 */
export async function POST(request: Request, {params}: {params: Promise<{battle_id: string}>}) {
    const {battle_id} = await params;

    try {
        await settleBattle(prisma, battle_id);
    } catch (e) {
        logger.error(`[POST /api/internal/battles/${battle_id}/settle]`, e);
        return NextResponse.json({error: "settlement failed"}, {status: 500});
    }

    return new Response(null, {status: 204});
}
