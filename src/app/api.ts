import { Battle } from "../../models/Battle";
import { BattleStatus } from "../../models/BattleStatus";
import { CreateBattle } from "../../models/CreateBattle";
import { Round } from "../../models/Hit";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ApiErrorPayload = {
  error?: string;
  details?: unknown;
};

export type UserRole = "USER" | "ADMIN";

export type AuthUser = {
  id: number;
  pseudo: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  password: string;
  pseudo?: string;
  email?: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  let data: T | ApiErrorPayload | null = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && data.error
        ? data.error
        : `Erreur API (${res.status})`;

    throw new Error(message);
  }

  return data as T;
}

/* =========================
   AUTH
========================= */

export async function login(payload: LoginPayload): Promise<{ ok: true; user: AuthUser }> {
  return apiFetch<{ ok: true; user: AuthUser }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: RegisterPayload): Promise<{ ok: true; user: AuthUser }> {
  return apiFetch<{ ok: true; user: AuthUser }>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/v1/auth/me");
}

export async function logout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/v1/auth/logout", {
    method: "POST",
  });
}

/* =========================
   PUBLIC BATTLES
========================= */

export async function getBattleStatus(
  battleId: number | string,
  includeHits: boolean = false
): Promise<BattleStatus> {
  return apiFetch<BattleStatus>(
    `/v1/status/${battleId}${includeHits ? "?includes=hits" : ""}`
  );
}

export async function getBattleHits(battleId: number | string): Promise<Round[]> {
  return apiFetch<Round[]>(`/v1/hits/${battleId}`);
}

export async function getAllBattles(): Promise<Battle[]> {
  return apiFetch<Battle[]>("/v1/battles");
}

export async function createBattle(battle: CreateBattle): Promise<Battle> {
  return apiFetch<Battle>("/v1/battle", {
    method: "POST",
    body: JSON.stringify(battle),
  });
}