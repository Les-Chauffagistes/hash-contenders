import {z} from "zod";
import {Prisma, PrismaClient} from "@/generated/prisma/client";
import {BattleStatus} from "../../../models/BattleStatus";
import type {BetTypeId} from "@/contracts/bets";
import {BettingClosedError} from "@/services/bets/errors";


export const CURRENCY = process.env.BETS_CURRENCY!;

/** Bet.amount est stocké en Postgres Int (32 bits) — borne haute alignée sur ça. */
const MAX_BET_AMOUNT = 2_147_483_647;

export const CreateBetSchema = z.object({
  battle_id: z.number().int(),
  amount: z.number().int().positive().max(MAX_BET_AMOUNT),
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

/** Résultat d'une bataille figé au moment du settlement, dérivé du référee Python. */
export type BattleResult = {
  battleId: string;
  isFinished: boolean;
  /** null : bataille terminée sur égalité (max de rounds atteint, PV égaux). */
  winnerIndex: 1 | 2 | null;
  /** Meilleure difficulté atteinte, tous rounds et contenders confondus. */
  maxDiffAchieved: number;
};

/** Pari confirmed chargé pour le settlement, avec sa donnée spécialisée déjà jointe. */
export type ConfirmedBet<TPersisted> = {
  id: string;
  userId: bigint;
  amount: number;
  specialized: TPersisted;
};

/**
 * Contrat que chaque type de pari implémente. Le déroulé commun — idempotence,
 * état de la bataille, solde, création du `Bet`, débit escrow et rollback —
 * vit une seule fois dans `submitBet` ; un handler ne décrit que ses différences.
 *
 * `TPersisted` est la forme de la table spécialisée une fois en base (ex.
 * `{winnerIndex: number}`), distincte de `T` qui est la forme du payload
 * d'entrée — `persist` convertit de l'un à l'autre.
 */
export interface BetHandler<T extends z.ZodType = z.ZodType, TPersisted = unknown> {
  /** Discriminant reçu dans `bet.type`. */
  readonly type: BetTypeId;

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

  /**
   * Charge, pour une bataille, tous les paris `confirmed` de ce type avec
   * leur ligne spécialisée. Utilisé par `settleBattle`, dans la transaction
   * de settlement — chaque type sait requêter sa propre table jointe.
   */
  loadConfirmedBets(tx: TransactionClient, battleId: string): Promise<ConfirmedBet<TPersisted>[]>;

  /**
   * Répartition pari-mutuel figée au settlement : reçoit tous les paris
   * confirmed de ce type pour la bataille et son résultat, rend la part de
   * chaque gagnant (userId -> montant). L'appelant doit redistribuer
   * exactement le pot du type (somme des `amount` reçus) — voir
   * `splitProportionally`. Une Map vide signifie "aucun gagnant" :
   * `settleBattle` rembourse alors chaque parieur de ce type sa propre mise
   * (ou une fraction, voir `refundRate`).
   */
  computePayouts(bets: ConfirmedBet<TPersisted>[], battleResult: BattleResult): Map<bigint, number>;

  /**
   * Point d'extension "un ticket par (user, battle)" : retrouve le pari
   * existant de ce type pour cet utilisateur sur cette bataille, s'il existe.
   * Quand défini, `submitBet` édite ce pari en place (nouvelle donnée
   * spécialisée, aucun nouveau `Bet`, aucun nouveau débit escrow) au lieu
   * d'en créer un nouveau. Absent : chaque soumission crée toujours un
   * nouveau `Bet`, comportement historique inchangé.
   */
  findEditableBet?(tx: TransactionClient, userId: number, battleId: string): Promise<{id: string} | null>;

  /**
   * Fraction de la mise remboursée par `settleBattle` quand `computePayouts`
   * ne rend aucun gagnant (Map vide). Absent : 1 (remboursement intégral,
   * comportement historique inchangé).
   */
  readonly refundRate?: number;
}

/**
 * Rejette une création ou édition de pari une fois la bataille démarrée.
 * `current_round > 0` est le même seuil que celui déjà utilisé côté
 * frontend (`BattleCard.tsx`) pour savoir si une bataille a démarré.
 * Partagé par les handlers qui ferment leurs paris au démarrage.
 */
export function assertBettingOpen(battle: BattleStatus): void {
  if (battle.current_round > 0) throw new BettingClosedError();
}

/** Préserve l'inférence du schéma dans les signatures du handler. */
export function defineBetHandler<T extends z.ZodType, TPersisted>(
  handler: BetHandler<T, TPersisted>,
): BetHandler<T, TPersisted> {
  return handler;
}
