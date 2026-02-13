import { randomInt } from 'node:crypto'
import { assign, setup } from 'xstate'
import { wordDatabase, type RealWordCategory } from './words'
import type { Player, Role, WordCategory, WordPair } from '@undercover/shared'
import { distributeRoles, getRoleCounts } from './roles'

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
  readyPlayers: string[]
  hideRoles: boolean
  scores: Record<string, number>
  usedWordPairIndices: Record<string, number[]>
  noElimination: boolean
  revealedPlayers: string[]
}

type UndercoverMachineEvent =
  | { type: 'START_GAME'; players?: Player[] }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_CATEGORY'; category: WordCategory }
  | { type: 'SET_TIMER_DURATION'; duration: number }
  | { type: 'START_ROLE_DISTRIBUTION' }
  | { type: 'PLAYER_READY'; playerId: string }
  | { type: 'START_ROUND' }
  | { type: 'NEXT_SPEAKER' }
  | { type: 'START_VOTING' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'FINISH_VOTING' }
  | { type: 'SUBMIT_MRWHITE_GUESS'; guess: string }
  | { type: 'CAST_MRWHITE_VOTE'; voterId: string; accepted: boolean }
  | { type: 'RESOLVE_MRWHITE_VOTE' }
  | { type: 'SET_HIDE_ROLES'; hideRoles: boolean }
  | { type: 'SET_NO_ELIMINATION'; noElimination: boolean }
  | { type: 'CONTINUE_GAME' }
  | { type: 'END_GAME' }
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
  readyPlayers: [],
  hideRoles: false,
  scores: {},
  usedWordPairIndices: {},
  noElimination: false,
  revealedPlayers: [],
}

const getCurrentVoteTargets = (context: UndercoverMachineContext): string[] => {
  if (context.tieCandidates.length > 0) {
    return context.tieCandidates
  }

  return context.alivePlayers
}

const cryptoRandom = (max: number): number => {
  if (max <= 0) return 0
  return randomInt(max)
}

