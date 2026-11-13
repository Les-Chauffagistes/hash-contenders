"use client";

import { usePathname, useRouter } from "next/navigation";
import { BattleStatus } from "../../../../models/BattleStatus";
import { useEffect, useRef, useState } from "react";
import { getBattleStatus, getMe } from "@/app/api";
import PlayerLeft from "./components/PlayerLeft";
import PlayerRight from "./components/PlayerRight";
import Log from "./components/Log";
import { ShareEvent, WebSocketEvent } from "../../../../models/WebSocketEvents";
import UnitConverter from "@/lib/UnitConverter";
import styles from "./page.module.css"
import { Round } from "../../../../models/Hit";
import { Coins, EllipsisVertical, HandFist, ListFilter, Trash2, UserRound, UsersRound } from "lucide-react";
import {config} from "@/lib/config";
import { User } from "../../../../models/User";
import { deleteBattleAction } from "@/lib/actions/deleteBattle";
import { getBattleMode } from "@/lib/battleMode";
import { nextReconnectDelayMs } from "@/lib/backoff";


export default function BatlePage() {
    const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [shares, setShares] = useState<ShareEvent[]>([]);
    const [connection, setConnection] = useState(false);
    const [leadFlash, setLeadFlash] = useState<0 | 1 | 2>(0);
    const shareQueue = useRef<ShareEvent[]>([]);
    const seenShares = useRef(new Set<string>());
    const previousLead = useRef(0);
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
    const canBet = battleStatus !== null && !battleStatus.is_finished;
    const battleMode = getBattleMode(
        battleStatus?.contender_info[0]?.worker,
        battleStatus?.contender_info[1]?.worker,
    );
    const battleModeLabel = battleMode === "miner" ? "Mineur vs Mineur" : "Pool vs Pool";

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

    useEffect(() => {
        if (!battleId) return;
        let ws: WebSocket;
        let stopped = false;
        let reconnectAttempts = 0;
        let lastPong = Date.now();
        let reconnect: ReturnType<typeof setTimeout>;
        const connect = () => {
        ws = new WebSocket(`${config.WSS_URL}/v1/ws/${battleId}`);
        ws.onopen = () => { reconnectAttempts = 0; lastPong = Date.now(); setConnection(true); getBattleStatus(battleId, true).then(setBattleStatus).catch(console.error); };
        ws.onclose = () => { setConnection(false); if (!stopped) reconnect = setTimeout(connect, nextReconnectDelayMs(reconnectAttempts++)); };
        ws.onmessage = (e) => {
            if (e.data === "pong") { lastPong = Date.now(); return; }
            const data: WebSocketEvent = JSON.parse(e.data);
            switch (data.type) {
                case "SHARE": {
                    const key = `${data.user}:${data.share_id}`;
                    if (!seenShares.current.has(key)) {
                        seenShares.current.add(key);
                        if (seenShares.current.size > 5000) seenShares.current.delete(seenShares.current.values().next().value!);
                        shareQueue.current.push(data);
                    }
                    break;
                }
                case "BEST_SHARE_UPDATE": {
                    const blockHeight = Number(data.block_height);
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
                    const blockHeight = Number(data.block_height);
                    setBattleStatus(old => {
                        if (!old) return old;

                        const hitsMap = new Map<number, Round>();
                        old.hits.forEach(hit => hitsMap.set(hit.block_height, hit));

                        if (!hitsMap.has(blockHeight)) {
                            hitsMap.set(blockHeight, {
                                block_height: blockHeight,
                                contender_1_best_diff: 0,
                                contender_2_best_diff: 0,
                                finalized_at: null,
                                battle_id: old.battle_id,
                                winner: null
                            });
                        }

                        const hitsArray = Array.from(hitsMap.values())
                            .sort((a, b) => b.block_height - a.block_height);

                        return { ...old, current_round: data.round, hits: hitsArray, contender_info: old.contender_info.map(c => ({...c, current_round_best_diff: 0})) };
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
                            finalized_at: new Date(data.date),
                            battle_id: old.battle_id,
                            winner: data.winner
                        });

                        const hitsArray = Array.from(hitsMap.values())
                            .sort((a, b) => b.block_height - a.block_height);

                        return {...old, hits: hitsArray, contender_info: old.contender_info.map((c, i) => ({...c, pv: i === 0 ? data.contender_1_pv : data.contender_2_pv}))};
                    });

                    break;
                }
                case "BATTLE_END": {
                    setBattleStatus(old => old ? {...old, is_finished: true, contender_info: old.contender_info.map((c, i) => ({...c, pv: i === 0 ? data.contender_1_pv : data.contender_2_pv}))} : old);
                    break;
                }
            }
        }
        };
        connect();
        const heartbeat = setInterval(() => {
            if (ws?.readyState !== WebSocket.OPEN) return;
            if (Date.now() - lastPong > 60000) { ws.close(); return; }
            ws.send("ping");
        }, 15000);
        const drain = setInterval(() => {
            const count = Math.max(1, Math.ceil(shareQueue.current.length / 20));
            const batch = shareQueue.current.splice(0, count);
            if (batch.length) setShares(old => [...batch.reverse(), ...old].slice(0, 16));
        }, 120);
        const poll = setInterval(() => {
            getBattleStatus(battleId, false).then(fresh => setBattleStatus(old => old && fresh ? {...old, contender_info: old.contender_info.map((c, i) => ({...c, hashrate: fresh.contender_info[i]?.hashrate}))} : old)).catch(console.error);
        }, 15000);
        return () => { stopped = true; clearTimeout(reconnect); clearInterval(heartbeat); clearInterval(drain); clearInterval(poll); ws?.close(); shareQueue.current = []; seenShares.current.clear(); };
    }, [battleId]);

    const diff1 = battleStatus?.contender_info[0]?.current_round_best_diff ?? 0;
    const diff2 = battleStatus?.contender_info[1]?.current_round_best_diff ?? 0;
    const leader = diff1 === diff2 ? 0 : diff1 > diff2 ? 1 : 2;
    useEffect(() => {
        if (leader && previousLead.current && leader !== previousLead.current) {
            setLeadFlash(leader);
            const timeout = setTimeout(() => setLeadFlash(0), 1400);
            previousLead.current = leader;
            return () => clearTimeout(timeout);
        }
        previousLead.current = leader;
    }, [leader]);

    const logContent = battleStatus?.hits?.length ? (
        <div className={styles.logScroll}>
            <Log hits={battleStatus.hits} />
        </div>
    ) : (
        <div className={styles.logEmpty}>
            <p>Aucun coup n&apos;a encore été porté. L&apos;historique des rounds s&apos;affichera ici.</p>
            <HandFist />
        </div>
    );

    return (
        <main className={styles.page}>
            <div className={styles.battleHeader}>
                <div className={styles.battleLabelGroup}>
                    <span className={styles.battleLabel}>Bataille #{battleId}</span>
                    <span className={styles.modeIcon} title={battleModeLabel} aria-label={battleModeLabel}>
                        {battleMode === "miner"
                            ? <UserRound aria-hidden="true" size={16} />
                            : <UsersRound aria-hidden="true" size={16} />}
                    </span>
                </div>

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
                                    className={`${styles.menuItem} ${styles.betsMenuItem}`}
                                    role="menuitem"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push(`/battle/${battleId}/bets`);
                                    }}
                                >
                                    <ListFilter aria-hidden="true" size={17} />
                                    Voir les paris
                                </button>
                                {canBet && (
                                    <button
                                        type="button"
                                        className={`${styles.menuItem} ${styles.betMenuItem}`}
                                        role="menuitem"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            router.push(`/bets/create?battle_id=${battleId}`);
                                        }}
                                    >
                                        <Coins aria-hidden="true" size={17} />
                                        Parier
                                    </button>
                                )}
                                {isOwner && (
                                    <button
                                        type="button"
                                        className={`${styles.menuItem} ${styles.deleteMenuItem}`}
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
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.battleContent}>
                <div className={styles.versusRow}>
                    <div className={`${styles.contender_div} ${styles.contenderStart} ${leader === 1 ? styles.leading : ""} ${leadFlash === 1 ? styles.leadFlash : ""}`}>
                        {battleStatus ? <PlayerLeft
                            name={battleStatus.contender_info[0].name}
                            pv={battleStatus.contender_info[0].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[0].current_round_best_diff}
                            worker={battleStatus.contender_info[0].worker}
                            leading={leader === 1}
                            alignment="start"
                        /> : <PlayerLeft name="Ça charge..." pv={0} pvMax={1} alignment="start" />}
                        <div className={styles.liveStats}><span>HASHRATE · 1 MIN</span><strong>{battleStatus?.contender_info[0]?.hashrate ? `${battleStatus.contender_info[0].hashrate}H/s` : "—"}</strong></div>
                        {shares.find(s => s.user === "contender_1") && <span key={shares.find(s => s.user === "contender_1")!.share_id} className={styles.shareFloat} aria-hidden="true">+{UnitConverter.fromNumberToString(shares.find(s => s.user === "contender_1")!.diff)}</span>}
                    </div>

                    <div className={styles.centerColumn}>
                    <div className={styles.roundBadgeOuter}>
                        <div className={styles.roundBadgeMid}>
                            <div className={styles.roundBadgeRing}>
                                <div className={styles.roundBadgeInner}>
                                    <h1>{battleStatus?.current_round ?? 0}</h1>
                                    <h2 className={styles.roundBadgeTotal}>/{battleStatus?.rounds ?? 0}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                    <section className={styles.sharePanel} aria-label="Shares en direct">
                        <div className={styles.shareHeader}><strong>⚡ SHARES</strong><span className={connection ? styles.online : styles.offline}>{connection ? "● LIVE" : "● …"}</span></div>
                        <div className={styles.shareList}>{shares.slice(0, 5).map(share => <div className={`${styles.shareItem} ${share.user === "contender_1" ? styles.shareA : styles.shareB}`} key={`${share.user}:${share.share_id}`}><span>{share.user === "contender_1" ? "◀" : "▶"}</span><strong>{UnitConverter.fromNumberToString(share.diff)}</strong></div>)}
                        {!shares.length && <p className={styles.shareEmpty}>En attente…</p>}</div>
                    </section>
                    </div>

                    <div className={`${styles.contender_div} ${styles.contenderEnd} ${leader === 2 ? styles.leading : ""} ${leadFlash === 2 ? styles.leadFlash : ""}`}>
                        {battleStatus ? <PlayerRight
                            name={battleStatus.contender_info[1].name}
                            pv={battleStatus.contender_info[1].pv}
                            pvMax={battleStatus.contenders_base_pv}
                            bestDiff={battleStatus.contender_info[1].current_round_best_diff}
                            worker={battleStatus.contender_info[1].worker}
                            leading={leader === 2}
                            alignment="end"
                        /> : <PlayerRight name="Ça charge..." pv={0} pvMax={1} alignment="end" />}
                        <div className={`${styles.liveStats} ${styles.liveStatsEnd}`}><span>HASHRATE · 1 MIN</span><strong>{battleStatus?.contender_info[1]?.hashrate ? `${battleStatus.contender_info[1].hashrate}H/s` : "—"}</strong></div>
                        {shares.find(s => s.user === "contender_2") && <span key={shares.find(s => s.user === "contender_2")!.share_id} className={styles.shareFloat} aria-hidden="true">+{UnitConverter.fromNumberToString(shares.find(s => s.user === "contender_2")!.diff)}</span>}
                    </div>
                </div>
                <div className={styles.historyPanel}>
                    <div className={styles.historyHeader}>
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
