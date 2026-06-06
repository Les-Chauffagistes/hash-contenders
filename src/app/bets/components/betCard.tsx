import { UserBetListItem } from "@/app/bets/types";

export default function BetCard({ bet }: Readonly<{ bet: UserBetListItem }>) {
    const battleLabel = bet.battle
        ? `${bet.battle.contender_1_name} vs ${bet.battle.contender_2_name}`
        : `Bataille #${bet.battleId}`;

    return (
        <div>
            <p>{bet.status}</p>
            <p>{battleLabel}</p>
            <p>{bet.amount} coins</p>
        </div>
    )
}
