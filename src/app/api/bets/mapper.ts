import type {
    BattleBetsView,
    BattleSummary,
    SpecializedBet,
    UserBattleBets,
    UserBattlePayout,
    UserBetItem,
    UserBetsOverview,
} from "@/contracts/bets";
import type {BattleBetRecord, UserBetRecord, UserPayoutRecord} from "@/services/bets/read";
import type {Battle} from "../../../../models/Battle";

function toSafeNumber(value: bigint): number {
    const converted = Number(value);
    if (!Number.isSafeInteger(converted)) {
        throw new RangeError(`BigInt ${value} cannot be safely converted to a number`);
    }
    return converted;
}

function toBattleSummary(battle: Battle): BattleSummary {
    return {
        id: battle.id,
        contender_1_name: battle.contender_1_name,
        contender_2_name: battle.contender_2_name,
        is_finished: battle.is_finished,
        rounds: battle.rounds,
        start_height: battle.start_height,
        contenders_pv: battle.contenders_pv,
    };
}

type SpecializedRow = {
    id: string;
    betOnWinner: {winnerIndex: number} | null;
    betOnBestShare: {diff: bigint} | null;
};

/**
 * Complète la partie commune d'un pari par sa spécialisation, en faisant
 * respecter l'invariant du schéma : exactement une des deux tables filles.
 * Partagé par les deux vues — la règle ne dépend pas de qui regarde.
 *
 * La spécialisation est ajoutée ici plutôt que rendue à part puis étalée par
 * l'appelant : TS ne distribue pas le spread d'une union, un `{...base,
 * ...spécialisation}` élargirait `type` et `details` chacun de leur côté et
 * casserait leur appariement.
 */
function withSpecialization<Base extends object>(
    base: Base,
    bet: SpecializedRow,
): Base & SpecializedBet {
    const {betOnWinner, betOnBestShare} = bet;
    const specializationCount = Number(betOnWinner !== null) + Number(betOnBestShare !== null);
    if (specializationCount !== 1) {
        throw new Error(`Bet ${bet.id} must have exactly one specialization`);
    }

    return betOnWinner
        ? {...base, type: "betOnWinner", details: {winnerIndex: betOnWinner.winnerIndex}}
        : {...base, type: "betOnBestShare", details: {diff: toSafeNumber(betOnBestShare!.diff)}};
}

/**
 * Projection champ par champ plutôt qu'un `...rest` : `battleId` ne fait pas
 * partie du pari exposé (il est porté par la bataille qui le contient), et une
 * colonne ajoutée à `Bet` ne doit pas se retrouver dans le contrat sans qu'on
 * l'ait décidé.
 */
export function toUserBetItem(bet: UserBetRecord): UserBetItem {
    return withSpecialization(
        {
            id: bet.id,
            createdAt: bet.createdAt.toISOString(),
            amount: bet.amount,
            result: bet.result,
            status: bet.status,
        },
        bet,
    );
}

/**
 * Replie les lignes d'outbox en un total par bataille. Le settlement n'en écrit
 * qu'une par couple (bataille, direction) pour un joueur — la somme est là par
 * robustesse, pas parce qu'un cas connu la réclame.
 */
function toPayoutsByBattle(payouts: UserPayoutRecord[]): Map<string, UserBattlePayout> {
    const byBattle = new Map<string, UserBattlePayout>();

    for (const payout of payouts) {
        // `debit_to_escrow` est la mise elle-même, déjà portée par `Bet.amount` :
        // la compter ici la ferait apparaître une seconde fois comme un versement.
        if (payout.direction === "debit_to_escrow") continue;

        let entry = byBattle.get(payout.battleId);
        if (!entry) {
            entry = {winnings: 0, refunds: 0};
            byBattle.set(payout.battleId, entry);
        }

        const amount = toSafeNumber(payout.amount);
        if (payout.direction === "escrow_to_winner") entry.winnings += amount;
        else entry.refunds += amount;
    }

    return byBattle;
}

/**
 * Assemble la vue « mes paris » : les paris regroupés par bataille, chacun avec
 * la mise cumulée du joueur et son versement.
 *
 * L'ordre d'arrivée des paris est conservé, à l'intérieur d'une bataille comme
 * entre les batailles — `findUserBets` trie par date décroissante, une bataille
 * apparaît donc à la position de son pari le plus récent.
 *
 * Un versement sans pari correspondant est ignoré : le cas ne devrait pas
 * exister, et il n'y aurait rien à en dire sous une bataille qu'on n'affiche pas.
 */
export function toUserBetsOverview(
    bets: UserBetRecord[],
    battles: Battle[],
    payouts: UserPayoutRecord[],
): UserBetsOverview {
    const battlesById = new Map(battles.map((battle) => [String(battle.id), battle]));
    const payoutsByBattle = toPayoutsByBattle(payouts);
    const byBattle = new Map<string, UserBattleBets>();

    for (const bet of bets) {
        let entry = byBattle.get(bet.battleId);

        if (!entry) {
            const battle = battlesById.get(bet.battleId);
            entry = {
                battleId: bet.battleId,
                battle: battle ? toBattleSummary(battle) : null,
                stake: 0,
                payout: payoutsByBattle.get(bet.battleId) ?? null,
                bets: [],
            };
            byBattle.set(bet.battleId, entry);
        }

        entry.bets.push(toUserBetItem(bet));
        entry.stake += bet.amount;
    }

    return {battles: [...byBattle.values()]};
}

/**
 * Assemble la vue publique d'une bataille : ses paris confirmés, tous joueurs.
 *
 * Ce qui n'y figure pas est aussi important que ce qui y figure — ni `status`
 * (l'escrow d'un joueur ne regarde que lui), ni montant de gain. À noter tout
 * de même : publier toutes les mises et toutes les issues rend la répartition
 * recalculable, `splitProportionally` étant déterministe.
 *
 * Tant que `betOnBestShareRevealed` est faux (bataille pas encore démarrée),
 * les paris betOnBestShare sont exclus de `bets` ET de `pot` — betOnWinner
 * reste visible normalement, la règle de confidentialité ne concernant que
 * les positions betOnBestShare.
 */
export function toBattleBetsView(
    battleId: string,
    battle: Battle | null,
    bets: BattleBetRecord[],
    pseudosByUserId: Map<string, string>,
    betOnBestShareRevealed: boolean,
): BattleBetsView {
    const visibleBets = betOnBestShareRevealed ? bets : bets.filter((bet) => bet.betOnBestShare === null);

    return {
        battleId,
        battle: battle ? toBattleSummary(battle) : null,
        pot: visibleBets.reduce((total, bet) => total + bet.amount, 0),
        betOnBestShareRevealed,
        bets: visibleBets.map((bet) =>
            withSpecialization(
                {
                    id: bet.id,
                    player: {
                        id: bet.userId.toString(),
                        pseudo: pseudosByUserId.get(bet.userId.toString()) ?? null,
                    },
                    createdAt: bet.createdAt.toISOString(),
                    amount: bet.amount,
                    result: bet.result,
                },
                bet,
            ),
        ),
    };
}
