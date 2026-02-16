import { DEFAULT_TARGET_SCORE, DEFAULT_TURN_TIMER } from '@uno/shared'
import type { Card, CardColor, HouseRules, PlayDirection } from '@uno/shared'
import { setup } from 'xstate'
import { unoActions } from './unoActions.js'
import { unoGuards } from './unoGuards.js'

export interface MachinePlayer {
  id: string
  name: string
  avatar?: string
  hand: Card[]
  hasCalledUno: boolean
  unoCallTime: number | null
}

export interface ChallengeState {
  challengerId: string
  challengedId: string
  wasBluffing: boolean
}

export interface UnoMachineContext {
  players: MachinePlayer[]
  drawPile: Card[]
  discardPile: Card[]
  currentColor: CardColor
  currentPlayerId: string
  playDirection: PlayDirection
  pendingDrawStack: number
  hasDrawnThisTurn: boolean
  turnTimer: number
  turnTimeRemaining: number
  targetScore: number
  houseRules: HouseRules
  scores: Record<string, number>
  roundNumber: number
  winner: string | null
  gameWinner: string | null
  lastPlayedCard: Card | null
  challengeState: ChallengeState | null
  colorChooserId: string | null
  botTimers: Map<string, NodeJS.Timeout>
}

export type UnoMachineEvent =
  | { type: 'ADD_PLAYER'; playerId: string; name: string; avatar?: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_HOUSE_RULES'; houseRules: HouseRules }
  | { type: 'SET_TARGET_SCORE'; targetScore: number }
  | { type: 'SET_TURN_TIMER'; turnTimer: number }
  | { type: 'START_GAME'; houseRules?: HouseRules; targetScore?: number; turnTimer?: number }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'CALL_UNO'; playerId: string }
  | { type: 'CATCH_UNO'; playerId: string; targetId: string }
  | { type: 'CHOOSE_COLOR'; playerId: string; color: CardColor }
  | { type: 'CHALLENGE_WD4'; playerId: string }
  | { type: 'ACCEPT_WD4'; playerId: string }
  | { type: 'TURN_TIMEOUT' }
  | { type: 'CONTINUE_NEXT_ROUND' }
  | { type: 'RESET_GAME' }

const isActionCard = (card: Card | null): boolean => {
  return (
    card?.value === 'skip' ||
    card?.value === 'reverse' ||
    card?.value === 'draw2' ||
    card?.value === 'wild-draw4'
  )
}

const defaultHouseRules: HouseRules = {
  stackDrawTwo: false,
  stackDrawFour: false,
  bluffChallenge: false,
  forcePlay: false,
}

export const initialContext: UnoMachineContext = {
  players: [],
  drawPile: [],
  discardPile: [],
  currentColor: 'red',
  currentPlayerId: '',
  playDirection: 'clockwise',
  pendingDrawStack: 0,
  hasDrawnThisTurn: false,
  turnTimer: DEFAULT_TURN_TIMER,
  turnTimeRemaining: DEFAULT_TURN_TIMER,
  targetScore: DEFAULT_TARGET_SCORE,
  houseRules: { ...defaultHouseRules },
  scores: {},
  roundNumber: 0,
  winner: null,
  gameWinner: null,
  lastPlayedCard: null,
  challengeState: null,
  colorChooserId: null,
  botTimers: new Map<string, NodeJS.Timeout>(),
}

