import { HandFist } from "lucide-react";
import { Round } from "../../../../../models/Hit";
import styles from "./logitem.module.css"
import UnitConverter from "../../../../../lib/UnitConverter";


export default function LogItem({ hit }: { hit: Round }) {
    if (!hit) return null;
    return (
        <div
            className={styles.logitem + " " + styles.item}
            style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
                padding: "5px 15px",
                alignItems: "center",
            }}>
            <h3>{UnitConverter.fromNumberToString(hit.contender_1_best_diff)}</h3>
            {hit.contender_1_best_diff > hit.contender_2_best_diff ? <HandFist color="orange"/> : <HandFist opacity={0}/>}
            <p>{hit.block_height}</p>
            {hit.contender_1_best_diff < hit.contender_2_best_diff ? <HandFist color="orange"/> : <HandFist opacity={0}/>}
            <h3>{UnitConverter.fromNumberToString(hit.contender_2_best_diff)}</h3>
        </div>
    )
}