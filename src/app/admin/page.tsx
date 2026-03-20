"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { Battle } from "../../../models/Battle";
import {
  createAdminBattle,
  deleteAdminBattle,
  getAdminBattles,
  scheduleAdminBattle,
  startAdminBattle,
  stopAdminBattle,
  cancelAdminBattle,
} from "./../api/admin/route";

export default function AdminPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contender1, setContender1] = useState("");
  const [contender2, setContender2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  async function loadBattles() {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminBattles();
      setBattles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les battles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBattles();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!contender1.trim() || !contender2.trim()) {
      setError("Les deux noms sont obligatoires.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await createAdminBattle({
        contender_1_name: contender1.trim(),
        contender_2_name: contender2.trim(),
      });

      setContender1("");
      setContender2("");
      await loadBattles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(`Supprimer la battle #${id} ?`)) return;

    try {
      setActionLoadingId(id);
      setError(null);
      await deleteAdminBattle(id);
      await loadBattles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleAction(
    id: number,
    action: "schedule" | "start" | "stop" | "cancel"
  ) {
    try {
      setActionLoadingId(id);
      setError(null);

      if (action === "schedule") await scheduleAdminBattle(id);
      if (action === "start") await startAdminBattle(id);
      if (action === "stop") await stopAdminBattle(id);
      if (action === "cancel") await cancelAdminBattle(id);

      await loadBattles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur sur l'action");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1 className={styles.title}>Gestion des battles</h1>
        </div>

        <Link href="/" className={styles.backLink}>
          Retour au front
        </Link>
      </div>

      <section className={styles.card}>
        <h2>Créer une battle</h2>

        <form onSubmit={handleCreate} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="contender1">Contender 1</label>
            <input
              id="contender1"
              value={contender1}
              onChange={(e) => setContender1(e.target.value)}
              placeholder="Nom du contender 1"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="contender2">Contender 2</label>
            <input
              id="contender2"
              value={contender2}
              onChange={(e) => setContender2(e.target.value)}
              placeholder="Nom du contender 2"
            />
          </div>

          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Création..." : "Créer"}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Liste des battles</h2>
          <button className="secondary" onClick={loadBattles}>
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : battles.length === 0 ? (
          <p>Aucune battle.</p>
        ) : (
          <div className={styles.list}>
            {battles.map((battle) => (
              <div key={battle.id} className={styles.row}>
                <div className={styles.meta}>
                  <p className={styles.names}>
                    {battle.contender_1_name} <span>vs</span> {battle.contender_2_name}
                  </p>
                  <p className={styles.subline}>
                    ID #{battle.id}
                    {" • "}
                    Statut : {(battle as { status?: string }).status ?? "inconnu"}
                  </p>
                </div>

                <div className={styles.actions}>
                  <Link href={`/battle/${battle.id}`} className={styles.linkBtn}>
                    Voir
                  </Link>

                  <Link href={`/admin/battles/${battle.id}`} className={styles.linkBtnAlt}>
                    Éditer
                  </Link>

                  <button
                    className="secondary"
                    disabled={actionLoadingId === battle.id}
                    onClick={() => handleAction(battle.id, "schedule")}
                  >
                    Schedule
                  </button>

                  <button
                    className="secondary"
                    disabled={actionLoadingId === battle.id}
                    onClick={() => handleAction(battle.id, "start")}
                  >
                    Start
                  </button>

                  <button
                    className="secondary"
                    disabled={actionLoadingId === battle.id}
                    onClick={() => handleAction(battle.id, "stop")}
                  >
                    Stop
                  </button>

                  <button
                    className="secondary"
                    disabled={actionLoadingId === battle.id}
                    onClick={() => handleAction(battle.id, "cancel")}
                  >
                    Cancel
                  </button>

                  <button
                    className={styles.deleteBtn}
                    disabled={actionLoadingId === battle.id}
                    onClick={() => handleDelete(battle.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}