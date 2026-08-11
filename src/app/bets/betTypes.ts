/**
 * Registre des types de paris proposés à l'utilisateur.
 *
 * Ce module est volontairement sans JSX ni dépendance serveur : il est lu par le
 * formulaire de création (nom court + description du sélecteur) comme par la
 * Server Action (extraction des champs métier). Ajouter un type de pari se fait
 * ici, puis dans `create/forms/index.ts` pour son formulaire dédié.
 */

import UnitConverter, { UNIT_VALUE_REGEX } from "@/lib/UnitConverter";
import type {BetTypeId} from "@/contracts/bets";

export type {BetTypeId} from "@/contracts/bets";

/** Champs métier extraits du formulaire, ou erreurs par champ à réafficher. */
export type ParsedBetFields = {
    fields?: Record<string, unknown>;
    errors?: Record<string, string>;
};

export type BetTypeDefinition = {
    id: BetTypeId;
    /** Nom court affiché dans le sélecteur. */
    name: string;
    description: string;
    /**
     * Lit les champs propres à ce type dans le FormData. Les clés retournées
     * alimentent l'objet `bet` envoyé au service, qui les revalide via Zod.
     */
    parseFields: (formData: FormData) => ParsedBetFields;
};

export const BET_TYPES: readonly BetTypeDefinition[] = [
    {
        id: "betOnWinner",
        name: "Vainqueur",
        description: "Misez sur le contender qui remportera la bataille.",
        parseFields: (formData) => {
            const winnerIndex = formData.get("winner_index");
            if (!winnerIndex) return { errors: { winner_index: "Veuillez choisir un gagnant" } };
            return { fields: { winner_index: Number(winnerIndex) } };
        },
    },
    {
        id: "betOnBestShare",
        name: "Meilleur share",
        description: "Misez sur la difficulté du meilleur share qui sera trouvé pendant la bataille.",
        parseFields: (formData) => {
            const diff = formData.get("diff")?.toString().trim() ?? "";
            if (!UNIT_VALUE_REGEX.test(diff)) {
                return { errors: { diff: "Indiquez un nombre, éventuellement suivi d'une unité (ex. 250G)" } };
            }
            if (UnitConverter.fromStringToNumber(diff) <= 0) {
                return { errors: { diff: "La difficulté visée doit être supérieure à 0" } };
            }
            // Transmise telle quelle : c'est le service qui convertit en nombre.
            return { fields: { diff } };
        },
    },
];

export const DEFAULT_BET_TYPE: BetTypeId = BET_TYPES[0].id;

export function getBetType(id: string | null | undefined): BetTypeDefinition | undefined {
    return BET_TYPES.find((betType) => betType.id === id);
}