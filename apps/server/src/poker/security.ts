import type { PokerAction, PokerPrivateState, PokerPublicState } from '@undercover/shared';
import { calculateHandStrength } from './handStrength';
import type { PokerMachineContext } from './pokerMachine';

const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const DEFAULT_TIMER_TICK_MS = 1_000;
const DEFAULT_ACTION_RATE_LIMIT_MS = 500;
const DEFAULT_FREE_CHIP_LIMIT_CENTIMES = 100_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

type TimeoutAutoAction = Extract<PokerAction, 'check' | 'fold'>;

export function sanitizeStateForPlayer(
  fullState: PokerMachineContext,
  playerId: string,
): { public: PokerPublicState; private: PokerPrivateState } {
  const activePlayer = fullState.players.find((player) => player.id === fullState.bettingEngineState.activePlayerId);
  const player = fullState.players.find((candidate) => candidate.id === playerId);
  const ownHoleCards = [...(player?.holeCards ?? [])];

  const publicState: PokerPublicState = {
    phase: fullState.currentPhase,
    communityCards: [...fullState.communityCards],
    pots: [...fullState.potManagerState.pots],
    currentBet: fullState.bettingEngineState.currentBet,
    minRaise: fullState.bettingEngineState.minRaise,
    dealerSeatIndex: fullState.dealerSeatIndex,
    activeSeatIndex: activePlayer?.seatIndex ?? -1,
    players: fullState.players.map((tablePlayer) => ({
      id: tablePlayer.id,
      name: tablePlayer.name,
      chipStack: tablePlayer.chipStack,
      status: tablePlayer.status,
      seatIndex: tablePlayer.seatIndex,
      currentBet: tablePlayer.currentBet,
      hasCards: tablePlayer.holeCards !== null,
      avatar: tablePlayer.avatar,
    })),
    handNumber: fullState.handNumber,
    tableConfig: fullState.tableConfig,
  };

  const availableActions: PokerAction[] = [];
  const currentBet = fullState.bettingEngineState.currentBet;
  const playerBet = player?.currentBet ?? 0;
  const callAmount = Math.max(0, currentBet - playerBet);
  const isPlayersTurn = fullState.bettingEngineState.activePlayerId === playerId;

  if (isPlayersTurn && player) {
    availableActions.push('fold');

    if (callAmount === 0) {
      availableActions.push('check');
    } else {
      availableActions.push('call');
    }

    if (player.chipStack > callAmount) {
      availableActions.push('raise');
    }
    if (player.chipStack > 0) {
      availableActions.push('allIn');
    }
  }

  let handStrength: string | undefined;
  if (ownHoleCards.length === 2) {
    try {
      handStrength = calculateHandStrength(ownHoleCards, fullState.communityCards).description;
    } catch {
      handStrength = undefined;
    }
  }

  const privateState: PokerPrivateState = {
    playerId,
    holeCards: ownHoleCards,
    handStrength,
    availableActions,
    minBetAmount: fullState.bettingEngineState.minRaise,
    maxBetAmount: player?.chipStack ?? 0,
  };

  return { public: publicState, private: privateState };
}

export function checkIPCollusion(
  tableId: string,
  playerIP: string,
  existingPlayerIPs: Map<string, string>,
): { allowed: boolean; reason?: string } {
  if (playerIP.length === 0) {
    return { allowed: true };
  }

  for (const [existingPlayerId, existingIP] of existingPlayerIPs.entries()) {
    if (existingPlayerId && existingIP === playerIP) {
      return {
        allowed: false,
        reason: 'IP already at table',
      };
    }
  }

  void tableId;
  return { allowed: true };
}

export class ActionTimer {
  private readonly timers = new Map<
    string,
    {
      timeout: NodeJS.Timeout;
      tick: NodeJS.Timeout;
      token: number;
    }
  >();

  private tokenSeed = 0;

  constructor(
    private readonly emitTimer: (playerId: string, remainingMs: number) => void,
    private readonly canAutoCheck: (playerId: string) => boolean,
    private readonly applyAutoAction: (playerId: string, action: TimeoutAutoAction) => void,
    private readonly timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
    private readonly tickMs = DEFAULT_TIMER_TICK_MS,
  ) {}

