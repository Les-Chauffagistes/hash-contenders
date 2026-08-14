import Link from "next/link";
import type {BattleSummary, UserBetItem} from "@/contracts/bets";
import formatNumber from "@/lib/NumberFormatter";
import {describePrediction, describeState, isAwaitingOutcome} from "../betPresentation";
import {getBetType} from "../betTypes";
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
    battleId,
}: Readonly<{bet: UserBetItem; battle: BattleSummary | null; battleId: string}>) {
    const prediction = describePrediction(bet, battle);
    const state = describeState(bet);
    // Seuls les types à ticket fixe (betOnBestShare) se modifient en resoumettant
    // le formulaire ; betOnWinner empile un nouveau pari à chaque soumission, et
    // rien ne se modifie une fois l'issue de la bataille connue.
    const isEditable = Boolean(getBetType(bet.type)?.fixedAmount) && isAwaitingOutcome(bet);

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
                {isEditable && (
                    <>
                        <span className={styles.separator}>·</span>
                        <Link href={`/bets/create?battle_id=${battleId}&bet_type=${bet.type}`} className={styles.editLink}>
                            Modifier
                        </Link>
                    </>
                )}
            </p>
        </article>
    );
}
