/** Backoff exponentiel plafonné, +/- 20% de jitter pour éviter les vagues synchronisées. */
export function nextReconnectDelayMs(attempts: number, maxDelayMs = 30_000): number {
    const baseMs = Math.min(2 ** attempts * 1_000, maxDelayMs);
    const jitterMs = Math.random() * baseMs * 0.2;
    return baseMs + jitterMs;
}
