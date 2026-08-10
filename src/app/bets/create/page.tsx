"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBattleStatus, getMe, refreshToken } from "../../api";
import { BattleStatus } from "../../../../models/BattleStatus";
import { createBetAction, FormState } from "@/lib/actions/createBet";
import { BET_TYPES, BetTypeId, DEFAULT_BET_TYPE } from "../betTypes";
import { BET_TYPE_FORMS } from "./forms";
import styles from "./page.module.css";

function BetCreateForm() {
  const searchParams = useSearchParams();
  const battleId = searchParams.get("battle_id");

  // Clé d'idempotence : générée à la première soumission et conservée tant que
  // celle-ci n'a pas abouti, de sorte que des soumissions concurrentes (double
  // clic, rejeu réseau) ne créent qu'un seul pari côté serveur.
  const idempotencyKey = useRef<string | null>(null);

  /**
   * La Server Action lit le cookie `access_token` mais ne peut pas le renouveler.
   * On passe donc par le navigateur : `getMe()` rafraîchit la session si le token
   * est expiré (le cookie renouvelé est celui que l'action relira), et en cas de
   * course on rejoue une fois après un refresh explicite.
   */
  async function submitWithFreshSession(prevState: FormState, formData: FormData): Promise<FormState> {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotency_key", idempotencyKey.current);

    try {
      const me = await getMe();
      if (!me) return { errors: { _form: "Session expirée, veuillez vous reconnecter" } };

      const result = await createBetAction(prevState, formData);
      if (!result.authExpired) return result;

      // Le rejeu réutilise la même clé : si l'action avait déjà écrit, rien n'est dupliqué.
      const refreshed = await refreshToken();
      if (!refreshed.ok) return { errors: { _form: "Session expirée, veuillez vous reconnecter" } };

      return await createBetAction(prevState, formData);
    } finally {
      // Tentative terminée : la prochaine soumission repart sur une clé neuve.
      idempotencyKey.current = null;
    }
  }

  const [state, action, isPending] = useActionState(submitWithFreshSession, {});
  const [battle, setBattle] = useState<BattleStatus | null>(null);
  const [betTypeId, setBetTypeId] = useState<BetTypeId>(DEFAULT_BET_TYPE);

  useEffect(() => {
    if (battleId) {
      getBattleStatus(Number(battleId)).then(setBattle);
    }
  }, [battleId]);

  const contenders = [
    battle?.contender_info?.[0]?.name ?? "Contender 1",
    battle?.contender_info?.[1]?.name ?? "Contender 2",
  ];

  const selectedBetType = BET_TYPES.find(betType => betType.id === betTypeId)!;
  const BetTypeForm = BET_TYPE_FORMS[betTypeId];

  return (
    <form action={action} className={styles.form}>
      <h1 className={styles.title}>Créer un pari</h1>

      {battle && (
        <p className={styles.battleContext}>
          {contenders[0]} <span className={styles.vs}>vs</span> {contenders[1]}
        </p>
      )}

      {state?.errors?._form && (
        <p className={styles.errorLabel}>{state.errors._form}</p>
      )}
      {state?.success && (
        <p className={styles.successLabel}>Pari placé avec succès !</p>
      )}

      <input type="hidden" name="battle_id" value={battleId ?? ""}/>
      <input type="hidden" name="bet_type" value={betTypeId}/>

      {/*
        Le sélecteur reste sur une à deux lignes quel que soit le nombre de types
        (seuls les noms courts sont affichés, la description est celle du type
        actif) et partage le fieldset du formulaire métier : les champs à remplir
        ne sont pas repoussés vers le bas quand le catalogue de paris s'allonge.
      */}
      <fieldset className={styles.fieldset}>
        <legend>Type de pari</legend>
        <div className={styles.betTypeTabs} role="radiogroup" aria-label="Type de pari">
          {BET_TYPES.map(betType => (
            <label
              key={betType.id}
              // Repris par le pseudo-élément qui réserve la largeur du libellé en gras.
              data-label={betType.name}
              className={`${styles.betTypeChip} ${betType.id === betTypeId ? styles.betTypeChipSelected : ""}`}
            >
              <input
                className={styles.srOnly}
                type="radio"
                name="bet_type_choice"
                value={betType.id}
                checked={betType.id === betTypeId}
                onChange={() => setBetTypeId(betType.id)}
              />
              {betType.name}
            </label>
          ))}
        </div>

        <p className={styles.betTypeDescription}>{selectedBetType.description}</p>

        {/*
          Le formulaire métier est remonté à chaque changement de type (`key`) :
          les champs de l'ancien type sont démontés, donc absents du FormData.
        */}
        <div className={styles.betTypeFields} key={betTypeId}>
          <BetTypeForm contenders={contenders} errors={state?.errors}/>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Mise</legend>
        <div className={styles.field}>
          <label htmlFor="amount">Montant</label>
          <input
            type="number"
            id="amount"
            name="amount"
            placeholder="500"
            min="1"
          />
          {state?.errors?.amount && (
            <p className={styles.errorLabel}>{state.errors.amount}</p>
          )}
        </div>
      </fieldset>

      <p>Un pari ne peut pas être annulé</p>

      <button type="submit" className={styles.submitButton} disabled={isPending}>
        {isPending ? "Envoi en cours…" : "Placer le pari"}
      </button>
    </form>
  );
}

export default function BetCreatePage() {
  return (
    <Suspense>
      <BetCreateForm/>
    </Suspense>
  );
}