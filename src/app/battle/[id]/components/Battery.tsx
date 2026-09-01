import styles from "./battery.module.css"

export default function Battery({ percent, alignment }: { percent: number, alignment: "start" | "end" }) {
    return (
        <div className={styles.battery} style={{ alignContent: alignment }}>
            <div className={styles.body}>
                <div className={styles.bars}>
                    <div className={styles.bar} style={{ opacity: Math.min(1, Math.max(0, (percent) / 0.2)) }}></div>
                    <div className={styles.bar} style={{ opacity: Math.min(1, Math.max(0, (percent - 0.2) / 0.2)) }}></div>
                    <div className={styles.bar} style={{ opacity: Math.min(1, Math.max(0, (percent - 0.4) / 0.2)) }}></div>
                    <div className={styles.bar} style={{ opacity: Math.min(1, Math.max(0, (percent - 0.6) / 0.2)) }}></div>
                    <div className={styles.bar} style={{ opacity: Math.min(1, Math.max(0, (percent - 0.8) / 0.2)) }}></div>
                </div>
            </div>
            <div className={styles.cap}></div>
        </div>
    )
}