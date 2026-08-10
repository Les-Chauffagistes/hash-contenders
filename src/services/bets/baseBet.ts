import {z} from "zod";
import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {BattleStatus} from "../../../models/BattleStatus";


export const CURRENCY = process.env.BETS_CURRENCY!;

export const CreateBetSchema = z.object({
  battle_id: z.number().int(),
  amount: z.number().int(),
  idempotency_key: z.uuid(),
  bet: z.object({
    type: z.string()
  }).loose()
})

/** Client Prisma restreint à une transaction en cours. */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Tout ce que le tronc commun a déjà établi quand un handler prend la main :
 * l'utilisateur est authentifié et la bataille existe et est en cours.
 */
export type BetContext = {
  db: PrismaClient;
  userId: number;
  access_token: string;
  battle: BattleStatus;
  /** Partie commune de la soumission : montant, bataille, clé d'idempotence. */
  submission: z.infer<typeof CreateBetSchema>;
};

/**
 * Contrat que chaque type de pari implémente. Le déroulé commun — idempotence,
 * état de la bataille, solde, création du `Bet`, burn des coins et rollback —
 * vit une seule fois dans `submitBet` ; un handler ne décrit que ses différences.
 */
export interface BetHandler<T extends z.ZodType = z.ZodType> {
  /** Discriminant reçu dans `bet.type`. */
  readonly type: string;

  /** Forme du payload spécifique. Le parsing est fait par le tronc commun. */
  readonly schema: T;

  /**
   * Règles propres au type. La bataille et le solde sont déjà validés ; lever
   * une erreur de `errors.ts` pour refuser le pari.
   */
  checkPreconditions(data: z.infer<T>, ctx: BetContext): Promise<void>;

  /**
   * Écrit la table spécialisée. Reçoit `tx` et non `db` : cette écriture doit
   * se faire dans la même transaction que la création du `Bet`, sinon un pari
   * peut exister sans sa ligne spécialisée.
   */
  persist(tx: TransactionClient, betId: string, data: z.infer<T>): Promise<void>;

  /** Règlement en fin de bataille. Pas encore appelé par le tronc commun. */
  settle?(ctx: BetContext): Promise<void>;
}

/** Préserve l'inférence du schéma dans les signatures du handler. */
export function defineBetHandler<T extends z.ZodType>(handler: BetHandler<T>): BetHandler<T> {
  return handler;
}
