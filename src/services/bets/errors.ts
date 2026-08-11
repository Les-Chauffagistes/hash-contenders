/** Refus métier explicite, par opposition à une panne technique. */
export class BetError extends Error {}

export class BattleNotFoundError extends BetError {}
export class BattleFinishedError extends BetError {}
export class InsufficientBalanceError extends BetError {}
export class EscrowDebitFailedError extends BetError {}
export class BetCreationError extends BetError {}
export class InvalidBetTypeError extends BetError {}
export class InvalidBetDataError extends BetError {}
