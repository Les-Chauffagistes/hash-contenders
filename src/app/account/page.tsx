"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthUser, getCurrentUser } from "../api";
import LogoutButton from "../components/LogoutButton";

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Chargement...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Accès refusé</h1>
        <p>Tu dois être connecté pour accéder à cette page.</p>
        <Link href="/login">Aller à la connexion</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Mon compte</h1>

      <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
        <p><strong>ID :</strong> {user.id}</p>
        <p><strong>Pseudo :</strong> {user.pseudo || "—"}</p>
        <p><strong>Email :</strong> {user.email || "—"}</p>
        <p><strong>Rôle :</strong> {user.role}</p>
        <p><strong>Statut :</strong> {user.is_active ? "Actif" : "Désactivé"}</p>
      </div>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/">Accueil</Link>
        {user.role === "ADMIN" && <Link href="/admin">Administration</Link>}
        <LogoutButton />
      </div>
    </main>
  );
}