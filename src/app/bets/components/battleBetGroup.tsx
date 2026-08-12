import Link from "next/link";
import type {UserBattleBets} from "@/contracts/bets";
import formatNumber from "@/lib/NumberFormatter";
import {battleLabel} from "../betPresentation";
import BetCard from "./betCard";
import styles from "./battleBetGroup.module.css";

function betCountLabel(count: number): string {
    return count > 1 ? `${count} paris` : "1 pari";
}

export default function BattleBetGroup({battleBets}: Readonly<{battleBets: UserBattleBets}>) {
    const {battle, payout} = battleBets;

    return (
        <section className={styles.group}>
            <Link href={`/battle/${battleBets.battleId}`} className={styles.header}>
                <span className={styles.battle}>{battleLabel(battleBets)}</span>
                {battle && (
                    <span className={styles.battleState}>
                        {battle.is_finished ? "Terminée" : "En cours"}
                    </span>
                )}
                <span className={styles.summary}>
                    {betCountLabel(battleBets.bets.length)} · {formatNumber(battleBets.stake)} hashcoins misés
                    {/*
                      * Montant brut : le pot d'un type de pari inclut la mise des
                      * gagnants. « reçus » plutôt que « gagnés » pour ne pas le
                      * faire lire comme un gain net face aux mises affichées juste
                      * avant.
                      */}
                    {payout && payout.winnings > 0 && (
                        <span className={styles.winnings}> · {formatNumber(payout.winnings)} reçus</span>
                    )}
                    {payout && payout.refunds > 0 && (
                        <span> · {formatNumber(payout.refunds)} remboursés</span>
                    )}
                </span>
            </Link>
            <div className={styles.bets}>
                {battleBets.bets.map((bet) => <BetCard key={bet.id} bet={bet} battle={battle} />)}
            </div>
        </section>
    );
}
