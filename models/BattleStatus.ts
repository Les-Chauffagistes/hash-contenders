import { Round } from "./Hit";

export type BattleStatus = {
    battle_id: number
    rounds: number
    contenders_base_pv: number
    start_height: number | null
    is_finished: boolean
    hits: Round[]
    current_round: number
    contender_info: {address?: string, pv: number, name: string, current_round_best_diff: number}[]
};