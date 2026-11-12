"use client";

import { Suspense, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBattleStatus, getMe, getUserBetsOverview, refreshToken } from "../../api";
import { BattleStatus } from "../../../../models/BattleStatus";
import { createBetAction, FormState } from "@/lib/actions/createBet";
import { BET_TYPES, BetTypeId, DEFAULT_BET_TYPE } from "../betTypes";
import { BET_TYPE_FORMS } from "./forms";
import type { UserBetItem, UserBetsOverview } from "@/contracts/bets";
import UnitConverter from "@/lib/UnitConverter";
import styles from "./page.module.css";

function isBetTypeId(value: string | null): value is BetTypeId {
  return BET_TYPES.some((betType) => betType.id === value);
}

/** Traduit le détail d'un pari existant en valeurs préremplissables par champ de formulaire. */
function toDefaultValues(bet: UserBetItem): Record<string, string> {
  switch (bet.type) {
    case "betOnBestShare":
      return { diff: UnitConverter.fromNumberToString(bet.details.diff) };
    case "betOnWinner":
      return { winner_index: String(bet.details.winnerIndex) };
  }
}

function BetCreateForm() {
  const searchParams = useSearchParams();
  const battleId = searchParams.get("battle_id");
  const requestedBetType = searchParams.get("bet_type");

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
  const [betTypeId, setBetTypeId] = useState<BetTypeId>(
    isBetTypeId(requestedBetType) ? requestedBetType : DEFAULT_BET_TYPE,
  );
  const [overview, setOverview] = useState<UserBetsOverview | null>(null);

  useEffect(() => {
    if (battleId) {
      getBattleStatus(Number(battleId)).then(setBattle);
    }
  }, [battleId]);

  // Permet de préremplir le formulaire avec le pari déjà en place du joueur
  // sur cette bataille, pour le modifier au lieu de repartir de zéro. Échec
  // silencieux : sans session valide, le formulaire reste utilisable tel
  // quel, `getMe()` gère déjà l'authentification à la soumission.
  useEffect(() => {
    getUserBetsOverview().then(setOverview).catch(() => setOverview(null));
  }, []);

  const contenders = [
    battle?.contender_info?.[0]?.name ?? "Contender 1",
    battle?.contender_info?.[1]?.name ?? "Contender 2",
  ];

  const selectedBetType = BET_TYPES.find(betType => betType.id === betTypeId)!;
  const BetTypeForm = BET_TYPE_FORMS[betTypeId];

  const existingBet = useMemo(() => {
    const battleBets = overview?.battles.find((entry) => entry.battleId === battleId);
    return battleBets?.bets.find((bet) => bet.type === betTypeId) ?? null;
  }, [overview, battleId, betTypeId]);
  const defaultValues = existingBet ? toDefaultValues(existingBet) : undefined;

  // "Modifier" n'a de sens que pour un type à ticket fixe (`fixedAmount`) :
  // seul betOnBestShare remplace son pari existant en resoumettant. Pour un
  // type sans ticket (betOnWinner), un pari existant s'affiche à titre
  // purement informatif — le formulaire est verrouillé, pas de faux espoir
  // de remplacement qui empilerait en réalité un nouveau pari.
  const isEditable = Boolean(selectedBetType.fixedAmount);
  const isLocked = existingBet !== null && !isEditable;

  function activateBetType(nextBetTypeId: BetTypeId) {
    setBetTypeId(nextBetTypeId);
    requestAnimationFrame(() => {
      document.getElementById(`bet-type-tab-${nextBetTypeId}`)?.focus();
    });
  }

  return (
    <form action={action} className={styles.form}>
      <h1 className={styles.title}>{existingBet && isEditable ? "Modifier mon pari" : "Créer un pari"}</h1>

      {battle && (
        <p className={styles.battleContext}>
          <span className={styles.contenderA}>{contenders[0]}</span>
          <span className={styles.vs}>vs</span>
          <span className={styles.contenderB}>{contenders[1]}</span>
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

      <fieldset className={styles.betTypeSection}>
        <legend className={styles.sectionTitle}>Type de pari</legend>
        <div className={styles.betTypeTabs} role="tablist" aria-label="Type de pari">
          {BET_TYPES.map(betType => (
            <button
              key={betType.id}
              type="button"
              id={`bet-type-tab-${betType.id}`}
              role="tab"
              aria-selected={betType.id === betTypeId}
              aria-controls={`bet-type-panel-${betType.id}`}
              tabIndex={betType.id === betTypeId ? 0 : -1}
              className={`${styles.betTypeTab} ${betType.id === betTypeId ? styles.betTypeTabSelected : ""}`}
              onClick={() => activateBetType(betType.id)}
              onKeyDown={(event) => {
                const currentIndex = BET_TYPES.findIndex(({ id }) => id === betType.id);
                const nextIndex = event.key === "ArrowRight"
                  ? (currentIndex + 1) % BET_TYPES.length
                  : event.key === "ArrowLeft"
                    ? (currentIndex - 1 + BET_TYPES.length) % BET_TYPES.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? BET_TYPES.length - 1
                        : undefined;

                if (nextIndex === undefined) return;

                event.preventDefault();
                activateBetType(BET_TYPES[nextIndex].id);
              }}
            >
              {betType.name}
            </button>
          ))}
        </div>

        <div
          // Inclut l'id du pari existant : force un remontage (et donc la
          // reprise du `defaultValue` des champs non contrôlés) une fois
          // qu'il est connu, même s'il arrive après le premier rendu.
          key={`${betTypeId}-${existingBet?.id ?? "new"}`}
          id={`bet-type-panel-${betTypeId}`}
          role="tabpanel"
          aria-labelledby={`bet-type-tab-${betTypeId}`}
          className={styles.betTypePanel}
        >
          <p className={styles.betTypeDescription}>{selectedBetType.description}</p>

          {existingBet && (
            <p className={styles.betNotice}>
              {isEditable
                ? "Vous avez déjà un pari sur cette bataille pour ce type : le modifier ci-dessous remplace votre prédiction actuelle."
                : "Vous avez déjà un pari sur cette bataille pour ce type, rappelé ci-dessous à titre indicatif : il ne peut pas être modifié depuis ce formulaire."}
            </p>
          )}

          <div className={styles.betTypeFields}>
            <BetTypeForm contenders={contenders} errors={state?.errors} defaultValues={defaultValues} disabled={isLocked}/>
          </div>

          <fieldset className={styles.stakeFieldset}>
            <legend>Mise</legend>
            <div className={styles.field}>
              {selectedBetType.fixedAmount ? (
                <>
                  <label htmlFor="amount">Prix du ticket</label>
                  <p>{selectedBetType.fixedAmount} hashcoins (fixe)</p>
                  <input type="hidden" id="amount" name="amount" value={selectedBetType.fixedAmount} />
                </>
              ) : (
                <>
                  <label htmlFor="amount">Montant</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    placeholder="500"
                    min="1"
                    defaultValue={existingBet?.amount}
                    disabled={isLocked}
                  />
                </>
              )}
              {state?.errors?.amount && (
                <p className={styles.errorLabel}>{state.errors.amount}</p>
              )}
            </div>
          </fieldset>

          <p className={styles.betNotice}>
            {selectedBetType.fixedAmount
              ? "Un pari ne peut pas être annulé, mais peut être modifié gratuitement et sans limite tant que la bataille n'a pas démarré (resoumettez ce formulaire avec une nouvelle valeur)."
              : "Un pari ne peut pas être annulé"}
          </p>
        </div>
      </fieldset>

      <button type="submit" className={styles.submitButton} disabled={isPending || isLocked}>
        {isPending
          ? "Envoi en cours…"
          : isLocked
            ? "Pari déjà placé"
            : existingBet
              ? "Modifier mon pari"
              : "Placer le pari"}
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