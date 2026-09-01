"use client";

import styles from "./page.module.css";
import {useEffect, useState} from "react";
import {getUserBetsOverview} from "@/app/api";
import BattleBetGroup from "@/app/bets/components/battleBetGroup";
import {isBattleAwaitingOutcome} from "@/app/bets/betPresentation";
import type {UserBetsOverview} from "@/contracts/bets";

export default function BetsPage() {
    const [overview, setOverview] = useState<UserBetsOverview | null>(null)

    useEffect(() => {
        getUserBetsOverview().then(setOverview)
    }, [])

    const battles = overview?.battles ?? []
    const awaitingOutcome = battles.filter(isBattleAwaitingOutcome)
    const settled = battles.filter((battleBets) => !isBattleAwaitingOutcome(battleBets))

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Mes paris</h1>
            {overview === null && <p className={styles.empty}>Récupération....</p>}
            {battles.length == 0 && overview !== null && <p>Aucun pari</p>}
            {awaitingOutcome.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>En cours</h2>
                    {awaitingOutcome.map((battleBets) => (
                        <BattleBetGroup key={battleBets.battleId} battleBets={battleBets} />
                    ))}
                </section>
            )}
            {settled.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Terminés</h2>
                    {settled.map((battleBets) => (
                        <BattleBetGroup key={battleBets.battleId} battleBets={battleBets} />
                    ))}
                </section>
            )}
        </main>
    );
}
