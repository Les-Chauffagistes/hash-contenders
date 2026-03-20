"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import { Battle } from "../../../../../models/Battle";
import {
  getAdminBattle,
  updateAdminBattle,
  deleteAdminBattle,
  scheduleAdminBattle,
  startAdminBattle,
  stopAdminBattle,
  cancelAdminBattle,
} from "../../../api/admin/route";

export default function AdminBattleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contender1, setContender1] = useState("");
  const [contender2, setContender2] = useState("");

  async function loadBattle() {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminBattle(id);
      setBattle(data);
      setContender1(data.contender_1_name);
      setContender2(data.contender_2_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la battle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBattle();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const updated = await updateAdminBattle(id, {
        contender_1_name: contender1.trim(),
        contender_2_name: contender2.trim(),
      });

      setBattle(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer la battle #${id} ?`)) return;

    try {
      setActionLoading(true);
      setError(null);
      await deleteAdminBattle(id);
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAction(action: "schedule" | "start" | "stop" | "cancel") {
    try {
      setActionLoading(true);
      setError(null);

      let updated: Battle;

      if (action === "schedule") updated = await scheduleAdminBattle(id);
      else if (action === "start") updated = await startAdminBattle(id);
      else if (action === "stop") updated = await stopAdminBattle(id);
      else updated = await cancelAdminBattle(id);

      setBattle(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur sur l'action");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin battle</p>
          <h1 className={styles.title}>Battle #{id}</h1>
        </div>

        <div className={styles.links}>
          <Link href="/admin" className={styles.backLink}>
            Retour admin
          </Link>
          <Link href={`/battle/${id}`} className={styles.backLink}>
            Voir côté front
          </Link>
        </div>
      </div>

      {loading ? (
        <section className={styles.card}>
          <p>Chargement...</p>
        </section>
      ) : !battle ? (
        <section className={styles.card}>
          <p>Battle introuvable.</p>
        </section>
      ) : (
        <>
          <section className={styles.card}>
            <h2>Informations</h2>

            <div className={styles.infoGrid}>
              <div>
                <span>ID</span>
                <strong>{battle.id}</strong>
              </div>

              <div>
                <span>Statut</span>
                <strong>{(battle as { status?: string }).status ?? "inconnu"}</strong>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Modifier la battle</h2>

            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="contender1">Contender 1</label>
                <input
                  id="contender1"
                  value={contender1}
                  onChange={(e) => setContender1(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="contender2">Contender 2</label>
                <input
                  id="contender2"
                  value={contender2}
                  onChange={(e) => setContender2(e.target.value)}
                />
              </div>

              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Actions</h2>

            <div className={styles.actions}>
              <button className="secondary" disabled={actionLoading} onClick={() => handleAction("schedule")}>
                Schedule
              </button>
              <button className="secondary" disabled={actionLoading} onClick={() => handleAction("start")}>
                Start
              </button>
              <button className="secondary" disabled={actionLoading} onClick={() => handleAction("stop")}>
                Stop
              </button>
              <button className="secondary" disabled={actionLoading} onClick={() => handleAction("cancel")}>
                Cancel
              </button>
              <button className={styles.deleteBtn} disabled={actionLoading} onClick={handleDelete}>
                Supprimer
              </button>
            </div>
          </section>

          {error && (
            <section className={styles.card}>
              <p className={styles.error}>{error}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}