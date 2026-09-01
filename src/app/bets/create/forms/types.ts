export type BetTypeFormProps = {
    /** Noms des contenders de la bataille, dans l'ordre des index de pari (1, 2, …). */
    contenders: string[];
    /** Erreurs renvoyées par la Server Action, indexées par nom de champ. */
    errors?: Record<string, string>;
    /**
     * Valeurs à préremplir, indexées par nom de champ — typiquement celles
     * du pari déjà en place du joueur sur cette bataille, pour en faciliter
     * la modification plutôt que de repartir d'un formulaire vide.
     */
    defaultValues?: Record<string, string>;
    /**
     * Le joueur a déjà un pari de ce type sur cette bataille, et ce type ne
     * se modifie pas en resoumettant (contrairement à un ticket à prix fixe) :
     * les champs restent affichés à titre informatif mais ne peuvent pas être
     * changés depuis ce formulaire.
     */
    disabled?: boolean;
};