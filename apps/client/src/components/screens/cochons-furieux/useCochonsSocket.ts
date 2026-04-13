import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  CochonsClientToServerEvents,
  CochonsServerToClientEvents,
  CochonsPublicState,
  CochonsPrivateState,
  ShotInput,
  ShotResult,
  TemplateId,
  CellType,
  WeaponType,
} from '@undercover/shared'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
type CochonsSocket = Socket<CochonsServerToClientEvents, CochonsClientToServerEvents>

const SK = {
  playerId: 'cochons_playerId',
  playerToken: 'cochons_playerToken',
  roomCode: 'cochons_roomCode',
  playerName: 'cochons_playerName',
}

export interface ShotAnimationData {
  shooterId: string
  targetId: string
  input: ShotInput
  result: ShotResult
}

export function useCochonsSocket() {
  const socketRef = useRef<CochonsSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [publicState, setPublicState] = useState<CochonsPublicState | null>(null)
  const [privateState, setPrivateState] = useState<CochonsPrivateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem(SK.roomCode))
  const [shotAnimation, setShotAnimation] = useState<ShotAnimationData | null>(null)
  const [buildTimeRemaining, setBuildTimeRemaining] = useState(60)

  useEffect(() => {
    const socket: CochonsSocket = io(`${SERVER_URL}/cochons-furieux`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true); setError(null)
      const r = localStorage.getItem(SK.roomCode)
      const t = localStorage.getItem(SK.playerToken)
      const n = localStorage.getItem(SK.playerName)
      if (r && t && n) socket.emit('room:join', { roomCode: r, playerName: n, playerToken: t })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('game:state', d => { setPublicState(d.publicState); setPrivateState(d.privateState) })
    socket.on('room:joined', d => {
      setRoomCode(d.roomCode)
      localStorage.setItem(SK.roomCode, d.roomCode)
      localStorage.setItem(SK.playerId, d.playerId)
      localStorage.setItem(SK.playerToken, d.playerToken)
      setError(null)
    })
    socket.on('room:error', d => setError(d.message))
    socket.on('game:shotAnimation', d => setShotAnimation(d))
    socket.on('game:buildTimer', d => setBuildTimeRemaining(d.secondsRemaining))

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
    setRoomCode(null); setPublicState(null); setPrivateState(null)
    localStorage.removeItem(SK.roomCode); localStorage.removeItem(SK.playerToken); localStorage.removeItem(SK.playerId)
  }, [])

  return {
    connected, publicState, privateState, error, roomCode, shotAnimation, buildTimeRemaining,
    clearShotAnimation: useCallback(() => setShotAnimation(null), []),
    createRoom, joinRoom, leaveRoom,
    startGame: useCallback(() => socketRef.current?.emit('game:startGame'), []),
    selectTemplate: useCallback((id: TemplateId) => socketRef.current?.emit('game:selectTemplate', { templateId: id }), []),
    placeBlock: useCallback((col: number, row: number, type: CellType) => socketRef.current?.emit('game:placeBlock', { col, row, type }), []),
    removeBlock: useCallback((col: number, row: number) => socketRef.current?.emit('game:removeBlock', { col, row }), []),
    placePig: useCallback((col: number, row: number) => socketRef.current?.emit('game:placePig', { col, row }), []),
    removePig: useCallback((col: number, row: number) => socketRef.current?.emit('game:removePig', { col, row }), []),
    confirmBuild: useCallback(() => socketRef.current?.emit('game:confirmBuild'), []),
    fire: useCallback((angle: number, power: number, weapon: WeaponType) => socketRef.current?.emit('game:fire', { angle, power, weapon }), []),
    resetGame: useCallback(() => socketRef.current?.emit('game:resetGame'), []),
  }
}
