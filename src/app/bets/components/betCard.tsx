import type {UserBetListItem} from "@/contracts/bets";
import {BetNames} from "@/contracts/bets";
import styles from "./betCard.module.css";


export default function BetCard({ bet }: Readonly<{ bet: UserBetListItem }>) {
    const battleLabel = bet.battle
        ? `${bet.battle.contender_1_name} vs ${bet.battle.contender_2_name}`
        : `Bataille #${bet.battleId}`;

    let badgeClass = "";

    if (bet.status === "pending") badgeClass = styles.pending;
    if (bet.status === "confirmed") badgeClass = styles.confirmed;
    if (bet.status === "void") badgeClass = styles.void;

    return (
        <div className={styles.betcard}>
          <div className={styles.badgeContainer}>
            <span className={`${styles.badge} ${badgeClass}`}>{bet.status}</span>
          </div>
            <h3>{battleLabel}</h3>
            <p>{BetNames[bet.type]}</p>
            <p>{bet.amount} hashcoins</p>
        </div>
    )
}
