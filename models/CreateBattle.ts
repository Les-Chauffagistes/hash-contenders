import type { Battle } from "./Battle";

export type CreateBattle = Omit<Battle, "id" | "is_finished">