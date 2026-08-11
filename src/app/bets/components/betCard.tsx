import type {UserBetListItem} from "@/contracts/bets";

export default function BetCard({ bet }: Readonly<{ bet: UserBetListItem }>) {
    const battleLabel = bet.battle
        ? `${bet.battle.contender_1_name} vs ${bet.battle.contender_2_name}`
        : `Bataille #${bet.battleId}`;

    return (
        <div style={{padding: "10px 20px", borderRadius: 10, backgroundColor: "var(--bg-soft)"}}>
            <h3>{battleLabel}</h3>
            <p>{bet.status}</p>
            <p>{bet.amount} hashcoins</p>
        </div>
    )
}
