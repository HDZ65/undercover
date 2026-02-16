import { assign } from 'xstate'
import {
  DEFAULT_TARGET_SCORE,
  DEFAULT_TURN_TIMER,
  INITIAL_HAND_SIZE,
  UNO_PENALTY_CARDS,
} from '@uno/shared'
import type { CardColor, HouseRules, PlayDirection } from '@uno/shared'
import { calculateRoundScore } from './scoring.js'
import { createDeck, dealInitialHands, drawCards, getStartingDiscard, shuffleDeck } from './deck.js'
import type { MachinePlayer, UnoMachineContext, UnoMachineEvent } from './unoMachine.js'

const assignUno = assign<UnoMachineContext, UnoMachineEvent, undefined, UnoMachineEvent, never>

const DEFAULT_COLOR: CardColor = 'red'

const DEFAULT_HOUSE_RULES: HouseRules = {
  stackDrawTwo: false,
  stackDrawFour: false,
  bluffChallenge: false,
  forcePlay: false,
}

const getPlayerIndex = (players: MachinePlayer[], playerId: string): number => {
  return players.findIndex((player) => player.id === playerId)
}

const getNextPlayerIndex = (
  players: MachinePlayer[],
  playerId: string,
  direction: PlayDirection,
  step: number = 1,
): number => {
  if (players.length === 0) {
    return -1
  }

  const currentIndex = getPlayerIndex(players, playerId)
  const baseIndex = currentIndex === -1 ? 0 : currentIndex
  const normalizedStep = step % players.length

  if (direction === 'clockwise') {
    return (baseIndex + normalizedStep) % players.length
  }

  return (baseIndex - normalizedStep + players.length) % players.length
}

const updatePlayer = (
  players: MachinePlayer[],
  playerId: string,
  updater: (player: MachinePlayer) => MachinePlayer,
): MachinePlayer[] => {
  return players.map((player) => {
    if (player.id !== playerId) {
      return player
    }

    return updater(player)
  })
}

const normalizeTargetScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_TARGET_SCORE
  }

  return Math.max(50, Math.floor(value))
}

const normalizeTurnTimer = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_TURN_TIMER
  }

  return Math.max(5, Math.floor(value))
}

const drawToPlayer = (
  context: UnoMachineContext,
  playerId: string,
  count: number,
): {
  players: MachinePlayer[]
  drawPile: UnoMachineContext['drawPile']
  discardPile: UnoMachineContext['discardPile']
} => {
  const drawResult = drawCards(context.drawPile, context.discardPile, count)
  const players = updatePlayer(context.players, playerId, (player) => ({
    ...player,
    hand: [...player.hand, ...drawResult.drawn],
    hasCalledUno: false,
    unoCallTime: null,
  }))

  return {
    players,
    drawPile: drawResult.newDrawPile,
    discardPile: drawResult.newDiscardPile,
  }
}

const resolveStackedDraw = (
  context: UnoMachineContext,
  cardsToAdd: number,
  stackCardValue: 'draw2' | 'wild-draw4',
  stackEnabled: boolean,
) => {
  if (context.players.length === 0 || !context.currentPlayerId) {
    return {}
  }

  const targetIndex = getNextPlayerIndex(
    context.players,
    context.currentPlayerId,
    context.playDirection,
    1,
  )
  const targetPlayer = context.players[targetIndex]
  if (!targetPlayer) {
    return {}
  }

  const totalPending = context.pendingDrawStack + cardsToAdd
  const targetCanStack =
    stackEnabled && targetPlayer.hand.some((card) => card.value === stackCardValue)

  if (targetCanStack) {
    return {
      pendingDrawStack: totalPending,
      currentPlayerId: targetPlayer.id,
      hasDrawnThisTurn: false,
      challengeState: null,
    }
  }

  const drawResult = drawCards(context.drawPile, context.discardPile, totalPending)
  const playersAfterDraw = updatePlayer(context.players, targetPlayer.id, (player) => ({
    ...player,
    hand: [...player.hand, ...drawResult.drawn],
    hasCalledUno: false,
    unoCallTime: null,
  }))

  const nextTurnIndex = getNextPlayerIndex(playersAfterDraw, targetPlayer.id, context.playDirection, 1)
  const nextPlayer = playersAfterDraw[nextTurnIndex]

  return {
    players: playersAfterDraw,
    drawPile: drawResult.newDrawPile,
    discardPile: drawResult.newDiscardPile,
    pendingDrawStack: 0,
    currentPlayerId: nextPlayer?.id ?? targetPlayer.id,
    hasDrawnThisTurn: false,
    challengeState: null,
  }
}