export const unoMachine = setup({
  types: {
    context: {} as UnoMachineContext,
    events: {} as UnoMachineEvent,
  },
  guards: unoGuards,
  actions: unoActions,
}).createMachine({
  id: 'unoGame',
  initial: 'lobby',
  context: initialContext,
  states: {
    lobby: {
      on: {
        ADD_PLAYER: {
          actions: unoActions.addPlayer,
        },
        REMOVE_PLAYER: {
          actions: unoActions.removePlayer,
        },
        SET_HOUSE_RULES: {
          actions: unoActions.setHouseRules,
        },
        SET_TARGET_SCORE: {
          actions: unoActions.setTargetScore,
        },
        SET_TURN_TIMER: {
          actions: unoActions.setTurnTimer,
        },
        START_GAME: {
          guard: unoGuards.hasEnoughPlayers,
          target: 'dealing',
          actions: unoActions.prepareGameStart,
        },
        RESET_GAME: {
          actions: unoActions.resetGame,
        },
      },
    },

    dealing: {
      entry: unoActions.dealCards,
      always: {
        target: 'playerTurn',
      },
    },

    playerTurn: {
      entry: [unoActions.startTurnTimer, unoActions.initBotTimer],
      always: [
        {
          guard: ({ context }) => context.colorChooserId !== null,
          target: 'colorChoice',
        },
      ],
      on: {
        PLAY_CARD: {
          guard: ({ context, event }) => {
            return (
              unoGuards.isCurrentPlayer({ context, event }) &&
              unoGuards.isValidCardPlay({ context, event })
            )
          },
          target: 'postPlay',
          actions: unoActions.playCard,
        },
        DRAW_CARD: [
          {
            guard: unoGuards.mustForcePlay,
            target: 'playerTurn',
          },
          {
            guard: unoGuards.canDraw,
            target: 'checkRoundEnd',
            actions: [unoActions.drawCard, unoActions.advanceTurn],
          },
        ],
        CALL_UNO: {
          actions: unoActions.callUno,
        },
        CATCH_UNO: {
          guard: unoGuards.canCatchUno,
          actions: unoActions.catchUno,
        },
        TURN_TIMEOUT: {
          guard: unoGuards.turnTimerExpired,
          target: 'checkRoundEnd',
          actions: [unoActions.autoDrawOnTimeout, unoActions.advanceTurn],
        },
        RESET_GAME: {
          target: 'lobby',
          actions: unoActions.resetGame,
        },
      },
    },

    postPlay: {
      always: [
        {
          guard: ({ context }) => context.colorChooserId !== null,
          target: 'colorChoice',
        },
        {
          guard: unoGuards.isBluffChallenge,
          target: 'challengeWD4',
          actions: unoActions.advanceTurn,
        },
        {
          guard: ({ context }) => isActionCard(context.lastPlayedCard),
          target: 'applyEffect',
        },
        {
          target: 'checkRoundEnd',
          actions: unoActions.advanceTurn,
        },
      ],
    },

    colorChoice: {
      on: {
        CHOOSE_COLOR: {
          guard: unoGuards.isCurrentPlayer,
          target: 'postPlay',
          actions: unoActions.chooseColor,
        },
        RESET_GAME: {
          target: 'lobby',
          actions: unoActions.resetGame,
        },
      },
    },

    challengeWD4: {
      on: {
        CHALLENGE_WD4: [
          {
            guard: ({ context, event }) => {
              return (
                unoGuards.isCurrentPlayer({ context, event }) &&
                unoGuards.wasBluffing({ context })
              )
            },
            target: 'checkRoundEnd',
            actions: unoActions.resolveChallenge,
          },
          {
            guard: unoGuards.isCurrentPlayer,
            target: 'checkRoundEnd',
            actions: unoActions.resolveChallenge,
          },
        ],
        ACCEPT_WD4: {
          guard: unoGuards.isCurrentPlayer,
          target: 'applyEffect',
        },
        RESET_GAME: {
          target: 'lobby',
          actions: unoActions.resetGame,
        },
      },
    },

    applyEffect: {
      always: [
        {
          guard: ({ context }) => context.lastPlayedCard?.value === 'skip',
          target: 'checkRoundEnd',
          actions: unoActions.skipNextPlayer,
        },
        {
          guard: ({ context }) => context.lastPlayedCard?.value === 'reverse',
          target: 'checkRoundEnd',
          actions: unoActions.reverseDirection,
        },
        {
          guard: ({ context }) => context.lastPlayedCard?.value === 'draw2',
          target: 'checkRoundEnd',
          actions: unoActions.applyDrawTwo,
        },
        {
          guard: ({ context }) => context.lastPlayedCard?.value === 'wild-draw4',
          target: 'checkRoundEnd',
          actions: unoActions.applyWildDrawFour,
        },
        {
          target: 'checkRoundEnd',
        },
      ],
    },

    checkRoundEnd: {
      always: [
        {
          guard: unoGuards.roundOver,
          target: 'roundOver',
        },
        {
          target: 'playerTurn',
        },
      ],
    },

    roundOver: {
      entry: unoActions.calculateScores,
      on: {
        CONTINUE_NEXT_ROUND: {
          target: 'checkGameEnd',
        },
        RESET_GAME: {
          target: 'lobby',
          actions: unoActions.resetGame,
        },
      },
    },

    checkGameEnd: {
      always: [
        {
          guard: unoGuards.gameOver,
          target: 'gameOver',
        },
        {
          target: 'lobby',
          actions: unoActions.resetRound,
        },
      ],
    },

    gameOver: {
      on: {
        RESET_GAME: {
          target: 'lobby',
          actions: unoActions.resetGame,
        },
      },
    },
  },
})
