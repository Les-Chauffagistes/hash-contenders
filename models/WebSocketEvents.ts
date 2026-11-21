type BestShareUpdate = {
    type: "BEST_SHARE_UPDATE", user: "contender_1" | "contender_2", diff: number, block_height: number
}

type RoundUpdate = {
    type: "ROUND_UPDATE", round: number, block_height: number
}

type HitResult = {
    type: "HIT_RESULT",
    round: number,
    block_height: number,
    winner: number | null,
    contender_1_best_diff: number,
    contender_2_best_diff: number,
    date: string,
    contender_1_pv: number,
    contender_2_pv: number
}

type BattleEnd = {
    type: "BATTLE_END", winner: number | null, contender_1_pv: number, contender_2_pv: number
}

export type ShareEvent = { type: "SHARE", user: "contender_1" | "contender_2", diff: number, block_height: number, share_id: string, created_at: string }

export type WebSocketEvent = BestShareUpdate | RoundUpdate | HitResult | BattleEnd | ShareEvent
