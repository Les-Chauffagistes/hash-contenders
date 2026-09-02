export type Round = {
    finalized_at: Date | null
    battle_id: number
    contender_1_best_diff: number
    contender_2_best_diff: number
    block_height: number,
    winner: number | null
}