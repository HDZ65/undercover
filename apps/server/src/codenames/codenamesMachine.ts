import { setup, assign, createActor } from 'xstate'
import type { CardColor, CodenamesTeam, CodenamesCard, CodenamesClue } from '@undercover/shared'
import { pickWords } from './words.js'

// ── Context ──

export interface CodenamesPlayer {
  id: string
  name: string
  team: CodenamesTeam | null
  isSpymaster: boolean
  connected: boolean
}

export interface CodenamesMachineContext {
  players: CodenamesPlayer[]
  hostId: string
  cards: CodenamesCard[]
  currentTeam: CodenamesTeam
  startingTeam: CodenamesTeam
  currentClue: CodenamesClue | null
  remainingGuesses: number
  scores: Record<CodenamesTeam, number>
  targets: Record<CodenamesTeam, number>
  winner: CodenamesTeam | null
  winReason: 'all_found' | 'assassin' | null
  loser: CodenamesTeam | null
}

// ── Events ──

export type CodenamesMachineEvent =
  | { type: 'ADD_PLAYER'; id: string; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'JOIN_TEAM'; playerId: string; team: CodenamesTeam }
  | { type: 'SET_SPYMASTER'; playerId: string }
  | { type: 'START_GAME' }
  | { type: 'GIVE_CLUE'; word: string; count: number }
  | { type: 'GUESS_WORD'; playerId: string; cardIndex: number }
  | { type: 'PASS_TURN' }
  | { type: 'RESET_GAME' }

// ── Helpers ──

function generateBoard(startingTeam: CodenamesTeam): CodenamesCard[] {
  const words = pickWords()
  const otherTeam: CodenamesTeam = startingTeam === 'red' ? 'blue' : 'red'

  // Starting team gets 9 words, other gets 8, 7 neutral, 1 assassin
  const colors: CardColor[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill('neutral' as CardColor),
    'assassin',
  ]

  // Shuffle colors
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[colors[i], colors[j]] = [colors[j], colors[i]]
  }

  return words.map((word, i) => ({
    word,
    color: colors[i],
    revealed: false,
  }))
}

function hasTeamRequirements(players: CodenamesPlayer[]): boolean {
  const redPlayers = players.filter(p => p.team === 'red')
  const bluePlayers = players.filter(p => p.team === 'blue')
  const redSpymaster = redPlayers.filter(p => p.isSpymaster).length === 1
  const blueSpymaster = bluePlayers.filter(p => p.isSpymaster).length === 1
  // Each team needs at least 2 players (1 spymaster + 1 agent)
  return redPlayers.length >= 2 && bluePlayers.length >= 2 && redSpymaster && blueSpymaster
}

// ── Machine ──