  startTimer(playerId: string, callback: () => void): void {
    this.cancelTimer(playerId);

    const token = ++this.tokenSeed;
    const startAt = Date.now();

    this.emitTimer(playerId, this.timeoutMs);

    const tick = setInterval(() => {
      const active = this.timers.get(playerId);
      if (!active || active.token !== token) {
        return;
      }

      const elapsed = Date.now() - startAt;
      const remainingMs = Math.max(0, this.timeoutMs - elapsed);
      this.emitTimer(playerId, remainingMs);
    }, this.tickMs);

    tick.unref?.();

    const timeout = setTimeout(() => {
      const active = this.timers.get(playerId);
      if (!active || active.token !== token) {
        return;
      }

      this.cancelTimer(playerId);
      const action: TimeoutAutoAction = this.canAutoCheck(playerId) ? 'check' : 'fold';
      this.applyAutoAction(playerId, action);
      callback();
    }, this.timeoutMs);

    timeout.unref?.();

    this.timers.set(playerId, { timeout, tick, token });
  }

  cancelTimer(playerId: string): void {
    const active = this.timers.get(playerId);
    if (!active) {
      return;
    }

    clearTimeout(active.timeout);
    clearInterval(active.tick);
    this.timers.delete(playerId);
  }
}

export class ActionSequencer {
  private readonly expectedByPlayer = new Map<string, number>();
  private nextSequence = 1;

  getNextSequence(): number {
    const next = this.nextSequence;
    this.nextSequence += 1;
    return next;
  }

  validateAction(playerId: string, sequenceNumber: number): boolean {
    const expected = this.expectedByPlayer.get(playerId) ?? 1;
    if (sequenceNumber !== expected) {
      return false;
    }

    this.expectedByPlayer.set(playerId, expected + 1);
    return true;
  }

  resetPlayer(playerId: string): void {
    this.expectedByPlayer.delete(playerId);
  }
}

export class PlayerActionRateLimiter {
  private readonly lastActionAtByPlayer = new Map<string, number>();

  constructor(private readonly minIntervalMs = DEFAULT_ACTION_RATE_LIMIT_MS) {}

  tryConsume(playerId: string, nowMs = Date.now()): { allowed: boolean; retryAfterMs?: number } {
    const previousAt = this.lastActionAtByPlayer.get(playerId);
    if (previousAt !== undefined) {
      const elapsed = nowMs - previousAt;
      if (elapsed < this.minIntervalMs) {
        return {
          allowed: false,
          retryAfterMs: this.minIntervalMs - elapsed,
        };
      }
    }

    this.lastActionAtByPlayer.set(playerId, nowMs);
    return { allowed: true };
  }

  clear(playerId: string): void {
    this.lastActionAtByPlayer.delete(playerId);
  }
}

export class FreeChipGrantLimiter {
  private readonly grantsByIP = new Map<string, { windowStartMs: number; grantedCentimes: number }>();

  constructor(
    private readonly maxPerWindowCentimes = DEFAULT_FREE_CHIP_LIMIT_CENTIMES,
    private readonly windowMs = DAY_MS,
  ) {}

  tryGrant(ip: string, amountCentimes: number, nowMs = Date.now()): { allowed: boolean; remainingCentimes: number } {
    if (!Number.isInteger(amountCentimes) || amountCentimes <= 0) {
      return { allowed: false, remainingCentimes: this.maxPerWindowCentimes };
    }

    const existing = this.grantsByIP.get(ip);
    const shouldReset = !existing || nowMs - existing.windowStartMs >= this.windowMs;
    const windowStartMs = shouldReset ? nowMs : existing.windowStartMs;
    const grantedCentimes = shouldReset ? 0 : existing.grantedCentimes;

    if (grantedCentimes + amountCentimes > this.maxPerWindowCentimes) {
      return {
        allowed: false,
        remainingCentimes: Math.max(0, this.maxPerWindowCentimes - grantedCentimes),
      };
    }

    const nextGranted = grantedCentimes + amountCentimes;
    this.grantsByIP.set(ip, {
      windowStartMs,
      grantedCentimes: nextGranted,
    });

    return {
      allowed: true,
      remainingCentimes: Math.max(0, this.maxPerWindowCentimes - nextGranted),
    };
  }
}
