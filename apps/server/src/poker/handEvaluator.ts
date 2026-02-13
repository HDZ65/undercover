import { evaluate as evaluateWithLibrary, getCardCode, rank as rankWithLibrary } from '@pokertools/evaluator';
import { HandRank } from '@undercover/shared';
import type { Card, EvaluatedHand, Rank } from '@undercover/shared';

type Locale = 'fr' | 'en';

type WinnerTier = {
  winners: string[];
  hand: EvaluatedHand;
};

type RankCount = [rank: Rank, count: number];

type HandEvaluationProvider = {
  evaluate: (cardCodes: number[]) => number;
  rank: (cardCodes: number[]) => number;
  toCardCode: (card: Card) => number;
};

const WORST_HAND_SCORE = 7_462;

const RANK_STRENGTH: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_TO_EVALUATOR: Record<Rank, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': 'T',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

const SUIT_TO_EVALUATOR: Record<Card['suit'], string> = {
  spades: 's',
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
};

const RANK_NAMES_EN_SINGULAR: Record<Rank, string> = {
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
};

const RANK_NAMES_EN_PLURAL: Record<Rank, string> = {
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  '10': 'Tens',
  J: 'Jacks',
  Q: 'Queens',
  K: 'Kings',
  A: 'Aces',
};

const RANK_NAMES_FR: Record<Rank, string> = {
  '2': 'Deux',
  '3': 'Trois',
  '4': 'Quatre',
  '5': 'Cinq',
  '6': 'Six',
  '7': 'Sept',
  '8': 'Huit',
  '9': 'Neuf',
  '10': 'Dix',
  J: 'Valets',
  Q: 'Dames',
  K: 'Rois',
  A: 'As',
};

const EVALUATOR_RANK = {
  STRAIGHT_FLUSH: 0,
  FOUR_OF_A_KIND: 1,
  FULL_HOUSE: 2,
  FLUSH: 3,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 5,
  TWO_PAIR: 6,
  ONE_PAIR: 7,
  HIGH_CARD: 8,
} as const;

const handEvaluationProvider: HandEvaluationProvider = {
  evaluate: evaluateWithLibrary,
  rank: rankWithLibrary,
  toCardCode: (card) => getCardCode(`${RANK_TO_EVALUATOR[card.rank]}${SUIT_TO_EVALUATOR[card.suit]}`),
};

const withFrenchDe = (label: string): string => {
  return /^[AEIOUaeiou]/.test(label) ? `d'${label}` : `de ${label}`;
};

const getSortedRanks = (cards: Card[]): Rank[] => {
  return cards
    .map((currentCard) => currentCard.rank)
    .sort((rankA, rankB) => RANK_STRENGTH[rankB] - RANK_STRENGTH[rankA]);
};

const getRankCounts = (cards: Card[]): RankCount[] => {
  const counts = new Map<Rank, number>();

  for (const currentCard of cards) {
    counts.set(currentCard.rank, (counts.get(currentCard.rank) ?? 0) + 1);
  }

  return [...counts.entries()].sort((entryA, entryB) => {
    if (entryA[1] !== entryB[1]) {
      return entryB[1] - entryA[1];
    }

    return RANK_STRENGTH[entryB[0]] - RANK_STRENGTH[entryA[0]];
  });
};

const getCombinationsOfFive = (cards: Card[]): Card[][] => {
  if (cards.length === 5) {
    return [cards];
  }

  const combinations: Card[][] = [];
  const current: Card[] = [];

  const build = (startIndex: number): void => {
    if (current.length === 5) {
      combinations.push([...current]);
      return;
    }

    const cardsStillRequired = 5 - current.length;
    const maxIndex = cards.length - cardsStillRequired;

    for (let index = startIndex; index <= maxIndex; index += 1) {
      current.push(cards[index]);
      build(index + 1);
      current.pop();
    }
  };

  build(0);

  return combinations;
};

const isRoyalFlushCards = (cards: Card[]): boolean => {
  if (cards.length !== 5) {
    return false;
  }

  const firstSuit = cards[0].suit;
  if (!cards.every((currentCard) => currentCard.suit === firstSuit)) {
    return false;
  }

  const ranks = new Set(cards.map((currentCard) => currentCard.rank));
  return ranks.has('10') && ranks.has('J') && ranks.has('Q') && ranks.has('K') && ranks.has('A');
};

