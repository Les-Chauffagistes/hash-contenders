import { Battle } from "../../../models/Battle";



export default function BattleCard({battle}: Readonly<{battle: Battle}>) {
    console.log(battle)
    return (
        <div style={{ display: "flex", flexDirection: "column", padding: 5 }}>
            <h1>{battle.contender_1_name} VS {battle.contender_2_name}</h1>
            <p>Démarre au bloc {battle.start_height}</p>
            <p>{battle.rounds} rounds</p>
        </div>
    )
}