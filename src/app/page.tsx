"use client";

import {useEffect, useMemo, useState} from "react";
import styles from "./page.module.css";
import {getAllBattles} from "./api";
import BattleCard from "./components/BattleCard";
import {Battle} from "../../models/Battle";
import Link from "next/link";
import {Search, X} from "lucide-react";

export default function Home() {
    const [battles, setBattles] = useState<Battle[] | null>(null);
    const [search, setSearch] = useState("");
    const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);

    useEffect(() => {
        getAllBattles().then(data => setBattles(data));
    }, []);

    const filteredBattles = useMemo(() => {
        if (!battles) return null;
        if (!search.trim()) return battles;
        const query = search.trim().toLowerCase();
        return battles.filter(b =>
            b.contender_1_name.toLowerCase().includes(query) ||
            b.contender_2_name.toLowerCase().includes(query)
        );
    }, [battles, search]);

    let view;

    if (filteredBattles === null) {
        view = <p>Ça va chauffer...</p>;
    } else if (filteredBattles.length === 0) {
        view = <p className={styles.empty}>{search.trim() ? "Aucun résultat" : "Aucune bataille en cours"}</p>;
    } else {
        view = filteredBattles.map(battle =>
            <Link href={`/battle/${battle.id}`} key={battle.id}>
                <BattleCard
                    battle={battle}
                    onBet={!battle.is_finished ? () => setSelectedBattle(battle) : undefined}
                />
            </Link>
        );
    }

    return (
        <main className={styles.page}>
            <div className={styles.toolbar}>
                <div className={styles.searchWrapper}>
                    <Search size={16} className={styles.searchIcon}/>
                    <input
                        type="text"
                        placeholder="Rechercher un contender..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
                <button className="primary">
                    <Link href="/create">Nouvelle bataille</Link>
                </button>
            </div>
            <div className={styles.main}>
                {view}
            </div>

            {selectedBattle && (
                <div className={styles.backdrop} onClick={() => setSelectedBattle(null)}/>
            )}
            <div className={`${styles.drawer} ${selectedBattle ? styles.drawerOpen : ""}`}>
                {selectedBattle && (
                    <>
                        <div className={styles.drawerHeader}>
                            <span className={styles.drawerTitle}>Créer un pari</span>
                            <button className={styles.drawerClose} onClick={() => setSelectedBattle(null)}>
                                <X size={18}/>
                            </button>
                        </div>
                        <p className={styles.drawerBattle}>
                            <span className={styles.drawerContender}>{selectedBattle.contender_1_name}</span>
                            <span className={styles.drawerVs}>vs</span>
                            <span className={styles.drawerContender}>{selectedBattle.contender_2_name}</span>
                        </p>
                        <Link
                            href={`/bets/create?battle_id=${selectedBattle.id}`}
                            className={styles.drawerButton}
                            onClick={() => setSelectedBattle(null)}
                        >
                            Créer un pari
                        </Link>
                    </>
                )}
            </div>
        </main>
    );
}
