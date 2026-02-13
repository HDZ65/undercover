import type { PokerAction, PokerPhase, TableConfig } from '@undercover/shared';
import { addChips, assertInteger, subtractChips } from './chips';

type AvailableActions = {
  actions: PokerAction[];
  minRaise: number;
  maxRaise: number;
  callAmount: number;
};

type ValidationResult = {
  valid: boolean;
  error?: string;
};

type ExecutionResult = {
  bet: number;
  isAllIn: boolean;
};

const BETTING_PHASES: PokerPhase[] = ['preFlop', 'flop', 'turn', 'river'];

const sortSeatIndices = (seatIndices: number[]): number[] => {
  return [...seatIndices].sort((seatA, seatB) => seatA - seatB);
};

const getNextSeat = (seatIndices: number[], fromSeat: number): number => {
  const sortedSeatIndices = sortSeatIndices(seatIndices);
  const nextSeat = sortedSeatIndices.find((seatIndex) => seatIndex > fromSeat);
  return nextSeat ?? sortedSeatIndices[0];
};

export class BettingEngine {
  private readonly config: TableConfig;

  private readonly dealerSeatIndex: number;

  private readonly stacks = new Map<string, number>();

  private readonly betsPerPlayer = new Map<string, number>();

  private readonly seatByPlayerId = new Map<string, number>();

  private readonly playerIdBySeat = new Map<number, string>();

  private readonly playerIds: string[] = [];

  private readonly foldedPlayers = new Set<string>();

  private readonly allInPlayers = new Set<string>();

  private readonly actedPlayers = new Set<string>();

  private raiseClosedPlayers = new Set<string>();

  private pendingPlayers = new Set<string>();

  private phase: PokerPhase = 'lobby';

  private currentBet = 0;

  private lastRaise = 0;

  private lastAggressor: string | null = null;

  private activePlayerId: string | null = null;

  constructor(config: TableConfig, playerStacks: Map<string, number>, dealerSeatIndex: number) {
    if (playerStacks.size < 2) {
      throw new Error('BettingEngine requires at least 2 players.');
    }

    assertInteger(dealerSeatIndex, 'dealerSeatIndex');

    this.config = config;
    this.dealerSeatIndex = dealerSeatIndex;
    this.lastRaise = this.config.bigBlind;

    let seatIndex = 0;
    for (const [playerId, chipStack] of playerStacks.entries()) {
      assertInteger(chipStack, `${playerId} stack`);
      if (chipStack < 0) {
        throw new Error(`${playerId} stack must be greater than or equal to 0.`);
      }

      this.playerIds.push(playerId);
      this.stacks.set(playerId, chipStack);
      this.betsPerPlayer.set(playerId, 0);
      this.seatByPlayerId.set(playerId, seatIndex);
      this.playerIdBySeat.set(seatIndex, playerId);
      seatIndex += 1;
    }
  }

  startNewRound(phase: PokerPhase): void {
    if (!BETTING_PHASES.includes(phase)) {
      throw new Error(`Cannot start betting round for phase ${phase}.`);
    }

    const previousPhase = this.phase;
    this.phase = phase;

    if (phase === 'preFlop' || previousPhase === 'lobby') {
      this.resetPlayerStatusesForNewHand();
    }

    this.resetRoundState();

    if (phase === 'preFlop') {
      this.startPreFlopRound();
      return;
    }

    this.startPostFlopRound();
  }

  getAvailableActions(playerId: string): AvailableActions {
    this.assertKnownPlayer(playerId);

    const stack = this.stacks.get(playerId) ?? 0;
    const playerBet = this.betsPerPlayer.get(playerId) ?? 0;
    const callAmount = this.getCallAmount(playerId);
    const minRaise = this.getMinRaiseAmount();
    const maxRaise = addChips(playerBet, stack);

    if (this.foldedPlayers.has(playerId) || this.allInPlayers.has(playerId) || stack === 0) {
      return {
        actions: [],
        minRaise,
        maxRaise,
        callAmount,
      };
    }

    const actions: PokerAction[] = [];

    if (callAmount === 0) {
      actions.push('check');
    } else {
      actions.push('fold');
      if (stack >= callAmount) {
        actions.push('call');
      }
    }

    const canRaise = !this.raiseClosedPlayers.has(playerId) && stack > callAmount && maxRaise >= minRaise;
    if (canRaise) {
      actions.push('raise');
    }

    if (stack > 0) {
      actions.push('allIn');
    }

    return {
      actions,
      minRaise,
      maxRaise,
      callAmount,
    };
  }

