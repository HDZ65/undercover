import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { io, type Socket } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

type LandingMode = 'create' | 'join'

interface UnoLobbyProps {
  onBack?: () => void
}

interface UnoPublicPlayer {
  id: string
  name: string
  handSize: number
  hasCalledUno: boolean
  isConnected: boolean
}

interface UnoLobbyState {
  phase: string
  players: UnoPublicPlayer[]
  roomCode: string
  hostId: string
  houseRules: {
    stackDrawTwo: boolean
    stackDrawFour: boolean
    bluffChallenge: boolean
    forcePlay: boolean
  }
  targetScore: number
  turnTimer: number
}

export function UnoLobby({ onBack }: UnoLobbyProps) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<LandingMode>('create')
  const [playerName, setPlayerName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [, setPlayerId] = useState<string | null>(null)
  const [lobbyState, setLobbyState] = useState<UnoLobbyState | null>(null)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    const socket = io(`${SERVER_URL}/uno`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      setError(err.message)
      setConnected(false)
    })

    socket.on('room:created', (data: { roomCode: string; playerToken: string; playerId: string }) => {
      setError(null)
      setRoomCode(data.roomCode)
      setPlayerId(data.playerId)
      setIsHost(true)
    })

    socket.on('room:joined', (data: { roomCode: string; playerToken: string; playerId: string }) => {
      setError(null)
      setRoomCode(data.roomCode)
      setPlayerId(data.playerId)
    })

    socket.on('room:error', (data: { message: string }) => {
      setError(data.message)
    })

    socket.on('game:state', (data: { publicState: UnoLobbyState; privateState: unknown }) => {
      setLobbyState(data.publicState)
      setRoomCode(data.publicState.roomCode)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const handleCreate = useCallback(() => {
    const name = playerName.trim()
    if (!name) {
      setError('Le nom du joueur est requis.')
      return
    }
    setError(null)
    socketRef.current?.emit('room:create', { playerName: name })
  }, [playerName])

  const handleJoin = useCallback(() => {
    const name = playerName.trim()
    const code = joinRoomCode.trim()
    if (!name || !code) {
      setError('Le code de salle et le nom du joueur sont requis.')
      return
    }
    setError(null)
    socketRef.current?.emit('room:join', { roomCode: code, playerName: name })
  }, [playerName, joinRoomCode])

  const handleLeave = useCallback(() => {
    socketRef.current?.emit('room:leave')
    setRoomCode(null)
    setPlayerId(null)
    setLobbyState(null)
    setIsHost(false)
  }, [])

  const tabClass = (tab: LandingMode) =>
    `min-h-[48px] rounded-lg font-semibold transition-all text-sm ${
      mode === tab
        ? 'bg-gradient-to-r from-red-500 to-yellow-500 text-white shadow-md'
        : 'text-slate-700 dark:text-slate-300'
    }`

  // In a room — show lobby state
  if (roomCode && lobbyState) {
    return (
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
          <motion.h1
            className="text-5xl md:text-6xl font-bold text-center tracking-tight mb-2"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 bg-clip-text text-transparent">
              UNO
            </span>
          </motion.h1>

          <div className="text-center mb-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">Code de la salle</p>
            <p className="text-3xl font-black tracking-wider text-slate-900 dark:text-slate-100">
              {lobbyState.roomCode}
            </p>
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Joueurs ({lobbyState.players.length})
            </p>
            {lobbyState.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {player.name}
                </span>
                {player.id === lobbyState.hostId && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                    Hote
                  </span>
                )}
              </div>
            ))}
          </div>

          {isHost && lobbyState.players.length >= 2 && (
            <motion.button
              onClick={() => {
                socketRef.current?.emit('game:startGame', {
                  houseRules: lobbyState.houseRules,
                  targetScore: lobbyState.targetScore,
                  turnTimer: lobbyState.turnTimer,
                })
              }}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 hover:from-red-600 hover:to-yellow-600 text-white font-bold text-lg rounded-lg shadow-lg mb-4"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Lancer la partie
            </motion.button>
          )}

          {isHost && lobbyState.players.length < 2 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">
              En attente d'autres joueurs...
            </p>
          )}

          <button
            onClick={() => {
              handleLeave()
              if (onBack) onBack()
            }}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Quitter la salle
          </button>
        </div>
      </motion.div>
    )
  }

  // Landing — create or join
  return (
    <motion.div
      className="w-full max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
        <motion.h1
          className="text-5xl md:text-6xl font-bold text-center tracking-tight mb-2"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 bg-clip-text text-transparent">
            UNO
          </span>
        </motion.h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          Multijoueur en temps reel
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/70">
          <button onClick={() => setMode('create')} className={tabClass('create')}>
            Creer
          </button>
          <button onClick={() => setMode('join')} className={tabClass('join')}>
            Rejoindre
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {mode === 'join' && (
              <input
                type="text"
                value={joinRoomCode}
                onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                placeholder="Code de la salle"
                className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                maxLength={8}
              />
            )}

            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Nom du joueur"
              className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              maxLength={24}
            />

            <motion.button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 hover:from-red-600 hover:to-yellow-600 text-white font-bold text-lg rounded-lg shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {mode === 'create' ? 'Creer une partie' : 'Rejoindre une partie'}
            </motion.button>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 text-sm text-center">
          <span className={connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {connected ? 'Connecte au serveur principal (/uno)' : 'Connexion au serveur principal (/uno)...'}
          </span>
          {error && (
            <p className="text-rose-600 dark:text-rose-400 mt-2">{error}</p>
          )}
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Retour aux jeux
          </button>
        )}
      </div>
    </motion.div>
  )
}
