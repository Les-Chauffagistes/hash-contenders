import formatNumber from "./NumberFormatter";

export default class UnitConverter {
    static fromStringToNumber(value: string): number {
        const unit = value.slice(-1).toUpperCase();
        const number = Number.parseFloat(value);
        if (Number.isNaN(number)) throw new Error("Invalid number");

        switch (unit) {
            case "K": return number * 1e3;
            case "M": return number * 1e6;
            case "G": return number * 1e9;
            case "T": return number * 1e12;
            case "P": return number * 1e15;
            case "E": return number * 1e18;
            default: return number;
        }
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