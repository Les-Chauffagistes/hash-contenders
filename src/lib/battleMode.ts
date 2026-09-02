export type BattleMode = "pool" | "miner";

export function getBattleMode(
    worker1?: string | null,
    worker2?: string | null,
): BattleMode {
    return worker1 || worker2 ? "miner" : "pool";
}
