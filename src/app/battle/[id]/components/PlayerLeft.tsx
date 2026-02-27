import UnitConverter from "../../../../../lib/UnitConverter"
import Battery from "./Battery"

export type PlayerLeftProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
}

export default function PlayerLeft({ name, pv, pvMax, alignment, bestDiff }: PlayerLeftProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <h1 style={{marginBottom: 40}}>{name}</h1>
            <table>
                <tbody>
                    <tr>
                        <td style={{ width: 1 }}><Battery percent={pv / pvMax} alignment={alignment} /></td>
                        <td><h2 style={{marginLeft: 50}}>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</h2></td>
                    </tr>
                    <tr>
                        <td>
                            <p style={{ textAlign: "center", marginTop: 20, width: "100%" }}>{Math.round((pv/pvMax) * 100)}%</p>
                        </td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}