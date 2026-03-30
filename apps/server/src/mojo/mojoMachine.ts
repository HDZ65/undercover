import { setup, assign, createActor } from 'xstate'
import type { MojoCard } from '@undercover/shared'
import { createMojoDeck, shuffle, scoreHand } from './deck.js'

// ── Types ──

export interface MojoPlayer {
  id: string
  name: string
  connected: boolean
  hand: MojoCard[]
  /** Face-down cards during mojo time */
  mojoCards: MojoCard[]
  /** Already revealed mojo cards */
  revealedMojoCards: MojoCard[]
  inMojoTime: boolean
  hasMojo: boolean
}

export interface MojoMachineContext {
  players: MojoPlayer[]
  hostId: string
  drawPile: MojoCard[]
  discardPiles: MojoCard[][]
  /** 1 or 2 discard piles */
  discardCount: 1 | 2
  doubleDiscard: boolean
  currentPlayerIndex: number
  direction: 1 | -1
  mojoHolderId: string | null
  scores: Record<string, number[]>
  round: number
  roundScores: Record<string, number> | null
  winnerId: string | null
  /** Turn state */
  playedThisTurn: boolean
  mustDraw: boolean
  /** Which discard pile the player is using this turn (for double discard) */
  activeDiscardIndex: number
  /** Track if player just played equal (can chain) */
  lastPlayedValue: number | null
  /** Flag: player emptied hand in single turn */
  emptiedHandThisTurn: boolean
}

