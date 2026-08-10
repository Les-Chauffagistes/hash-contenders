import {z} from "zod";

export const BetOnBestShareSchema = z.object({
  diff: z.number()
})

/*
 * Pas encore de handler : il manque la table `BetOnBestShare` dans le schéma
 * Prisma pour que `persist` ait quelque chose à écrire. Tant que ce type n'est
 * pas enregistré dans HANDLERS (create.ts), une soumission `betOnBestShare` est
 * rejetée par InvalidBetTypeError plutôt que faussement acceptée.
 *
 * Pour l'implémenter :
 *  - ajouter `model BetOnBestShare { betId String @id, diff Int, bet Bet @relation(...) }`
 *  - exporter un `betOnBestShareHandler` construit avec defineBetHandler
 *  - l'ajouter au registry
 *  - implémenter `settle` : la plus haute difficulté atteinte prend 60 %, les
 *    deuxième et troisième 30 % et 10 % ; miser sur une difficulté jamais
 *    atteinte est perdant.
 */