export const codenamesMachine = setup({
  types: {
    context: {} as CodenamesMachineContext,
    events: {} as CodenamesMachineEvent,
  },
  guards: {
    canStart: ({ context }) => hasTeamRequirements(context.players),
    isGameWon: ({ context }) => context.winner !== null,
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'ADD_PLAYER') return context.players
        if (context.players.find(p => p.id === event.id)) return context.players
        return [...context.players, {
          id: event.id,
          name: event.name,
          team: null,
          isSpymaster: false,
          connected: true,
        }]
      },
    }),
    removePlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'REMOVE_PLAYER') return context.players
        return context.players.filter(p => p.id !== event.id)
      },
    }),
    joinTeam: assign({
      players: ({ context, event }) => {
        if (event.type !== 'JOIN_TEAM') return context.players
        return context.players.map(p =>
          p.id === event.playerId
            ? { ...p, team: event.team, isSpymaster: false }
            : p,
        )
      },
    }),
    setSpymaster: assign({
      players: ({ context, event }) => {
        if (event.type !== 'SET_SPYMASTER') return context.players
        const player = context.players.find(p => p.id === event.playerId)
        if (!player || !player.team) return context.players
        // Remove previous spymaster from same team, set this one
        return context.players.map(p => {
          if (p.team === player.team) {
            return { ...p, isSpymaster: p.id === event.playerId }
          }
          return p
        })
      },
    }),
    initBoard: assign(({ context }) => {
      const startingTeam: CodenamesTeam = Math.random() < 0.5 ? 'red' : 'blue'
      const cards = generateBoard(startingTeam)
      return {
        cards,
        startingTeam,
        currentTeam: startingTeam,
        currentClue: null,
        remainingGuesses: 0,
        scores: { red: 0, blue: 0 },
        targets: {
          red: cards.filter(c => c.color === 'red').length,
          blue: cards.filter(c => c.color === 'blue').length,
        },
        winner: null,
        winReason: null,
        loser: null,
      }
    }),
    giveClue: assign({
      currentClue: ({ event }) => {
        if (event.type !== 'GIVE_CLUE') return null
        return null // will be set below
      },
    }),
    setClue: assign(({ context, event }) => {
      if (event.type !== 'GIVE_CLUE') return {}
      return {
        currentClue: {
          word: event.word,
          count: event.count,
          team: context.currentTeam,
        },
        // Players can guess count + 1 (the extra one to catch up on previous clues)
        remainingGuesses: event.count + 1,
      }
    }),
    revealCard: assign(({ context, event }) => {
      if (event.type !== 'GUESS_WORD') return {}
      const card = context.cards[event.cardIndex]
      if (!card || card.revealed) return {}

      const newCards = context.cards.map((c, i) =>
        i === event.cardIndex ? { ...c, revealed: true, revealedBy: context.currentTeam } : c,
      )

      const newScores = { ...context.scores }
      if (card.color === 'red') newScores.red++
      if (card.color === 'blue') newScores.blue++

      let winner: CodenamesTeam | null = null
      let winReason: 'all_found' | 'assassin' | null = null
      let loser: CodenamesTeam | null = null
      let remainingGuesses = context.remainingGuesses - 1

      // Check assassin
      if (card.color === 'assassin') {
        loser = context.currentTeam
        winner = context.currentTeam === 'red' ? 'blue' : 'red'
        winReason = 'assassin'
      }

      // Check if a team found all their words
      if (!winner) {
        if (newScores.red === context.targets.red) {
          winner = 'red'
          winReason = 'all_found'
        } else if (newScores.blue === context.targets.blue) {
          winner = 'blue'
          winReason = 'all_found'
        }
      }

      // If wrong team's card or neutral → end turn
      let currentTeam = context.currentTeam
      let currentClue = context.currentClue
      if (!winner && (card.color !== context.currentTeam || remainingGuesses <= 0)) {
        currentTeam = context.currentTeam === 'red' ? 'blue' : 'red'
        currentClue = null
        remainingGuesses = 0
      }

      return {
        cards: newCards,
        scores: newScores,
        winner,
        winReason,
        loser,
        currentTeam,
        currentClue,
        remainingGuesses,
      }
    }),
    passTurn: assign(({ context }) => ({
      currentTeam: context.currentTeam === 'red' ? 'blue' as CodenamesTeam : 'red' as CodenamesTeam,
      currentClue: null,
      remainingGuesses: 0,
    })),
    resetGame: assign(({ context }) => ({
      cards: [] as CodenamesCard[],
      currentTeam: 'red' as CodenamesTeam,
      startingTeam: 'red' as CodenamesTeam,
      currentClue: null,
      remainingGuesses: 0,
      scores: { red: 0, blue: 0 },
      targets: { red: 0, blue: 0 },
      winner: null,
      winReason: null,
      loser: null,
      players: context.players.map(p => ({ ...p, isSpymaster: false, team: null })),
    })),
  },
}).createMachine({
  id: 'codenames',
  initial: 'lobby',
  context: {
    players: [],
    hostId: '',
    cards: [],
    currentTeam: 'red',
    startingTeam: 'red',
    currentClue: null,
    remainingGuesses: 0,
    scores: { red: 0, blue: 0 },
    targets: { red: 0, blue: 0 },
    winner: null,
    winReason: null,
    loser: null,
  },
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        JOIN_TEAM: { actions: 'joinTeam' },
        SET_SPYMASTER: { actions: 'setSpymaster' },
        START_GAME: {
          guard: 'canStart',
          target: 'clueGiving',
          actions: 'initBoard',
        },
        RESET_GAME: { actions: 'resetGame' },
      },
    },
    clueGiving: {
      on: {
        GIVE_CLUE: {
          target: 'guessing',
          actions: 'setClue',
        },
      },
    },
    guessing: {
      on: {
        GUESS_WORD: [
          {
            guard: 'isGameWon',
            target: 'victory',
            actions: 'revealCard',
          },
          {
            target: 'checkAfterGuess',
            actions: 'revealCard',
          },
        ],
        PASS_TURN: {
          target: 'clueGiving',
          actions: 'passTurn',
        },
      },
    },
    checkAfterGuess: {
      always: [
        {
          guard: 'isGameWon',
          target: 'victory',
        },
        {
          guard: ({ context }) => context.currentClue === null,
          target: 'clueGiving',
        },
        {
          target: 'guessing',
        },
      ],
    },
    victory: {
      on: {
        RESET_GAME: {
          target: 'lobby',
          actions: 'resetGame',
        },
      },
    },
  },
})

export type CodenamesActor = ReturnType<typeof createActor<typeof codenamesMachine>>
