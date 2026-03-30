import type { TamalouCard, TamalouSuit, TamalouRank } from '@undercover/shared'
import { TAMALOU_CARD_VALUES, TAMALOU_CARD_POWERS } from '@undercover/shared'

const SUITS: TamalouSuit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: TamalouRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck(): TamalouCard[] {
  const deck: TamalouCard[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  // Use 2 decks for 5+ players, 1 deck for 2-4
  return deck
}

export function createDoubleDeck(): TamalouCard[] {
  return [...createDeck(), ...createDeck()]
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardValue(card: TamalouCard): number {
  return TAMALOU_CARD_VALUES[card.rank]
}

export function cardPower(card: TamalouCard) {
  return TAMALOU_CARD_POWERS[card.rank]
}

export function handScore(hand: TamalouCard[]): number {
  return hand.reduce((sum, c) => sum + cardValue(c), 0)
}