const pickRandomPlayerId = (playerIds: string[]): string | null => {
  if (playerIds.length === 0) {
    return null
  }

  return playerIds[cryptoRandom(playerIds.length)]
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
    allPlayersReady: ({ context }) => {
      return context.alivePlayers.length > 0 && context.alivePlayers.every((playerId) => context.readyPlayers.includes(playerId))
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
    isNoElimination: ({ context }) => context.noElimination,
    isNormalMode: ({ context }) => !context.noElimination,
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
      const nextPlayers = event.type === 'START_GAME' ? (event.players ?? context.players) : context.players

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
        readyPlayers: [],
      }
    }),

    addPlayer: assign(({ context, event }) => {
      if (event.type !== 'ADD_PLAYER') {
        return {}
      }

      if (context.players.some((player) => player.id === event.player.id)) {
        return {}
      }

      const nextPlayers = [...context.players, { ...event.player, role: undefined, isEliminated: false }]

      return {
        players: nextPlayers,
        alivePlayers: nextPlayers.map((player) => player.id),
      }
    }),

    removePlayer: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PLAYER') {
        return {}
      }

      const nextPlayers = context.players.filter((player) => player.id !== event.playerId)
      const alivePlayers = nextPlayers.filter((player) => !player.isEliminated).map((player) => player.id)

      return {
        players: nextPlayers,
        alivePlayers,
        currentSpeakerIndex:
          alivePlayers.length === 0
            ? 0
            : Math.min(context.currentSpeakerIndex, alivePlayers.length - 1),
        votes: Object.fromEntries(
          Object.entries(context.votes).filter(
            ([voterId, targetId]) => voterId !== event.playerId && targetId !== event.playerId,
          ),
        ),
        readyPlayers: context.readyPlayers.filter((id) => id !== event.playerId),
        tieCandidates: context.tieCandidates.filter((id) => id !== event.playerId),
      }
    }),

    markPlayerReady: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_READY') {
        return {}
      }

      if (!context.alivePlayers.includes(event.playerId) || context.readyPlayers.includes(event.playerId)) {
        return {}
      }

      return {
        readyPlayers: [...context.readyPlayers, event.playerId],
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
        readyPlayers: [],
      }
    }),

    assignWordPair: assign(({ context }) => {
      const realCategories = Object.keys(wordDatabase) as RealWordCategory[]
      const resolvedCategory: RealWordCategory = context.category === 'aleatoire'
        ? realCategories[cryptoRandom(realCategories.length)]
        : context.category as RealWordCategory

      const words = wordDatabase[resolvedCategory]

      if (!words || words.length === 0) {
        return {
          wordPair: null,
          usedWordPairIndices: context.usedWordPairIndices,
        }
      }

      const usedIndices = context.usedWordPairIndices[resolvedCategory] ?? []

      // Find available (unused) indices
      let availableIndices = words.map((_, index) => index).filter((index) => !usedIndices.includes(index))

      // If all pairs have been used, reset and shuffle
      if (availableIndices.length === 0) {
        availableIndices = words.map((_, index) => index)
      }

      // Fisher-Yates shuffle for uniform distribution
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = cryptoRandom(i + 1)
        ;[availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]]
      }

      const randomIndex = availableIndices[0]
      const newUsedIndices = availableIndices.length === words.length
        ? [randomIndex]
        : [...usedIndices, randomIndex]

      return {
        wordPair: words[randomIndex] ?? null,
        usedWordPairIndices: {
          ...context.usedWordPairIndices,
          [resolvedCategory]: newUsedIndices,
        },
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
        readyPlayers: [],
      }
    }),

    revealPlayer: assign(({ context }) => {
      if (!context.eliminatedPlayer) {
        return {
          votes: {},
          tieCandidates: [],
          tieRound: 0,
          voteResolution: 'pending' as VoteResolution,
        }
      }

      // Award +1 to each player who voted for the revealed player IF that player is undercover/mrwhite
      const revealedMachinePlayer = context.players.find((p) => p.id === context.eliminatedPlayer)
      const updatedScores = { ...context.scores }
      const isCorrectVote = revealedMachinePlayer?.role === 'undercover' || revealedMachinePlayer?.role === 'mrwhite'

      if (isCorrectVote) {
        for (const [voterId, targetId] of Object.entries(context.votes)) {
          if (targetId === context.eliminatedPlayer) {
            updatedScores[voterId] = (updatedScores[voterId] ?? 0) + 1
          }
        }
      }

      const newRevealed = context.revealedPlayers.includes(context.eliminatedPlayer)
        ? context.revealedPlayers
        : [...context.revealedPlayers, context.eliminatedPlayer]

      return {
        revealedPlayers: newRevealed,
        scores: updatedScores,
        currentRound: context.currentRound + 1,
        votes: {},
        tieCandidates: [],
        tieRound: 0,
        voteResolution: 'pending' as VoteResolution,
        readyPlayers: [],
      }
    }),

    resetVotes: assign({
      votes: () => ({}),
    }),

    setWinner: assign(({ context }) => ({
      winner: getWinner(context),
    })),

    computeScores: assign(({ context }) => {
      const winner = getWinner(context)
      if (!winner) {
        return { scores: context.scores }
      }

      const updatedScores = { ...context.scores }

      for (const player of context.players) {
        if (!player.role) {
          continue
        }

        if (!updatedScores[player.id]) {
          updatedScores[player.id] = 0
        }

        if (winner === 'civil' && player.role === 'civil' && !player.isEliminated) {
          updatedScores[player.id] += 2
        } else if (winner === 'undercover' && player.role === 'undercover' && !player.isEliminated) {
          updatedScores[player.id] += 3
        } else if (winner === 'mrwhite' && player.role === 'mrwhite') {
          updatedScores[player.id] += 4
        }
      }

      return { scores: updatedScores }
    }),

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

    setHideRoles: assign(({ event }) => {
      if (event.type !== 'SET_HIDE_ROLES') {
        return {}
      }

      return {
        hideRoles: event.hideRoles,
      }
    }),

    setNoElimination: assign(({ event }) => {
      if (event.type !== 'SET_NO_ELIMINATION') {
        return {}
      }

      return {
        noElimination: event.noElimination,
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
      readyPlayers: [],
      currentSpeakerIndex:
        context.alivePlayers.length === 0
          ? 0
          : context.currentSpeakerIndex % context.alivePlayers.length,
    })),

    resetGame: assign(({ context }) => ({
      ...initialContext,
      scores: context.scores,
      usedWordPairIndices: context.usedWordPairIndices,
      noElimination: context.noElimination,
    })),
  },
}).createMachine({
  id: 'undercoverGame',
  initial: 'menu',
  context: initialContext,
  states: {
    menu: {
      on: {
        ADD_PLAYER: {
          target: 'lobby',
          actions: 'addPlayer',
        },
        START_GAME: {
          target: 'lobby',
          actions: 'assignPlayers',
        },
      },
    },

    lobby: {
      on: {
        ADD_PLAYER: {
          actions: 'addPlayer',
        },
        REMOVE_PLAYER: {
          actions: 'removePlayer',
        },
        SET_CATEGORY: {
          actions: 'setCategory',
        },
        SET_TIMER_DURATION: {
          actions: 'setTimerDuration',
        },
        SET_HIDE_ROLES: {
          actions: 'setHideRoles',
        },
        SET_NO_ELIMINATION: {
          actions: 'setNoElimination',
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
      always: {
        guard: 'allPlayersReady',
        target: 'gameRound.discussion',
        actions: 'resetVotes',
      },
      on: {
        PLAYER_READY: {
          actions: 'markPlayerReady',
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
        END_GAME: {
          target: '#undercoverGame.victory',
          actions: ['setWinner', 'computeScores'],
        },
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
      initial: 'routing',
      states: {
        routing: {
          always: [
            {
              guard: 'isNoElimination',
              target: 'revealed',
              actions: 'revealPlayer',
            },
            {
              target: 'eliminated',
              actions: 'eliminatePlayer',
            },
          ],
        },
        revealed: {
          on: {
            CONTINUE_GAME: {
              target: '#undercoverGame.roleDistribution',
              actions: 'prepareNextRound',
            },
          },
        },
        eliminated: {
          on: {
            CONTINUE_GAME: [
              {
                guard: 'isMrWhiteEliminated',
                target: '#undercoverGame.mrWhiteGuess',
              },
              {
                target: '#undercoverGame.checkGameEnd',
              },
            ],
          },
        },
      },
      on: {
        END_GAME: {
          target: 'victory',
          actions: ['setWinner', 'computeScores'],
        },
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
          actions: ['setWinner', 'computeScores'],
        },
        {
          guard: 'gameOver',
          target: 'victory',
          actions: ['setWinner', 'computeScores'],
        },
        {
          target: 'roleDistribution',
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
