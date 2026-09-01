import {NextResponse} from "next/server";
import {prisma} from "@/server/db";
import {reconcileEscrowBalances} from "@/services/reconciliation/reconcileEscrow";

/**
 * Déclenche une réconciliation à la demande et en restitue le résultat.
 * Il n'y a pas de pipeline de métriques dans ce dépôt (pas de prom-client ni
 * d'OpenTelemetry) : ce endpoint JSON, combiné aux `logger.error` émis par
 * `reconcileEscrowBalances`, tient lieu de point d'observation en attendant.
 */
export async function GET() {
    const drifted = await reconcileEscrowBalances(prisma);
    return NextResponse.json({checked: true, drifted});
}
