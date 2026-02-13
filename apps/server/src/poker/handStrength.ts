import type { Card, EvaluatedHand, HandRank, Rank } from '@undercover/shared';
import { evaluateHand } from './handEvaluator';

/**
 * Pre-flop starting hand tier classification
 */
export type PreFlopTier = 'Premium' | 'Forte' | 'Jouable' | 'Spéculative' | 'Faible';

/**
 * Draw types detected in post-flop play
 */
export type DrawType = 'Tirage couleur' | 'Tirage quinte' | 'Tirage quinte par le ventre';

/**
 * Hand strength result with description and rank
 */
export interface HandStrengthResult {
  description: string;
  rank: HandRank;
}

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

/**
 * Normalize rank to comparable string for pre-flop classification
 */
const normalizeRank = (rank: Rank): string => {
  return rank === '10' ? 'T' : rank;
};

/**
 * Check if two cards are suited
 */
const isSuited = (card1: Card, card2: Card): boolean => {
  return card1.suit === card2.suit;
};

/**
 * Check if two cards are a pocket pair
 */
const isPocketPair = (card1: Card, card2: Card): boolean => {
  return card1.rank === card2.rank;
};

/**
 * Get sorted ranks from high to low
 */
const getSortedRanks = (card1: Card, card2: Card): [Rank, Rank] => {
  const strength1 = RANK_STRENGTH[card1.rank];
  const strength2 = RANK_STRENGTH[card2.rank];
  return strength1 >= strength2 ? [card1.rank, card2.rank] : [card2.rank, card1.rank];
};

/**
 * Check if two ranks are connectors (consecutive)
 */
const areConnectors = (rank1: Rank, rank2: Rank): boolean => {
  const strength1 = RANK_STRENGTH[rank1];
  const strength2 = RANK_STRENGTH[rank2];
  const diff = Math.abs(strength1 - strength2);
  return diff === 1 || (rank1 === 'A' && rank2 === '2') || (rank1 === '2' && rank2 === 'A');
};

/**
 * Check if two ranks have a 1-card gap
 */
const areOneGappers = (rank1: Rank, rank2: Rank): boolean => {
  const strength1 = RANK_STRENGTH[rank1];
  const strength2 = RANK_STRENGTH[rank2];
  const diff = Math.abs(strength1 - strength2);
  return diff === 2;
};

/**
 * Classify pre-flop starting hand into tiers
 * Based on standard starting hand charts
 */
export const classifyPreFlopHand = (holeCards: Card[]): PreFlopTier => {
  if (holeCards.length !== 2) {
    throw new Error(`Pre-flop classification requires exactly 2 hole cards. Received ${holeCards.length}.`);
  }

  const [card1, card2] = holeCards;
  const [highRank, lowRank] = getSortedRanks(card1, card2);
  const suited = isSuited(card1, card2);
  const pair = isPocketPair(card1, card2);

  // Premium (top 2%): AA, KK, QQ, AKs
  if (pair && (highRank === 'A' || highRank === 'K' || highRank === 'Q')) {
    return 'Premium';
  }
  if (highRank === 'A' && lowRank === 'K' && suited) {
    return 'Premium';
  }

  // Forte (top 5%): JJ, TT, AQs, AKo, AJs, KQs
  if (pair && (highRank === 'J' || highRank === '10')) {
    return 'Forte';
  }
  if (highRank === 'A' && lowRank === 'K' && !suited) {
    return 'Forte';
  }
  if (highRank === 'A' && (lowRank === 'Q' || lowRank === 'J') && suited) {
    return 'Forte';
  }
  if (highRank === 'K' && lowRank === 'Q' && suited) {
    return 'Forte';
  }

  // Jouable (top 15%): 99-77, ATs, AQo, KJs, QJs, JTs, suited connectors
  if (pair && ['9', '8', '7'].includes(highRank)) {
    return 'Jouable';
  }
  if (highRank === 'A' && lowRank === '10' && suited) {
    return 'Jouable';
  }
  if (highRank === 'A' && lowRank === 'Q' && !suited) {
    return 'Jouable';
  }
  if (highRank === 'K' && lowRank === 'J' && suited) {
    return 'Jouable';
  }
  if (highRank === 'Q' && lowRank === 'J' && suited) {
    return 'Jouable';
  }
  if (highRank === 'J' && lowRank === '10' && suited) {
    return 'Jouable';
  }
  if (suited && areConnectors(highRank, lowRank)) {
    return 'Jouable';
  }

  // Spéculative (top 30%): Small pairs (66-22), suited aces (A9s-A2s), suited gappers
  if (pair && ['6', '5', '4', '3', '2'].includes(highRank)) {
    return 'Spéculative';
  }
  if (highRank === 'A' && suited) {
    return 'Spéculative';
  }
  if (suited && areOneGappers(highRank, lowRank)) {
    return 'Spéculative';
  }

  // Faible (bottom 70%): Everything else
  return 'Faible';
};

/**
 * Get French description for pre-flop hand tier
 */
export const describePreFlopHand = (holeCards: Card[]): string => {
  const tier = classifyPreFlopHand(holeCards);
  return `Main ${tier}`;
};

