"use client";

import { Battle } from "../../../models/Battle";
import { BattleStatus } from "../../../models/BattleStatus";
import { useEffect, useState } from "react";
import { getBattleStatus } from "@/app/api";
import { getBattleMode } from "@/lib/battleMode";
import { UserRound, UsersRound } from "lucide-react";
import styles from "./BattleCard.module.css";

type Props = {
    battle: Battle;
    onBet?: () => void;
};

export default function BattleCard({ battle, onBet }: Readonly<Props>) {
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

    const battleMode = getBattleMode(battle.contender_1_worker, battle.contender_2_worker);
    const modeLabel = battleMode === "miner" ? "Mineur vs Mineur" : "Pool vs Pool";

    return (
        <div className={styles.battlecard}>
            <div className={styles.header}>
                <div className={styles.badges}>
                    <span className={`${styles.badge} ${badgeClass}`}>
                        {badgeLabel}
                    </span>
                    <span className={styles.modeIcon} title={modeLabel} aria-label={modeLabel}>
                        {battleMode === "miner"
                            ? <UserRound aria-hidden="true" size={16} />
                            : <UsersRound aria-hidden="true" size={16} />}
                    </span>
                </div>
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
                {onBet && !battle.is_finished && (
                    <button
                        className={styles.betButton}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onBet();
                        }}
                    >
                        Parier
                    </button>
                )}
            </div>
        </div>
    );
}
