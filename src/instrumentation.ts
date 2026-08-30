/**
 * Démarre, au boot du process Next (standalone, process long-lived — pas de
 * contrainte serverless ici), les boucles de fond du settlement de paris :
 *
 * - dispatcher payout_outbox : rejoue les paiements en attente vers le
 *   wallet (Phase 4) ;
 * - sweep : règle les batailles terminées côté référee qui n'ont pas encore
 *   de battle_settlement, filet de sécurité si le fast path (webhook Python)
 *   se perd (Phase 5) ;
 * - réconciliation : détecte une dérive d'escrow après coup, hors du chemin
 *   critique (Phase 6).
 *
 * Next appelle `register()` une seule fois au démarrage du serveur.
 */
export async function register() {
  // instrumentation.ts est aussi chargé pour le runtime edge ; ces boucles
  // ont besoin de Prisma et d'API Node (process.once), donc uniquement en
  // Node — le code correspondant vit dans instrumentation.node.ts, importé
  // dynamiquement ici pour qu'il n'entre jamais dans le bundle edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const {startBackgroundLoops} = await import("@/instrumentation.node");
  await startBackgroundLoops();
}