export type MojoMachineEvent =
  | { type: 'ADD_PLAYER'; id: string; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_DOUBLE_DISCARD'; enabled: boolean }
  | { type: 'START_GAME' }
  | { type: 'PLAY_CARD'; playerId: string; cardId: number; discardIndex: number }
  | { type: 'DRAW'; source: 'pile' | 'discard'; discardIndex: number }
  | { type: 'END_TURN' }
  | { type: 'REVEAL_MOJO_CARD'; playerId: string; cardId: number }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET_GAME' }

// ── Helpers ──

function dealRound(ctx: MojoMachineContext): Partial<MojoMachineContext> {
  const deck = shuffle(createMojoDeck())
  const players = ctx.players.map(p => ({
    ...p,
    hand: [] as MojoCard[],
    mojoCards: [] as MojoCard[],
    revealedMojoCards: [] as MojoCard[],
    inMojoTime: false,
  }))

  let idx = 0
  for (const p of players) {
    p.hand = deck.slice(idx, idx + 8)
    idx += 8
  }

  const discardPiles: MojoCard[][] = [[deck[idx]]]
  idx++
  if (ctx.doubleDiscard) {
    discardPiles.push([deck[idx]])
    idx++
  }

  return {
    players,
    drawPile: deck.slice(idx),
    discardPiles,
    discardCount: ctx.doubleDiscard ? 2 : 1,
    currentPlayerIndex: 0,
    playedThisTurn: false,
    mustDraw: false,
    activeDiscardIndex: 0,
    lastPlayedValue: null,
    emptiedHandThisTurn: false,
    roundScores: null,
  }
}

function nextPlayerIndex(ctx: MojoMachineContext): number {
  const len = ctx.players.length
  return ((ctx.currentPlayerIndex + ctx.direction) % len + len) % len
}

function currentPlayer(ctx: MojoMachineContext): MojoPlayer {
  return ctx.players[ctx.currentPlayerIndex]
}

function discardTop(pile: MojoCard[]): MojoCard | null {
  return pile.length > 0 ? pile[pile.length - 1] : null
}

function drawOneCard(ctx: MojoMachineContext): { card: MojoCard; drawPile: MojoCard[]; discardPiles: MojoCard[][] } {
  let pile = [...ctx.drawPile]
  let discardPiles = ctx.discardPiles.map(d => [...d])

  if (pile.length === 0) {
    // Reshuffle: take all but top from each discard pile
    const reshuffleCards: MojoCard[] = []
    for (let i = 0; i < discardPiles.length; i++) {
      if (discardPiles[i].length > 1) {
        const top = discardPiles[i].pop()!
        reshuffleCards.push(...discardPiles[i])
        discardPiles[i] = [top]
      }
    }
    pile = shuffle(reshuffleCards)
  }

  const card = pile.pop()!
  return { card, drawPile: pile, discardPiles }
}

// ── Machine ──

export const mojoMachine = setup({
  types: {
    context: {} as MojoMachineContext,
    events: {} as MojoMachineEvent,
  },
  guards: {
    canStart: ({ context }) => context.players.length >= 2,
    isRoundOver: ({ context }) => {
      // Round ends when a player reveals last mojo card OR emptied hand in one turn
      return context.players.some(p =>
        (p.inMojoTime && p.mojoCards.length === 0 && p.revealedMojoCards.length > 0) ||
        false,
      ) || context.emptiedHandThisTurn
    },
    isGameOver: ({ context }) => {
      for (const p of context.players) {
        const total = (context.scores[p.id] || []).reduce((a, b) => a + b, 0)
        if (total >= 50) return true
      }
      return false
    },
    canPlayCard: ({ context, event }) => {
      if (event.type !== 'PLAY_CARD') return false
      const player = currentPlayer(context)
      if (event.playerId !== player.id) return false
      if (player.inMojoTime) return false
      const card = player.hand.find(c => c.id === event.cardId)
      if (!card) return false
      return true
    },
    mustDrawFirst: ({ context }) => context.mustDraw,
    playerInMojoTime: ({ context }) => currentPlayer(context).inMojoTime,
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'ADD_PLAYER') return context.players
        if (context.players.find(p => p.id === event.id)) return context.players
        return [...context.players, {
          id: event.id, name: event.name, connected: true,
          hand: [], mojoCards: [], revealedMojoCards: [], inMojoTime: false, hasMojo: false,
        }]
      },
      scores: ({ context, event }) => {
        if (event.type !== 'ADD_PLAYER' || context.scores[event.id]) return context.scores
        return { ...context.scores, [event.id]: [] }
      },
    }),
    removePlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'REMOVE_PLAYER') return context.players
        return context.players.filter(p => p.id !== event.id)
      },
    }),
    setDoubleDiscard: assign({
      doubleDiscard: ({ event }) => event.type === 'SET_DOUBLE_DISCARD' ? event.enabled : false,
    }),
    dealAndSetup: assign(({ context }) => dealRound(context)),
    playCard: assign(({ context, event }) => {
      if (event.type !== 'PLAY_CARD') return {}
      const player = currentPlayer(context)
      const cardIdx = player.hand.findIndex(c => c.id === event.cardId)
      if (cardIdx === -1) return {}
      const card = player.hand[cardIdx]
      const dIdx = context.doubleDiscard ? event.discardIndex : 0

      // Get top of chosen discard
      const top = discardTop(context.discardPiles[dIdx])

      // If already played this turn, must match the equal-chain value
      if (context.playedThisTurn && context.lastPlayedValue !== null && card.value !== context.lastPlayedValue) {
        return {} // Invalid: can't play different value in chain
      }

      // Determine outcome
      const isEqual = top !== null && card.value === top.value
      const isHigher = top !== null && card.value > top.value
      // isLower = neither equal nor higher (or no top)

      // Remove card from hand
      const newHand = [...player.hand]
      newHand.splice(cardIdx, 1)
      const newPlayers = context.players.map(p =>
        p.id === player.id ? { ...p, hand: newHand } : p,
      )

      // Add to discard
      const newDiscards = context.discardPiles.map((d, i) =>
        i === dIdx ? [...d, card] : [...d],
      )

      const emptiedHandThisTurn = newHand.length === 0

      return {
        players: newPlayers,
        discardPiles: newDiscards,
        playedThisTurn: true,
        mustDraw: isHigher && !isEqual,
        activeDiscardIndex: dIdx,
        lastPlayedValue: isEqual ? card.value : null,
        emptiedHandThisTurn,
      }
    }),
    drawCard: assign(({ context, event }) => {
      if (event.type !== 'DRAW') return {}
      const player = currentPlayer(context)

      if (event.source === 'discard' && context.doubleDiscard) {
        // In double discard: draw top of the OTHER discard pile
        const otherIdx = event.discardIndex
        const otherPile = [...context.discardPiles[otherIdx]]
        if (otherPile.length === 0) return {}
        const card = otherPile.pop()!
        const newHand = [...player.hand, card]
        const newPlayers = context.players.map(p =>
          p.id === player.id ? { ...p, hand: newHand } : p,
        )
        const newDiscards = context.discardPiles.map((d, i) =>
          i === otherIdx ? otherPile : [...d],
        )
        return { players: newPlayers, discardPiles: newDiscards, mustDraw: false }
      }

      // Draw from pile
      const { card, drawPile, discardPiles } = drawOneCard(context)
      const newHand = [...player.hand, card]
      const newPlayers = context.players.map(p =>
        p.id === player.id ? { ...p, hand: newHand } : p,
      )
      return { players: newPlayers, drawPile, discardPiles, mustDraw: false }
    }),
    checkMojoTime: assign(({ context }) => {
      // After ending turn, check if current player should enter mojo time
      const player = currentPlayer(context)
      const threshold = context.players.length === 2 ? 2 : 3
      if (!player.inMojoTime && player.hand.length <= threshold && player.hand.length > 0) {
        const newPlayers = context.players.map(p => {
          if (p.id !== player.id) return p
          return {
            ...p,
            mojoCards: [...p.hand],
            hand: [],
            inMojoTime: true,
          }
        })
        return { players: newPlayers }
      }
      return {}
    }),
    advanceTurn: assign(({ context }) => ({
      currentPlayerIndex: nextPlayerIndex(context),
      playedThisTurn: false,
      mustDraw: false,
      lastPlayedValue: null,
      activeDiscardIndex: 0,
      emptiedHandThisTurn: false,
    })),
    revealMojoCard: assign(({ context, event }) => {
      if (event.type !== 'REVEAL_MOJO_CARD') return {}
      const player = currentPlayer(context)
      if (event.playerId !== player.id) return {}
      const cardIdx = player.mojoCards.findIndex(c => c.id === event.cardId)
      if (cardIdx === -1) return {}
      const card = player.mojoCards[cardIdx]
      const newMojo = [...player.mojoCards]
      newMojo.splice(cardIdx, 1)
      const newRevealed = [...player.revealedMojoCards, card]
      const newPlayers = context.players.map(p =>
        p.id === player.id ? { ...p, mojoCards: newMojo, revealedMojoCards: newRevealed } : p,
      )
      return { players: newPlayers }
    }),
    assignMojoWinner: assign(({ context }) => {
      // The player who ended the round gets the mojo card
      // Either: revealed last mojo card, or emptied hand in one turn
      let winnerId = currentPlayer(context).id

      // Check if someone just revealed their last mojo card
      for (const p of context.players) {
        if (p.inMojoTime && p.mojoCards.length === 0 && p.revealedMojoCards.length > 0) {
          winnerId = p.id
          break
        }
      }

      const newPlayers = context.players.map(p => ({
        ...p,
        hasMojo: p.id === winnerId,
      }))
      return { players: newPlayers, mojoHolderId: winnerId }
    }),
    computeRoundScores: assign(({ context }) => {
      const roundScores: Record<string, number> = {}
      for (const p of context.players) {
        // All cards: remaining hand + mojo cards (face-down + revealed)
        const allCards = [...p.hand, ...p.mojoCards, ...p.revealedMojoCards]
        roundScores[p.id] = scoreHand(allCards)
      }

      // Mojo bonus/penalty
      if (context.mojoHolderId) {
        const holderScore = roundScores[context.mojoHolderId]
        const otherScores = Object.entries(roundScores)
          .filter(([id]) => id !== context.mojoHolderId)
          .map(([, s]) => s)
        const minOther = Math.min(...otherScores)
        if (holderScore <= minOther) {
          roundScores[context.mojoHolderId] = 0
        } else {
          roundScores[context.mojoHolderId] += 10
        }
      }

      const newScores = { ...context.scores }
      for (const p of context.players) {
        newScores[p.id] = [...(newScores[p.id] || []), roundScores[p.id]]
      }

      return { roundScores, scores: newScores }
    }),
    determineWinner: assign(({ context }) => {
      let minTotal = Infinity
      let winnerId: string | null = null
      for (const p of context.players) {
        const total = (context.scores[p.id] || []).reduce((a, b) => a + b, 0)
        if (total < minTotal) { minTotal = total; winnerId = p.id }
      }
      return { winnerId }
    }),
    resetAll: assign(({ context }) => ({
      drawPile: [] as MojoCard[],
      discardPiles: [[]] as MojoCard[][],
      currentPlayerIndex: 0,
      playedThisTurn: false,
      mustDraw: false,
      activeDiscardIndex: 0,
      lastPlayedValue: null,
      emptiedHandThisTurn: false,
      mojoHolderId: null,
      scores: Object.fromEntries(context.players.map(p => [p.id, []])) as Record<string, number[]>,
      round: 1,
      roundScores: null,
      winnerId: null,
      players: context.players.map(p => ({
        ...p, hand: [], mojoCards: [], revealedMojoCards: [], inMojoTime: false, hasMojo: false,
      })),
    })),
    incrementRound: assign({ round: ({ context }) => context.round + 1 }),
  },
}).createMachine({
  id: 'mojo',
  initial: 'lobby',
  context: {
    players: [],
    hostId: '',
    drawPile: [],
    discardPiles: [[]],
    discardCount: 1,
    doubleDiscard: false,
    currentPlayerIndex: 0,
    direction: 1,
    mojoHolderId: null,
    scores: {},
    round: 1,
    roundScores: null,
    winnerId: null,
    playedThisTurn: false,
    mustDraw: false,
    activeDiscardIndex: 0,
    lastPlayedValue: null,
    emptiedHandThisTurn: false,
  },
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        SET_DOUBLE_DISCARD: { actions: 'setDoubleDiscard' },
        START_GAME: {
          guard: 'canStart',
          target: 'playing',
          actions: 'dealAndSetup',
        },
        RESET_GAME: { actions: 'resetAll' },
      },
    },
    playing: {
      on: {
        PLAY_CARD: [
          {
            guard: 'canPlayCard',
            actions: 'playCard',
            target: 'checkAfterPlay',
          },
        ],
        DRAW: {
          guard: 'mustDrawFirst',
          actions: 'drawCard',
        },
        END_TURN: {
          guard: ({ context }) => context.playedThisTurn && !context.mustDraw,
          target: 'endTurn',
        },
        REVEAL_MOJO_CARD: {
          guard: 'playerInMojoTime',
          actions: 'revealMojoCard',
          target: 'checkRoundEnd',
        },
      },
    },
    checkAfterPlay: {
      always: [
        {
          // Emptied hand in one turn → round end
          guard: ({ context }) => context.emptiedHandThisTurn,
          target: 'roundEnd',
          actions: ['assignMojoWinner', 'computeRoundScores'],
        },
        {
          // Equal card → stay in playing (player can chain or end turn)
          guard: ({ context }) => context.lastPlayedValue !== null,
          target: 'playing',
        },
        {
          // Higher card → must draw, then end turn
          guard: ({ context }) => context.mustDraw,
          target: 'playing',
        },
        {
          // Lower card → can end turn
          target: 'playing',
        },
      ],
    },
    endTurn: {
      entry: 'checkMojoTime',
      always: [
        {
          target: 'checkRoundEnd',
        },
      ],
    },
    checkRoundEnd: {
      always: [
        {
          guard: 'isRoundOver',
          target: 'roundEnd',
          actions: ['assignMojoWinner', 'computeRoundScores'],
        },
        {
          target: 'playing',
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
            target: 'playing',
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

export type MojoActor = ReturnType<typeof createActor<typeof mojoMachine>>