  validateAction(playerId: string, action: PokerAction, amount?: number): ValidationResult {
    this.assertKnownPlayer(playerId);

    if (this.activePlayerId !== playerId) {
      return {
        valid: false,
        error: `It is not ${playerId}'s turn.`,
      };
    }

    if (this.foldedPlayers.has(playerId) || this.allInPlayers.has(playerId)) {
      return {
        valid: false,
        error: `${playerId} cannot act in current state.`,
      };
    }

    const stack = this.stacks.get(playerId) ?? 0;
    const playerBet = this.betsPerPlayer.get(playerId) ?? 0;
    const callAmount = this.getCallAmount(playerId);
    const minRaise = this.getMinRaiseAmount();
    const maxRaise = addChips(playerBet, stack);

    if (action === 'check') {
      if (callAmount > 0) {
        return {
          valid: false,
          error: 'Cannot check while facing a bet.',
        };
      }

      return { valid: true };
    }

    if (action === 'fold') {
      return { valid: true };
    }

    if (action === 'call') {
      if (callAmount === 0) {
        return {
          valid: false,
          error: 'Nothing to call.',
        };
      }

      if (stack < callAmount) {
        return {
          valid: false,
          error: 'Insufficient chips to call, use allIn.',
        };
      }

      return { valid: true };
    }

    if (action === 'allIn') {
      if (stack <= 0) {
        return {
          valid: false,
          error: 'No chips available for all-in.',
        };
      }

      return { valid: true };
    }

    if (action === 'raise') {
      if (amount === undefined) {
        return {
          valid: false,
          error: 'Raise amount is required.',
        };
      }

      if (!Number.isInteger(amount)) {
        return {
          valid: false,
          error: 'Raise amount must be an integer.',
        };
      }

      if (this.raiseClosedPlayers.has(playerId)) {
        return {
          valid: false,
          error: 'Action is not reopened for raise after incomplete all-in.',
        };
      }

      if (amount <= this.currentBet) {
        return {
          valid: false,
          error: 'Raise must be greater than current bet.',
        };
      }

      if (amount > maxRaise) {
        return {
          valid: false,
          error: 'Raise cannot exceed stack.',
        };
      }

      if (amount < minRaise) {
        return {
          valid: false,
          error: `Raise must be at least minimum raise (${minRaise}).`,
        };
      }

      return { valid: true };
    }

    return {
      valid: false,
      error: `Unsupported action: ${action}`,
    };
  }

  executeAction(playerId: string, action: PokerAction, amount?: number): ExecutionResult {
    const validation = this.validateAction(playerId, action, amount);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid action.');
    }

    const stackBeforeAction = this.stacks.get(playerId) ?? 0;
    const playerBetBeforeAction = this.betsPerPlayer.get(playerId) ?? 0;
    const currentBetBeforeAction = this.currentBet;
    const actedBeforeAction = new Set(this.actedPlayers);

    let contribution = 0;

    if (action === 'fold') {
      this.foldedPlayers.add(playerId);
      this.pendingPlayers.delete(playerId);
      this.actedPlayers.add(playerId);
    }

    if (action === 'check') {
      this.pendingPlayers.delete(playerId);
      this.actedPlayers.add(playerId);
    }

    if (action === 'call') {
      const callAmount = this.getCallAmount(playerId);
      contribution = callAmount;
      const newTotalBet = addChips(playerBetBeforeAction, callAmount);
      this.applyBet(playerId, newTotalBet);
      this.pendingPlayers.delete(playerId);
      this.actedPlayers.add(playerId);
    }

    if (action === 'raise') {
      const targetBet = amount as number;
      contribution = subtractChips(targetBet, playerBetBeforeAction);
      this.applyBet(playerId, targetBet);
      this.applyRaiseOutcome(playerId, currentBetBeforeAction, actedBeforeAction);
    }

    if (action === 'allIn') {
      const targetBet = addChips(playerBetBeforeAction, stackBeforeAction);
      contribution = stackBeforeAction;
      this.applyBet(playerId, targetBet);

      if (targetBet > currentBetBeforeAction) {
        this.applyRaiseOutcome(playerId, currentBetBeforeAction, actedBeforeAction);
      } else {
        this.pendingPlayers.delete(playerId);
        this.actedPlayers.add(playerId);
      }
    }

    this.cleanupPendingPlayers();

    if (this.getInHandPlayerCount() <= 1 || this.pendingPlayers.size === 0) {
      this.pendingPlayers.clear();
      this.activePlayerId = null;
    } else {
      const actorSeat = this.getSeatIndex(playerId);
      this.activePlayerId = this.findPendingPlayerFromSeat(actorSeat + 1);
    }

