import { Pickaxe } from "lucide-react"
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
    hashrateString?: string
}

export default function PlayerLeft({ name, pv, pvMax, alignment, bestDiff, worker, hashrateString }: Readonly<PlayerLeftProps>) {
    return (
        <div className={styles.player}>
            <div className={styles.headerRow}>
                <div className={`${styles.avatar} ${styles.avatarA}`}>{name.charAt(0).toUpperCase()}</div>
                <div className={styles.identity}>
                    <h1 className={`${styles.name} ${styles.nameA}`}>{name}</h1>
                    <p className={styles.workerTag}>
                        <Pickaxe aria-hidden="true" size={11} />
                        {worker ?? "pool entière"}
                    </p>
                </div>
            </div>

            <div className={styles.gaugeBlock}>
                <div className={styles.gaugeLabels}>
                    <span>PV</span>
                    <span>{pv} / {pvMax}</span>
                </div>
                <Battery percent={pv / pvMax} alignment={alignment} />
            </div>

            <div className={styles.statBox}>
                <span className={styles.statLabel}>Meilleur coup — round</span>
                <span className={`${styles.statValue} ${styles.statValueA}`}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</span>
            </div>
            <div className={styles.statBox}>
                <span className={styles.statLabel}>Hashrate</span>
                <span className={`${styles.statValue} ${styles.statValueA}`}>{hashrateString}</span>
            </div>
        </div>
    )
}
