import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  TamalouClientToServerEvents,
  TamalouServerToClientEvents,
  TamalouPublicState,
  TamalouPrivateState,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
type TamalouSocket = Socket<TamalouServerToClientEvents, TamalouClientToServerEvents>

const STORAGE_KEYS = {
  playerId: 'tamalou_playerId',
  playerToken: 'tamalou_playerToken',
  roomCode: 'tamalou_roomCode',
  playerName: 'tamalou_playerName',
}

export function useTamalouSocket() {
  const socketRef = useRef<TamalouSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [publicState, setPublicState] = useState<TamalouPublicState | null>(null)
  const [privateState, setPrivateState] = useState<TamalouPrivateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.roomCode),
  )

  useEffect(() => {
    const socket: TamalouSocket = io(`${SERVER_URL}/tamalou`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
      const storedRoom = localStorage.getItem(STORAGE_KEYS.roomCode)
      const storedToken = localStorage.getItem(STORAGE_KEYS.playerToken)
      const storedName = localStorage.getItem(STORAGE_KEYS.playerName)
      if (storedRoom && storedToken && storedName) {
        socket.emit('room:join', { roomCode: storedRoom, playerName: storedName, playerToken: storedToken })
      }
    })

    socket.on('disconnect', () => setConnected(false))

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

    socket.on('room:error', (data) => setError(data.message))

    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  const createRoom = useCallback((name: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, name)
    socketRef.current?.emit('room:create', { playerName: name })
  }, [])

  const joinRoom = useCallback((code: string, name: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, name)
    socketRef.current?.emit('room:join', { roomCode: code, playerName: name })
  }, [])

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave')
    setRoomCode(null); setPublicState(null); setPrivateState(null)
    localStorage.removeItem(STORAGE_KEYS.roomCode)
    localStorage.removeItem(STORAGE_KEYS.playerToken)
    localStorage.removeItem(STORAGE_KEYS.playerId)
  }, [])

  return {
    connected, publicState, privateState, error, roomCode,
    createRoom, joinRoom, leaveRoom,
    startGame: useCallback(() => socketRef.current?.emit('game:startGame'), []),
    setMaxScore: useCallback((s: number) => socketRef.current?.emit('game:setMaxScore', { maxScore: s }), []),
    peekInitial: useCallback((indices: [number, number]) => socketRef.current?.emit('game:peekInitial', { cardIndices: indices }), []),
    draw: useCallback((source: 'pile' | 'discard') => socketRef.current?.emit('game:draw', { source }), []),
    swapWithOwn: useCallback((idx: number) => socketRef.current?.emit('game:swapWithOwn', { cardIndex: idx }), []),
    discardDrawn: useCallback(() => socketRef.current?.emit('game:discardDrawn'), []),
    peekOwn: useCallback((idx: number) => socketRef.current?.emit('game:peekOwn', { cardIndex: idx }), []),
    peekOpponent: useCallback((pid: string, idx: number) => socketRef.current?.emit('game:peekOpponent', { targetPlayerId: pid, cardIndex: idx }), []),
    blindSwap: useCallback((own: number, pid: string, target: number) => socketRef.current?.emit('game:blindSwap', { ownCardIndex: own, targetPlayerId: pid, targetCardIndex: target }), []),
    skipPower: useCallback(() => socketRef.current?.emit('game:skipPower'), []),
    ackPeek: useCallback(() => socketRef.current?.emit('game:ackPeek'), []),
    callTamalou: useCallback(() => socketRef.current?.emit('game:callTamalou'), []),
    nextRound: useCallback(() => socketRef.current?.emit('game:nextRound'), []),
    resetGame: useCallback(() => socketRef.current?.emit('game:resetGame'), []),
  }
}
