type BestShareUpdate = {
    type: "BEST_SHARE_UPDATE", user: "contender_1" | "contender_2", diff: number
}

type RoundUpdate = {
    type: "ROUND_UPDATE", round: number, block_height: string
}

type HitResult = {
    type: "HIT_RESULT", round: number, block_height: string, winner: number, contender_1_best_diff: number, contender_2_best_diff: number, date: string, contender_1_pv: number, contender_2_pv: number
}

export type WebSocketEvent = BestShareUpdate | RoundUpdate | HitResult