export const unoActions = {
  addPlayer: assignUno(({ context, event }) => {
    if (event.type !== 'ADD_PLAYER') {
      return {}
    }

    if (context.players.some((player) => player.id === event.playerId) || context.players.length >= 8) {
      return {}
    }

    const nextPlayers: MachinePlayer[] = [
      ...context.players,
      {
        id: event.playerId,
        name: event.name,
        avatar: event.avatar,
        hand: [],
        hasCalledUno: false,
        unoCallTime: null,
      },
    ]

    return {
      players: nextPlayers,
      scores: {
        ...context.scores,
        [event.playerId]: context.scores[event.playerId] ?? 0,
      },
      currentPlayerId: context.currentPlayerId || nextPlayers[0]?.id || '',
    }
  }),

  removePlayer: assignUno(({ context, event }) => {
    if (event.type !== 'REMOVE_PLAYER') {
      return {}
    }

    const nextPlayers = context.players.filter((player) => player.id !== event.playerId)
    const nextScores = Object.fromEntries(
      Object.entries(context.scores).filter(([playerId]) => playerId !== event.playerId),
    )

    if (nextPlayers.length === 0) {
      return {
        players: [],
        scores: {},
        currentPlayerId: '',
      }
    }

    const nextCurrentPlayerId =
      context.currentPlayerId === event.playerId
        ? nextPlayers[0].id
        : context.currentPlayerId

    return {
      players: nextPlayers,
      scores: nextScores,
      currentPlayerId: nextCurrentPlayerId,
    }
  }),

  setHouseRules: assignUno(({ event }) => {
    if (event.type !== 'SET_HOUSE_RULES') {
      return {}
    }

    return {
      houseRules: {
        ...event.houseRules,
      },
    }
  }),

  setTargetScore: assignUno(({ event }) => {
    if (event.type !== 'SET_TARGET_SCORE') {
      return {}
    }

    return {
      targetScore: normalizeTargetScore(event.targetScore),
    }
  }),

  setTurnTimer: assignUno(({ event }) => {
    if (event.type !== 'SET_TURN_TIMER') {
      return {}
    }

    const turnTimer = normalizeTurnTimer(event.turnTimer)

    return {
      turnTimer,
      turnTimeRemaining: turnTimer,
    }
  }),

  prepareGameStart: assignUno(({ context, event }) => {
    if (event.type !== 'START_GAME') {
      return {}
    }

    const turnTimer =
      typeof event.turnTimer === 'number' ? normalizeTurnTimer(event.turnTimer) : context.turnTimer

    return {
      houseRules: event.houseRules ? { ...event.houseRules } : context.houseRules,
      targetScore:
        typeof event.targetScore === 'number'
          ? normalizeTargetScore(event.targetScore)
          : context.targetScore,
      turnTimer,
      turnTimeRemaining: turnTimer,
      winner: null,
      gameWinner: null,
      pendingDrawStack: 0,
      challengeState: null,
      colorChooserId: null,
      hasDrawnThisTurn: false,
    }
  }),

  dealCards: assignUno(({ context }) => {
    if (context.players.length < 2) {
      return {}
    }

    const shuffledDeck = shuffleDeck(createDeck())
    const dealt = dealInitialHands(shuffledDeck, context.players.length, INITIAL_HAND_SIZE)
    const startingDiscard = getStartingDiscard(dealt.remainingDeck)

    let players: MachinePlayer[] = context.players.map((player, index) => ({
      ...player,
      hand: dealt.hands[index] ?? [],
      hasCalledUno: false,
      unoCallTime: null,
    }))

    let drawPile = startingDiscard.newDrawPile
    let discardPile = [startingDiscard.discard]
    let playDirection: PlayDirection = 'clockwise'
    let currentPlayerId = players[0]?.id ?? ''
    let colorChooserId: string | null = null

    if (startingDiscard.discard.value === 'skip' && currentPlayerId) {
      const skippedIndex = getNextPlayerIndex(players, currentPlayerId, playDirection, 1)
      currentPlayerId = players[skippedIndex]?.id ?? currentPlayerId
    }

    if (startingDiscard.discard.value === 'reverse') {
      playDirection = 'counterclockwise'

      if (players.length > 2 && currentPlayerId) {
        const reversedIndex = getNextPlayerIndex(players, currentPlayerId, playDirection, 1)
        currentPlayerId = players[reversedIndex]?.id ?? currentPlayerId
      }
    }

    if (startingDiscard.discard.value === 'draw2' && currentPlayerId) {
      const drawResult = drawCards(drawPile, discardPile, 2)
      drawPile = drawResult.newDrawPile
      discardPile = drawResult.newDiscardPile

      players = updatePlayer(players, currentPlayerId, (player) => ({
        ...player,
        hand: [...player.hand, ...drawResult.drawn],
        hasCalledUno: false,
        unoCallTime: null,
      }))

      const nextPlayerIndex = getNextPlayerIndex(players, currentPlayerId, playDirection, 1)
      currentPlayerId = players[nextPlayerIndex]?.id ?? currentPlayerId
    }

    if (startingDiscard.discard.value === 'wild' || startingDiscard.discard.value === 'wild-draw4') {
      colorChooserId = currentPlayerId
    }

    const scores = { ...context.scores }
    for (const player of players) {
      if (typeof scores[player.id] !== 'number') {
        scores[player.id] = 0
      }
    }

    return {
      players,
      drawPile,
      discardPile,
      currentColor: startingDiscard.discard.color ?? DEFAULT_COLOR,
      currentPlayerId,
      playDirection,
      pendingDrawStack: 0,
      hasDrawnThisTurn: false,
      scores,
      roundNumber: context.roundNumber + 1,
      winner: null,
      gameWinner: null,
      lastPlayedCard: startingDiscard.discard,
      challengeState: null,
      colorChooserId,
      turnTimeRemaining: context.turnTimer,
    }
  }),

  playCard: assignUno(({ context, event }) => {
    if (event.type !== 'PLAY_CARD') {
      return {}
    }

    const player = context.players.find((candidate) => candidate.id === event.playerId)
    if (!player) {
      return {}
    }

    const card = player.hand.find((candidate) => candidate.id === event.cardId)
    if (!card) {
      return {}
    }

    const playedAt = Date.now()
    const wasBluffingOnDrawFour =
      card.value === 'wild-draw4' &&
      player.hand.some(
        (candidate) => candidate.id !== card.id && candidate.color === context.currentColor,
      )

    const nextPlayers = context.players.map((candidate) => {
      if (candidate.id !== event.playerId) {
        return candidate
      }

      const nextHand = candidate.hand.filter((handCard) => handCard.id !== event.cardId)
      if (nextHand.length === 1) {
        return {
          ...candidate,
          hand: nextHand,
          hasCalledUno: candidate.hasCalledUno,
          unoCallTime: candidate.hasCalledUno ? candidate.unoCallTime ?? playedAt : playedAt,
        }
      }

      return {
        ...candidate,
        hand: nextHand,
        hasCalledUno: false,
        unoCallTime: null,
      }
    })

    const winner = nextPlayers.find((candidate) => candidate.hand.length === 0)?.id ?? null

    return {
      players: nextPlayers,
      discardPile: [...context.discardPile, card],
      currentColor: card.color ?? context.currentColor,
      hasDrawnThisTurn: false,
      winner,
      lastPlayedCard: card,
      challengeState:
        card.value === 'wild-draw4'
          ? {
              challengerId: '',
              challengedId: event.playerId,
              wasBluffing: wasBluffingOnDrawFour,
            }
          : null,
      colorChooserId: card.color === null ? event.playerId : null,
    }
  }),

  drawCard: assignUno(({ context, event }) => {
    if (event.type !== 'DRAW_CARD') {
      return {}
    }

    const player = context.players.find((candidate) => candidate.id === event.playerId)
    if (!player) {
      return {}
    }

    const drawCount = context.pendingDrawStack > 0 ? context.pendingDrawStack : 1
    const drawResult = drawCards(context.drawPile, context.discardPile, drawCount)

    const players = updatePlayer(context.players, event.playerId, (candidate) => ({
      ...candidate,
      hand: [...candidate.hand, ...drawResult.drawn],
      hasCalledUno: false,
      unoCallTime: null,
    }))

    return {
      players,
      drawPile: drawResult.newDrawPile,
      discardPile: drawResult.newDiscardPile,
      hasDrawnThisTurn: true,
      pendingDrawStack: context.pendingDrawStack > 0 ? 0 : context.pendingDrawStack,
      challengeState: null,
      colorChooserId: null,
    }
  }),

  skipNextPlayer: assignUno(({ context }) => {
    if (!context.currentPlayerId || context.players.length === 0) {
      return {}
    }

    const nextIndex = getNextPlayerIndex(context.players, context.currentPlayerId, context.playDirection, 2)
    const nextPlayer = context.players[nextIndex]

    return {
      currentPlayerId: nextPlayer?.id ?? context.currentPlayerId,
      hasDrawnThisTurn: false,
      challengeState: null,
      colorChooserId: null,
    }
  }),

  reverseDirection: assignUno(({ context }) => {
    if (!context.currentPlayerId || context.players.length === 0) {
      return {}
    }

    const nextDirection: PlayDirection =
      context.playDirection === 'clockwise' ? 'counterclockwise' : 'clockwise'

    if (context.players.length === 2) {
      return {
        playDirection: nextDirection,
        hasDrawnThisTurn: false,
        challengeState: null,
        colorChooserId: null,
      }
    }

    const nextIndex = getNextPlayerIndex(context.players, context.currentPlayerId, nextDirection, 1)
    const nextPlayer = context.players[nextIndex]

    return {
      playDirection: nextDirection,
      currentPlayerId: nextPlayer?.id ?? context.currentPlayerId,
      hasDrawnThisTurn: false,
      challengeState: null,
      colorChooserId: null,
    }
  }),

  applyDrawTwo: assignUno(({ context }) => {
    return resolveStackedDraw(context, 2, 'draw2', context.houseRules.stackDrawTwo)
  }),

  applyWildDrawFour: assignUno(({ context }) => {
    return resolveStackedDraw(context, 4, 'wild-draw4', context.houseRules.stackDrawFour)
  }),

  chooseColor: assignUno(({ event }) => {
    if (event.type !== 'CHOOSE_COLOR') {
      return {}
    }

    return {
      currentColor: event.color,
      colorChooserId: null,
    }
  }),

  resolveChallenge: assignUno(({ context, event }) => {
    if (event.type !== 'CHALLENGE_WD4' || !context.challengeState) {
      return {}
    }

    const challengerId = event.playerId
    const challengedId = context.challengeState.challengedId
    const wasBluffing = context.challengeState.wasBluffing

    if (wasBluffing) {
      const drawResult = drawCards(context.drawPile, context.discardPile, 4)
      const players = updatePlayer(context.players, challengedId, (player) => ({
        ...player,
        hand: [...player.hand, ...drawResult.drawn],
        hasCalledUno: false,
        unoCallTime: null,
      }))

      return {
        players,
        drawPile: drawResult.newDrawPile,
        discardPile: drawResult.newDiscardPile,
        pendingDrawStack: 0,
        currentPlayerId: challengerId,
        challengeState: null,
        hasDrawnThisTurn: false,
        colorChooserId: null,
      }
    }

    const drawResult = drawCards(context.drawPile, context.discardPile, 6)
    const players = updatePlayer(context.players, challengerId, (player) => ({
      ...player,
      hand: [...player.hand, ...drawResult.drawn],
      hasCalledUno: false,
      unoCallTime: null,
    }))

    const nextIndex = getNextPlayerIndex(players, challengerId, context.playDirection, 1)
    const nextPlayer = players[nextIndex]

    return {
      players,
      drawPile: drawResult.newDrawPile,
      discardPile: drawResult.newDiscardPile,
      pendingDrawStack: 0,
      currentPlayerId: nextPlayer?.id ?? challengerId,
      challengeState: null,
      hasDrawnThisTurn: false,
      colorChooserId: null,
    }
  }),

  advanceTurn: assignUno(({ context }) => {
    if (!context.currentPlayerId || context.players.length === 0) {
      return {}
    }

    const nextIndex = getNextPlayerIndex(context.players, context.currentPlayerId, context.playDirection, 1)
    const nextPlayer = context.players[nextIndex]

    return {
      currentPlayerId: nextPlayer?.id ?? context.currentPlayerId,
      hasDrawnThisTurn: false,
      challengeState: null,
      colorChooserId: null,
    }
  }),

  calculateScores: assignUno(({ context }) => {
    const winnerId = context.winner ?? context.players.find((player) => player.hand.length === 0)?.id
    if (!winnerId) {
      return {}
    }

    const losingHands = context.players
      .filter((player) => player.id !== winnerId)
      .map((player) => player.hand)
    const roundScore = calculateRoundScore(losingHands)

    const scores = {
      ...context.scores,
      [winnerId]: (context.scores[winnerId] ?? 0) + roundScore,
    }

    return {
      winner: winnerId,
      scores,
      gameWinner: scores[winnerId] >= context.targetScore ? winnerId : null,
    }
  }),

  callUno: assignUno(({ context, event }) => {
    if (event.type !== 'CALL_UNO') {
      return {}
    }

    if (!context.players.some((player) => player.id === event.playerId)) {
      return {}
    }

    return {
      players: updatePlayer(context.players, event.playerId, (player) => ({
        ...player,
        hasCalledUno: true,
        unoCallTime: Date.now(),
      })),
    }
  }),

  catchUno: assignUno(({ context, event }) => {
    if (event.type !== 'CATCH_UNO') {
      return {}
    }

    if (!context.players.some((player) => player.id === event.targetId)) {
      return {}
    }

    const drawResult = drawCards(context.drawPile, context.discardPile, UNO_PENALTY_CARDS)

    return {
      players: updatePlayer(context.players, event.targetId, (player) => ({
        ...player,
        hand: [...player.hand, ...drawResult.drawn],
        hasCalledUno: false,
        unoCallTime: null,
      })),
      drawPile: drawResult.newDrawPile,
      discardPile: drawResult.newDiscardPile,
    }
  }),

  startTurnTimer: assignUno(({ context }) => {
    return {
      turnTimeRemaining: context.turnTimer,
    }
  }),

  autoDrawOnTimeout: assignUno(({ context }) => {
    if (!context.currentPlayerId || context.players.length === 0) {
      return {}
    }

    const drawOutcome = drawToPlayer(context, context.currentPlayerId, 1)

    return {
      players: drawOutcome.players,
      drawPile: drawOutcome.drawPile,
      discardPile: drawOutcome.discardPile,
      turnTimeRemaining: 0,
      hasDrawnThisTurn: false,
      pendingDrawStack: 0,
      challengeState: null,
      colorChooserId: null,
    }
  }),

  initBotTimer: assignUno(() => {
    return {}
  }),

  resetRound: assignUno(({ context }) => {
    const players = context.players.map((player) => ({
      ...player,
      hand: [],
      hasCalledUno: false,
      unoCallTime: null,
    }))

    return {
      players,
      drawPile: [],
      discardPile: [],
      currentColor: DEFAULT_COLOR,
      currentPlayerId: players[0]?.id ?? '',
      playDirection: 'clockwise' as PlayDirection,
      pendingDrawStack: 0,
      hasDrawnThisTurn: false,
      winner: null,
      gameWinner: null,
      lastPlayedCard: null,
      challengeState: null,
      colorChooserId: null,
      turnTimeRemaining: context.turnTimer,
    }
  }),

  resetGame: assignUno(({ context }) => {
    const players = context.players.map((player) => ({
      ...player,
      hand: [],
      hasCalledUno: false,
      unoCallTime: null,
    }))

    const scores = players.reduce<Record<string, number>>((accumulator, player) => {
      accumulator[player.id] = 0
      return accumulator
    }, {})

    return {
      players,
      drawPile: [],
      discardPile: [],
      currentColor: DEFAULT_COLOR,
      currentPlayerId: '',
      playDirection: 'clockwise' as PlayDirection,
      pendingDrawStack: 0,
      hasDrawnThisTurn: false,
      turnTimer: DEFAULT_TURN_TIMER,
      turnTimeRemaining: DEFAULT_TURN_TIMER,
      targetScore: DEFAULT_TARGET_SCORE,
      houseRules: { ...DEFAULT_HOUSE_RULES },
      scores,
      roundNumber: 0,
      winner: null,
      gameWinner: null,
      lastPlayedCard: null,
      challengeState: null,
      colorChooserId: null,
      botTimers: new Map<string, NodeJS.Timeout>(),
    }
  }),
}
