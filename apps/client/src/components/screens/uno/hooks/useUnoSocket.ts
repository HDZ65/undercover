import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  Card,
  CardColor,
  ClientToServerEvents,
  HouseRules,
  PrivatePlayerState,
  PublicGameState,
  ServerToClientEvents,
} from '@uno/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
const STORAGE_KEY_PLAYER_ID = 'uno_playerId'
const STORAGE_KEY_PLAYER_TOKEN = 'uno_playerToken'
const STORAGE_KEY_ROOM_CODE = 'uno_roomCode'

const DEFAULT_TARGET_SCORE = 500
const DEFAULT_TURN_TIMER = 30
const DEFAULT_HOUSE_RULES: HouseRules = {
  stackDrawTwo: false,
  stackDrawFour: false,
  bluffChallenge: false,
  forcePlay: false,
}
const EMPTY_HAND: Card[] = []

type UnoSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function getStoredValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(key)
}

function setStoredValue(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (value === null) {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, value)
}

export interface UseUnoSocketReturn {
  connected: boolean
  error: string | null
  publicState: PublicGameState | null
  privateState: PrivatePlayerState | null
  phase: PublicGameState['phase'] | null
  playerId: string | null
  playerToken: string | null
  roomCode: string | null
  isHost: boolean
  isMyTurn: boolean
  myHand: Card[]
  canPlay: boolean
  canDraw: boolean
  canCallUno: boolean
  canCatchUno: boolean
  mustChooseColor: boolean
  createRoom: (playerName: string) => void
  joinRoom: (roomCode: string, playerName: string) => void
  leaveRoom: () => void
  startGame: (houseRules?: HouseRules, targetScore?: number, turnTimer?: number) => void
  playCard: (cardId: string) => void
  drawCard: () => void
  callUno: () => void
  catchUno: (targetId: string) => void
  chooseColor: (color: CardColor) => void
  challengeWD4: () => void
  acceptWD4: () => void
  setHouseRules: (rules: HouseRules) => void
  setTargetScore: (score: number) => void
  setTurnTimer: (seconds: number) => void
  continueNextRound: () => void
  resetGame: () => void
}

