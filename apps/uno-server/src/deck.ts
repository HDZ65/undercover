import { randomInt } from 'crypto'
import { INITIAL_HAND_SIZE } from '@uno/shared'
import type { Card, CardColor, CardValue, HouseRules } from '@uno/shared'

type ColoredDuplicateValue = Exclude<CardValue, '0'>

const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow']
const DUPLICATE_COLOR_VALUES: ColoredDuplicateValue[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'skip',
  'reverse',
  'draw2',
]

const isWildCard = (card: Card): boolean => card.value === 'wild' || card.value === 'wild-draw4'

export const createDeck = (): Card[] => {
  const deck: Card[] = []

  for (const color of COLORS) {
    deck.push({ id: `${color}-0-0`, color, value: '0' })

    for (const value of DUPLICATE_COLOR_VALUES) {
      deck.push({ id: `${color}-${value}-0`, color, value })
      deck.push({ id: `${color}-${value}-1`, color, value })
    }
  }

  for (let index = 0; index < 4; index += 1) {
    deck.push({ id: `wild-${index}`, color: null, value: 'wild' })
    deck.push({ id: `wild-draw4-${index}`, color: null, value: 'wild-draw4' })
  }

  return deck
}

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1)
    const currentCard = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = currentCard
  }

  return shuffled
}

export const isValidPlay = (
  card: Card,
  discardTop: Card,
  currentColor: CardColor,
  houseRules: HouseRules,
  pendingDrawStack: number,
): boolean => {
  if (pendingDrawStack > 0) {
    if (discardTop.value === 'draw2') {
      return houseRules.stackDrawTwo && card.value === 'draw2'
    }

    if (discardTop.value === 'wild-draw4') {
      return houseRules.stackDrawFour && card.value === 'wild-draw4'
    }
  }

  if (isWildCard(card)) {
    return true
  }

  if (card.color === currentColor) {
    return true
  }

  return card.value === discardTop.value
}

export const recycleDeck = (discardPile: Card[]): Card[] => {
  if (discardPile.length <= 1) {
    return []
  }

  const recyclableCards = discardPile.slice(0, -1)
  return shuffleDeck(recyclableCards)
}

export const drawCards = (
  drawPile: Card[],
  discardPile: Card[],
  count: number,
): { drawn: Card[]; newDrawPile: Card[]; newDiscardPile: Card[] } => {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('count must be a non-negative integer')
  }

  let cardsLeftToDraw = count
  let nextDrawPile = [...drawPile]
  let nextDiscardPile = [...discardPile]
  const drawn: Card[] = []

  while (cardsLeftToDraw > 0) {
    if (nextDrawPile.length === 0) {
      if (nextDiscardPile.length <= 1) {
        break
      }

      nextDrawPile = recycleDeck(nextDiscardPile)
      nextDiscardPile = [nextDiscardPile[nextDiscardPile.length - 1]]
    }

    if (nextDrawPile.length === 0) {
      break
    }

    const drawCount = Math.min(cardsLeftToDraw, nextDrawPile.length)
    drawn.push(...nextDrawPile.slice(0, drawCount))
    nextDrawPile = nextDrawPile.slice(drawCount)
    cardsLeftToDraw -= drawCount
  }

  return {
    drawn,
    newDrawPile: nextDrawPile,
    newDiscardPile: nextDiscardPile,
  }
}

export const getValidPlays = (
  hand: Card[],
  discardTop: Card,
  currentColor: CardColor,
  houseRules: HouseRules,
  pendingDrawStack: number,
): Card[] => {
  return hand.filter((card) => isValidPlay(card, discardTop, currentColor, houseRules, pendingDrawStack))
}

export const dealInitialHands = (
  deck: Card[],
  playerCount: number,
  handSize: number = INITIAL_HAND_SIZE,
): { hands: Card[][]; remainingDeck: Card[] } => {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw new Error('playerCount must be a positive integer')
  }

  if (!Number.isInteger(handSize) || handSize < 0) {
    throw new Error('handSize must be a non-negative integer')
  }

  const totalCardsToDeal = playerCount * handSize
  if (totalCardsToDeal > deck.length) {
    throw new Error(`Cannot deal ${totalCardsToDeal} cards from a deck of ${deck.length}`)
  }

  const hands = Array.from({ length: playerCount }, () => [] as Card[])
  let nextDeckIndex = 0

  for (let round = 0; round < handSize; round += 1) {
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      hands[playerIndex].push(deck[nextDeckIndex])
      nextDeckIndex += 1
    }
  }

  return {
    hands,
    remainingDeck: deck.slice(nextDeckIndex),
  }
}

export const getStartingDiscard = (drawPile: Card[]): { discard: Card; newDrawPile: Card[] } => {
  if (drawPile.length === 0) {
    throw new Error('Cannot pick a starting discard from an empty draw pile')
  }

  const onlyWildDrawFour = drawPile.every((card) => card.value === 'wild-draw4')
  if (onlyWildDrawFour) {
    throw new Error('Cannot pick a starting discard when all cards are Wild Draw Four')
  }

  let nextDrawPile = [...drawPile]

  while (nextDrawPile.length > 0) {
    const [candidate, ...remainingCards] = nextDrawPile

    if (candidate.value !== 'wild-draw4') {
      return {
        discard: candidate,
        newDrawPile: remainingCards,
      }
    }

    const insertIndex = randomInt(1, remainingCards.length + 1)
    nextDrawPile = [
      ...remainingCards.slice(0, insertIndex),
      candidate,
      ...remainingCards.slice(insertIndex),
    ]
  }

  throw new Error('Unable to determine a valid starting discard')
}
