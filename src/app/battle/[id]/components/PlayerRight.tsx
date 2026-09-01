import UnitConverter from "../../../../lib/UnitConverter"
import Battery from "./Battery"
import styles from "./player.module.css"

export type PlayerLeftProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
}

export default function PlayerRight({ name, pv, pvMax, alignment, bestDiff }: PlayerLeftProps) {
    return (
        <div className={`${styles.player} ${styles.playerEnd}`}>
            <h1 className={styles.name}>{name}</h1>
            <table className={styles.table}>
                <tbody>
                    <tr>
                        <td><h2 className={styles.diffValueEnd}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</h2></td>
                        <td className={styles.diffCellEnd}><Battery percent={pv / pvMax} alignment={alignment} /></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>
                            <p className={styles.percent}>{Math.round((pv / pvMax) * 100)}%</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}