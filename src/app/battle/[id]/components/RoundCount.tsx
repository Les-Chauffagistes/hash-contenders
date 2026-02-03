import { BattleStatus } from "../../../../../models/BattleStatus";


export default function RoundCount({battleStatus}: {battleStatus: BattleStatus | null}) {
    return (
        <div style={{ display: "flex", alignItems: "flex-end", backgroundColor: "var(--card-background-color)", borderRadius: 10, padding: "5px 10px" }}>
            <h1>{battleStatus?.hits ? battleStatus.hits.length : 0}</h1>
            <p style={{ marginBottom: 5, marginLeft: 3 }}>/{battleStatus?.rounds ?? 0}</p>
        </div>
    )
}