/**
 * Detect flush draw (4 cards of same suit, need 1 more)
 */
const detectFlushDraw = (allCards: Card[]): boolean => {
  const suitCounts = new Map<Card['suit'], number>();

  for (const card of allCards) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }

  // Check if any suit has exactly 4 cards (flush draw)
  for (const count of suitCounts.values()) {
    if (count === 4) {
      return true;
    }
  }

  return false;
};

/**
 * Detect straight draws (open-ended and gutshot)
 * Returns array of draw types found
 */
const detectStraightDraws = (allCards: Card[]): DrawType[] => {
  const draws: DrawType[] = [];

  // Get unique ranks sorted by strength
  const uniqueRanks = [...new Set(allCards.map((card) => card.rank))];
  const sortedRanks = uniqueRanks.sort((a, b) => RANK_STRENGTH[a] - RANK_STRENGTH[b]);

  // Convert ranks to numeric values for gap detection
  const values = sortedRanks.map((rank) => RANK_STRENGTH[rank]);

  // Check for open-ended straight draw (4 consecutive ranks)
  for (let i = 0; i <= values.length - 4; i++) {
    const sequence = values.slice(i, i + 4);
    const isConsecutive = sequence.every((val, idx) => idx === 0 || val === sequence[idx - 1] + 1);

    if (isConsecutive) {
      draws.push('Tirage quinte');
      break; // Only report once
    }
  }

  // Check for gutshot (4 cards with exactly 1 gap)
  if (!draws.includes('Tirage quinte')) {
    for (let i = 0; i <= values.length - 4; i++) {
      for (let j = i + 1; j <= values.length - 3; j++) {
        for (let k = j + 1; k <= values.length - 2; k++) {
          for (let l = k + 1; l < values.length; l++) {
            const fourCards = [values[i], values[j], values[k], values[l]];
            const min = Math.min(...fourCards);
            const max = Math.max(...fourCards);

            // Check if span is exactly 5 (4 cards + 1 gap)
            if (max - min === 4) {
              // Check if there's exactly 1 missing card
              const expectedCards = [min, min + 1, min + 2, min + 3, min + 4];
              const missingCount = expectedCards.filter((val) => !fourCards.includes(val)).length;

              if (missingCount === 1) {
                draws.push('Tirage quinte par le ventre');
                return draws; // Only report once
              }
            }
          }
        }
      }
    }
  }

  // Special case: A-2-3-4 (wheel draw)
  if (uniqueRanks.includes('A') && uniqueRanks.includes('2') && uniqueRanks.includes('3') && uniqueRanks.includes('4')) {
    if (!draws.includes('Tirage quinte')) {
      draws.push('Tirage quinte');
    }
  }

  // Special case: A-K-Q-J (broadway draw)
  if (
    uniqueRanks.includes('A') &&
    uniqueRanks.includes('K') &&
    uniqueRanks.includes('Q') &&
    uniqueRanks.includes('J')
  ) {
    if (!draws.includes('Tirage quinte')) {
      draws.push('Tirage quinte');
    }
  }

  return draws;
};

/**
 * Calculate all draws (flush, straight, gutshot) from hole cards + community cards
 * Returns array of French draw descriptions
 */
export const calculateDraws = (holeCards: Card[], communityCards: Card[]): string[] => {
  if (holeCards.length !== 2) {
    throw new Error(`calculateDraws requires exactly 2 hole cards. Received ${holeCards.length}.`);
  }

  if (communityCards.length < 3 || communityCards.length > 5) {
    throw new Error(`calculateDraws requires 3-5 community cards. Received ${communityCards.length}.`);
  }

  const allCards = [...holeCards, ...communityCards];
  const draws: string[] = [];

  // Detect flush draw
  if (detectFlushDraw(allCards)) {
    draws.push('Tirage couleur');
  }

  // Detect straight draws
  const straightDraws = detectStraightDraws(allCards);
  draws.push(...straightDraws);

  return draws;
};

/**
 * Calculate current hand strength from hole cards + community cards
 * Returns description and rank
 */
export const calculateHandStrength = (holeCards: Card[], communityCards: Card[]): HandStrengthResult => {
  if (holeCards.length !== 2) {
    throw new Error(`calculateHandStrength requires exactly 2 hole cards. Received ${holeCards.length}.`);
  }

  // Pre-flop: classify starting hand
  if (communityCards.length === 0) {
    const tier = classifyPreFlopHand(holeCards);
    return {
      description: `Main ${tier}`,
      rank: 0, // No HandRank for pre-flop
    };
  }

  // Post-flop: evaluate hand using handEvaluator
  if (communityCards.length < 3 || communityCards.length > 5) {
    throw new Error(`calculateHandStrength requires 0, 3, 4, or 5 community cards. Received ${communityCards.length}.`);
  }

  const allCards = [...holeCards, ...communityCards];
  const evaluatedHand: EvaluatedHand = evaluateHand(allCards);

  return {
    description: evaluatedHand.description,
    rank: evaluatedHand.rank,
  };
};
