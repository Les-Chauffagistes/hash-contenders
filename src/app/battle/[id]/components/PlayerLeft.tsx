import UnitConverter from "../../../../lib/UnitConverter"
import Battery from "./Battery"
import styles from "./player.module.css"

export type PlayerLeftProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
    worker?: string | null
}

export default function PlayerLeft({ name, pv, pvMax, alignment, bestDiff, worker }: PlayerLeftProps) {
    return (
        <div className={styles.player}>
            <h1 className={styles.name}>{name}</h1>
            {worker && <p className={styles.workerTag}>⛏ {worker}</p>}
            <table className={styles.table}>
                <tbody>
                    <tr>
                        <td className={styles.diffCellStart}><Battery percent={pv / pvMax} alignment={alignment} /></td>
                        <td><h2 className={styles.diffValue}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</h2></td>
                    </tr>
                    <tr>
                        <td>
                            <p className={styles.percent}>{Math.round((pv/pvMax) * 100)}%</p>
                        </td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}