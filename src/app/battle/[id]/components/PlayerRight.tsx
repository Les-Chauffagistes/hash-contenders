import UnitConverter from "../../../../../lib/UnitConverter"
import Battery from "./Battery"

export type PlayerLeftProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
}

export default function PlayerRight({ name, pv, pvMax, alignment, bestDiff }: PlayerLeftProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: "end" }}>
            <h1 style={{ marginBottom: 40 }}>{name}</h1>
            <table>
                <tbody>
                    <tr>
                        <td><h2 style={{ marginRight: 50 }}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</h2></td>
                        <td><Battery percent={pv / pvMax} alignment={alignment} /></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>
                            <p style={{ textAlign: "center", marginTop: 20, width: "100%" }}>{Math.round((pv / pvMax) * 100)}%</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}