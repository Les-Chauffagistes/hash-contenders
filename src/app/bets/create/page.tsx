"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBattleStatus } from "../../api";
import { BattleStatus } from "../../../../models/BattleStatus";
import { createBetAction } from "../../../../lib/actions/createBet";
import styles from "./page.module.css";

function BetCreateForm() {
    const searchParams = useSearchParams();
    const battleId = searchParams.get("battle_id");

    const [state, action] = useActionState(createBetAction, {});
    const [battle, setBattle] = useState<BattleStatus | null>(null);

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

            <input type="hidden" name="battle_id" value={battleId ?? ""} />
            <input type="hidden" name="bet_type" value="betOnWinner" />

            <fieldset className={styles.fieldset}>
                <legend>Parier sur le gagnant</legend>
                <div className={styles.field}>
                    <div className={styles.radioGroup}>
                        <label className={styles.radioLabel}>
                            <input type="radio" name="winner_index" value="1" />
                            <span>{contender1}</span>
                        </label>
                        <label className={styles.radioLabel}>
                            <input type="radio" name="winner_index" value="2" />
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

            <button type="submit" className={styles.submitButton}>Placer le pari</button>
        </form>
    );
}

export default function BetCreatePage() {
    return (
        <Suspense>
            <BetCreateForm />
        </Suspense>
    );
}
