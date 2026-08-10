import formatNumber from "@/lib/NumberFormatter";

/** Séparateur décimal : le point comme la virgule, saisie francophone oblige. */
const NUMBER_PART = "\\d+(?:[.,]\\d+)?";
const UNIT_PART = "[KMGTPEkmgtpe]";

/**
 * Forme d'une valeur que `fromStringToNumber` interprète : un nombre décimal, un
 * espace optionnel, puis un préfixe d'unité optionnel (ex. `250G`, `1,5 T`, `4000`).
 *
 * Sans ancres, pour être posé tel quel dans l'attribut `pattern` d'un input (que
 * le navigateur ancre implicitement) ; utiliser `UNIT_VALUE_REGEX` en JS.
 */
export const UNIT_VALUE_PATTERN = `${NUMBER_PART}\\s*${UNIT_PART}?`;

export const UNIT_VALUE_REGEX = new RegExp(`^${UNIT_VALUE_PATTERN}$`);

/**
 * Saisie *en cours de frappe* : accepte les états intermédiaires par lesquels on
 * passe forcément pour écrire une valeur valide (`""`, `"1"`, `"1,"`, `"250 "`),
 * mais rien qui ne puisse mener à une valeur valide. Sert à refuser la frappe
 * caractère par caractère ; c'est `UNIT_VALUE_REGEX` qui juge la valeur finale.
 */
export const UNIT_VALUE_DRAFT_REGEX = /^(?:\d+(?:[.,]\d*)?\s?[KMGTPEkmgtpe]?)?$/;

/** Même langage que `UNIT_VALUE_PATTERN`, avec le nombre et l'unité capturés. */
const UNIT_VALUE_CAPTURE_REGEX = new RegExp(`^(${NUMBER_PART})\\s*(${UNIT_PART})?$`);

const UNIT_MULTIPLIERS: Record<string, number> = {
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
};

export default class UnitConverter {
    /**
     * Lit une valeur saisie (`"250G"`, `"1,5 T"`, `"4000"`) et la ramène à un
     * nombre brut.
     *
     * Le découpage est fait par la regex plutôt qu'avec `parseFloat` + `slice(-1)` :
     * ce couple lisait « 1,5G » comme 1G (la virgule arrêtant `parseFloat`) et
     * acceptait n'importe quel suffixe inconnu en l'ignorant — « 250X » valait
     * 250. Une valeur mal formée lève désormais plutôt que de valoir autre chose
     * que ce qui a été écrit.
     */
    static fromStringToNumber(value: string): number {
        const match = UNIT_VALUE_CAPTURE_REGEX.exec(value.trim());
        if (!match) throw new Error(`Invalid number: ${value}`);

        const [, numberPart, unit] = match;
        const number = Number.parseFloat(numberPart.replace(",", "."));

        return unit ? number * UNIT_MULTIPLIERS[unit.toUpperCase()] : number;
    };

    static fromNumberToString(value: number, significantDigits: number = 3): string {
        // Gestion des cas spéciaux
        if (value === 0) return "0";
        if (!Number.isFinite(value)) return value.toString();

        const absValue = Math.abs(value);

        // Fonction pour formater avec les chiffres significatifs
        const formatWithSignificantDigits = (num: number, digits: number): string => {
            // Utiliser la notation exponentielle pour extraire les chiffres significatifs
            const exponent = Math.floor(Math.log10(Math.abs(num)));
            const scale = Math.pow(10, digits - 1 - exponent);
            const rounded = Math.round(num * scale) / scale;

            // Pour éviter la notation exponentielle pour les petits nombres
            if (absValue < 1000 && absValue >= 0.001) {
                return formatNumber(rounded.toString());
            }

            // Utiliser toPrecision qui gère naturellement les chiffres significatifs
            return formatNumber(rounded.toPrecision(digits));
        };

        if (absValue < 1e3) {
            return formatWithSignificantDigits(value, significantDigits);
        } else if (absValue < 1e6) {
            return formatWithSignificantDigits(value / 1e3, significantDigits) + " K";
        } else if (absValue < 1e9) {
            return formatWithSignificantDigits(value / 1e6, significantDigits) + " M";
        } else if (absValue < 1e12) {
            return formatWithSignificantDigits(value / 1e9, significantDigits) + " G";
        } else if (absValue < 1e15) {
            return formatWithSignificantDigits(value / 1e12, significantDigits) + " T";
        } else if (absValue < 1e18) {
            return formatWithSignificantDigits(value / 1e15, significantDigits) + " P";
        } else {
            return formatWithSignificantDigits(value / 1e18, significantDigits) + " E";
        }
    }
}