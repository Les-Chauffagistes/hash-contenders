"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthUser, getCurrentUser } from "../api";
import LogoutButton from "./LogoutButton";

export default function UserNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div style={{ display: "flex", gap: "1rem" }}>
        <Link href="/login">Connexion</Link>
        <Link href="/register">Inscription</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <Link href="/account">{user.pseudo || user.email || "Mon compte"}</Link>
      {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
      <LogoutButton />
    </div>
  );
}