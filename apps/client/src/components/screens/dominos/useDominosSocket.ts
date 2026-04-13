import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  DominosClientToServerEvents,
  DominosServerToClientEvents,
  DominosPublicState,
  DominosPrivateState,
  AttackTier,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
type DominosSocket = Socket<DominosServerToClientEvents, DominosClientToServerEvents>

const SK = {
  playerId: 'dominos_playerId',
  playerToken: 'dominos_playerToken',
  roomCode: 'dominos_roomCode',
  playerName: 'dominos_playerName',
}

export interface CombatAnimationData {
  winnerId: string
  losers: string[]
  attackTier: AttackTier
  pointsScored: number
  damagePerPlayer: Record<string, number>
}

export function useDominosSocket() {
  const socketRef = useRef<DominosSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [publicState, setPublicState] = useState<DominosPublicState | null>(null)
  const [privateState, setPrivateState] = useState<DominosPrivateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem(SK.roomCode))
  const [combatAnimation, setCombatAnimation] = useState<CombatAnimationData | null>(null)

  useEffect(() => {
    const socket: DominosSocket = io(`${SERVER_URL}/dominos`, {
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
      const r = localStorage.getItem(SK.roomCode)
      const t = localStorage.getItem(SK.playerToken)
      const n = localStorage.getItem(SK.playerName)
      if (r && t && n) socket.emit('room:join', { roomCode: r, playerName: n, playerToken: t })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('game:state', d => {
      setPublicState(d.publicState)
      setPrivateState(d.privateState)
    })
    socket.on('room:joined', d => {
      setRoomCode(d.roomCode)
      localStorage.setItem(SK.roomCode, d.roomCode)
      localStorage.setItem(SK.playerId, d.playerId)
      localStorage.setItem(SK.playerToken, d.playerToken)
      setError(null)
    })
    socket.on('room:error', d => setError(d.message))
    socket.on('game:combatAnimation', d => setCombatAnimation(d))

    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  const createRoom = useCallback((name: string) => {
    localStorage.setItem(SK.playerName, name)
    socketRef.current?.emit('room:create', { playerName: name })
  }, [])

  const joinRoom = useCallback((code: string, name: string) => {
    localStorage.setItem(SK.playerName, name)
    socketRef.current?.emit('room:join', { roomCode: code, playerName: name })
  }, [])

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave')
    setRoomCode(null)
    setPublicState(null)
    setPrivateState(null)
    localStorage.removeItem(SK.roomCode)
    localStorage.removeItem(SK.playerToken)
    localStorage.removeItem(SK.playerId)
  }, [])

  return {
    connected, publicState, privateState, error, roomCode, combatAnimation,
    clearCombatAnimation: useCallback(() => setCombatAnimation(null), []),
    createRoom, joinRoom, leaveRoom,
    startGame: useCallback(() => socketRef.current?.emit('game:startGame'), []),
    setTargetScore: useCallback((v: number) => socketRef.current?.emit('game:setTargetScore', { targetScore: v }), []),
    placeTile: useCallback((tileId: number, end: 'left' | 'right') => socketRef.current?.emit('game:placeTile', { tileId, end }), []),
    drawTile: useCallback(() => socketRef.current?.emit('game:drawTile'), []),
    pass: useCallback(() => socketRef.current?.emit('game:pass'), []),
    nextRound: useCallback(() => socketRef.current?.emit('game:nextRound'), []),
    resetGame: useCallback(() => socketRef.current?.emit('game:resetGame'), []),
  }
}
