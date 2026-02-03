import UnitConverter from "../../../../../lib/UnitConverter"
import Battery from "./Battery"

export type PlayerLeftProps = {
    name: string
    pv: number
    pvMax: number
    alignment: "start" | "end"
    bestDiff?: number
}

export default function Player({ name, pv, pvMax, alignment, bestDiff }: PlayerLeftProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: alignment, width: "100%" }}>
            <h1>{name}</h1>
            <div style={{display: "flex", flexDirection: alignment === "start" ? "row" : "row-reverse", width: "100%", }}>
                <Battery percent={pv / pvMax} alignment={alignment} />
                <h2>{UnitConverter.fromNumberToString(bestDiff ?? 0)}</h2>
            </div>
        </div>
    )
}