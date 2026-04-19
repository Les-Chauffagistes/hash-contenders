"use client";

import styles from "./page.module.css";
import {useEffect, useState} from "react";
import {BetModel} from "@/generated/prisma/models/Bet";
import {getUserBets} from "@/app/api";

export default function BetsPage() {
    const [bets, setBets] = useState<BetModel[] | null>(null)

    useEffect(() => {
        getUserBets().then(setBets)
    }, [])

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Mes paris</h1>
            {bets === null && <p className={styles.empty}>Récupération....</p>}
            {bets?.length == 0 && <p>Aucun pari</p>}
            {bets && <div></div>}
        </main>
    );
}
