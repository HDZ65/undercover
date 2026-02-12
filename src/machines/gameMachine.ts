import { assign, setup } from 'xstate'
import { wordDatabase } from '../data/words'
import type { Player, Role, WordCategory, WordPair } from '../types/game'
import { distributeRoles, getRoleCounts } from '../utils/roles'

type VoteResolution = 'pending' | 'tie' | 'secondTie' | 'resolved'

interface UndercoverMachineContext {
  players: Player[]
  alivePlayers: string[]
  currentRound: number
  currentSpeakerIndex: number
  votes: Record<string, string>
  eliminatedPlayer: string | null
  wordPair: WordPair | null
  category: WordCategory
  timerDuration: number
  winner: Role | null
  mrWhiteGuess: string
  mrWhiteGuessResult: boolean | null
  tieCandidates: string[]
  tieRound: number
  voteResolution: VoteResolution
}

type UndercoverMachineEvent =
  | { type: 'START_GAME'; players?: Player[] }
  | { type: 'UPDATE_PLAYERS'; players: Player[] }
  | { type: 'SET_CATEGORY'; category: WordCategory }
  | { type: 'SET_TIMER_DURATION'; duration: number }
  | { type: 'START_ROLE_DISTRIBUTION' }
  | { type: 'START_ROUND' }
  | { type: 'NEXT_SPEAKER' }
  | { type: 'START_VOTING' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'FINISH_VOTING' }
  | { type: 'SUBMIT_MRWHITE_GUESS'; guess: string }
  | { type: 'CAST_MRWHITE_VOTE'; voterId: string; accepted: boolean }
  | { type: 'RESOLVE_MRWHITE_VOTE' }
  | { type: 'RESET_GAME' }

const initialContext: UndercoverMachineContext = {
  players: [],
  alivePlayers: [],
  currentRound: 1,
  currentSpeakerIndex: 0,
  votes: {},
  eliminatedPlayer: null,
  wordPair: null,
  category: 'facile',
  timerDuration: 60,
  winner: null,
  mrWhiteGuess: '',
  mrWhiteGuessResult: null,
  tieCandidates: [],
  tieRound: 0,
  voteResolution: 'pending',
}

const getCurrentVoteTargets = (context: UndercoverMachineContext): string[] => {
  if (context.tieCandidates.length > 0) {
    return context.tieCandidates
  }

  return context.alivePlayers
}

const pickRandomPlayerId = (playerIds: string[]): string | null => {
  if (playerIds.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * playerIds.length)
  return playerIds[randomIndex]
}

const getWinner = (context: UndercoverMachineContext): Role | null => {
  if (context.mrWhiteGuessResult === true) {
    return 'mrwhite'
  }

  const alivePlayers = context.players.filter((player) => !player.isEliminated)
  const roleCounts = getRoleCounts(alivePlayers)

  if (roleCounts.undercover === 0 && roleCounts.mrwhite === 0) {
    return 'civil'
  }

  if (roleCounts.undercover >= roleCounts.civil) {
    return 'undercover'
  }

  return null
}

