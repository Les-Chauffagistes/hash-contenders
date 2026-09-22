import { Pickaxe } from "lucide-react"
import UnitConverter from "../../../../lib/UnitConverter"
import Battery from "./Battery"
import styles from "./player.module.css"

export type PlayerRightProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
    worker?: string | null
}

export default function PlayerRight({ name, pv, pvMax, alignment, bestDiff, worker }: PlayerRightProps) {
    return (
        <div className={`${styles.player} ${styles.playerEnd}`}>
            <div className={`${styles.headerRow} ${styles.headerRowEnd}`}>
                <div className={`${styles.avatar} ${styles.avatarB}`}>{name.charAt(0).toUpperCase()}</div>
                <div className={`${styles.identity} ${styles.identityEnd}`}>
                    <h1 className={`${styles.name} ${styles.nameB}`}>{name}</h1>
                    <p className={styles.workerTag}>
                        <Pickaxe aria-hidden="true" size={11} />
                        {worker ?? "pool entière"}
                    </p>
                </div>
            </div>

            <div className={styles.gaugeBlock}>
                <div className={styles.gaugeLabels}>
                    <span>{pv} / {pvMax}</span>
                    <span>PV</span>
                </div>
                <Battery percent={pv / pvMax} alignment={alignment} />
            </div>

            <div className={`${styles.statBox} ${styles.statBoxEnd}`}>
                <span className={styles.statLabel}>Meilleur coup — round</span>
                <span className={`${styles.statValue} ${styles.statValueB}`}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</span>
            </div>
        </div>
    )
}
