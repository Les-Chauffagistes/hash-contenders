export type BetTypeFormProps = {
    /** Noms des contenders de la bataille, dans l'ordre des index de pari (1, 2, …). */
    contenders: string[];
    /** Erreurs renvoyées par la Server Action, indexées par nom de champ. */
    errors?: Record<string, string>;
};