import { Battle } from "../../../../models/Battle";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ApiErrorPayload = {
  error?: string;
  details?: unknown;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

export type AdminBattleCreatePayload = {
  contender_1_name: string;
  contender_2_name: string;
};

export type AdminBattleUpdatePayload = Partial<{
  contender_1_name: string;
  contender_2_name: string;
  status: string;
}>;

export async function getAdminBattles(): Promise<Battle[]> {
  return adminFetch<Battle[]>("/v1/admin/battles");
}

export async function getAdminBattle(battleId: number | string): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}`);
}

export async function createAdminBattle(payload: AdminBattleCreatePayload): Promise<Battle> {
  return adminFetch<Battle>("/v1/admin/battles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBattle(
  battleId: number | string,
  payload: AdminBattleUpdatePayload
): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBattle(
  battleId: number | string
): Promise<{ success?: boolean; message?: string }> {
  return adminFetch<{ success?: boolean; message?: string }>(`/v1/admin/battles/${battleId}`, {
    method: "DELETE",
  });
}

export async function scheduleAdminBattle(battleId: number | string): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}/schedule`, {
    method: "POST",
  });
}

export async function startAdminBattle(battleId: number | string): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}/start`, {
    method: "POST",
  });
}

export async function stopAdminBattle(battleId: number | string): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}/stop`, {
    method: "POST",
  });
}

export async function cancelAdminBattle(battleId: number | string): Promise<Battle> {
  return adminFetch<Battle>(`/v1/admin/battles/${battleId}/cancel`, {
    method: "POST",
  });
}