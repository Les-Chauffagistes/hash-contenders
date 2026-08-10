"use client";

import { useState } from "react";
import { BetTypeFormProps } from "./types";
import styles from "../page.module.css";

export default function BetOnWinnerForm({ contenders, errors }: Readonly<BetTypeFormProps>) {
    const [selectedContenderIndex, setSelectedContenderIndex] = useState<number | null>(null);

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