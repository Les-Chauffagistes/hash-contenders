"use client";

import styles from "./page.module.css";
import {useEffect, useState} from "react";
import {getUserBets} from "@/app/api";
import BetCard from "@/app/bets/components/betCard";
import {UserBetListItem} from "@/app/bets/types";

export default function BetsPage() {
    const [bets, setBets] = useState<UserBetListItem[] | null>(null)

    useEffect(() => {
        getUserBets().then(setBets)
    }, [])

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Mes paris</h1>
            {bets === null && <p className={styles.empty}>Récupération....</p>}
            {bets?.length == 0 && <p>Aucun pari</p>}
            {(bets !== null && bets?.length != 0) && <div>
                {bets.map((bet) => <BetCard key={bet.id} bet={bet} />)}
            </div>}
        </main>
    );
}
