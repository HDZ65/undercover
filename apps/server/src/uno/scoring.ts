import { CARD_POINTS } from '@uno/shared'
import type { Card } from '@uno/shared'

export const getCardPoints = (card: Card): number => {
  return CARD_POINTS[card.value]
}

export const calculateRoundScore = (loserHands: Card[][]): number => {
  return loserHands.reduce(
    (totalScore, hand) => totalScore + hand.reduce((handScore, card) => handScore + getCardPoints(card), 0),
    0,
  )
}