    const isAllIn = (this.stacks.get(playerId) ?? 0) === 0;
    return {
      bet: contribution,
      isAllIn,
    };
  }

  isRoundComplete(): boolean {
    if (this.getInHandPlayerCount() <= 1) {
      return true;
    }

    return this.pendingPlayers.size === 0;
  }

  getNextActivePlayer(): string | null {
    if (this.pendingPlayers.size === 0) {
      return null;
    }

    return this.activePlayerId;
  }

  getBlindsOrder(seatIndices: number[]): { sbSeat: number; bbSeat: number; firstToAct: number } {
    if (seatIndices.length < 2) {
      throw new Error('At least 2 seats are required to post blinds.');
    }

    const sortedSeatIndices = sortSeatIndices(seatIndices);
    const buttonSeat = this.resolveButtonSeat(sortedSeatIndices);

    if (sortedSeatIndices.length === 2) {
      const sbSeat = buttonSeat;
      const bbSeat = getNextSeat(sortedSeatIndices, sbSeat);
      return {
        sbSeat,
        bbSeat,
        firstToAct: sbSeat,
      };
    }

    const sbSeat = getNextSeat(sortedSeatIndices, buttonSeat);
    const bbSeat = getNextSeat(sortedSeatIndices, sbSeat);
    const firstToAct = getNextSeat(sortedSeatIndices, bbSeat);

    return {
      sbSeat,
      bbSeat,
      firstToAct,
    };
  }

  private assertKnownPlayer(playerId: string): void {
    if (!this.stacks.has(playerId)) {
      throw new Error(`Unknown player: ${playerId}`);
    }
  }

  private getSeatIndex(playerId: string): number {
    const seatIndex = this.seatByPlayerId.get(playerId);
    if (seatIndex === undefined) {
      throw new Error(`Unknown seat for player: ${playerId}`);
    }

    return seatIndex;
  }

  private getSeatsWithChipsInHand(): number[] {
    const seatIndices: number[] = [];

    for (const playerId of this.playerIds) {
      const stack = this.stacks.get(playerId) ?? 0;
      if (stack <= 0 || this.foldedPlayers.has(playerId)) {
        continue;
      }

      seatIndices.push(this.getSeatIndex(playerId));
    }

    return sortSeatIndices(seatIndices);
  }

  private getPlayersAbleToAct(): string[] {
    return this.playerIds.filter((playerId) => this.canPlayerAct(playerId));
  }

  private canPlayerAct(playerId: string): boolean {
    const stack = this.stacks.get(playerId) ?? 0;
    return stack > 0 && !this.foldedPlayers.has(playerId) && !this.allInPlayers.has(playerId);
  }

  private resetPlayerStatusesForNewHand(): void {
    this.foldedPlayers.clear();
    this.allInPlayers.clear();

    for (const playerId of this.playerIds) {
      if ((this.stacks.get(playerId) ?? 0) === 0) {
        this.allInPlayers.add(playerId);
      }
    }
  }

  private resetRoundState(): void {
    this.currentBet = 0;
    this.lastRaise = this.config.bigBlind;
    this.lastAggressor = null;
    this.activePlayerId = null;
    this.actedPlayers.clear();
    this.raiseClosedPlayers.clear();
    this.pendingPlayers.clear();

    for (const playerId of this.playerIds) {
      this.betsPerPlayer.set(playerId, 0);
    }
  }

  private startPreFlopRound(): void {
    const activeSeats = this.getSeatsWithChipsInHand();
    if (activeSeats.length < 2) {
      return;
    }

    const { sbSeat, bbSeat, firstToAct } = this.getBlindsOrder(activeSeats);
    const sbPlayerId = this.playerIdBySeat.get(sbSeat);
    const bbPlayerId = this.playerIdBySeat.get(bbSeat);

    if (!sbPlayerId || !bbPlayerId) {
      throw new Error('Unable to resolve blind seats to players.');
    }

    const sbPosted = this.postBlind(sbPlayerId, this.config.smallBlind);
    const bbPosted = this.postBlind(bbPlayerId, this.config.bigBlind);
    this.currentBet = Math.max(sbPosted, bbPosted);
    this.lastRaise = this.config.bigBlind;

    this.pendingPlayers = new Set(this.getPlayersAbleToAct());
    this.cleanupPendingPlayers();
    this.activePlayerId = this.findPendingPlayerFromSeat(firstToAct);
  }

  private startPostFlopRound(): void {
    const playersAbleToAct = this.getPlayersAbleToAct();
    this.pendingPlayers = new Set(playersAbleToAct);
    this.cleanupPendingPlayers();

    if (this.pendingPlayers.size === 0) {
      this.activePlayerId = null;
      return;
    }

    const activeSeats = sortSeatIndices(
      playersAbleToAct.map((playerId) => this.getSeatIndex(playerId)),
    );

    const buttonSeat = this.resolveButtonSeat(activeSeats);
    const firstToAct = getNextSeat(activeSeats, buttonSeat);
    this.activePlayerId = this.findPendingPlayerFromSeat(firstToAct);
  }

  private resolveButtonSeat(activeSeats: number[]): number {
    if (activeSeats.includes(this.dealerSeatIndex)) {
      return this.dealerSeatIndex;
    }

    return getNextSeat(activeSeats, this.dealerSeatIndex);
  }

  private postBlind(playerId: string, blindAmount: number): number {
    const stack = this.stacks.get(playerId) ?? 0;
    if (stack === 0) {
      this.allInPlayers.add(playerId);
      return 0;
    }

    const postedAmount = Math.min(blindAmount, stack);
    const newStack = subtractChips(stack, postedAmount);
    const currentBet = this.betsPerPlayer.get(playerId) ?? 0;
    const updatedBet = addChips(currentBet, postedAmount);

    this.stacks.set(playerId, newStack);
    this.betsPerPlayer.set(playerId, updatedBet);

    if (newStack === 0) {
      this.allInPlayers.add(playerId);
    }

    return postedAmount;
  }

  private getCallAmount(playerId: string): number {
    const playerBet = this.betsPerPlayer.get(playerId) ?? 0;
    if (playerBet >= this.currentBet) {
      return 0;
    }

    return subtractChips(this.currentBet, playerBet);
  }

  private getMinRaiseAmount(): number {
    return addChips(this.currentBet, this.lastRaise);
  }

  private applyBet(playerId: string, targetTotalBet: number): void {
    const stack = this.stacks.get(playerId) ?? 0;
    const currentPlayerBet = this.betsPerPlayer.get(playerId) ?? 0;
    const contribution = subtractChips(targetTotalBet, currentPlayerBet);
    const updatedStack = subtractChips(stack, contribution);

    this.stacks.set(playerId, updatedStack);
    this.betsPerPlayer.set(playerId, targetTotalBet);

    if (targetTotalBet > this.currentBet) {
      this.currentBet = targetTotalBet;
    }

    if (updatedStack === 0) {
      this.allInPlayers.add(playerId);
    }
  }

  private applyRaiseOutcome(playerId: string, previousCurrentBet: number, actedBeforeAction: Set<string>): void {
    const raiseIncrement = subtractChips(this.currentBet, previousCurrentBet);
    const isFullRaise = raiseIncrement >= this.lastRaise;

    this.lastAggressor = playerId;

    if (isFullRaise) {
      this.lastRaise = raiseIncrement;
      this.raiseClosedPlayers.clear();
      this.pendingPlayers = new Set(
        this.getPlayersAbleToAct().filter((otherPlayerId) => otherPlayerId !== playerId),
      );
      this.actedPlayers.clear();
      this.actedPlayers.add(playerId);
      return;
    }

    for (const actedPlayerId of actedBeforeAction) {
      if (actedPlayerId !== playerId && this.canPlayerAct(actedPlayerId)) {
        this.raiseClosedPlayers.add(actedPlayerId);
      }
    }

    this.pendingPlayers = new Set(
      this.getPlayersAbleToAct().filter((otherPlayerId) => {
        if (otherPlayerId === playerId) {
          return false;
        }

        const otherBet = this.betsPerPlayer.get(otherPlayerId) ?? 0;
        return otherBet < this.currentBet;
      }),
    );

    this.actedPlayers.add(playerId);
  }

  private cleanupPendingPlayers(): void {
    this.pendingPlayers = new Set(
      [...this.pendingPlayers].filter((playerId) => this.canPlayerAct(playerId)),
    );
  }

  private findPendingPlayerFromSeat(startSeat: number): string | null {
    const pendingSeatIndices = sortSeatIndices(
      [...this.pendingPlayers].map((playerId) => this.getSeatIndex(playerId)),
    );

    if (pendingSeatIndices.length === 0) {
      return null;
    }

    const nextSeat = pendingSeatIndices.find((seatIndex) => seatIndex >= startSeat) ?? pendingSeatIndices[0];
    return this.playerIdBySeat.get(nextSeat) ?? null;
  }

  private getInHandPlayerCount(): number {
    return this.playerIds.filter((playerId) => !this.foldedPlayers.has(playerId)).length;
  }
}