const mapHandRank = (evaluatorRank: number, bestCards: Card[]): HandRank => {
  switch (evaluatorRank) {
    case EVALUATOR_RANK.HIGH_CARD:
      return HandRank.HIGH_CARD;
    case EVALUATOR_RANK.ONE_PAIR:
      return HandRank.ONE_PAIR;
    case EVALUATOR_RANK.TWO_PAIR:
      return HandRank.TWO_PAIR;
    case EVALUATOR_RANK.THREE_OF_A_KIND:
      return HandRank.THREE_OF_A_KIND;
    case EVALUATOR_RANK.STRAIGHT:
      return HandRank.STRAIGHT;
    case EVALUATOR_RANK.FLUSH:
      return HandRank.FLUSH;
    case EVALUATOR_RANK.FULL_HOUSE:
      return HandRank.FULL_HOUSE;
    case EVALUATOR_RANK.FOUR_OF_A_KIND:
      return HandRank.FOUR_OF_A_KIND;
    case EVALUATOR_RANK.STRAIGHT_FLUSH:
      return isRoyalFlushCards(bestCards) ? HandRank.ROYAL_FLUSH : HandRank.STRAIGHT_FLUSH;
    default:
      throw new Error(`Unsupported evaluator rank: ${evaluatorRank}`);
  }
};

const getBestFiveCardHand = (cards: Card[]): { cards: Card[]; score: number; rank: HandRank } => {
  const combinations = getCombinationsOfFive(cards);

  let bestCards = combinations[0];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestHandRank = HandRank.HIGH_CARD;

  for (const combination of combinations) {
    const codes = combination.map(handEvaluationProvider.toCardCode);
    const score = handEvaluationProvider.evaluate(codes);

    if (score < bestScore) {
      bestScore = score;
      bestCards = combination;
      bestHandRank = mapHandRank(handEvaluationProvider.rank(codes), combination);
    }
  }

  return {
    cards: bestCards,
    score: bestScore,
    rank: bestHandRank,
  };
};

const toComparableValue = (score: number): number => {
  return WORST_HAND_SCORE + 1 - score;
};

const describeHandInFrench = (hand: EvaluatedHand): string => {
  const rankCounts = getRankCounts(hand.cards);

  switch (hand.rank) {
    case HandRank.HIGH_CARD: {
      const highestRank = getSortedRanks(hand.cards)[0];
      return `Carte Haute ${RANK_NAMES_FR[highestRank]}`;
    }
    case HandRank.ONE_PAIR:
      return `Paire ${withFrenchDe(RANK_NAMES_FR[rankCounts[0][0]])}`;
    case HandRank.TWO_PAIR: {
      const [firstPair, secondPair] = rankCounts.filter((entry) => entry[1] === 2).map((entry) => entry[0]);
      return `Double Paire, ${RANK_NAMES_FR[firstPair]} et ${RANK_NAMES_FR[secondPair]}`;
    }
    case HandRank.THREE_OF_A_KIND:
      return `Brelan ${withFrenchDe(RANK_NAMES_FR[rankCounts[0][0]])}`;
    case HandRank.STRAIGHT:
      return 'Quinte';
    case HandRank.FLUSH:
      return 'Couleur';
    case HandRank.FULL_HOUSE: {
      const threeOfAKindRank = rankCounts.find((entry) => entry[1] === 3)?.[0];
      const pairRank = rankCounts.find((entry) => entry[1] === 2)?.[0];

      if (!threeOfAKindRank || !pairRank) {
        return 'Full';
      }

      return `Full, ${RANK_NAMES_FR[threeOfAKindRank]} par ${RANK_NAMES_FR[pairRank]}`;
    }
    case HandRank.FOUR_OF_A_KIND:
      return `Carre ${withFrenchDe(RANK_NAMES_FR[rankCounts[0][0]])}`;
    case HandRank.STRAIGHT_FLUSH:
      return 'Quinte Flush';
    case HandRank.ROYAL_FLUSH:
      return 'Quinte Flush Royale';
    default:
      return 'Main inconnue';
  }
};

