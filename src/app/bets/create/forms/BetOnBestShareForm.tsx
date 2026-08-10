"use client";

import { FormEvent } from "react";
import { UNIT_VALUE_DRAFT_REGEX, UNIT_VALUE_PATTERN } from "@/lib/UnitConverter";
import { BetTypeFormProps } from "./types";
import styles from "../page.module.css";

/**
 * Refuse la frappe avant que le caractère n'atteigne le champ : on reconstitue
 * la valeur qui *résulterait* de l'insertion et on annule si elle ne peut plus
 * mener à une difficulté valide.
 *
 * `beforeinput` plutôt qu'un champ contrôlé filtré dans `onChange` : le
 * caractère n'étant jamais inséré, la position du curseur est préservée
 * telle quelle, y compris en édition au milieu de la valeur.
 */
function rejectInvalidInput(event: FormEvent<HTMLInputElement>) {
    const nativeEvent = event.nativeEvent as InputEvent;
    // `data` est vide pour les suppressions ; Safari le laisse null sur un collage.
    const inserted = nativeEvent.data ?? nativeEvent.dataTransfer?.getData("text");
    if (!inserted) return;

    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = input.value.slice(0, start) + inserted + input.value.slice(end);

    if (!UNIT_VALUE_DRAFT_REGEX.test(nextValue)) event.preventDefault();
}

export default function BetOnBestShareForm({ errors }: Readonly<BetTypeFormProps>) {
    return (
        <div className={styles.field}>
            <label htmlFor="diff">Difficulté visée</label>
            <input
                type="text"
                id="diff"
                name="diff"
                placeholder="250G"
                inputMode="decimal"
                autoComplete="off"
                onBeforeInput={rejectInvalidInput}
                // Filet pour ce que la frappe ne voit pas (valeur préremplie, saisie
                // vocale) et pour les états incomplets type « 1. » ; la règle est de
                // toute façon revérifiée dans le registre, seul garde-fou réel.
                pattern={UNIT_VALUE_PATTERN}
                title="Un nombre, éventuellement suivi d'une unité : K, M, G, T, P ou E (ex. 250G)"
            />
            {errors?.diff && <p className={styles.errorLabel}>{errors.diff}</p>}
            <p className={styles.hint}>
                Seule la difficulté la plus haute effectivement atteinte est récompensée : viser une difficulté qui
                n&apos;est jamais atteinte fait perdre la mise.
            </p>
        </div>
    );
}
