"use client";

import { useState } from "react";
import { BetTypeFormProps } from "./types";
import styles from "../page.module.css";

export default function BetOnWinnerForm({ contenders, errors, defaultValues, disabled }: Readonly<BetTypeFormProps>) {
    const defaultIndex = defaultValues?.winner_index ? Number(defaultValues.winner_index) : null;
    const [selectedContenderIndex, setSelectedContenderIndex] = useState<number | null>(defaultIndex);

    return (
        <>
            <div className={styles.field}>
                <div className={styles.radioGroup}>
                    {contenders.map((contender, index) => (
                        <label key={contender} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="winner_index"
                                value={index + 1}
                                defaultChecked={index + 1 === defaultIndex}
                                disabled={disabled}
                                onChange={e => setSelectedContenderIndex(Number(e.target.value))}
                            />
                            <span>{contender}</span>
                        </label>
                    ))}
                </div>
                {errors?.winner_index && <p className={styles.errorLabel}>{errors.winner_index}</p>}
            </div>

            {selectedContenderIndex && (
                <p className={styles.hint}>
                    En plaçant votre pari sur {contenders[selectedContenderIndex - 1]}, vous renoncez à parier sur la
                    victoire de {contenders[selectedContenderIndex === 1 ? 1 : 0]}
                </p>
            )}
        </>
    );
}