const describeHandInEnglish = (hand: EvaluatedHand): string => {
  const rankCounts = getRankCounts(hand.cards);

  switch (hand.rank) {
    case HandRank.HIGH_CARD: {
      const highestRank = getSortedRanks(hand.cards)[0];
      return `High Card, ${RANK_NAMES_EN_SINGULAR[highestRank]}`;
    }
    case HandRank.ONE_PAIR:
      return `Pair of ${RANK_NAMES_EN_PLURAL[rankCounts[0][0]]}`;
    case HandRank.TWO_PAIR: {
      const [firstPair, secondPair] = rankCounts.filter((entry) => entry[1] === 2).map((entry) => entry[0]);
      return `Two Pair, ${RANK_NAMES_EN_PLURAL[firstPair]} and ${RANK_NAMES_EN_PLURAL[secondPair]}`;
    }
    case HandRank.THREE_OF_A_KIND:
      return `Three of a Kind, ${RANK_NAMES_EN_PLURAL[rankCounts[0][0]]}`;
    case HandRank.STRAIGHT:
      return 'Straight';
    case HandRank.FLUSH:
      return 'Flush';
    case HandRank.FULL_HOUSE: {
      const threeOfAKindRank = rankCounts.find((entry) => entry[1] === 3)?.[0];
      const pairRank = rankCounts.find((entry) => entry[1] === 2)?.[0];

      if (!threeOfAKindRank || !pairRank) {
        return 'Full House';
      }

      return `Full House, ${RANK_NAMES_EN_PLURAL[threeOfAKindRank]} over ${RANK_NAMES_EN_PLURAL[pairRank]}`;
    }
    case HandRank.FOUR_OF_A_KIND:
      return `Four of a Kind, ${RANK_NAMES_EN_PLURAL[rankCounts[0][0]]}`;
    case HandRank.STRAIGHT_FLUSH:
      return 'Straight Flush';
    case HandRank.ROYAL_FLUSH:
      return 'Royal Flush';
    default:
      return 'Unknown Hand';
  }
};

export const describeHand = (hand: EvaluatedHand, locale: Locale): string => {
  return locale === 'fr' ? describeHandInFrench(hand) : describeHandInEnglish(hand);
};

export const evaluateHand = (cards: Card[]): EvaluatedHand => {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`Hand evaluator requires 5 to 7 cards. Received ${cards.length}.`);
  }

  const bestHand = getBestFiveCardHand(cards);

  const evaluatedHand: EvaluatedHand = {
    rank: bestHand.rank,
    value: toComparableValue(bestHand.score),
    cards: [...bestHand.cards],
    description: '',
  };

  return {
    ...evaluatedHand,
    description: describeHand(evaluatedHand, 'fr'),
  };
};

export const compareHands = (handA: EvaluatedHand, handB: EvaluatedHand): -1 | 0 | 1 => {
  if (handA.value > handB.value) {
    return 1;
  }

  if (handA.value < handB.value) {
    return -1;
  }

  return 0;
};

export const findWinners = (playerHands: Map<string, Card[]>, communityCards: Card[]): WinnerTier[] => {
  if (communityCards.length !== 5) {
    throw new Error(`findWinners requires exactly 5 community cards. Received ${communityCards.length}.`);
  }

  const evaluatedPlayers = [...playerHands.entries()]
    .map(([playerId, holeCards], index) => ({
      playerId,
      hand: evaluateHand([...holeCards, ...communityCards]),
      index,
    }))
    .sort((playerA, playerB) => {
      const comparison = compareHands(playerB.hand, playerA.hand);

      if (comparison !== 0) {
        return comparison;
      }

      return playerA.index - playerB.index;
    });

  const winnerTiers: WinnerTier[] = [];

  for (const evaluatedPlayer of evaluatedPlayers) {
    const currentTier = winnerTiers[winnerTiers.length - 1];

    if (!currentTier || compareHands(evaluatedPlayer.hand, currentTier.hand) !== 0) {
      winnerTiers.push({
        winners: [evaluatedPlayer.playerId],
        hand: evaluatedPlayer.hand,
      });
      continue;
    }

    currentTier.winners.push(evaluatedPlayer.playerId);
  }

  return winnerTiers;
};
