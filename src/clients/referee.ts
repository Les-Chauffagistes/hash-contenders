import type {Battle} from "../../models/Battle";
import type {BattleStatus} from "../../models/BattleStatus";
import type {CreateBattle} from "../../models/CreateBattle";
import type {Round} from "../../models/Hit";
import {UnauthorizedError} from "@/lib/errors";
import {config} from "@/lib/config";

export async function getBattleStatus(
  battleId: number | string,
  includeHits: boolean = false,
): Promise<BattleStatus> {
  const response = await fetch(
    `${config.API_URL}/v1/status/${battleId}${includeHits ? "?includes=hits" : ""}`,
  );
  if (!response.ok) {
    throw new Error(`Unable to fetch battle status: ${response.status}`);
  }
  return response.json();
}

export async function getBattleHits(battleId: number | string): Promise<Round[]> {
  const response = await fetch(`${config.API_URL}/v1/hits/${battleId}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch battle hits: ${response.status}`);
  }
  return response.json();
}

export async function getAllBattles(): Promise<Battle[]> {
  const response = await fetch(`${config.API_URL}/v1/battles`);
  if (!response.ok) {
    throw new Error(`Unable to fetch battles: ${response.status}`);
  }
  return response.json();
}

export async function getBattlesByIds(battleIds: number[]): Promise<Battle[]> {
  if (battleIds.length === 0) return [];

  const response = await fetch(`${config.API_URL}/v1/battles/by-ids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ids: battleIds}),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch battles: ${response.status}`);
  }

  return response.json();
}

export async function deleteBattleById(
  battleId: number | string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${config.API_URL}/v1/battle/${battleId}`, {
    method: "DELETE",
    headers: {
      Authorization: accessToken,
    },
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `deleteBattleById failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
}

export async function createBattle(
  battle: CreateBattle,
  accessToken: string,
): Promise<Battle> {
  const response = await fetch(`${config.API_URL}/v1/battle`, {
    method: "POST",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(battle),
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `createBattle failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
  return response.json();
}

export async function getBitcoinBlockHeight(): Promise<number> {
  const response = await fetch(`${config.BITCOIN_API_URL}/v1/bitcoin-block-height`);
  if (!response.ok) {
    throw new Error(`Unable to fetch Bitcoin block height: ${response.status}`);
  }
  return Number.parseInt(await response.text());
}
