import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  CardColor,
  ClientToServerEvents,
  HouseRules,
  PrivatePlayerState,
  PublicGameState,
  ServerToClientEvents,
} from '@uno/shared'
import { useLocalStorage } from './useLocalStorage.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002'
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
const EMPTY_HAND: PrivatePlayerState['hand'] = []

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface UseSocketReturn {
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
  myHand: PrivatePlayerState['hand']
  canPlay: boolean
  canDraw: boolean
  canCallUno: boolean
  canCatchUno: boolean
  mustChooseColor: boolean
  createRoom: (playerName: string, _avatar?: string) => void
  joinRoom: (roomCode: string, playerName: string, _avatar?: string) => void
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
  const [playerId, setPlayerId] = useLocalStorage<string | null>(STORAGE_KEY_PLAYER_ID, null)
  const [playerToken, setPlayerToken] = useLocalStorage<string | null>(STORAGE_KEY_PLAYER_TOKEN, null)
  const [roomCode, setRoomCode] = useLocalStorage<string | null>(STORAGE_KEY_ROOM_CODE, null)

  useEffect(() => {
    reconnectRef.current = { roomCode, playerToken }
  }, [roomCode, playerToken])

  const clearSession = useCallback(() => {
    setPublicState(null)
    setPrivateState(null)
    setPlayerId(null)
    setPlayerToken(null)
    setRoomCode(null)
  }, [setPlayerId, setPlayerToken, setRoomCode])

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
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
      setPlayerToken(data.privateState.playerToken)
      setRoomCode(data.publicState.roomCode)
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
  }, [setPlayerId, setPlayerToken, setRoomCode])

  const emit = useCallback(
    <T extends keyof ClientToServerEvents>(event: T, ...args: Parameters<ClientToServerEvents[T]>) => {
      socketRef.current?.emit(event, ...args)
    },
    [],
  )

  const createRoom = useCallback(
    (playerName: string, _avatar?: string) => {
      const normalizedName = playerName.trim()
      if (!normalizedName) {
        setError('Player name is required.')
        return
      }

      setError(null)
      emit('room:create', { playerName: normalizedName })
    },
    [emit],
  )

  const joinRoom = useCallback(
    (nextRoomCode: string, playerName: string, _avatar?: string) => {
      const normalizedCode = nextRoomCode.trim().toUpperCase()
      const normalizedName = playerName.trim()

      if (!normalizedCode || !normalizedName) {
        setError('Room code and player name are required.')
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