export function useUnoSocket(): UseUnoSocketReturn {
  const socketRef = useRef<UnoSocket | null>(null)
  const reconnectRef = useRef<{ roomCode: string | null; playerToken: string | null }>({
    roomCode: null,
    playerToken: null,
  })

  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicState, setPublicState] = useState<PublicGameState | null>(null)
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(() => getStoredValue(STORAGE_KEY_PLAYER_ID))
  const [playerToken, setPlayerToken] = useState<string | null>(() => getStoredValue(STORAGE_KEY_PLAYER_TOKEN))
  const [roomCode, setRoomCode] = useState<string | null>(() => getStoredValue(STORAGE_KEY_ROOM_CODE))

  useEffect(() => {
    reconnectRef.current = { roomCode, playerToken }
  }, [roomCode, playerToken])

  const updatePlayerId = useCallback((value: string | null) => {
    setPlayerId(value)
    setStoredValue(STORAGE_KEY_PLAYER_ID, value)
  }, [])

  const updatePlayerToken = useCallback((value: string | null) => {
    setPlayerToken(value)
    setStoredValue(STORAGE_KEY_PLAYER_TOKEN, value)
  }, [])

  const updateRoomCode = useCallback((value: string | null) => {
    setRoomCode(value)
    setStoredValue(STORAGE_KEY_ROOM_CODE, value)
  }, [])

  const clearSession = useCallback(() => {
    setPublicState(null)
    setPrivateState(null)
    updatePlayerId(null)
    updatePlayerToken(null)
    updateRoomCode(null)
  }, [updatePlayerId, updatePlayerToken, updateRoomCode])

  useEffect(() => {
    const socket = io(`${SERVER_URL}/uno`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
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
          playerName: 'Reconnecting...',
          playerToken: reconnectData.playerToken,
        })
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (connectError) => {
      setConnected(false)
      setError(connectError.message)
    })

    socket.on('room:created', (data) => {
      setError(null)
      updateRoomCode(data.roomCode)
      updatePlayerToken(data.playerToken)
      updatePlayerId(data.playerId)
    })

    socket.on('room:joined', (data) => {
      setError(null)
      updateRoomCode(data.roomCode)
      updatePlayerToken(data.playerToken)
      updatePlayerId(data.playerId)
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
      updatePlayerId(data.privateState.playerId)
      updatePlayerToken(data.privateState.playerToken)
      updateRoomCode(data.publicState.roomCode)
      setError(null)
    })

    socket.on('game:roundOver', (data) => {
      setPublicState((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          phase: 'roundOver',
          scores: data.scores,
        }
      })
    })

    socket.on('game:gameOver', (data) => {
      setPublicState((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          phase: 'gameOver',
          scores: data.scores,
        }
      })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [updatePlayerId, updatePlayerToken, updateRoomCode])

  const emit = useCallback(
    <T extends keyof ClientToServerEvents>(event: T, ...args: Parameters<ClientToServerEvents[T]>) => {
      socketRef.current?.emit(event, ...args)
    },
    [],
  )

  const createRoom = useCallback(
    (playerName: string) => {
      const normalizedName = playerName.trim()
      if (!normalizedName) {
        setError('Le nom du joueur est requis.')
        return
      }

      setError(null)
      emit('room:create', { playerName: normalizedName })
    },
    [emit],
  )

  const joinRoom = useCallback(
    (nextRoomCode: string, playerName: string) => {
      const normalizedCode = nextRoomCode.trim().toUpperCase()
      const normalizedName = playerName.trim()

      if (!normalizedCode || !normalizedName) {
        setError('Le code de salle et le nom du joueur sont requis.')
        return
      }

      setError(null)
      emit('room:join', {
        roomCode: normalizedCode,
        playerName: normalizedName,
        playerToken: roomCode === normalizedCode ? (playerToken ?? undefined) : undefined,
      })
    },
    [emit, playerToken, roomCode],
  )

  const leaveRoom = useCallback(() => {
    emit('room:leave')
    setError(null)
    clearSession()
  }, [clearSession, emit])

  const startGame = useCallback(
    (houseRules?: HouseRules, targetScore?: number, turnTimer?: number) => {
      emit('game:startGame', {
        houseRules: houseRules ?? publicState?.houseRules ?? DEFAULT_HOUSE_RULES,
        targetScore: targetScore ?? publicState?.targetScore ?? DEFAULT_TARGET_SCORE,
        turnTimer: turnTimer ?? publicState?.turnTimer ?? DEFAULT_TURN_TIMER,
      })
    },
    [emit, publicState],
  )

  const playCard = useCallback(
    (cardId: string) => {
      emit('game:playCard', { cardId })
    },
    [emit],
  )

  const drawCard = useCallback(() => {
    emit('game:drawCard')
  }, [emit])

  const callUno = useCallback(() => {
    emit('game:callUno')
  }, [emit])

  const catchUno = useCallback(
    (targetId: string) => {
      emit('game:catchUno', { playerId: targetId })
    },
    [emit],
  )

  const chooseColor = useCallback(
    (color: CardColor) => {
      emit('game:chooseColor', { color })
    },
    [emit],
  )

  const challengeWD4 = useCallback(() => {
    emit('game:challengeWD4')
  }, [emit])

  const acceptWD4 = useCallback(() => {
    emit('game:acceptWD4', { accepted: true })
  }, [emit])

  const setHouseRules = useCallback(
    (rules: HouseRules) => {
      emit('game:setHouseRules', { houseRules: rules })
    },
    [emit],
  )

  const setTargetScore = useCallback(
    (score: number) => {
      emit('game:setTargetScore', { targetScore: score })
    },
    [emit],
  )

  const setTurnTimer = useCallback(
    (seconds: number) => {
      emit('game:setTurnTimer', { turnTimer: seconds })
    },
    [emit],
  )

  const continueNextRound = useCallback(() => {
    emit('game:continueNextRound')
  }, [emit])

  const resetGame = useCallback(() => {
    emit('game:resetGame')
  }, [emit])

  const phase = publicState?.phase ?? null
  const isHost = privateState?.isHost ?? false
  const isMyTurn = publicState?.currentPlayerId === playerId
  const myHand = privateState?.hand ?? EMPTY_HAND
  const canPlay = (privateState?.canPlayCards.length ?? 0) > 0
  const canDraw = privateState?.canDraw ?? false
  const canCallUno = privateState?.canCallUno ?? false
  const canCatchUno = privateState?.canCatchUno ?? false
  const mustChooseColor = privateState?.mustChooseColor ?? false

  return useMemo(
    () => ({
      connected,
      error,
      publicState,
      privateState,
      phase,
      playerId,
      playerToken,
      roomCode,
      isHost,
      isMyTurn,
      myHand,
      canPlay,
      canDraw,
      canCallUno,
      canCatchUno,
      mustChooseColor,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      playCard,
      drawCard,
      callUno,
      catchUno,
      chooseColor,
      challengeWD4,
      acceptWD4,
      setHouseRules,
      setTargetScore,
      setTurnTimer,
      continueNextRound,
      resetGame,
    }),
    [
      acceptWD4,
      callUno,
      canCallUno,
      canCatchUno,
      canDraw,
      canPlay,
      catchUno,
      challengeWD4,
      chooseColor,
      connected,
      continueNextRound,
      createRoom,
      drawCard,
      error,
      isHost,
      isMyTurn,
      joinRoom,
      leaveRoom,
      mustChooseColor,
      myHand,
      phase,
      playCard,
      playerId,
      playerToken,
      privateState,
      publicState,
      resetGame,
      roomCode,
      setHouseRules,
      setTargetScore,
      setTurnTimer,
      startGame,
    ],
  )
}
