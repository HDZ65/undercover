import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE_CONFIG } from '@undercover/shared';
import type { TableConfig } from '@undercover/shared';
import { BettingEngine } from '../bettingEngine';

const buildConfig = (overrides: Partial<TableConfig> = {}): TableConfig => {
  return {
    ...DEFAULT_TABLE_CONFIG,
    smallBlind: 50,
    bigBlind: 100,
    ...overrides,
  };
};

const createEngine = (
  playerStacks: Array<[string, number]>,
  dealerSeatIndex = 0,
  configOverrides: Partial<TableConfig> = {},
): BettingEngine => {
  return new BettingEngine(buildConfig(configOverrides), new Map(playerStacks), dealerSeatIndex);
};

describe('BettingEngine', () => {
  it('returns small blind, big blind, and first pre-flop actor for 3+ players', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
      ['d', 1_000],
    ]);

    expect(engine.getBlindsOrder([0, 1, 2, 3])).toEqual({
      sbSeat: 1,
      bbSeat: 2,
      firstToAct: 3,
    });
  });

  it('applies heads-up exception: dealer is SB, acts first pre-flop and last post-flop', () => {
    const engine = createEngine([
      ['dealer', 1_000],
      ['bigBlind', 1_000],
    ]);

    expect(engine.getBlindsOrder([0, 1])).toEqual({
      sbSeat: 0,
      bbSeat: 1,
      firstToAct: 0,
    });

    engine.startNewRound('preFlop');
    expect(engine.getNextActivePlayer()).toBe('dealer');

    engine.executeAction('dealer', 'call');
    engine.executeAction('bigBlind', 'check');
    expect(engine.isRoundComplete()).toBe(true);

    engine.startNewRound('flop');
    expect(engine.getNextActivePlayer()).toBe('bigBlind');
  });

  it('posts blinds at round start and computes per-player call amounts', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);

    engine.startNewRound('preFlop');

    expect(engine.getNextActivePlayer()).toBe('a');
    expect(engine.getAvailableActions('a').callAmount).toBe(100);
    expect(engine.getAvailableActions('b').callAmount).toBe(50);
    expect(engine.getAvailableActions('c').callAmount).toBe(0);
  });

  it('calculates minimum raise from big blind, then from last full raise increment', () => {
    const engine = createEngine([
      ['a', 2_000],
      ['b', 2_000],
      ['c', 2_000],
    ]);

    engine.startNewRound('preFlop');
    expect(engine.getAvailableActions('a').minRaise).toBe(200);

    engine.executeAction('a', 'raise', 300);

    const bActions = engine.getAvailableActions('b');
    expect(bActions.minRaise).toBe(500);
    expect(bActions.callAmount).toBe(250);
  });

  it('enforces full bet rule: short all-in does not reopen raise for player who already acted', () => {
    const engine = createEngine(
      [
        ['a', 1_000],
        ['b', 120],
        ['c', 1_000],
      ],
      2,
    );

    engine.startNewRound('flop');

    engine.executeAction('a', 'raise', 100);
    engine.executeAction('b', 'allIn');
    engine.executeAction('c', 'call');

    const aActions = engine.getAvailableActions('a');
    expect(engine.getNextActivePlayer()).toBe('a');
    expect(aActions.callAmount).toBe(20);
    expect(aActions.actions).toContain('call');
    expect(aActions.actions).not.toContain('raise');
  });

  it('keeps big blind option open after limps: BB can check or raise and is not skipped', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);

    engine.startNewRound('preFlop');
    engine.executeAction('a', 'call');
    engine.executeAction('b', 'call');

    expect(engine.getNextActivePlayer()).toBe('c');
    const bbActions = engine.getAvailableActions('c');
    expect(bbActions.callAmount).toBe(0);
    expect(bbActions.actions).toContain('check');
    expect(bbActions.actions).toContain('raise');
  });

  it('allows check only when not facing a bet', () => {
    const preFlopEngine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);
    preFlopEngine.startNewRound('preFlop');
    expect(preFlopEngine.getAvailableActions('a').actions).not.toContain('check');

    const postFlopEngine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);
    postFlopEngine.startNewRound('flop');
    const firstPlayer = postFlopEngine.getNextActivePlayer();
    expect(firstPlayer).not.toBeNull();
    expect(postFlopEngine.getAvailableActions(firstPlayer as string).actions).toContain('check');
  });

  it('computes call amount as currentBet minus playerCurrentBet', () => {
    const engine = createEngine([
      ['a', 2_000],
      ['b', 2_000],
      ['c', 2_000],
    ]);

    engine.startNewRound('preFlop');
    engine.executeAction('a', 'raise', 300);

    expect(engine.getAvailableActions('b').callAmount).toBe(250);
    expect(engine.getAvailableActions('c').callAmount).toBe(200);
  });

  it('allows all-in even when stack is below minimum raise amount', () => {
    const engine = createEngine(
      [
        ['a', 1_000],
        ['b', 140],
        ['c', 1_000],
      ],
      2,
    );

    engine.startNewRound('flop');
    engine.executeAction('a', 'raise', 100);

    expect(engine.validateAction('b', 'raise', 140).valid).toBe(false);
    expect(engine.validateAction('b', 'allIn').valid).toBe(true);

    const result = engine.executeAction('b', 'allIn');
    expect(result.isAllIn).toBe(true);
    expect(result.bet).toBe(140);
  });

  it('rejects action taken out of turn', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);

    engine.startNewRound('preFlop');
    const validation = engine.validateAction('b', 'call');

    expect(validation.valid).toBe(false);
    expect(validation.error).toMatch(/turn/i);
  });

  it('rejects raise below minimum when action is not all-in', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);

    engine.startNewRound('preFlop');
    const validation = engine.validateAction('a', 'raise', 150);

    expect(validation.valid).toBe(false);
    expect(validation.error).toMatch(/minimum raise/i);
  });

  it('marks round complete when all active players have acted and bets are equal', () => {
    const engine = createEngine([
      ['a', 1_000],
      ['b', 1_000],
      ['c', 1_000],
    ]);

    engine.startNewRound('preFlop');
    engine.executeAction('a', 'call');
    engine.executeAction('b', 'call');

    expect(engine.isRoundComplete()).toBe(false);

    engine.executeAction('c', 'check');

    expect(engine.isRoundComplete()).toBe(true);
    expect(engine.getNextActivePlayer()).toBeNull();
  });

  it('marks round complete when unmatched player is all-in and others have matched', () => {
    const engine = createEngine(
      [
        ['a', 1_000],
        ['b', 80],
        ['c', 1_000],
      ],
      2,
    );

    engine.startNewRound('flop');
    engine.executeAction('a', 'raise', 100);
    engine.executeAction('b', 'allIn');
    engine.executeAction('c', 'call');

    expect(engine.isRoundComplete()).toBe(true);
    expect(engine.getNextActivePlayer()).toBeNull();
  });
});
