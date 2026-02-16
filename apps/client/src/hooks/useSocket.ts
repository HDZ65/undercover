import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useLocalStorage } from './useLocalStorage'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PublicGameState,
  PrivatePlayerState,
  PublicRoomInfo,
  GamePhase,
  WordCategory,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
const STORAGE_KEY_TOKEN = 'undercover-player-token'
const STORAGE_KEY_ROOM = 'undercover-room-code'

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const CATEGORIES: WordCategory[] = ['facile', 'expert', 'adulte', 'gastronomie', 'voyage', 'aleatoire']

interface UseSocketReturn {
  connected: boolean
  error: string | null
  publicState: PublicGameState | null
  privateState: PrivatePlayerState | null
  publicRooms: PublicRoomInfo[]
  phase: GamePhase | null
  playerId: string | null
  roomCode: string | null
  isHost: boolean
  createRoom: (playerName: string, isPublic?: boolean) => void
  joinRoom: (roomCode: string, playerName: string) => void
  leaveRoom: () => void
  listRooms: () => void
  setCategory: (category: string) => void
  setTimerDuration: (duration: number) => void
  setHideRoles: (hideRoles: boolean) => void
  setNoElimination: (noElimination: boolean) => void
  startDistribution: () => void
  markReady: () => void
  nextSpeaker: () => void
  startVoting: () => void
  castVote: (targetId: string) => void
  submitMrWhiteGuess: (guess: string) => void
  castMrWhiteVote: (accepted: boolean) => void
  continueGame: () => void
  endGame: () => void
  resetGame: () => void
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<GameSocket | null>(null)
  const reconnectRef = useRef<{ roomCode: string | null; playerToken: string | null }>({
    roomCode: null,
    playerToken: null,
  })
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicState, setPublicState] = useState<PublicGameState | null>(null)
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null)
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerToken, setPlayerToken] = useLocalStorage<string | null>(STORAGE_KEY_TOKEN, null)
  const [roomCode, setRoomCode] = useLocalStorage<string | null>(STORAGE_KEY_ROOM, null)

  useEffect(() => {
    reconnectRef.current = { roomCode, playerToken }
  }, [playerToken, roomCode])

  const clearSession = useCallback(() => {
    setPublicState(null)
    setPrivateState(null)
    setPlayerId(null)
    setRoomCode(null)
    setPlayerToken(null)
  }, [setPlayerToken, setRoomCode])

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)

      const reconnectData = reconnectRef.current
      if (reconnectData.roomCode && reconnectData.playerToken) {
        socket.emit('room:join', {
          roomCode: reconnectData.roomCode,
          playerName: 'Reconnexion',
          playerToken: reconnectData.playerToken,
        })
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (connectError) => {
      setError(connectError.message)
      setConnected(false)
    })

    socket.on('room:created', (data) => {
      setError(null)
      setRoomCode(data.roomCode)
      setPlayerToken(data.playerToken)
      setPlayerId(data.playerId)
    })

    socket.on('room:joined', (data) => {
      setError(null)
      setRoomCode(data.roomCode)
      setPlayerToken(data.playerToken)
      setPlayerId(data.playerId)
    })

    socket.on('room:error', (data) => {
      setError(data.message)
    })

    socket.on('room:hostChanged', (data) => {
      setPublicState((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          hostId: data.hostId,
        }
      })
    })

    socket.on('game:state', (data) => {
      setPublicState(data.publicState)
      setPrivateState(data.privateState)
      setPlayerId(data.privateState.playerId)
      setRoomCode(data.publicState.roomCode)
      setPlayerToken(data.privateState.playerToken)
      setError(null)
    })

    socket.on('game:victory', (data) => {
      setPublicState((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          winner: data.winner,
          players: data.players,
          wordPair: data.wordPair,
          phase: 'victory',
        }
      })
    })

    socket.on('room:list', (data) => {
      setPublicRooms(data.rooms)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [setPlayerToken, setRoomCode])

  const emit = useCallback(
    <T extends keyof ClientToServerEvents>(event: T, ...args: Parameters<ClientToServerEvents[T]>) => {
      socketRef.current?.emit(event, ...args)
    },
    [],
  )

  const createRoom = useCallback(
    (playerName: string, isPublic?: boolean) => {
      const normalized = playerName.trim()
      if (!normalized) {
        setError('Le nom du joueur est requis.')
        return
      }

      setError(null)
      emit('room:create', { playerName: normalized, isPublic })
    },
    [emit],
  )

  const listRooms = useCallback(() => {
    emit('room:list')
  }, [emit])

  const joinRoom = useCallback(
    (nextRoomCode: string, playerName: string) => {
      const normalizedName = playerName.trim()
      const normalizedCode = nextRoomCode.trim()

      if (!normalizedCode || !normalizedName) {
        setError('Le code de salle et le nom du joueur sont requis.')
        return
      }

      setError(null)
      emit('room:join', {
        roomCode: normalizedCode,
        playerName: normalizedName,
        playerToken: roomCode === normalizedCode ? playerToken ?? undefined : undefined,
      })
    },
    [emit, playerToken, roomCode],
  )

  const leaveRoom = useCallback(() => {
    emit('room:leave')
    clearSession()
  }, [clearSession, emit])

  const setCategory = useCallback(
    (category: string) => {
      if (!CATEGORIES.includes(category as WordCategory)) {
        return
      }
      emit('game:setCategory', { category: category as WordCategory })
    },
    [emit],
  )

  const setTimerDuration = useCallback(
    (duration: number) => {
      emit('game:setTimerDuration', { duration })
    },
    [emit],
  )

  const setHideRoles = useCallback(
    (hideRoles: boolean) => {
      emit('game:setHideRoles', { hideRoles })
    },
    [emit],
  )

  const setNoElimination = useCallback(
    (noElimination: boolean) => {
      emit('game:setNoElimination', { noElimination })
    },
    [emit],
  )

  const startDistribution = useCallback(() => {
    emit('game:startDistribution')
  }, [emit])

  const markReady = useCallback(() => {
    emit('game:ready')
  }, [emit])

  const nextSpeaker = useCallback(() => {
    emit('game:nextSpeaker')
  }, [emit])

  const startVoting = useCallback(() => {
    emit('game:startVoting')
  }, [emit])

  const castVote = useCallback(
    (targetId: string) => {
      emit('game:castVote', { targetId })
    },
    [emit],
  )

  const submitMrWhiteGuess = useCallback(
    (guess: string) => {
      emit('game:submitMrWhiteGuess', { guess: guess.trim() })
    },
    [emit],
  )

  const castMrWhiteVote = useCallback(
    (accepted: boolean) => {
      emit('game:castMrWhiteVote', { accepted })
    },
    [emit],
  )

  const continueGame = useCallback(() => {
    emit('game:continueGame')
  }, [emit])

  const endGame = useCallback(() => {
    emit('game:endGame')
  }, [emit])

  const resetGame = useCallback(() => {
    emit('game:resetGame')
  }, [emit])

  const phase = publicState?.phase ?? null

  return useMemo(
    () => ({
      connected,
      error,
      publicState,
      privateState,
      publicRooms,
      phase,
      playerId,
      roomCode,
      isHost: privateState?.isHost ?? false,
      createRoom,
      joinRoom,
      leaveRoom,
      listRooms,
      setCategory,
      setTimerDuration,
      setHideRoles,
      startDistribution,
      markReady,
      nextSpeaker,
      startVoting,
      castVote,
      submitMrWhiteGuess,
      castMrWhiteVote,
      continueGame,
      endGame,
      resetGame,
      setNoElimination,
    }),
    [
      castMrWhiteVote,
      castVote,
      connected,
      continueGame,
      endGame,
      createRoom,
      error,
      joinRoom,
      leaveRoom,
      listRooms,
      markReady,
      nextSpeaker,
      phase,
      playerId,
      privateState,
      publicRooms,
      publicState,
      resetGame,
      roomCode,
      setCategory,
      setTimerDuration,
      setHideRoles,
      setNoElimination,
      startDistribution,
      startVoting,
      submitMrWhiteGuess,
    ],
  )
}

export type { UseSocketReturn }
