import { describe, expect, it } from 'vitest';
import { HandRank } from '@undercover/shared';
import type { Card } from '@undercover/shared';
import { compareHands, describeHand, evaluateHand, findWinners } from '../handEvaluator';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

const rankCounts = (cards: Card[]): Record<string, number> => {
  return cards.reduce<Record<string, number>>((counts, currentCard) => {
    counts[currentCard.rank] = (counts[currentCard.rank] ?? 0) + 1;
    return counts;
  }, {});
};

describe('handEvaluator', () => {
  describe('evaluateHand', () => {
    it.each<{
      label: string;
      cards: Card[];
      expectedRank: HandRank;
    }>([
      {
        label: 'high card',
        cards: [
          card('A', 'spades'),
          card('J', 'diamonds'),
          card('8', 'clubs'),
          card('6', 'hearts'),
          card('3', 'spades'),
        ],
        expectedRank: HandRank.HIGH_CARD,
      },
      {
        label: 'one pair',
        cards: [
          card('A', 'spades'),
          card('A', 'diamonds'),
          card('K', 'clubs'),
          card('9', 'hearts'),
          card('3', 'spades'),
        ],
        expectedRank: HandRank.ONE_PAIR,
      },
      {
        label: 'two pair',
        cards: [
          card('A', 'spades'),
          card('A', 'diamonds'),
          card('K', 'clubs'),
          card('K', 'hearts'),
          card('3', 'spades'),
        ],
        expectedRank: HandRank.TWO_PAIR,
      },
      {
        label: 'three of a kind',
        cards: [
          card('K', 'spades'),
          card('K', 'diamonds'),
          card('K', 'clubs'),
          card('9', 'hearts'),
          card('3', 'spades'),
        ],
        expectedRank: HandRank.THREE_OF_A_KIND,
      },
      {
        label: 'straight',
        cards: [
          card('5', 'spades'),
          card('6', 'diamonds'),
          card('7', 'clubs'),
          card('8', 'hearts'),
          card('9', 'spades'),
        ],
        expectedRank: HandRank.STRAIGHT,
      },
      {
        label: 'flush',
        cards: [
          card('A', 'hearts'),
          card('J', 'hearts'),
          card('8', 'hearts'),
          card('6', 'hearts'),
          card('3', 'hearts'),
        ],
        expectedRank: HandRank.FLUSH,
      },
      {
        label: 'full house',
        cards: [
          card('Q', 'spades'),
          card('Q', 'diamonds'),
          card('Q', 'clubs'),
          card('7', 'hearts'),
          card('7', 'spades'),
        ],
        expectedRank: HandRank.FULL_HOUSE,
      },
      {
        label: 'four of a kind',
        cards: [
          card('9', 'spades'),
          card('9', 'diamonds'),
          card('9', 'clubs'),
          card('9', 'hearts'),
          card('A', 'spades'),
        ],
        expectedRank: HandRank.FOUR_OF_A_KIND,
      },
      {
        label: 'straight flush',
        cards: [
          card('5', 'hearts'),
          card('6', 'hearts'),
          card('7', 'hearts'),
          card('8', 'hearts'),
          card('9', 'hearts'),
        ],
        expectedRank: HandRank.STRAIGHT_FLUSH,
      },
      {
        label: 'royal flush',
        cards: [
          card('10', 'spades'),
          card('J', 'spades'),
          card('Q', 'spades'),
          card('K', 'spades'),
          card('A', 'spades'),
        ],
        expectedRank: HandRank.ROYAL_FLUSH,
      },
    ])('detects $label', ({ cards, expectedRank }) => {
      const evaluated = evaluateHand(cards);

      expect(evaluated.rank).toBe(expectedRank);
      expect(evaluated.cards).toHaveLength(5);
    });

    it('orders all hand ranks from HIGH_CARD to ROYAL_FLUSH', () => {
      const orderedHands: Card[][] = [
        [
          card('A', 'spades'),
          card('J', 'diamonds'),
          card('8', 'clubs'),
          card('6', 'hearts'),
          card('3', 'spades'),
        ],
        [
          card('A', 'spades'),
          card('A', 'diamonds'),
          card('K', 'clubs'),
          card('9', 'hearts'),
          card('3', 'spades'),
        ],
        [
          card('A', 'spades'),
          card('A', 'diamonds'),
          card('K', 'clubs'),
          card('K', 'hearts'),
          card('3', 'spades'),
        ],
        [
          card('K', 'spades'),
          card('K', 'diamonds'),
          card('K', 'clubs'),
          card('9', 'hearts'),
          card('3', 'spades'),
        ],
        [
          card('5', 'spades'),
          card('6', 'diamonds'),
          card('7', 'clubs'),
          card('8', 'hearts'),
          card('9', 'spades'),
        ],
        [
          card('A', 'hearts'),
          card('J', 'hearts'),
          card('8', 'hearts'),
          card('6', 'hearts'),
          card('3', 'hearts'),
        ],
        [
          card('Q', 'spades'),
          card('Q', 'diamonds'),
          card('Q', 'clubs'),
          card('7', 'hearts'),
          card('7', 'spades'),
        ],
        [
          card('9', 'spades'),
          card('9', 'diamonds'),
          card('9', 'clubs'),
          card('9', 'hearts'),
          card('A', 'spades'),
        ],
        [
          card('5', 'hearts'),
          card('6', 'hearts'),
          card('7', 'hearts'),
          card('8', 'hearts'),
          card('9', 'hearts'),
        ],
        [
          card('10', 'spades'),
          card('J', 'spades'),
          card('Q', 'spades'),
          card('K', 'spades'),
          card('A', 'spades'),
        ],
      ];

      const evaluatedHands = orderedHands.map((cards) => evaluateHand(cards));

      for (let index = 1; index < evaluatedHands.length; index += 1) {
        expect(compareHands(evaluatedHands[index], evaluatedHands[index - 1])).toBe(1);
      }
    });

    it('uses kickers when primary rank is identical', () => {
      const pairOfAcesWithKing = evaluateHand([
        card('A', 'spades'),
        card('A', 'diamonds'),
        card('K', 'clubs'),
        card('9', 'hearts'),
        card('3', 'spades'),
      ]);
      const pairOfAcesWithQueen = evaluateHand([
        card('A', 'clubs'),
        card('A', 'hearts'),
        card('Q', 'diamonds'),
        card('9', 'clubs'),
        card('3', 'hearts'),
      ]);

      expect(compareHands(pairOfAcesWithKing, pairOfAcesWithQueen)).toBe(1);
      expect(compareHands(pairOfAcesWithQueen, pairOfAcesWithKing)).toBe(-1);
    });

    it('detects wheel straight (A-2-3-4-5) as the lowest straight', () => {
      const wheelStraight = evaluateHand([
        card('A', 'spades'),
        card('2', 'diamonds'),
        card('3', 'clubs'),
        card('4', 'hearts'),
        card('5', 'spades'),
      ]);
      const sixHighStraight = evaluateHand([
        card('2', 'spades'),
        card('3', 'diamonds'),
        card('4', 'clubs'),
        card('5', 'hearts'),
        card('6', 'spades'),
      ]);

      expect(wheelStraight.rank).toBe(HandRank.STRAIGHT);
      expect(compareHands(wheelStraight, sixHighStraight)).toBe(-1);
    });

    it('detects ace-high straight (10-J-Q-K-A) correctly', () => {
      const aceHighStraight = evaluateHand([
        card('10', 'spades'),
        card('J', 'diamonds'),
        card('Q', 'clubs'),
        card('K', 'hearts'),
        card('A', 'spades'),
      ]);
      const kingHighStraight = evaluateHand([
        card('9', 'spades'),
        card('10', 'diamonds'),
        card('J', 'clubs'),
        card('Q', 'hearts'),
        card('K', 'spades'),
      ]);

      expect(aceHighStraight.rank).toBe(HandRank.STRAIGHT);
      expect(compareHands(aceHighStraight, kingHighStraight)).toBe(1);
    });

    it('selects the best 5 cards out of 7 cards', () => {
      const evaluated = evaluateHand([
        card('A', 'spades'),
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('K', 'hearts'),
        card('K', 'spades'),
        card('2', 'diamonds'),
        card('3', 'clubs'),
      ]);

      expect(evaluated.rank).toBe(HandRank.FULL_HOUSE);
      expect(evaluated.cards).toHaveLength(5);

      const counts = rankCounts(evaluated.cards);
      expect(counts.A).toBe(3);
      expect(counts.K).toBe(2);
    });
  });

  describe('findWinners', () => {
    it('returns tie winners when best hands are identical (split pot)', () => {
      const winners = findWinners(
        new Map<string, Card[]>([
          ['alice', [card('2', 'clubs'), card('7', 'diamonds')]],
          ['bob', [card('3', 'spades'), card('8', 'clubs')]],
        ]),
        [
          card('10', 'hearts'),
          card('J', 'hearts'),
          card('Q', 'hearts'),
          card('K', 'hearts'),
          card('A', 'hearts'),
        ],
      );

      expect(winners).toHaveLength(1);
      expect(winners[0].winners).toEqual(['alice', 'bob']);
      expect(winners[0].hand.rank).toBe(HandRank.ROYAL_FLUSH);
    });

    it('returns ordered winner tiers from strongest to weakest hand', () => {
      const winners = findWinners(
        new Map<string, Card[]>([
          ['alice', [card('A', 'clubs'), card('A', 'hearts')]],
          ['bob', [card('K', 'clubs'), card('K', 'hearts')]],
          ['carol', [card('Q', 'clubs'), card('Q', 'hearts')]],
        ]),
        [
          card('A', 'spades'),
          card('2', 'diamonds'),
          card('7', 'clubs'),
          card('9', 'hearts'),
          card('J', 'spades'),
        ],
      );

      expect(winners).toHaveLength(3);
      expect(winners[0].winners).toEqual(['alice']);
      expect(winners[1].winners).toEqual(['bob']);
      expect(winners[2].winners).toEqual(['carol']);
    });
  });

  describe('describeHand', () => {
    it('returns French description for paire and brelan', () => {
      const pairOfAces = evaluateHand([
        card('A', 'spades'),
        card('A', 'diamonds'),
        card('K', 'clubs'),
        card('9', 'hearts'),
        card('3', 'spades'),
      ]);
      const threeKings = evaluateHand([
        card('K', 'spades'),
        card('K', 'diamonds'),
        card('K', 'clubs'),
        card('9', 'hearts'),
        card('3', 'spades'),
      ]);

      expect(describeHand(pairOfAces, 'fr')).toBe("Paire d'As");
      expect(describeHand(threeKings, 'fr')).toBe('Brelan de Rois');
    });

    it('returns French description for royal flush', () => {
      const royalFlush = evaluateHand([
        card('10', 'spades'),
        card('J', 'spades'),
        card('Q', 'spades'),
        card('K', 'spades'),
        card('A', 'spades'),
      ]);

      expect(describeHand(royalFlush, 'fr')).toBe('Quinte Flush Royale');
    });

    it('returns English description when locale is en', () => {
      const pairOfAces = evaluateHand([
        card('A', 'spades'),
        card('A', 'diamonds'),
        card('K', 'clubs'),
        card('9', 'hearts'),
        card('3', 'spades'),
      ]);

      expect(describeHand(pairOfAces, 'en')).toBe('Pair of Aces');
    });
  });
});
