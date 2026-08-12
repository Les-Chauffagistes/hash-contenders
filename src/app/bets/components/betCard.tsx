import type {BattleSummary, UserBetItem} from "@/contracts/bets";
import formatNumber from "@/lib/NumberFormatter";
import {describePrediction, describeState} from "../betPresentation";
import styles from "./betCard.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

/**
 * La bataille est portée par le groupe qui contient la carte : il ne reste ici
 * que ce qui distingue un pari d'un autre au sein d'une même bataille — sa
 * prédiction, son état, sa mise. Elle redescend en prop parce que la prédiction
 * d'un `betOnWinner` s'énonce avec le nom du contender.
 */
export default function BetCard({
    bet,
    battle,
}: Readonly<{bet: UserBetItem; battle: BattleSummary | null}>) {
    const prediction = describePrediction(bet, battle);
    const state = describeState(bet);

    return (
        <article className={styles.betcard}>
            <div className={styles.prediction}>
                <span className={styles.predictionLabel}>{prediction.label}</span>
                <span className={styles.predictionValue}>{prediction.value}</span>
            </div>
            <span className={`${styles.badge} ${styles[state.tone]}`}>{state.label}</span>
            <p className={styles.meta}>
                <span className={styles.amount}>{formatNumber(bet.amount)} hashcoins</span>
                <span className={styles.separator}>·</span>
                <time dateTime={bet.createdAt}>{dateFormatter.format(new Date(bet.createdAt))}</time>
            </p>
        </article>
    );
}
