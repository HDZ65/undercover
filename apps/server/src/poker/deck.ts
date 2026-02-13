import { RANKS, SUITS } from '@undercover/shared';
import type { Card } from '@undercover/shared';

export type CommunityStreet = 'flop' | 'turn' | 'river';

const COMMUNITY_CARD_COUNTS: Record<CommunityStreet, number> = {
  flop: 3,
  turn: 1,
  river: 1,
};

const UINT32_RANGE = 0x1_0000_0000;

const getCryptoRandomIndex = (maxExclusive: number): number => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be greater than 0.');
  }

  const unbiasedUpperBound = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  let candidate = 0;
  do {
    candidate = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (candidate >= unbiasedUpperBound);

  return candidate % maxExclusive;
};

export const createDeck = (): Card[] => {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = getCryptoRandomIndex(index + 1);
    const currentCard = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = currentCard;
  }

  return shuffled;
};

export const dealCards = (deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } => {
  if (count < 0) {
    throw new Error('Cannot deal a negative number of cards.');
  }

  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from a deck of ${deck.length}.`);
  }

  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
};

export const burnCard = (deck: Card[]): { burned: Card; remaining: Card[] } => {
  if (deck.length === 0) {
    throw new Error('Cannot burn a card from an empty deck.');
  }

  return {
    burned: deck[0],
    remaining: deck.slice(1),
  };
};

export const dealHoleCards = (
  deck: Card[],
  playerCount: number,
): { holeCardsByPlayer: Card[][]; remaining: Card[] } => {
  if (playerCount <= 0) {
    throw new Error('playerCount must be greater than 0.');
  }

  const requiredCards = playerCount * 2;
  const { dealt, remaining } = dealCards(deck, requiredCards);

  const holeCardsByPlayer = Array.from({ length: playerCount }, (_, playerIndex) => [
    dealt[playerIndex],
    dealt[playerIndex + playerCount],
  ]);

  return {
    holeCardsByPlayer,
    remaining,
  };
};

export const dealCommunityCards = (
  deck: Card[],
  street: CommunityStreet,
): { burned: Card; community: Card[]; remaining: Card[] } => {
  const burnResult = burnCard(deck);
  const cardCount = COMMUNITY_CARD_COUNTS[street];
  const dealResult = dealCards(burnResult.remaining, cardCount);

  return {
    burned: burnResult.burned,
    community: dealResult.dealt,
    remaining: dealResult.remaining,
  };
};
