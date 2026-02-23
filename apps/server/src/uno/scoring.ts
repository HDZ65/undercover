import { CARD_POINTS } from './shared.js'
import type { Card } from './shared.js'

export const getCardPoints = (card: Card): number => {
  return CARD_POINTS[card.value]
}

export const calculateRoundScore = (loserHands: Card[][]): number => {
  return loserHands.reduce(
    (totalScore, hand) => totalScore + hand.reduce((handScore, card) => handScore + getCardPoints(card), 0),
    0,
  )
}
