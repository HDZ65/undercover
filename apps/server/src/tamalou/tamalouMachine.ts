import { setup, assign, createActor } from 'xstate'
import type { TamalouCard, TamalouPower } from '@undercover/shared'
import { createDeck, createDoubleDeck, shuffle, cardPower, handScore } from './deck.js'

// ── Context ──

export interface TamalouPlayer {
  id: string
  name: string
  connected: boolean
}

export interface TamalouMachineContext {
  players: TamalouPlayer[]
  hostId: string
  // Card state
  hands: Record<string, TamalouCard[]>
  /** Which positions each player has seen (persists through the round) */
  knownPositions: Record<string, Set<number>>
  drawPile: TamalouCard[]
  discardPile: TamalouCard[]
  // Turn
  currentPlayerIndex: number
  drawnCard: TamalouCard | null
  drawnFromDiscard: boolean
  // Powers
  activePower: TamalouPower
  powerTargetPlayerId: string | null
  peekedCard: { cardIndex: number; card: TamalouCard; owner: string } | null
  // Tamalou
  tamalouCaller: string | null
  /** How many players still need to play in the final round */
  finalRoundRemaining: number
  // Initial peek
  peeksCompleted: Set<string>
  // Scoring
  scores: Record<string, number[]>
  maxScore: number
  round: number
  // Round end
  roundScores: Record<string, number> | null
  winnerId: string | null
}

// ── Events ──

