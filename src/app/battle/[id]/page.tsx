"use client";

import { usePathname } from "next/navigation";
import { BattleStatus } from "../../../../models/BattleStatus";
import { useEffect, useMemo, useState } from "react";
import { getBattleStatus } from "@/app/api";
import Player from "./components/Player";
import Log from "./components/Log";
import { WebSocketEvent } from "../../../../models/WebSocketEvents";
import styles from "./page.module.css"
import { Round } from "../../../../models/Hit";


export default function BatlePage() {
    const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);
    const path = usePathname();
    const battleId = path?.split("/")[2];

    useEffect(() => {
        getBattleStatus(battleId, true).then(data => setBattleStatus(data));
    }, [battleId]);

    // Produit 2 ws en mode dev. Normal. N'en produit qu'un en build
    useMemo(() => {
        const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WSS_URL}/api/v1/ws/${battleId}`);
        ws.onmessage = (e) => {
            const data: WebSocketEvent = JSON.parse(e.data);
            switch (data.type) {
                case "BEST_SHARE_UPDATE": {

                    if (data.user === "contender_1") {
                        setBattleStatus(old => {
                            if (!old) return old;
                            old.contender_info[0].current_round_best_diff = data.diff
                            return { ...old }
                        });
                    } else if (data.user === "contender_2") {
                        setBattleStatus(old => {
                            if (!old) return old;
                            old.contender_info[1].current_round_best_diff = data.diff
                            return { ...old }
                        });
                    }
                    break;
                }

                case "ROUND_UPDATE": {
                    setBattleStatus(old => {
                        if (!old) return old;
                        old.current_round = data.round
                        return { ...old }
                    })
                    break;
                }

                case "HIT_RESULT": {
                    const blockHeight = Number.parseInt(data.block_height, 16);

                    setBattleStatus(old => {
                        if (!old) return old;

                        const hitsMap = new Map<number, Round>();
                        old.hits.forEach(hit => hitsMap.set(hit.block_height, hit));

                        hitsMap.set(blockHeight, {
                            block_height: blockHeight,
                            contender_1_best_diff: data.contender_1_best_diff,
                            contender_2_best_diff: data.contender_2_best_diff,
                            date: new Date(data.date),
                            battle_id: old.battle_id,
                        });

                        const hitsArray = Array.from(hitsMap.values())
                            .sort((a, b) => b.block_height - a.block_height);

                        old.contender_info[0].pv = data.contender_1_pv
                        old.contender_info[1].pv = data.contender_2_pv

                        return { ...old, hits: hitsArray };
                    });

                    break;
                }
            }
        }
        return ws
    }, [battleId]);

    return (
        <main className={styles.page}>
            <div>
                <div style={{ display: "flex", flexDirection: "row", margin: 10, alignItems: "center" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "start" }} className={styles.contender_div}>
                        {battleStatus ? <Player
                            name={battleStatus.contender_info[0].name}
                            pv={battleStatus.contender_info[0].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[0].current_round_best_diff}
                            alignment="start"
                        /> : <Player name="Ça charge..." pv={0} pvMax={1} alignment="start" />}
                    </div>

                    <div>
                        <div style={{ display: "flex", backgroundColor: "var(--orange)", borderRadius: 25, padding: "10px 10px", alignItems: "end" }}>
                            <h1>{battleStatus?.current_round ?? 0}</h1>
                            <h2 style={{ marginBottom: 2 }}>/{battleStatus?.rounds ?? 0}</h2>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "end" }} className={styles.contender_div}>
                        {battleStatus ? <Player
                            name={battleStatus.contender_info[1].name}
                            pv={battleStatus.contender_info[1].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[1].current_round_best_diff}
                            alignment="end"
                        /> : <Player name="Ça charge..." pv={0} pvMax={1} alignment="end" />}
                    </div>
                </div>
                <div style={{ width: "100%" }}>
                    <Log hits={battleStatus?.hits ?? []} />
                </div>
            </div>
        </main>
    );
}