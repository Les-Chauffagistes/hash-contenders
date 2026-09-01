import type {BattleBetItem, BetResult, BetTypeId} from "@/contracts/bets";

export type BattleBetTypeFilter = "all" | BetTypeId;
export type BattleBetResultFilter = "all" | BetResult;
export type BattleBetSort = "newest" | "oldest" | "amount-desc" | "amount-asc";

export type BattleBetFilters = {
    query: string;
    type: BattleBetTypeFilter;
    result: BattleBetResultFilter;
    sort: BattleBetSort;
};

export function playerLabel(bet: BattleBetItem): string {
    return bet.player.pseudo ?? `Joueur #${bet.player.id}`;
}

export function filterAndSortBattleBets(
    bets: readonly BattleBetItem[],
    filters: BattleBetFilters,
): BattleBetItem[] {
    const query = filters.query.trim().toLocaleLowerCase("fr-FR");
    const filtered = bets.filter((bet) => {
        const matchesPlayer = query.length === 0
            || playerLabel(bet).toLocaleLowerCase("fr-FR").includes(query)
            || bet.player.id.includes(query);
        const matchesType = filters.type === "all" || bet.type === filters.type;
        const matchesResult = filters.result === "all" || bet.result === filters.result;

        return matchesPlayer && matchesType && matchesResult;
    });

    return filtered.sort((left, right) => {
        switch (filters.sort) {
            case "oldest":
                return Date.parse(left.createdAt) - Date.parse(right.createdAt);
            case "amount-desc":
                return right.amount - left.amount || Date.parse(right.createdAt) - Date.parse(left.createdAt);
            case "amount-asc":
                return left.amount - right.amount || Date.parse(right.createdAt) - Date.parse(left.createdAt);
            case "newest":
                return Date.parse(right.createdAt) - Date.parse(left.createdAt);
        }
    });
}
