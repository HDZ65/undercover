import { describe, expect, it } from 'vitest';
import { PotManager } from '../potManager';

const expectEligiblePlayers = (actual: string[], expected: string[]): void => {
  expect([...actual].sort()).toEqual([...expected].sort());
};

describe('potManager', () => {
  it('handles a simple pot where all players bet equally', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 100],
        ['bob', 100],
        ['carol', 100],
      ]),
      new Set<string>(),
    );

    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expectEligiblePlayers(pots[0].eligiblePlayerIds, ['alice', 'bob', 'carol']);
    expect(manager.getTotalPot()).toBe(300);

    const payouts = manager.distributePots(
      new Map<number, string[]>([[0, ['alice']]]),
      0,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
      ]),
    );

    expect(payouts).toEqual(new Map<string, number>([['alice', 300]]));
  });

  it('creates a single side pot for one all-in player', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 100],
        ['bob', 200],
        ['carol', 200],
      ]),
      new Set<string>(),
    );

    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(300);
    expectEligiblePlayers(pots[0].eligiblePlayerIds, ['alice', 'bob', 'carol']);
    expect(pots[1].amount).toBe(200);
    expectEligiblePlayers(pots[1].eligiblePlayerIds, ['bob', 'carol']);

    const payouts = manager.distributePots(
      new Map<number, string[]>([
        [0, ['alice']],
        [1, ['bob']],
      ]),
      1,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 300],
        ['bob', 200],
      ]),
    );
  });

  it('creates multiple side pots for different all-in thresholds', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 50],
        ['bob', 100],
        ['carol', 200],
      ]),
      new Set<string>(),
    );

    expect(pots).toHaveLength(3);
    expect(pots[0].amount).toBe(150);
    expectEligiblePlayers(pots[0].eligiblePlayerIds, ['alice', 'bob', 'carol']);
    expect(pots[1].amount).toBe(100);
    expectEligiblePlayers(pots[1].eligiblePlayerIds, ['bob', 'carol']);
    expect(pots[2].amount).toBe(100);
    expectEligiblePlayers(pots[2].eligiblePlayerIds, ['carol']);
  });

  it('prevents ghost side pots when a high bettor folds', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 10],
        ['bob', 100],
        ['carol', 100],
      ]),
      new Set<string>(['bob']),
    );

    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(30);
    expectEligiblePlayers(pots[0].eligiblePlayerIds, ['alice', 'carol']);
    expect(pots[1].amount).toBe(180);
    expectEligiblePlayers(pots[1].eligiblePlayerIds, ['carol']);

    const payouts = manager.distributePots(
      new Map<number, string[]>([
        [0, ['alice']],
        [1, ['alice', 'carol']],
      ]),
      2,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 30],
        ['carol', 180],
      ]),
    );
  });

  it('awards the odd chip to the player closest left of dealer', () => {
    const manager = new PotManager();

    manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 5],
        ['bob', 5],
        ['carol', 5],
        ['dave', 5],
        ['eve', 5],
      ]),
      new Set<string>(),
    );

    const payouts = manager.distributePots(
      new Map<number, string[]>([[0, ['alice', 'bob']]]),
      0,
      new Map<string, number>([
        ['eve', 0],
        ['alice', 1],
        ['carol', 2],
        ['bob', 3],
        ['dave', 4],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 13],
        ['bob', 12],
      ]),
    );
  });

  it('splits pots evenly between tied winners when no odd chip remains', () => {
    const manager = new PotManager();

    manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 100],
        ['bob', 100],
        ['carol', 100],
        ['dave', 100],
      ]),
      new Set<string>(),
    );

    const payouts = manager.distributePots(
      new Map<number, string[]>([[0, ['alice', 'bob']]]),
      3,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
        ['dave', 3],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 200],
        ['bob', 200],
      ]),
    );
  });

  it('handles three-way split with odd chip placement by dealer position', () => {
    const manager = new PotManager();

    manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 25],
        ['bob', 25],
        ['carol', 25],
        ['dave', 25],
      ]),
      new Set<string>(),
    );

    const payouts = manager.distributePots(
      new Map<number, string[]>([[0, ['alice', 'bob', 'carol']]]),
      0,
      new Map<string, number>([
        ['dave', 0],
        ['carol', 1],
        ['alice', 2],
        ['bob', 3],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['carol', 34],
        ['alice', 33],
        ['bob', 33],
      ]),
    );
  });

  it('excludes folded players from every pot eligibility list', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 50],
        ['bob', 100],
        ['carol', 100],
        ['dave', 100],
      ]),
      new Set<string>(['dave']),
    );

    expect(pots).toHaveLength(2);
    expectEligiblePlayers(pots[0].eligiblePlayerIds, ['alice', 'bob', 'carol']);
    expectEligiblePlayers(pots[1].eligiblePlayerIds, ['bob', 'carol']);

    const payouts = manager.distributePots(
      new Map<number, string[]>([
        [0, ['alice', 'dave']],
        [1, ['dave', 'carol']],
      ]),
      3,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
        ['dave', 3],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 200],
        ['carol', 150],
      ]),
    );
  });

  it('caps all-in player winnings to each opponent contribution level', () => {
    const manager = new PotManager();

    const pots = manager.calculateSidePots(
      new Map<string, number>([
        ['alice', 50],
        ['bob', 200],
        ['carol', 200],
      ]),
      new Set<string>(),
    );

    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150);
    expect(pots[1].amount).toBe(300);

    const payouts = manager.distributePots(
      new Map<number, string[]>([
        [0, ['alice']],
        [1, ['alice', 'bob']],
      ]),
      2,
      new Map<string, number>([
        ['alice', 0],
        ['bob', 1],
        ['carol', 2],
      ]),
    );

    expect(payouts).toEqual(
      new Map<string, number>([
        ['alice', 150],
        ['bob', 300],
      ]),
    );
  });
});
