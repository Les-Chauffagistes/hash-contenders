"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft, Search} from "lucide-react";
import {getBattleBetsView} from "@/app/api";
import BattleBetCard from "@/app/bets/components/battleBetCard";
import {
    filterAndSortBattleBets,
    type BattleBetResultFilter,
    type BattleBetSort,
    type BattleBetTypeFilter,
} from "@/app/bets/publicBetPresentation";
import type {BattleBetsView} from "@/contracts/bets";
import formatNumber from "@/lib/NumberFormatter";
import styles from "./page.module.css";

function battleLabel(view: BattleBetsView): string {
    if (!view.battle) return `Bataille #${view.battleId}`;
    return `${view.battle.contender_1_name} vs ${view.battle.contender_2_name}`;
}

export default function BattleBetsPage() {
    const {id} = useParams<{id: string}>();
    const [view, setView] = useState<BattleBetsView | null>(null);
    const [loadError, setLoadError] = useState<{battleId: string; message: string} | null>(null);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<BattleBetTypeFilter>("all");
    const [resultFilter, setResultFilter] = useState<BattleBetResultFilter>("all");
    const [sort, setSort] = useState<BattleBetSort>("newest");

    useEffect(() => {
        const controller = new AbortController();

        getBattleBetsView(id, controller.signal)
            .then((data) => {
                setView(data);
                setLoadError(null);
            })
            .catch((cause: unknown) => {
                if (cause instanceof DOMException && cause.name === "AbortError") return;
                console.error("Impossible de charger les paris de la bataille", cause);
                setLoadError({
                    battleId: id,
                    message: "Impossible de charger les paris de cette bataille.",
                });
            });

        return () => controller.abort();
    }, [id]);

    const currentView = view?.battleId === id ? view : null;
    const error = loadError?.battleId === id ? loadError.message : null;
    const displayedBets = useMemo(
        () => filterAndSortBattleBets(currentView?.bets ?? [], {
            query,
            type: typeFilter,
            result: resultFilter,
            sort,
        }),
        [currentView, query, resultFilter, sort, typeFilter],
    );

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <Link href={`/battle/${id}`} className={styles.backLink}>
                    <ArrowLeft aria-hidden="true" size={18} />
                    Retour à la bataille
                </Link>
                <div>
                    <p className={styles.eyebrow}>Paris de la bataille</p>
                    <h1 className={styles.title}>{currentView ? battleLabel(currentView) : `Bataille #${id}`}</h1>
                </div>
                {currentView && (
                    <p className={styles.summary}>
                        {currentView.bets.length} {currentView.bets.length > 1 ? "paris confirmés" : "pari confirmé"}
                        {" · "}{formatNumber(currentView.pot)} hashcoins dans le pot visible
                    </p>
                )}
            </header>

            {currentView && (
                <>
                    {!currentView.betOnBestShareRevealed && (
                        <p className={styles.notice}>
                            Les paris sur le meilleur share seront révélés au démarrage de la bataille.
                        </p>
                    )}

                    <section className={styles.controls} aria-label="Trier et filtrer les paris">
                        <label className={styles.searchField}>
                            <span>Joueur</span>
                            <span className={styles.searchInput}>
                                <Search aria-hidden="true" size={16} />
                                <input
                                    type="search"
                                    value={query}
                                    placeholder="Rechercher un pseudo"
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </span>
                        </label>
                        <label>
                            <span>Type</span>
                            <select
                                value={typeFilter}
                                onChange={(event) => setTypeFilter(event.target.value as BattleBetTypeFilter)}
                            >
                                <option value="all">Tous les types</option>
                                <option value="betOnWinner">Vainqueur</option>
                                <option value="betOnBestShare">Meilleur share</option>
                            </select>
                        </label>
                        <label>
                            <span>Résultat</span>
                            <select
                                value={resultFilter}
                                onChange={(event) => setResultFilter(event.target.value as BattleBetResultFilter)}
                            >
                                <option value="all">Tous les résultats</option>
                                <option value="pending">En jeu</option>
                                <option value="won">Gagnés</option>
                                <option value="lost">Perdus</option>
                                <option value="cancelled">Annulés</option>
                            </select>
                        </label>
                        <label>
                            <span>Trier par</span>
                            <select
                                value={sort}
                                onChange={(event) => setSort(event.target.value as BattleBetSort)}
                            >
                                <option value="newest">Plus récents</option>
                                <option value="oldest">Plus anciens</option>
                                <option value="amount-desc">Mise décroissante</option>
                                <option value="amount-asc">Mise croissante</option>
                            </select>
                        </label>
                    </section>

                    {currentView.bets.length === 0 ? (
                        <p className={styles.empty}>Aucun pari confirmé n&apos;est visible pour cette bataille.</p>
                    ) : displayedBets.length === 0 ? (
                        <p className={styles.empty}>Aucun pari ne correspond à ces filtres.</p>
                    ) : (
                        <section className={styles.bets} aria-label="Paris des joueurs">
                            {displayedBets.map((bet) => (
                                <BattleBetCard key={bet.id} bet={bet} battle={currentView.battle} />
                            ))}
                        </section>
                    )}
                </>
            )}

            {!currentView && !error && <p className={styles.empty}>Récupération des paris...</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </main>
    );
}
