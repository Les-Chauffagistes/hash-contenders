"use client";

import { usePathname, useRouter } from "next/navigation";
import { BattleStatus } from "../../../../models/BattleStatus";
import { useEffect, useMemo, useState } from "react";
import { getBattleStatus, getMe } from "@/app/api";
import PlayerLeft from "./components/PlayerLeft";
import PlayerRight from "./components/PlayerRight";
import Log from "./components/Log";
import { WebSocketEvent } from "../../../../models/WebSocketEvents";
import styles from "./page.module.css"
import { Round } from "../../../../models/Hit";
import { EllipsisVertical, HandFist, Trash2 } from "lucide-react";
import {config} from "@/lib/config";
import { components } from "@les-chauffagistes/authentication-types";
import { deleteBattleAction } from "@/lib/actions/deleteBattle";


export default function BatlePage() {
    const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);
    const [user, setUser] = useState<components["schemas"]["User"] | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const path = usePathname();
    const router = useRouter();
    const battleId = path?.split("/")[2];

    useEffect(() => {
        getBattleStatus(battleId, true).then(data => setBattleStatus(data));

        getMe()
            .then(setUser)
            .catch(error => console.error("Impossible de charger l'utilisateur connecté", error));
    }, [battleId]);

    const isOwner = battleStatus !== null
        && user !== null
        && battleStatus.owner_user_id === Number(user.user_id);

    async function handleDeleteBattle() {
        const parsedBattleId = Number(battleId);
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const result = await deleteBattleAction(parsedBattleId);
            if (!result.success) {
                setDeleteError(result.error);
                return;
            }
            setIsDeleteDialogOpen(false);
            router.replace("/");
        } catch (error) {
            console.error("Impossible de supprimer la bataille", error);
            setDeleteError("Impossible de supprimer cette bataille.");
        } finally {
            setIsDeleting(false);
        }
    }

    // Produit 2 ws en mode dev. Normal. N'en produit qu'un en build
    useMemo(() => {
        const ws = new WebSocket(`${config.WSS_URL}/v1/ws/${battleId}`);
        ws.onmessage = (e) => {
            const data: WebSocketEvent = JSON.parse(e.data);
            switch (data.type) {
                case "BEST_SHARE_UPDATE": {
                    const blockHeight = Number.parseInt(data.block_height, 16);
                    const contenderIndex = data.user === "contender_1" ? 0 : 1;
                    const diffKey = data.user === "contender_1" ? "contender_1_best_diff" : "contender_2_best_diff";
                    setBattleStatus(old => {
                        if (!old) return old;
                        const updatedHits = old.hits.map(hit =>
                            hit.block_height === blockHeight ? {...hit, [diffKey]: data.diff} : hit
                        );
                        const isCurrentRound = old.hits.find(hit => hit.block_height === blockHeight)?.winner === null;
                        const updatedContenderInfo = isCurrentRound
                            ? old.contender_info.map((c, i) =>
                                i === contenderIndex ? {...c, current_round_best_diff: data.diff} : c
                            )
                            : old.contender_info;
                        return {...old, contender_info: updatedContenderInfo, hits: updatedHits};
                    });
                    break;
                }

                case "ROUND_UPDATE": {
                    const blockHeight = Number.parseInt(data.block_height, 16);
                    setBattleStatus(old => {
                        if (!old) return old;

                        const hitsMap = new Map<number, Round>();
                        old.hits.forEach(hit => hitsMap.set(hit.block_height, hit));

                        if (!hitsMap.has(blockHeight)) {
                            hitsMap.set(blockHeight, {
                                block_height: blockHeight,
                                contender_1_best_diff: 0,
                                contender_2_best_diff: 0,
                                date: new Date(),
                                battle_id: old.battle_id,
                                winner: null
                            });
                        }

                        const hitsArray = Array.from(hitsMap.values())
                            .sort((a, b) => b.block_height - a.block_height);

                        return { ...old, current_round: data.round, hits: hitsArray };
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
                            winner: data.winner
                        });

                        const hitsArray = Array.from(hitsMap.values())
                            .sort((a, b) => b.block_height - a.block_height);

                        old.contender_info[0].pv = data.contender_1_pv
                        old.contender_info[1].pv = data.contender_2_pv

                        return {...old, hits: hitsArray};
                    });

                    break;
                }
                case "BATTLE_END": {
                    console.debug("C fini au revoir");
                    break;
                }
            }
        }
        return ws
    }, [battleId]);

    const logContent = battleStatus?.hits?.length ? (
        <div style={{ overflow: "scroll", flex: 1 }}>
            <Log hits={battleStatus.hits} />
        </div>
    ) : (
        <div style={{
            color: "var(--text-muted)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            flexDirection: "column",
            gap: 10,
            paddingBottom: 20
        }}>
            <p>Aucun coup n&apos;a encore été porté. L&apos;historique des rounds s&apos;affichera ici.</p>
            <HandFist />
        </div>
    );

    return (
        <main className={styles.page}>
            <div className={styles.battleHeader}>
                <span className={styles.battleLabel}>Bataille #{battleId}</span>

                {isOwner && (
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.menuButton}
                            aria-label="Actions de la bataille"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            onClick={() => setIsMenuOpen(open => !open)}
                        >
                            <EllipsisVertical aria-hidden="true" size={20} />
                        </button>

                        {isMenuOpen && (
                            <>
                                <button
                                    type="button"
                                    className={styles.menuDismiss}
                                    aria-label="Fermer le menu"
                                    onClick={() => setIsMenuOpen(false)}
                                />
                                <div className={styles.actionMenu} role="menu">
                                    <button
                                        type="button"
                                        className={styles.deleteMenuItem}
                                        role="menuitem"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setDeleteError(null);
                                            setIsDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 aria-hidden="true" size={17} />
                                        Supprimer la bataille
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.battleContent}>
                <div style={{ display: "flex", flexDirection: "row", margin: 10, alignItems: "center" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "start" }} className={styles.contender_div}>
                        {battleStatus ? <PlayerLeft
                            name={battleStatus.contender_info[0].name}
                            pv={battleStatus.contender_info[0].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[0].current_round_best_diff}
                            alignment="start"
                        /> : <PlayerLeft name="Ça charge..." pv={0} pvMax={1} alignment="start" />}
                    </div>

                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ padding: 20, borderRadius: 55, backgroundColor: "#ff88002c", margin: -50 }}>
                            <div style={{ padding: 15, borderRadius: 40, backgroundColor: "#ff88006a" }}>
                                <div style={{
                                    display: "flex",
                                    backgroundColor: "var(--accent)",
                                    borderRadius: 25,
                                    padding: "10px 10px",
                                    alignItems: "end"
                                }}>
                                    <h1>{battleStatus?.current_round ?? 0}</h1>
                                    <h2 style={{ marginBottom: 2 }}>/{battleStatus?.rounds ?? 0}</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "end" }}
                         className={styles.contender_div}>
                        {battleStatus ? <PlayerRight
                            name={battleStatus.contender_info[1].name}
                            pv={battleStatus.contender_info[1].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[1].current_round_best_diff}
                            alignment="end"
                        /> : <PlayerRight name="Ça charge..." pv={0} pvMax={1} alignment="end" />}
                    </div>
                </div>
                <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    backgroundColor: "var(--bg-alt)",
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingTop: 20,
                    margin: "0 10px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 30px 30px" }}>
                        <p>{battleStatus?.hits ? battleStatus?.hits?.filter(hit => hit.winner === 1).length : "-"}</p>
                        <p>Historique</p>
                        <p>{battleStatus?.hits ? battleStatus?.hits?.filter(hit => hit.winner === 2).length : "-"}</p>
                    </div>
                    {logContent}
                </div>
            </div>

            {isDeleteDialogOpen && (
                <div
                    className={styles.dialogBackdrop}
                    onMouseDown={event => {
                        if (event.target === event.currentTarget && !isDeleting) {
                            setIsDeleteDialogOpen(false);
                        }
                    }}
                >
                    <div
                        className={styles.dialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-battle-title"
                    >
                        <div className={styles.dialogIcon}>
                            <Trash2 aria-hidden="true" size={22} />
                        </div>
                        <h2 id="delete-battle-title">Supprimer définitivement cette bataille ?</h2>
                        <p>
                            {battleStatus
                                ? `${battleStatus.contender_info[0].name} contre ${battleStatus.contender_info[1].name} sera supprimée.`
                                : `La bataille #${battleId} sera supprimée.`}
                            {" "}Cette action est irréversible.
                        </p>

                        {deleteError && (
                            <p className={styles.deleteError} role="alert">{deleteError}</p>
                        )}

                        <div className={styles.dialogActions}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                disabled={isDeleting}
                                autoFocus
                                onClick={() => setIsDeleteDialogOpen(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className={styles.confirmDeleteButton}
                                disabled={isDeleting}
                                onClick={handleDeleteBattle}
                            >
                                {isDeleting ? "Suppression..." : "Supprimer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}