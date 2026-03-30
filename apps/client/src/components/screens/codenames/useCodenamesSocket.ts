import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  CodenamesClientToServerEvents,
  CodenamesServerToClientEvents,
  CodenamesPublicState,
  CodenamesPrivateState,
  CodenamesTeam,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

type CodenamesSocket = Socket<CodenamesServerToClientEvents, CodenamesClientToServerEvents>

const STORAGE_KEYS = {
  playerId: 'codenames_playerId',
  playerToken: 'codenames_playerToken',
  roomCode: 'codenames_roomCode',
  playerName: 'codenames_playerName',
}

export function useCodenamesSocket() {
  const socketRef = useRef<CodenamesSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [publicState, setPublicState] = useState<CodenamesPublicState | null>(null)
  const [privateState, setPrivateState] = useState<CodenamesPrivateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.roomCode),
  )

  // Connect socket
  useEffect(() => {
    const socket: CodenamesSocket = io(`${SERVER_URL}/codenames`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)

      // Auto-rejoin if we have stored credentials
      const storedRoom = localStorage.getItem(STORAGE_KEYS.roomCode)
      const storedToken = localStorage.getItem(STORAGE_KEYS.playerToken)
      const storedName = localStorage.getItem(STORAGE_KEYS.playerName)
      if (storedRoom && storedToken && storedName) {
        socket.emit('room:join', {
          roomCode: storedRoom,
          playerName: storedName,
          playerToken: storedToken,
        })
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('game:state', (data) => {
      setPublicState(data.publicState)
      setPrivateState(data.privateState)
    })

    socket.on('room:joined', (data) => {
      setRoomCode(data.roomCode)
      localStorage.setItem(STORAGE_KEYS.roomCode, data.roomCode)
      localStorage.setItem(STORAGE_KEYS.playerId, data.playerId)
      localStorage.setItem(STORAGE_KEYS.playerToken, data.playerToken)
      setError(null)
    })

    socket.on('room:error', (data) => {
      setError(data.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const createRoom = useCallback((playerName: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, playerName)
    socketRef.current?.emit('room:create', { playerName })
  }, [])

  const joinRoom = useCallback((code: string, playerName: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, playerName)
    socketRef.current?.emit('room:join', { roomCode: code, playerName })
  }, [])

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave')
    setRoomCode(null)
    setPublicState(null)
    setPrivateState(null)
    localStorage.removeItem(STORAGE_KEYS.roomCode)
    localStorage.removeItem(STORAGE_KEYS.playerToken)
    localStorage.removeItem(STORAGE_KEYS.playerId)
  }, [])

  const joinTeam = useCallback((team: CodenamesTeam) => {
    socketRef.current?.emit('game:joinTeam', { team })
  }, [])

  const setSpymaster = useCallback(() => {
    socketRef.current?.emit('game:setSpymaster')
  }, [])

  const startGame = useCallback(() => {
    socketRef.current?.emit('game:startGame')
  }, [])

  const giveClue = useCallback((word: string, count: number) => {
    socketRef.current?.emit('game:giveClue', { word, count })
  }, [])

  const guessWord = useCallback((cardIndex: number) => {
    socketRef.current?.emit('game:guessWord', { cardIndex })
  }, [])

  const passTurn = useCallback(() => {
    socketRef.current?.emit('game:passTurn')
  }, [])

  const resetGame = useCallback(() => {
    socketRef.current?.emit('game:resetGame')
  }, [])

  return {
    connected,
    publicState,
    privateState,
    error,
    roomCode,
    createRoom,
    joinRoom,
    leaveRoom,
    joinTeam,
    setSpymaster,
    startGame,
    giveClue,
    guessWord,
    passTurn,
    resetGame,
  }
}
