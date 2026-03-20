"use client";

import Link from "next/link";
import "./auth.css";

export default function AuthCard() {
  return (
    <div className="auth-card">
      <h2>Compte utilisateur</h2>
      <p>Connecte-toi ou crée un compte pour accéder à ton espace personnel.</p>
      <div className="auth-card-actions">
        <Link href="/login" className="auth-card-button primary">
          Connexion
        </Link>
        <Link href="/register" className="auth-card-button secondary">
          Inscription
        </Link>
      </div>
    </div>
  );
}