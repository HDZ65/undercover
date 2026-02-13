import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@undercover/shared';
import {
  burnCard,
  createDeck,
  dealCards,
  dealCommunityCards,
  dealHoleCards,
  shuffleDeck,
} from '../deck';

const toCardKey = (card: Card): string => `${card.rank}-${card.suit}`;

describe('deck', () => {
  it('createDeck returns 52 unique cards with all suit/rank combinations', () => {
    const deck = createDeck();
    const cardKeys = deck.map(toCardKey);

    expect(deck).toHaveLength(52);
    expect(new Set(cardKeys).size).toBe(52);
    expect(cardKeys).toContain('2-hearts');
    expect(cardKeys).toContain('A-spades');
    expect(cardKeys).toContain('10-diamonds');
    expect(cardKeys).toContain('K-clubs');
  });

  it('shuffleDeck uses crypto.getRandomValues and keeps the same unique cards', () => {
    const deck = createDeck();
    const originalDeck = [...deck];
    const randomSpy = vi.spyOn(globalThis.crypto, 'getRandomValues');

    const shuffled = shuffleDeck(deck);

    expect(randomSpy).toHaveBeenCalled();
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(toCardKey)).size).toBe(52);
    expect(new Set(shuffled.map(toCardKey))).toEqual(new Set(deck.map(toCardKey)));
    expect(shuffled).not.toBe(deck);
    expect(deck).toEqual(originalDeck);

    randomSpy.mockRestore();
  });

  it('shuffleDeck produces different orderings across multiple shuffles', () => {
    const deck = createDeck();
    const orderings = new Set<string>();

    for (let index = 0; index < 10; index += 1) {
      const shuffled = shuffleDeck(deck);
      orderings.add(shuffled.map(toCardKey).join(','));
    }

    expect(orderings.size).toBeGreaterThan(1);
  });

  it('dealCards returns dealt and remaining cards without mutating input', () => {
    const deck = createDeck();
    const originalDeck = [...deck];

    const { dealt, remaining } = dealCards(deck, 5);

    expect(dealt).toEqual(deck.slice(0, 5));
    expect(remaining).toEqual(deck.slice(5));
    expect(deck).toEqual(originalDeck);
  });

  it('burnCard removes the top card and returns a new remaining deck', () => {
    const deck = createDeck();
    const originalDeck = [...deck];

    const { burned, remaining } = burnCard(deck);

    expect(burned).toEqual(deck[0]);
    expect(remaining).toEqual(deck.slice(1));
    expect(deck).toEqual(originalDeck);
  });

  it('dealHoleCards deals two cards per player in round-robin order', () => {
    const deck = createDeck();
    const sixCards = deck.slice(0, 6);

    const { holeCardsByPlayer, remaining } = dealHoleCards(sixCards, 3);

    expect(holeCardsByPlayer).toHaveLength(3);
    expect(holeCardsByPlayer[0]).toEqual([sixCards[0], sixCards[3]]);
    expect(holeCardsByPlayer[1]).toEqual([sixCards[1], sixCards[4]]);
    expect(holeCardsByPlayer[2]).toEqual([sixCards[2], sixCards[5]]);
    expect(remaining).toEqual([]);
  });

  it('dealCommunityCards burns one then deals flop, turn, and river counts', () => {
    const deck = createDeck();

    const flop = dealCommunityCards(deck, 'flop');
    expect(flop.community).toHaveLength(3);
    expect(flop.burned).toEqual(deck[0]);
    expect(flop.community).toEqual(deck.slice(1, 4));
    expect(flop.remaining).toEqual(deck.slice(4));

    const turn = dealCommunityCards(deck, 'turn');
    expect(turn.community).toHaveLength(1);
    expect(turn.community).toEqual(deck.slice(1, 2));

    const river = dealCommunityCards(deck, 'river');
    expect(river.community).toHaveLength(1);
    expect(river.community).toEqual(deck.slice(1, 2));
  });

  it('full hand flow leaves 32 cards after 6 players and all community cards', () => {
    const deck = createDeck();

    const preFlop = dealHoleCards(deck, 6);
    const flop = dealCommunityCards(preFlop.remaining, 'flop');
    const turn = dealCommunityCards(flop.remaining, 'turn');
    const river = dealCommunityCards(turn.remaining, 'river');

    expect(preFlop.holeCardsByPlayer).toHaveLength(6);
    expect(preFlop.holeCardsByPlayer.every((cards) => cards.length === 2)).toBe(true);
    expect(flop.community).toHaveLength(3);
    expect(turn.community).toHaveLength(1);
    expect(river.community).toHaveLength(1);
    expect(river.remaining).toHaveLength(32);
  });
});
