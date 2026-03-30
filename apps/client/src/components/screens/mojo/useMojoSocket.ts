import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  MojoClientToServerEvents,
  MojoServerToClientEvents,
  MojoPublicState,
  MojoPrivateState,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
type MojoSocket = Socket<MojoServerToClientEvents, MojoClientToServerEvents>

const SK = {
  playerId: 'mojo_playerId',
  playerToken: 'mojo_playerToken',
  roomCode: 'mojo_roomCode',
  playerName: 'mojo_playerName',
}

export function useMojoSocket() {
  const socketRef = useRef<MojoSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [publicState, setPublicState] = useState<MojoPublicState | null>(null)
  const [privateState, setPrivateState] = useState<MojoPrivateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem(SK.roomCode))

  useEffect(() => {
    const socket: MojoSocket = io(`${SERVER_URL}/mojo`, {
      transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000,
    })
    socketRef.current = socket
    socket.on('connect', () => {
      setConnected(true); setError(null)
      const r = localStorage.getItem(SK.roomCode), t = localStorage.getItem(SK.playerToken), n = localStorage.getItem(SK.playerName)
      if (r && t && n) socket.emit('room:join', { roomCode: r, playerName: n, playerToken: t })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('game:state', d => { setPublicState(d.publicState); setPrivateState(d.privateState) })
    socket.on('room:joined', d => { setRoomCode(d.roomCode); localStorage.setItem(SK.roomCode, d.roomCode); localStorage.setItem(SK.playerId, d.playerId); localStorage.setItem(SK.playerToken, d.playerToken); setError(null) })
    socket.on('room:error', d => setError(d.message))
    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  const e = socketRef.current
  const createRoom = useCallback((name: string) => { localStorage.setItem(SK.playerName, name); e?.emit('room:create', { playerName: name }) }, [e])
  const joinRoom = useCallback((code: string, name: string) => { localStorage.setItem(SK.playerName, name); e?.emit('room:join', { roomCode: code, playerName: name }) }, [e])
  const leaveRoom = useCallback(() => { e?.emit('room:leave'); setRoomCode(null); setPublicState(null); setPrivateState(null); localStorage.removeItem(SK.roomCode); localStorage.removeItem(SK.playerToken); localStorage.removeItem(SK.playerId) }, [e])

  return {
    connected, publicState, privateState, error, roomCode,
    createRoom, joinRoom, leaveRoom,
    startGame: useCallback(() => e?.emit('game:startGame'), [e]),
    setDoubleDiscard: useCallback((v: boolean) => e?.emit('game:setDoubleDiscard', { enabled: v }), [e]),
    playCard: useCallback((cardId: number, discardIndex?: number) => e?.emit('game:playCard', { cardId, discardIndex }), [e]),
    draw: useCallback((source: 'pile' | 'discard', discardIndex?: number) => e?.emit('game:draw', { source, discardIndex }), [e]),
    endTurn: useCallback(() => e?.emit('game:endTurn'), [e]),
    revealMojoCard: useCallback((cardId: number) => e?.emit('game:revealMojoCard', { cardId }), [e]),
    nextRound: useCallback(() => e?.emit('game:nextRound'), [e]),
    resetGame: useCallback(() => e?.emit('game:resetGame'), [e]),
  }
}
