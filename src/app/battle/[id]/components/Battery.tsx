import styles from "./battery.module.css"

export default function Battery({ percent, alignment }: { percent: number, alignment: "start" | "end" }) {
    const pct = Math.round(Math.min(1, Math.max(0, percent)) * 100);
    const isStart = alignment === "start";

    return (
        <div className={styles.frame} style={{ justifyContent: isStart ? "flex-start" : "flex-end" }}>
            <div
                className={styles.fill}
                style={{
                    width: `${pct}%`,
                    background: isStart
                        ? "linear-gradient(90deg, var(--camp-a-deep), var(--camp-a) 55%, var(--camp-a-light))"
                        : "linear-gradient(90deg, var(--camp-b-light), var(--camp-b) 55%, var(--camp-b-deep))",
                }}
            />
        </div>
    )
}
