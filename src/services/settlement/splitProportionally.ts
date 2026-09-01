export type Stake = { userId: bigint; amount: number };

/**
 * Répartit `pot` entre `stakes` au prorata de chaque mise, en entiers. Le
 * total réparti doit être exactement égal à `pot` (jamais un coin perdu ou
 * inventé) : chaque part est arrondie vers le bas, puis le reste de la
 * division entière va à la plus grosse mise (à égalité, la première dans
 * l'ordre reçu — choix arbitraire mais déterministe et audité via
 * `battle_settlement.breakdown`).
 *
 * Un même userId peut apparaître plusieurs fois dans `stakes` (plusieurs
 * paris gagnants du même type pour le même utilisateur) : ses parts sont
 * cumulées dans la Map retournée.
 */
export function splitProportionally(pot: number, stakes: Stake[]): Map<bigint, number> {
  const shares = new Map<bigint, number>();
  const totalStake = stakes.reduce((sum, s) => sum + s.amount, 0);
  if (totalStake === 0 || stakes.length === 0) return shares;

  let distributed = 0;
  let biggestStake = stakes[0];
  for (const stake of stakes) {
    const share = Math.floor((pot * stake.amount) / totalStake);
    shares.set(stake.userId, (shares.get(stake.userId) ?? 0) + share);
    distributed += share;
    if (stake.amount > biggestStake.amount) biggestStake = stake;
  }

  const remainder = pot - distributed;
  if (remainder > 0) {
    shares.set(biggestStake.userId, (shares.get(biggestStake.userId) ?? 0) + remainder);
  }
  return shares;
}
