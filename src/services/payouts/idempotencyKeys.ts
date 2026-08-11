/**
 * Clés d'idempotence déterministes pour payout_outbox, calculées dans la
 * transaction qui écrit la ligne — jamais un UUID généré au moment du
 * dispatch. Un crash entre "le wallet a traité" et "la ligne est marquée
 * dispatched" doit rejouer avec la MÊME clé, sinon le wallet créditerait une
 * seconde fois en toute légitimité (pour lui, une clé inédite = une nouvelle
 * opération).
 */

export function betDebitKey(battleId: number | string, betId: string): string {
  return `bet:${battleId}:${betId}`;
}

export function settleKey(battleId: number | string, userId: number | string | bigint): string {
  return `settle:${battleId}:${userId}`;
}

export function refundKey(battleId: number | string, userId: number | string | bigint): string {
  return `refund:${battleId}:${userId}`;
}

/**
 * Extrait le betId d'une clé produite par betDebitKey. Le dispatcher en a
 * besoin pour répercuter le dispatch d'une ligne debit_to_escrow sur le
 * statut du Bet correspondant (payout_outbox n'a pas de colonne betId : la
 * clé le porte déjà, inutile de la dupliquer).
 */
export function parseBetDebitKey(idempotencyKey: string): { battleId: string; betId: string } | null {
  const match = /^bet:(.+):([^:]+)$/.exec(idempotencyKey);
  if (!match) return null;
  return { battleId: match[1], betId: match[2] };
}
