/**
 * Convention partagée avec coins-service : le compte escrow d'une bataille
 * est un pseudo-compte système, sans JWT ni session, identifié par l'opposé
 * de l'id de bataille. Les vrais utilisateurs ont des id positifs
 * (auto-incrément côté auth-service), cet espace négatif ne leur est donc
 * jamais alloué.
 */
export function escrowUserId(battleId: number | string | bigint): number {
  return -Number(battleId);
}
