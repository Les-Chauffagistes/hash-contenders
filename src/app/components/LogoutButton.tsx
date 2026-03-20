"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "../api";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoading(false);
      return;
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      style={{
        padding: "0.7rem 1rem",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "transparent",
        color: "inherit",
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Déconnexion..." : "Déconnexion"}
    </button>
  );
}