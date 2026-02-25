import { UNO_CATCH_WINDOW_MS } from './shared.js'
import { getValidPlays, isValidPlay } from './deck.js'
import type { UnoMachineEvent, UnoMachineContext } from './unoMachine.js'

const NUMBER_CARD_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])

type EventWithPlayerId = Extract<UnoMachineEvent, { playerId: string }>

const hasPlayerId = (event: UnoMachineEvent): event is EventWithPlayerId => {
  return 'playerId' in event && typeof event.playerId === 'string'
}

const getCurrentPlayer = (context: UnoMachineContext) => {
  return context.players.find((player) => player.id === context.currentPlayerId)
}

export const unoGuards = {
  hasEnoughPlayers: ({ context }: { context: UnoMachineContext }) => {
    return context.players.length >= 2 && context.players.length <= 8
  },

  isCurrentPlayer: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (!hasPlayerId(event)) {
      return false
    }

    return context.currentPlayerId === event.playerId
  },

  isValidCardPlay: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (event.type !== 'PLAY_CARD') {
      return false
    }

    const player = context.players.find((candidate) => candidate.id === event.playerId)
    if (!player) {
      return false
    }

    const card = player.hand.find((candidate) => candidate.id === event.cardId)
    if (!card) {
      return false
    }

    const discardTop = context.discardPile[context.discardPile.length - 1]
    if (!discardTop) {
      return false
    }

    return isValidPlay(
      card,
      discardTop,
      context.currentColor,
      context.houseRules,
      context.pendingDrawStack,
    )
  },

  isValidMultiCardPlay: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (event.type !== 'PLAY_CARDS') {
      return false
    }

    if (event.cardIds.length < 2) {
      return false
    }

    if (new Set(event.cardIds).size !== event.cardIds.length) {
      return false
    }

    const player = context.players.find((candidate) => candidate.id === event.playerId)
    if (!player) {
      return false
    }

    const cards = event.cardIds.map((cardId) => player.hand.find((candidate) => candidate.id === cardId))
    if (cards.some((card) => !card)) {
      return false
    }

    const playedCards = cards.filter((card): card is NonNullable<typeof card> => Boolean(card))
    const baseValue = playedCards[0]?.value
    if (!baseValue || !NUMBER_CARD_VALUES.has(baseValue)) {
      return false
    }

    if (!playedCards.every((card) => card.value === baseValue && NUMBER_CARD_VALUES.has(card.value))) {
      return false
    }

    const discardTop = context.discardPile[context.discardPile.length - 1]
    if (!discardTop) {
      return false
    }

    return playedCards.some((card) =>
      isValidPlay(
        card,
        discardTop,
        context.currentColor,
        context.houseRules,
        context.pendingDrawStack,
      ),
    )
  },

  canDraw: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (event.type !== 'DRAW_CARD') {
      return false
    }

    return context.currentPlayerId === event.playerId && !context.hasDrawnThisTurn
  },

  roundOver: ({ context }: { context: UnoMachineContext }) => {
    return context.players.some((player) => player.hand.length === 0)
  },

  gameOver: ({ context }: { context: UnoMachineContext }) => {
    return Object.values(context.scores).some((score) => score >= context.targetScore)
  },

  hasCalledUno: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (!hasPlayerId(event)) {
      return false
    }

    const player = context.players.find((candidate) => candidate.id === event.playerId)
    if (!player) {
      return false
    }

    if (player.hasCalledUno) {
      return true
    }

    if (player.unoCallTime === null) {
      return false
    }

    return Date.now() - player.unoCallTime <= UNO_CATCH_WINDOW_MS
  },

  canCatchUno: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (event.type !== 'CATCH_UNO') {
      return false
    }

    if (event.playerId === event.targetId) {
      return false
    }

    const targetPlayer = context.players.find((player) => player.id === event.targetId)
    if (!targetPlayer) {
      return false
    }

    if (targetPlayer.hand.length !== 1 || targetPlayer.hasCalledUno || targetPlayer.unoCallTime === null) {
      return false
    }

    return Date.now() - targetPlayer.unoCallTime <= UNO_CATCH_WINDOW_MS
  },

  isBluffChallenge: ({ context }: { context: UnoMachineContext }) => {
    return context.houseRules.bluffChallenge && context.lastPlayedCard?.value === 'wild-draw4'
  },

  wasBluffing: ({ context }: { context: UnoMachineContext }) => {
    return Boolean(context.challengeState?.wasBluffing)
  },

  canStack: ({ context }: { context: UnoMachineContext }) => {
    if (context.pendingDrawStack <= 0) {
      return false
    }

    const currentPlayer = getCurrentPlayer(context)
    if (!currentPlayer || !context.lastPlayedCard) {
      return false
    }

    if (context.lastPlayedCard.value === 'draw2') {
      return context.houseRules.stackDrawTwo && currentPlayer.hand.some((card) => card.value === 'draw2')
    }

    if (context.lastPlayedCard.value === 'wild-draw4') {
      return (
        context.houseRules.stackDrawFour &&
        currentPlayer.hand.some((card) => card.value === 'wild-draw4')
      )
    }

    return false
  },

  mustForcePlay: ({ context, event }: { context: UnoMachineContext; event: UnoMachineEvent }) => {
    if (!context.houseRules.forcePlay) {
      return false
    }

    const playerId = hasPlayerId(event) ? event.playerId : context.currentPlayerId
    const player = context.players.find((candidate) => candidate.id === playerId)
    const discardTop = context.discardPile[context.discardPile.length - 1]

    if (!player || !discardTop) {
      return false
    }

    const validPlays = getValidPlays(
      player.hand,
      discardTop,
      context.currentColor,
      context.houseRules,
      context.pendingDrawStack,
    )

    return validPlays.length > 0
  },

  turnTimerExpired: ({ context }: { context: UnoMachineContext }) => {
    return context.turnTimeRemaining <= 0
  },

  isDrawTwoActive: ({ context }: { context: UnoMachineContext }) => {
    return context.pendingDrawStack > 0 && context.lastPlayedCard?.value === 'draw2'
  },

  isDrawFourActive: ({ context }: { context: UnoMachineContext }) => {
    return context.pendingDrawStack > 0 && context.lastPlayedCard?.value === 'wild-draw4'
  },
}
