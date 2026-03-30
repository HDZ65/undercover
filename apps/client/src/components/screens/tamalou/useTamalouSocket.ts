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
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
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

  const emit = socketRef.current

  const createRoom = useCallback((name: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, name)
    emit?.emit('room:create', { playerName: name })
  }, [emit])

  const joinRoom = useCallback((code: string, name: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, name)
    emit?.emit('room:join', { roomCode: code, playerName: name })
  }, [emit])

  const leaveRoom = useCallback(() => {
    emit?.emit('room:leave')
    setRoomCode(null); setPublicState(null); setPrivateState(null)
    localStorage.removeItem(STORAGE_KEYS.roomCode)
    localStorage.removeItem(STORAGE_KEYS.playerToken)
    localStorage.removeItem(STORAGE_KEYS.playerId)
  }, [emit])

  return {
    connected, publicState, privateState, error, roomCode,
    createRoom, joinRoom, leaveRoom,
    startGame: useCallback(() => emit?.emit('game:startGame'), [emit]),
    setMaxScore: useCallback((s: number) => emit?.emit('game:setMaxScore', { maxScore: s }), [emit]),
    peekInitial: useCallback((indices: [number, number]) => emit?.emit('game:peekInitial', { cardIndices: indices }), [emit]),
    draw: useCallback((source: 'pile' | 'discard') => emit?.emit('game:draw', { source }), [emit]),
    swapWithOwn: useCallback((idx: number) => emit?.emit('game:swapWithOwn', { cardIndex: idx }), [emit]),
    discardDrawn: useCallback(() => emit?.emit('game:discardDrawn'), [emit]),
    peekOwn: useCallback((idx: number) => emit?.emit('game:peekOwn', { cardIndex: idx }), [emit]),
    peekOpponent: useCallback((pid: string, idx: number) => emit?.emit('game:peekOpponent', { targetPlayerId: pid, cardIndex: idx }), [emit]),
    blindSwap: useCallback((own: number, pid: string, target: number) => emit?.emit('game:blindSwap', { ownCardIndex: own, targetPlayerId: pid, targetCardIndex: target }), [emit]),
    skipPower: useCallback(() => emit?.emit('game:skipPower'), [emit]),
    ackPeek: useCallback(() => emit?.emit('game:ackPeek'), [emit]),
    callTamalou: useCallback(() => emit?.emit('game:callTamalou'), [emit]),
    nextRound: useCallback(() => emit?.emit('game:nextRound'), [emit]),
    resetGame: useCallback(() => emit?.emit('game:resetGame'), [emit]),
  }
}
