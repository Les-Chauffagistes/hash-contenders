import {config} from "@/lib/config";
import {logger} from "@/lib/logger";

export type AuthUser = {
  id: number;
  pseudo: string;
};

/** `null` si l'auth service ne connaît pas cet identifiant (404). */
export async function getUserById(userId: number | string | bigint): Promise<AuthUser | null> {
  const response = await fetch(`${config.AUTH_API_URL}/user/${userId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to fetch user ${userId}: ${response.status}`);
  return response.json();
}

/**
 * Les utilisateurs correspondant aux identifiants demandés. Un identifiant
 * inconnu est simplement absent de la réponse — ce n'est pas une erreur, la
 * liste rendue est juste plus courte que celle demandée.
 */
export async function getUsersByIds(
  userIds: readonly (number | string | bigint)[],
): Promise<AuthUser[]> {
  if (userIds.length === 0) return [];

  const response = await fetch(`${config.AUTH_API_URL}/users/by-ids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // `JSON.stringify` lève sur un BigInt, et `Bet.userId` en est un.
    body: JSON.stringify({ids: userIds.map(Number)}),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch users: ${response.status}`);
  }

  return response.json();
}

/**
 * Pseudos indexés par identifiant, pour décorer une liste de paris.
 *
 * Un identifiant absent de la Map est un joueur que l'annuaire n'a pas rendu,
 * jamais une erreur remontée à l'appelant : un pseudo manquant ne doit pas
 * faire tomber l'affichage des paris, qui eux sont bien réels. L'annuaire
 * répondant maintenant en un seul appel, c'est tout ou rien — un service muet
 * laisse la liste entière sans pseudo là où le fan-out d'avant en sauvait une
 * partie.
 */
export async function getPseudosByUserId(
  userIds: readonly (number | string | bigint)[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.map(String))];
  if (uniqueIds.length === 0) return new Map();

  try {
    const users = await getUsersByIds(uniqueIds);
    return new Map(users.map((user) => [String(user.id), user.pseudo]));
  } catch (error) {
    logger.error("[auth] annuaire injoignable", error);
    return new Map();
  }
}