export type TamalouMachineEvent =
  | { type: 'ADD_PLAYER'; id: string; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_MAX_SCORE'; maxScore: number }
  | { type: 'START_GAME' }
  | { type: 'PEEK_INITIAL'; playerId: string; cardIndices: [number, number] }
  | { type: 'DRAW'; source: 'pile' | 'discard' }
  | { type: 'SWAP_WITH_OWN'; cardIndex: number }
  | { type: 'DISCARD_DRAWN' }
  | { type: 'PEEK_OWN'; cardIndex: number }
  | { type: 'PEEK_OPPONENT'; targetPlayerId: string; cardIndex: number }
  | { type: 'BLIND_SWAP'; ownCardIndex: number; targetPlayerId: string; targetCardIndex: number }
  | { type: 'SKIP_POWER' }
  | { type: 'ACK_PEEK' }
  | { type: 'CALL_TAMALOU' }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET_GAME' }

// ── Helpers ──

function dealCards(ctx: TamalouMachineContext): { hands: Record<string, TamalouCard[]>; drawPile: TamalouCard[]; discardPile: TamalouCard[] } {
  const deck = shuffle(ctx.players.length >= 5 ? createDoubleDeck() : createDeck())
  const hands: Record<string, TamalouCard[]> = {}
  let idx = 0
  for (const p of ctx.players) {
    hands[p.id] = deck.slice(idx, idx + 4)
    idx += 4
  }
  const discardPile = [deck[idx]]
  const drawPile = deck.slice(idx + 1)
  return { hands, drawPile, discardPile }
}

function nextPlayerIndex(ctx: TamalouMachineContext): number {
  return (ctx.currentPlayerIndex + 1) % ctx.players.length
}

function currentPlayerId(ctx: TamalouMachineContext): string {
  return ctx.players[ctx.currentPlayerIndex].id
}

// ── Machine ──

export const tamalouMachine = setup({
  types: {
    context: {} as TamalouMachineContext,
    events: {} as TamalouMachineEvent,
  },
  guards: {
    canStart: ({ context }) => context.players.length >= 2,
    allPeeked: ({ context }) => context.peeksCompleted.size >= context.players.length,
    hasPower: ({ context }) => context.activePower !== null,
    isPeeking: ({ context }) => context.peekedCard !== null,
    isFinalRoundDone: ({ context }) => context.tamalouCaller !== null && context.finalRoundRemaining <= 0,
    isGameOver: ({ context }) => {
      for (const p of context.players) {
        const total = (context.scores[p.id] || []).reduce((a, b) => a + b, 0)
        if (total >= context.maxScore) return true
      }
      return false
    },
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'ADD_PLAYER') return context.players
        if (context.players.find(p => p.id === event.id)) return context.players
        return [...context.players, { id: event.id, name: event.name, connected: true }]
      },
      scores: ({ context, event }) => {
        if (event.type !== 'ADD_PLAYER') return context.scores
        if (context.scores[event.id]) return context.scores
        return { ...context.scores, [event.id]: [] }
      },
    }),
    removePlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'REMOVE_PLAYER') return context.players
        return context.players.filter(p => p.id !== event.id)
      },
    }),
    setMaxScore: assign({
      maxScore: ({ event }) => event.type === 'SET_MAX_SCORE' ? event.maxScore : 100,
    }),
    dealAndSetup: assign(({ context }) => {
      const { hands, drawPile, discardPile } = dealCards(context)
      const knownPositions: Record<string, Set<number>> = {}
      for (const p of context.players) {
        knownPositions[p.id] = new Set()
      }
      return {
        hands,
        drawPile,
        discardPile,
        knownPositions,
        currentPlayerIndex: 0,
        drawnCard: null,
        drawnFromDiscard: false,
        activePower: null as TamalouPower,
        powerTargetPlayerId: null,
        peekedCard: null,
        tamalouCaller: null,
        finalRoundRemaining: 0,
        peeksCompleted: new Set<string>(),
        roundScores: null,
        winnerId: null,
      }
    }),
    peekInitial: assign(({ context, event }) => {
      if (event.type !== 'PEEK_INITIAL') return {}
      const newPeeks = new Set(context.peeksCompleted)
      newPeeks.add(event.playerId)
      const newKnown = { ...context.knownPositions }
      const playerKnown = new Set(newKnown[event.playerId] || [])
      playerKnown.add(event.cardIndices[0])
      playerKnown.add(event.cardIndices[1])
      newKnown[event.playerId] = playerKnown
      return { peeksCompleted: newPeeks, knownPositions: newKnown }
    }),
    drawCard: assign(({ context, event }) => {
      if (event.type !== 'DRAW') return {}
      if (event.source === 'discard') {
        const discard = [...context.discardPile]
        const card = discard.pop()!
        return {
          drawnCard: card,
          drawnFromDiscard: true,
          discardPile: discard,
        }
      }
      // Draw from pile
      const pile = [...context.drawPile]
      let card = pile.pop()!
      // If draw pile runs out, reshuffle discard (keep top)
      if (pile.length === 0 && context.discardPile.length > 1) {
        const discard = [...context.discardPile]
        const top = discard.pop()!
        const reshuffled = shuffle(discard)
        return {
          drawnCard: card,
          drawnFromDiscard: false,
          drawPile: reshuffled,
          discardPile: [top],
        }
      }
      return {
        drawnCard: card,
        drawnFromDiscard: false,
        drawPile: pile,
      }
    }),
    swapWithOwn: assign(({ context, event }) => {
      if (event.type !== 'SWAP_WITH_OWN') return {}
      const pid = currentPlayerId(context)
      const hand = [...context.hands[pid]]
      const oldCard = hand[event.cardIndex]
      hand[event.cardIndex] = context.drawnCard!
      const newHands = { ...context.hands, [pid]: hand }
      // The old card goes to discard — no power triggered on swap
      const discard = [...context.discardPile, oldCard]
      // Player now knows what's at this position
      const newKnown = { ...context.knownPositions }
      const pk = new Set(newKnown[pid] || [])
      pk.add(event.cardIndex)
      newKnown[pid] = pk
      return {
        hands: newHands,
        discardPile: discard,
        drawnCard: null,
        drawnFromDiscard: false,
        activePower: null as TamalouPower,
        knownPositions: newKnown,
      }
    }),
    discardDrawn: assign(({ context }) => {
      const card = context.drawnCard!
      const discard = [...context.discardPile, card]
      const power = cardPower(card)
      return {
        discardPile: discard,
        drawnCard: null,
        drawnFromDiscard: false,
        activePower: power,
      }
    }),
    peekOwn: assign(({ context, event }) => {
      if (event.type !== 'PEEK_OWN') return {}
      const pid = currentPlayerId(context)
      const card = context.hands[pid][event.cardIndex]
      const newKnown = { ...context.knownPositions }
      const pk = new Set(newKnown[pid] || [])
      pk.add(event.cardIndex)
      newKnown[pid] = pk
      return {
        peekedCard: { cardIndex: event.cardIndex, card, owner: pid },
        knownPositions: newKnown,
      }
    }),
    peekOpponent: assign(({ context, event }) => {
      if (event.type !== 'PEEK_OPPONENT') return {}
      const card = context.hands[event.targetPlayerId][event.cardIndex]
      return {
        peekedCard: { cardIndex: event.cardIndex, card, owner: event.targetPlayerId },
        powerTargetPlayerId: event.targetPlayerId,
      }
    }),
    blindSwap: assign(({ context, event }) => {
      if (event.type !== 'BLIND_SWAP') return {}
      const pid = currentPlayerId(context)
      const myHand = [...context.hands[pid]]
      const theirHand = [...context.hands[event.targetPlayerId]]
      const temp = myHand[event.ownCardIndex]
      myHand[event.ownCardIndex] = theirHand[event.targetCardIndex]
      theirHand[event.targetCardIndex] = temp
      const newHands = { ...context.hands, [pid]: myHand, [event.targetPlayerId]: theirHand }
      // Invalidate known positions for swapped cards
      const newKnown = { ...context.knownPositions }
      const myKnown = new Set(newKnown[pid] || [])
      myKnown.delete(event.ownCardIndex)
      newKnown[pid] = myKnown
      const theirKnown = new Set(newKnown[event.targetPlayerId] || [])
      theirKnown.delete(event.targetCardIndex)
      newKnown[event.targetPlayerId] = theirKnown
      return {
        hands: newHands,
        knownPositions: newKnown,
        activePower: null as TamalouPower,
        powerTargetPlayerId: null,
      }
    }),
    clearPower: assign({
      activePower: () => null as TamalouPower,
      peekedCard: () => null,
      powerTargetPlayerId: () => null,
    }),
    advanceTurn: assign(({ context }) => {
      const next = nextPlayerIndex(context)
      const remaining = context.tamalouCaller !== null
        ? context.finalRoundRemaining - 1
        : context.finalRoundRemaining
      return {
        currentPlayerIndex: next,
        finalRoundRemaining: remaining,
      }
    }),
    callTamalou: assign(({ context }) => ({
      tamalouCaller: currentPlayerId(context),
      // Everyone else gets one more turn
      finalRoundRemaining: context.players.length - 1,
    })),
    computeRoundScores: assign(({ context }) => {
      const roundScores: Record<string, number> = {}
      const revealedHands: Record<string, TamalouCard[]> = {}
      for (const p of context.players) {
        const hand = context.hands[p.id] || []
        roundScores[p.id] = handScore(hand)
        revealedHands[p.id] = hand
      }
      // Tamalou penalty: if caller doesn't have lowest, they get +20 penalty
      if (context.tamalouCaller) {
        const callerScore = roundScores[context.tamalouCaller]
        const otherScores = Object.entries(roundScores)
          .filter(([id]) => id !== context.tamalouCaller)
          .map(([, s]) => s)
        const minOther = Math.min(...otherScores)
        if (callerScore > minOther) {
          roundScores[context.tamalouCaller] += 20
        } else {
          // Caller wins: 0 points
          roundScores[context.tamalouCaller] = 0
        }
      }
      // Update cumulative scores
      const newScores = { ...context.scores }
      for (const p of context.players) {
        newScores[p.id] = [...(newScores[p.id] || []), roundScores[p.id]]
      }
      return { roundScores, scores: newScores }
    }),
    determineWinner: assign(({ context }) => {
      // Winner = lowest total score
      let minTotal = Infinity
      let winnerId: string | null = null
      for (const p of context.players) {
        const total = (context.scores[p.id] || []).reduce((a, b) => a + b, 0)
        if (total < minTotal) {
          minTotal = total
          winnerId = p.id
        }
      }
      return { winnerId }
    }),
    resetAll: assign(({ context }) => ({
      hands: {} as Record<string, TamalouCard[]>,
      drawPile: [] as TamalouCard[],
      discardPile: [] as TamalouCard[],
      knownPositions: {} as Record<string, Set<number>>,
      currentPlayerIndex: 0,
      drawnCard: null,
      drawnFromDiscard: false,
      activePower: null as TamalouPower,
      powerTargetPlayerId: null,
      peekedCard: null,
      tamalouCaller: null,
      finalRoundRemaining: 0,
      peeksCompleted: new Set<string>(),
      scores: Object.fromEntries(context.players.map(p => [p.id, []])),
      round: 1,
      roundScores: null,
      winnerId: null,
    })),
    incrementRound: assign({ round: ({ context }) => context.round + 1 }),
  },
}).createMachine({
  id: 'tamalou',
  initial: 'lobby',
  context: {
    players: [],
    hostId: '',
    hands: {},
    knownPositions: {},
    drawPile: [],
    discardPile: [],
    currentPlayerIndex: 0,
    drawnCard: null,
    drawnFromDiscard: false,
    activePower: null,
    powerTargetPlayerId: null,
    peekedCard: null,
    tamalouCaller: null,
    finalRoundRemaining: 0,
    peeksCompleted: new Set(),
    scores: {},
    maxScore: 100,
    round: 1,
    roundScores: null,
    winnerId: null,
  },
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        SET_MAX_SCORE: { actions: 'setMaxScore' },
        START_GAME: {
          guard: 'canStart',
          target: 'initialPeek',
          actions: 'dealAndSetup',
        },
        RESET_GAME: { actions: 'resetAll' },
      },
    },
    initialPeek: {
      on: {
        PEEK_INITIAL: [
          {
            actions: 'peekInitial',
          },
        ],
      },
      always: [
        {
          guard: 'allPeeked',
          target: 'playerTurn',
        },
      ],
    },
    playerTurn: {
      on: {
        DRAW: {
          target: 'drawnCard',
          actions: 'drawCard',
        },
        CALL_TAMALOU: {
          actions: 'callTamalou',
          target: 'drawnCard.drawPhase',
        },
      },
    },
    drawnCard: {
      initial: 'drawPhase',
      states: {
        drawPhase: {
          on: {
            DRAW: {
              target: 'actionPhase',
              actions: 'drawCard',
            },
          },
        },
        actionPhase: {
          on: {
            SWAP_WITH_OWN: {
              target: '#tamalou.afterAction',
              actions: 'swapWithOwn',
            },
            DISCARD_DRAWN: [
              {
                target: '#tamalou.afterAction',
                actions: ['discardDrawn'],
              },
            ],
          },
        },
      },
    },
    afterAction: {
      always: [
        {
          guard: 'hasPower',
          target: 'usePower',
        },
        {
          guard: 'isFinalRoundDone',
          target: 'roundEnd',
          actions: 'computeRoundScores',
        },
        {
          target: 'playerTurn',
          actions: 'advanceTurn',
        },
      ],
    },
    usePower: {
      on: {
        PEEK_OWN: {
          actions: 'peekOwn',
          target: 'awaitPeekAck',
        },
        PEEK_OPPONENT: {
          actions: 'peekOpponent',
          target: 'awaitPeekAck',
        },
        BLIND_SWAP: {
          actions: 'blindSwap',
          target: 'afterPower',
        },
        SKIP_POWER: {
          actions: 'clearPower',
          target: 'afterPower',
        },
      },
    },
    awaitPeekAck: {
      on: {
        ACK_PEEK: {
          actions: 'clearPower',
          target: 'afterPower',
        },
      },
    },
    afterPower: {
      always: [
        {
          guard: 'isFinalRoundDone',
          target: 'roundEnd',
          actions: 'computeRoundScores',
        },
        {
          target: 'playerTurn',
          actions: 'advanceTurn',
        },
      ],
    },
    roundEnd: {
      on: {
        NEXT_ROUND: [
          {
            guard: 'isGameOver',
            target: 'gameOver',
            actions: 'determineWinner',
          },
          {
            target: 'initialPeek',
            actions: ['incrementRound', 'dealAndSetup'],
          },
        ],
      },
    },
    gameOver: {
      on: {
        RESET_GAME: {
          target: 'lobby',
          actions: 'resetAll',
        },
      },
    },
  },
})

export type TamalouActor = ReturnType<typeof createActor<typeof tamalouMachine>>
