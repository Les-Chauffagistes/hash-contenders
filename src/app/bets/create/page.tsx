"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBattleStatus, getMe, refreshToken } from "../../api";
import { BattleStatus } from "../../../../models/BattleStatus";
import { createBetAction, FormState } from "../../../../lib/actions/createBet";
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
  const [selectedContenderIndex, setSelectedContenderIndex] = useState<number | null>(null);

  useEffect(() => {
    if (battleId) {
      getBattleStatus(Number(battleId)).then(setBattle);
    }
  }, [battleId]);

  const contender1 = battle?.contender_info?.[0]?.name ?? "Contender 1";
  const contender2 = battle?.contender_info?.[1]?.name ?? "Contender 2";

  return (
    <form action={action} className={styles.form}>
      <h1 className={styles.title}>Créer un pari</h1>

      {battle && (
        <p className={styles.battleContext}>
          {contender1} <span className={styles.vs}>vs</span> {contender2}
        </p>
      )}

      {state?.errors?._form && (
        <p className={styles.errorLabel}>{state.errors._form}</p>
      )}
      {state?.success && (
        <p className={styles.successLabel}>Pari placé avec succès !</p>
      )}

      <input type="hidden" name="battle_id" value={battleId ?? ""}/>
      <input type="hidden" name="bet_type" value="betOnWinner"/>

      <fieldset className={styles.fieldset}>
        <legend>Parier sur le gagnant</legend>
        <div className={styles.field}>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="winner_index" value="1" onChange={e => setSelectedContenderIndex(Number(e.target.value))}/>
              <span>{contender1}</span>
            </label>
            <label className={styles.radioLabel}>
              <input type="radio" name="winner_index" value="2" onChange={e => setSelectedContenderIndex(Number(e.target.value))}/>
              <span>{contender2}</span>
            </label>
          </div>
          {state?.errors?.winner_index && (
            <p className={styles.errorLabel}>{state.errors.winner_index}</p>
          )}
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
      {selectedContenderIndex &&
          <p>En plaçant votre pari sur {selectedContenderIndex === 1 ? contender1 : contender2}, vous renoncez à parier sur la victoire de {selectedContenderIndex === 1 ? contender2 : contender1}</p>}

      <button type="submit" className={styles.submitButton} disabled={isPending}>
        {isPending ? "Envoi en cours…" : "Placer le pari"}
      </button>
    </form>
  )
    ;
}

export default function BetCreatePage() {
  return (
    <Suspense>
      <BetCreateForm/>
    </Suspense>
  );
}
