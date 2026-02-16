import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  PokerPublicState,
  PokerPrivateState,
  TableConfig,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@undercover/shared'
import type { Socket } from 'socket.io-client'

interface TableListEntry {
  id: string
  playerCount: number
  config: TableConfig
}

interface TimerState {
  playerId: string
  remainingMs: number
}

interface ErrorState {
  message: string
  code: string
}

interface UsePokerSocketReturn {
  // State
  publicState: PokerPublicState | null
  privateState: PokerPrivateState | null
  tableList: TableListEntry[]
  timer: TimerState | null
  error: ErrorState | null
  isConnected: boolean
  currentTableId: string | null

  // Game actions
  fold: () => void
  check: () => void
  call: () => void
  raise: (amount: number) => void
  allIn: () => void

  // Table actions
  createTable: (config?: Partial<TableConfig>) => void
  joinTable: (tableId: string, playerName: string, buyIn: number, seatIndex?: number) => void
  leaveTable: () => void

  // Player actions
  sitOut: () => void
  sitIn: () => void
  toggleStraddle: () => void
  acceptRunItTwice: (accepted: boolean) => void
}

type PokerSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function usePokerSocket(socket: PokerSocket | null): UsePokerSocketReturn {

  // State
  const [publicState, setPublicState] = useState<PokerPublicState | null>(null)
  const [privateState, setPrivateState] = useState<PokerPrivateState | null>(null)
  const [tableList, setTableList] = useState<TableListEntry[]>([])
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentTableId, setCurrentTableId] = useState<string | null>(null)

  // Track action sequence number
  const sequenceNumberRef = useRef(0)

  // Update sequence number when state changes
  useEffect(() => {
    if (publicState) {
      sequenceNumberRef.current = 0
    }
  }, [publicState?.handNumber])

  // Setup socket listeners
  useEffect(() => {
    if (!socket) {
      return
    }

    setIsConnected(socket.connected)

    const handleConnect = () => {
      setIsConnected(true)
      setError(null)
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    const handlePokerState = (data: { publicState: PokerPublicState; privateState: PokerPrivateState }) => {
      setPublicState(data.publicState)
      setPrivateState(data.privateState)
      setCurrentTableId(data.publicState.phase !== 'lobby' ? 'current' : null)
      setError(null)
    }

    const handleTableList = (data: { tables: TableListEntry[] }) => {
      setTableList(data.tables)
    }

    const handleTimer = (data: { playerId: string; remainingMs: number }) => {
      setTimer(data)
    }

    const handleError = (data: { message: string; code: string }) => {
      setError(data)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('poker:state', handlePokerState)
    socket.on('poker:tableList', handleTableList)
    socket.on('poker:timer', handleTimer)
    socket.on('poker:error', handleError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('poker:state', handlePokerState)
      socket.off('poker:tableList', handleTableList)
      socket.off('poker:timer', handleTimer)
      socket.off('poker:error', handleError)
    }
  }, [socket])

  // Game action dispatchers
  const fold = useCallback(() => {
    if (!socket) return
    socket.emit('poker:fold')
    sequenceNumberRef.current++
  }, [socket])

  const check = useCallback(() => {
    if (!socket) return
    socket.emit('poker:check')
    sequenceNumberRef.current++
  }, [socket])

  const call = useCallback(() => {
    if (!socket) return
    socket.emit('poker:call')
    sequenceNumberRef.current++
  }, [socket])

  const raise = useCallback(
    (amount: number) => {
      if (!socket) return
      socket.emit('poker:raise', { amount })
      sequenceNumberRef.current++
    },
    [socket],
  )

  const allIn = useCallback(() => {
    if (!socket) return
    socket.emit('poker:allIn')
    sequenceNumberRef.current++
  }, [socket])

  // Table action dispatchers
  const createTable = useCallback(
    (config?: Partial<TableConfig>) => {
      if (!socket) return
      socket.emit('poker:createTable', {
        playerName: 'Player',
        config,
      })
    },
    [socket],
  )

  const joinTable = useCallback(
    (tableId: string, playerName: string, buyIn: number, seatIndex?: number) => {
      if (!socket) return
      socket.emit('poker:joinTable', {
        tableId,
        playerName,
        buyIn,
        seatIndex,
      })
    },
    [socket],
  )

  const leaveTable = useCallback(() => {
    if (!socket) return
    socket.emit('poker:leaveTable')
    setCurrentTableId(null)
    setPublicState(null)
    setPrivateState(null)
  }, [socket])

  // Player action dispatchers
  const sitOut = useCallback(() => {
    if (!socket) return
    socket.emit('poker:sitOut')
  }, [socket])

  const sitIn = useCallback(() => {
    if (!socket) return
    socket.emit('poker:sitIn')
  }, [socket])

  const toggleStraddle = useCallback(() => {
    if (!socket) return
    socket.emit('poker:toggleStraddle', { enabled: true })
  }, [socket])

  const acceptRunItTwice = useCallback(
    (accepted: boolean) => {
      if (!socket) return
      socket.emit('poker:acceptRunItTwice', { accepted })
    },
    [socket],
  )

  return useMemo(
    () => ({
      publicState,
      privateState,
      tableList,
      timer,
      error,
      isConnected,
      currentTableId,
      fold,
      check,
      call,
      raise,
      allIn,
      createTable,
      joinTable,
      leaveTable,
      sitOut,
      sitIn,
      toggleStraddle,
      acceptRunItTwice,
    }),
    [
      publicState,
      privateState,
      tableList,
      timer,
      error,
      isConnected,
      currentTableId,
      fold,
      check,
      call,
      raise,
      allIn,
      createTable,
      joinTable,
      leaveTable,
      sitOut,
      sitIn,
      toggleStraddle,
      acceptRunItTwice,
    ],
  )
}

export type { UsePokerSocketReturn }
