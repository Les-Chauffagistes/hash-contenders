"use client";

import { Battle } from "../../../models/Battle";
import { BattleStatus } from "../../../models/BattleStatus";
import { useEffect, useState } from "react";
import { getBattleStatus } from "@/app/api";
import styles from "./BattleCard.module.css";

export default function BattleCard({ battle }: Readonly<{ battle: Battle }>) {
    const [status, setStatus] = useState<BattleStatus | null>(null);

    useEffect(() => {
        getBattleStatus(battle.id, true).then(setStatus);
    }, [battle.id]);

    const score1 = status?.hits?.filter(h => h.winner === 1).length ?? 0;
    const score2 = status?.hits?.filter(h => h.winner === 2).length ?? 0;

    const hasStarted = status !== null && status.current_round > 0;

    let badgeClass = styles.waiting;
    let badgeLabel = "En attente";
    if (battle.is_finished) {
        badgeClass = styles.finished;
        badgeLabel = "Terminée";
    } else if (hasStarted) {
        badgeClass = styles.live;
        badgeLabel = "En cours";
    }

    return (
        <div className={styles.battlecard}>
            <div className={styles.header}>
                <span className={`${styles.badge} ${badgeClass}`}>
                    {badgeLabel}
                </span>
                {hasStarted && (
                    <span className={styles.round}>
                        Round {status.current_round}/{battle.rounds}
                    </span>
                )}
            </div>

            <div className={styles.versus}>
                <span className={styles.name}>{battle.contender_1_name}</span>
                {hasStarted ? (
                    <span className={styles.score}>{score1} - {score2}</span>
                ) : (
                    <span className={styles.score}>VS</span>
                )}
                <span className={styles.name}>{battle.contender_2_name}</span>
            </div>

            <div className={styles.footer}>
                <span>Bloc {battle.start_height}</span>
                <span>{battle.rounds} rounds · {battle.contenders_pv} PV</span>
            </div>
        </div>
    );
}
