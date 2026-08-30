import type {BattleBetItem, BattleSummary} from "@/contracts/bets";
import formatNumber from "@/lib/NumberFormatter";
import {describePrediction, describeResult} from "../betPresentation";
import {getBetType} from "../betTypes";
import {playerLabel} from "../publicBetPresentation";
import styles from "./betCard.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

export default function BattleBetCard({
    bet,
    battle,
}: Readonly<{bet: BattleBetItem; battle: BattleSummary | null}>) {
    const prediction = describePrediction(bet, battle);
    const state = describeResult(bet.result);

    return (
        <article className={styles.betcard}>
            <div className={styles.prediction}>
                <span className={styles.predictionLabel}>
                    {playerLabel(bet)} · {prediction.label}
                </span>
                <span className={styles.predictionValue}>{prediction.value}</span>
            </div>
            <span className={`${styles.badge} ${styles[state.tone]}`}>{state.label}</span>
            <p className={styles.meta}>
                <span className={styles.amount}>{formatNumber(bet.amount)} hashcoins</span>
                <span className={styles.separator}>·</span>
                <span>{getBetType(bet.type)?.name}</span>
                <span className={styles.separator}>·</span>
                <time dateTime={bet.createdAt}>{dateFormatter.format(new Date(bet.createdAt))}</time>
            </p>
        </article>
    );
}
