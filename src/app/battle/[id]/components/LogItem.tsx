import { HandFist } from "lucide-react";
import { Round } from "../../../../../models/Hit";
import styles from "./logitem.module.css"
import UnitConverter from "../../../../../lib/UnitConverter";


export default function LogItem({ hit }: { hit: Round }) {
    if (!hit) return null;

    const c1Wins = hit.winner === 1;
    const c2Wins = hit.winner === 2;

    const total = hit.contender_1_best_diff + hit.contender_2_best_diff;
    const c1Pct = total > 0 ? (hit.contender_1_best_diff / total) * 100 : 50;
    const c2Pct = 100 - c1Pct;

    return (
        <div className={styles.logItem}>
            <div className={styles.labels}>
                <span className={`${styles.diff} ${styles.diffLeft} ${c1Wins ? styles.diffWinner : ""}`}>
                    {c1Wins && <HandFist size={14} />}
                    {UnitConverter.fromNumberToString(hit.contender_1_best_diff)}
                </span>

                <span className={styles.blockHeight}>
                    #{hit.block_height}
                </span>

                <span className={`${styles.diff} ${styles.diffRight} ${c2Wins ? styles.diffWinner : ""}`}>
                    {c2Wins && <HandFist size={14} />}
                    {UnitConverter.fromNumberToString(hit.contender_2_best_diff)}
                </span>
            </div>

            <div className={styles.bar}>
                <div
                    className={`${styles.barLeft} ${c1Wins ? styles.barLeftWinner : styles.barLeftLoser}`}
                    style={{ width: `${c1Pct}%` }}
                />
                <div
                    className={`${styles.barRight} ${c2Wins ? styles.barRightWinner : styles.barRightLoser}`}
                    style={{ width: `${c2Pct}%` }}
                />
            </div>
        </div>
    )
}
