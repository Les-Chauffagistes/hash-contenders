import type { Battle } from "./Battle";

export type CreateBattle = Omit<Battle, "id" | "owner_user_id" | "is_finished">