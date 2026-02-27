export type Battle = {
    id: number
    are_addresses_privates: boolean
    contender_1_address: string
    contender_1_name: string
    contender_2_address: string
    contender_2_name: string
    contenders_pv: number
    rounds: number
    start_height: number
    is_finished: boolean
}