/**
 * Isolé de instrumentation.ts pour que le bundle edge (qui charge aussi
 * register(), analysé statiquement pour les deux runtimes) ne référence
 * jamais d'API Node comme `process.once` — ce module n'est importé que
 * dynamiquement, depuis la branche `NEXT_RUNTIME === "nodejs"`.
 */
import {logger} from "@/lib/logger";
import {setupTracing, shutdownTracing} from "@chauffagistes/cmn";

export async function startBackgroundLoops() {
  // handleShutdownSignal: false — ce fichier a déjà son propre handler SIGTERM
  // ci-dessous pour drainer les boucles de fond ; shutdownTracing() y est
  // appelé explicitement, dans la même séquence, plutôt que de laisser deux
  // handlers SIGTERM indépendants se disputer l'ordre d'arrêt.
  setupTracing({service: "hash-contenders", handleShutdownSignal: false});

  const {prisma} = await import("@/server/db");
  const {dispatchOutboxBatch} = await import("@/services/payouts/dispatch");
  const {sweepUnsettledBattles} = await import("@/services/settlement/sweep");
  const {reconcileEscrowBalances} = await import("@/services/reconciliation/reconcileEscrow");

  const DISPATCH_INTERVAL_MS = 2_000;
  const SWEEP_INTERVAL_MS = 5_000;
  const RECONCILIATION_INTERVAL_MS = 60_000;

  const loops = [
    startLoop("payout dispatcher", DISPATCH_INTERVAL_MS, () => dispatchOutboxBatch(prisma)),
    startLoop("sweep", SWEEP_INTERVAL_MS, () => sweepUnsettledBattles(prisma)),
    startLoop("reconciliation", RECONCILIATION_INTERVAL_MS, () => reconcileEscrowBalances(prisma)),
  ];

  const shutdown = async () => {
    await Promise.all(loops.map((loop) => loop.stop()));
    await prisma.$disconnect();
    await shutdownTracing();
  };

  // Le Swarm envoie SIGTERM à chaque redeploy : laisser le tick en cours se
  // terminer proprement plutôt que couper une transaction en plein vol.
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

type Loop = {stop: () => Promise<void>};

function startLoop(name: string, intervalMs: number, run: () => Promise<unknown>): Loop {
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  const tick = async () => {
    try {
      await run();
    } catch (e) {
      logger.error(`[${name}] tick failed`, e);
    }
  };

  const timer = setInterval(() => {
    if (stopped || inFlight) return; // ne chevauche jamais deux ticks du même loop
    inFlight = tick().finally(() => {
      inFlight = null;
    });
  }, intervalMs);

  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      if (inFlight) await inFlight;
    },
  };
}