export const gameMachine = setup({
  types: {
    context: {} as UndercoverMachineContext,
    events: {} as UndercoverMachineEvent,
  },
  guards: {
    hasEnoughPlayers: ({ context }) => {
      return (
        Array.isArray(context.players) && context.players.length >= 3 && context.players.length <= 20
      )
    },
    allVotesCast: ({ context }) => {
      const voteTargets = getCurrentVoteTargets(context)

      if (context.alivePlayers.length === 0 || voteTargets.length === 0) {
        return false
      }

      return context.alivePlayers.every((playerId) => {
        const votedFor = context.votes[playerId]
        return typeof votedFor === 'string' && voteTargets.includes(votedFor)
      })
    },
    isTied: ({ context }) => context.voteResolution === 'tie',
    isSecondTie: ({ context }) => context.voteResolution === 'secondTie',
    isMrWhiteEliminated: ({ context }) => {
      if (!context.eliminatedPlayer) {
        return false
      }

      const eliminatedPlayer = context.players.find((player) => player.id === context.eliminatedPlayer)
      return eliminatedPlayer?.role === 'mrwhite'
    },
    gameOver: ({ context }) => {
      const alivePlayers = context.players.filter((player) => !player.isEliminated)
      const roleCounts = getRoleCounts(alivePlayers)

      return (
        (roleCounts.undercover === 0 && roleCounts.mrwhite === 0) ||
        roleCounts.undercover >= roleCounts.civil
      )
    },
    mrWhiteGuessCorrect: ({ context }) => context.mrWhiteGuessResult === true,
    allMrWhiteVotesCast: ({ context }) => {
      if (context.alivePlayers.length === 0) {
        return true
      }

      return context.alivePlayers.every((playerId) => {
        const vote = context.votes[playerId]
        return vote === 'accept' || vote === 'reject'
      })
    },
  },
  actions: {
    assignPlayers: assign(({ context, event }) => {
      const nextPlayers =
        event.type === 'UPDATE_PLAYERS'
          ? event.players
          : event.type === 'START_GAME'
            ? (event.players ?? context.players)
            : context.players

      const normalizedPlayers = nextPlayers.map((player) => ({
        ...player,
        role: undefined,
        isEliminated: false,
      }))

      return {
        players: normalizedPlayers,
        alivePlayers: normalizedPlayers.map((player) => player.id),
        currentRound: 1,
        currentSpeakerIndex: 0,
        votes: {},
        eliminatedPlayer: null,
        wordPair: null,
        winner: null,
        mrWhiteGuess: '',
        mrWhiteGuessResult: null,
        tieCandidates: [],
        tieRound: 0,
        voteResolution: 'pending' as VoteResolution,
      }
    }),

    assignRoles: assign(({ context }) => {
      if (context.players.length < 3 || context.players.length > 20) {
        return {}
      }

      const playersWithRoles = distributeRoles(context.players).map((player) => ({
        ...player,
        isEliminated: false,
      }))

      return {
        players: playersWithRoles,
        alivePlayers: playersWithRoles.map((player) => player.id),
        currentRound: 1,
        currentSpeakerIndex: 0,
        votes: {},
        eliminatedPlayer: null,
        winner: null,
        mrWhiteGuess: '',
        mrWhiteGuessResult: null,
        tieCandidates: [],
        tieRound: 0,
        voteResolution: 'pending' as VoteResolution,
      }
    }),

    assignWordPair: assign(({ context }) => {
      const words = wordDatabase[context.category]

      if (!words || words.length === 0) {
        return {
          wordPair: null,
        }
      }

      const randomIndex = Math.floor(Math.random() * words.length)

      return {
        wordPair: words[randomIndex] ?? null,
      }
    }),

    recordVote: assign(({ context, event }) => {
      if (event.type !== 'CAST_VOTE') {
        return {}
      }

      if (!context.alivePlayers.includes(event.voterId)) {
        return {}
      }

      const voteTargets = getCurrentVoteTargets(context)
      if (!voteTargets.includes(event.targetId)) {
        return {}
      }

      return {
        votes: {
          ...context.votes,
          [event.voterId]: event.targetId,
        },
      }
    }),

    computeElimination: assign(({ context }) => {
      const voteTargets = getCurrentVoteTargets(context)

      if (voteTargets.length === 0) {
        return {
          eliminatedPlayer: null,
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'resolved' as VoteResolution,
        }
      }

      const voteCounts = voteTargets.reduce<Record<string, number>>((accumulator, playerId) => {
        accumulator[playerId] = 0
        return accumulator
      }, {})

      for (const voterId of context.alivePlayers) {
        const votedFor = context.votes[voterId]

        if (typeof votedFor === 'string' && voteTargets.includes(votedFor)) {
          voteCounts[votedFor] = (voteCounts[votedFor] ?? 0) + 1
        }
      }

      const highestVoteCount = Math.max(...Object.values(voteCounts))
      const topCandidates = Object.entries(voteCounts)
        .filter(([, count]) => count === highestVoteCount)
        .map(([playerId]) => playerId)

      if (topCandidates.length === 1) {
        return {
          eliminatedPlayer: topCandidates[0],
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'resolved' as VoteResolution,
        }
      }

      if (topCandidates.length === 0) {
        return {
          eliminatedPlayer: pickRandomPlayerId(voteTargets),
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'resolved' as VoteResolution,
        }
      }

      if (context.tieRound >= 1) {
        return {
          eliminatedPlayer: pickRandomPlayerId(topCandidates),
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'secondTie' as VoteResolution,
        }
      }

      return {
        eliminatedPlayer: null,
        tieCandidates: topCandidates,
        tieRound: context.tieRound + 1,
        voteResolution: 'tie' as VoteResolution,
      }
    }),

    eliminatePlayer: assign(({ context }) => {
      if (!context.eliminatedPlayer) {
        return {
          votes: {},
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'pending' as VoteResolution,
        }
      }

      const updatedPlayers = context.players.map((player) => {
        if (player.id !== context.eliminatedPlayer) {
          return player
        }

        return {
          ...player,
          isEliminated: true,
        }
      })

      const alivePlayers = updatedPlayers
        .filter((player) => !player.isEliminated)
        .map((player) => player.id)

      return {
        players: updatedPlayers,
        alivePlayers,
        currentRound: context.currentRound + 1,
        currentSpeakerIndex:
          alivePlayers.length === 0
            ? 0
            : Math.min(context.currentSpeakerIndex, alivePlayers.length - 1),
        votes: {},
        tieCandidates: [],
        tieRound: 0,
        voteResolution: 'pending' as VoteResolution,
      }
    }),

    resetVotes: assign({
      votes: () => ({}),
    }),

    setWinner: assign(({ context }) => ({
      winner: getWinner(context),
    })),

    recordMrWhiteGuess: assign(({ event }) => {
      if (event.type !== 'SUBMIT_MRWHITE_GUESS') {
        return {}
      }

      return {
        mrWhiteGuess: event.guess.trim(),
        mrWhiteGuessResult: null,
        votes: {},
      }
    }),

    recordMrWhiteVote: assign(({ context, event }) => {
      if (event.type !== 'CAST_MRWHITE_VOTE') {
        return {}
      }

      if (!context.alivePlayers.includes(event.voterId)) {
        return {}
      }

      return {
        votes: {
          ...context.votes,
          [event.voterId]: event.accepted ? 'accept' : 'reject',
        },
      }
    }),

    resolveMrWhiteGuessVote: assign(({ context }) => {
      const result = context.alivePlayers.reduce(
        (accumulator, playerId) => {
          const vote = context.votes[playerId]

          if (vote === 'accept') {
            accumulator.accept += 1
          } else if (vote === 'reject') {
            accumulator.reject += 1
          }

          return accumulator
        },
        { accept: 0, reject: 0 },
      )

      return {
        mrWhiteGuessResult: result.accept > result.reject,
      }
    }),

    setCategory: assign(({ event }) => {
      if (event.type !== 'SET_CATEGORY') {
        return {}
      }

      return {
        category: event.category,
      }
    }),

    setTimerDuration: assign(({ event }) => {
      if (event.type !== 'SET_TIMER_DURATION') {
        return {}
      }

      if (!Number.isFinite(event.duration)) {
        return {
          timerDuration: 60,
        }
      }

      return {
        timerDuration: Math.max(10, Math.floor(event.duration)),
      }
    }),

    advanceSpeaker: assign(({ context }) => {
      if (context.alivePlayers.length === 0) {
        return {
          currentSpeakerIndex: 0,
        }
      }

      return {
        currentSpeakerIndex: (context.currentSpeakerIndex + 1) % context.alivePlayers.length,
      }
    }),

    prepareNextRound: assign(({ context }) => ({
      eliminatedPlayer: null,
      mrWhiteGuess: '',
      mrWhiteGuessResult: null,
      votes: {},
      tieCandidates: [],
      tieRound: 0,
      voteResolution: 'pending' as VoteResolution,
      currentSpeakerIndex:
        context.alivePlayers.length === 0
          ? 0
          : context.currentSpeakerIndex % context.alivePlayers.length,
    })),

    resetGame: assign(() => ({
      ...initialContext,
    })),
  },
}).createMachine({
  id: 'undercoverGame',
  initial: 'menu',
  context: initialContext,
  states: {
    menu: {
      on: {
        START_GAME: {
          target: 'lobby',
          actions: 'assignPlayers',
        },
      },
    },

    lobby: {
      on: {
        UPDATE_PLAYERS: {
          actions: 'assignPlayers',
        },
        SET_CATEGORY: {
          actions: 'setCategory',
        },
        SET_TIMER_DURATION: {
          actions: 'setTimerDuration',
        },
        START_ROLE_DISTRIBUTION: {
          guard: 'hasEnoughPlayers',
          target: 'roleDistribution',
          actions: ['assignRoles', 'assignWordPair', 'resetVotes'],
        },
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    roleDistribution: {
      on: {
        START_ROUND: {
          target: 'gameRound.discussion',
          actions: 'resetVotes',
        },
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    gameRound: {
      initial: 'discussion',
      states: {
        discussion: {
          on: {
            NEXT_SPEAKER: {
              actions: 'advanceSpeaker',
            },
            START_VOTING: {
              target: 'voting',
              actions: 'resetVotes',
            },
          },
        },

        voting: {
          on: {
            CAST_VOTE: {
              actions: 'recordVote',
            },
            FINISH_VOTING: {
              guard: 'allVotesCast',
              target: '#undercoverGame.vote',
            },
          },
        },
      },
      on: {
        RESET_GAME: {
          target: '#undercoverGame.menu',
          actions: 'resetGame',
        },
      },
    },

    vote: {
      entry: 'computeElimination',
      always: [
        {
          guard: 'isTied',
          target: '#undercoverGame.gameRound.voting',
          actions: 'resetVotes',
        },
        {
          guard: 'isSecondTie',
          target: 'elimination',
        },
        {
          target: 'elimination',
        },
      ],
      on: {
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    elimination: {
      entry: 'eliminatePlayer',
      always: [
        {
          guard: 'isMrWhiteEliminated',
          target: 'mrWhiteGuess',
        },
        {
          target: 'checkGameEnd',
        },
      ],
      on: {
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    mrWhiteGuess: {
      entry: 'resetVotes',
      on: {
        SUBMIT_MRWHITE_GUESS: {
          target: 'mrWhiteVote',
          actions: 'recordMrWhiteGuess',
        },
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    mrWhiteVote: {
      on: {
        CAST_MRWHITE_VOTE: {
          actions: 'recordMrWhiteVote',
        },
        RESOLVE_MRWHITE_VOTE: {
          guard: 'allMrWhiteVotesCast',
          target: 'checkGameEnd',
          actions: 'resolveMrWhiteGuessVote',
        },
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    checkGameEnd: {
      always: [
        {
          guard: 'mrWhiteGuessCorrect',
          target: 'victory',
          actions: 'setWinner',
        },
        {
          guard: 'gameOver',
          target: 'victory',
          actions: 'setWinner',
        },
        {
          target: 'gameRound.discussion',
          actions: 'prepareNextRound',
        },
      ],
      on: {
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },

    victory: {
      on: {
        RESET_GAME: {
          target: 'menu',
          actions: 'resetGame',
        },
      },
    },
  },
})
