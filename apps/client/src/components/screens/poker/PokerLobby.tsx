import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@undercover/shared'
import { PokerTable } from './PokerTable'
import { usePokerSocket } from './hooks/usePokerSocket'

interface PokerLobbyProps {
  onBack?: () => void
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

type PokerSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function PokerLobby({ onBack }: PokerLobbyProps) {
  const [socket, setSocket] = useState<PokerSocket | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const [createFormData, setCreateFormData] = useState({
    smallBlind: 50,
    bigBlind: 100,
    minBuyIn: 1000,
    maxBuyIn: 10000,
  })

  const [joinFormData, setJoinFormData] = useState({
    buyIn: 5000,
    seatIndex: 0,
  })

  const poker = usePokerSocket(socket)

  useEffect(() => {
    const nextSocket: PokerSocket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })

    setSocket(nextSocket)

    return () => {
      nextSocket.removeAllListeners()
      nextSocket.disconnect()
      setSocket(null)
    }
  }, [])

  const validationMessage = useMemo(() => {
    if (localError) {
      return localError
    }
    return poker.error?.message ?? null
  }, [localError, poker.error?.message])

  const handleCreateTable = () => {
    const name = playerName.trim()
    if (!name) {
      setLocalError('Le nom du joueur est requis.')
      return
    }

    setLocalError(null)
    poker.createTable(name, {
      maxPlayers: 6,
      smallBlind: createFormData.smallBlind,
      bigBlind: createFormData.bigBlind,
      minBuyIn: createFormData.minBuyIn,
      maxBuyIn: createFormData.maxBuyIn,
      actionTimeoutMs: 30000,
      straddleEnabled: false,
      runItTwiceEnabled: false,
    })
    setShowCreateForm(false)
  }

  const handleJoinTable = (tableId: string) => {
    const name = playerName.trim()
    if (!name) {
      setLocalError('Le nom du joueur est requis.')
      return
    }

    setLocalError(null)
    poker.joinTable(tableId, name, joinFormData.buyIn, joinFormData.seatIndex)
    setShowJoinForm(false)
    setSelectedTable(null)
  }

  const formatChips = (centimes: number) => (centimes / 100).toFixed(2)

  if (poker.publicState) {
    return (
      <div className="relative w-full">
        <PokerTable
          gameState={poker.publicState}
          playerHoleCards={poker.privateState?.holeCards}
          playerId={poker.privateState?.playerId}
        />

        <div className="absolute top-4 left-4 right-4 md:left-auto md:w-80 space-y-2">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-3 shadow-lg">
            <p
              className={`text-sm font-medium ${
                poker.isConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {poker.isConnected ? 'Connecté au serveur' : 'Connexion au serveur...'}
            </p>
            {validationMessage && (
              <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{validationMessage}</p>
            )}
          </div>

          <motion.button
            onClick={() => poker.leaveTable()}
            className="w-full min-h-[44px] px-5 py-2 bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-700 dark:to-slate-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Quitter la table
          </motion.button>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full min-h-[44px] text-sm font-semibold text-white/90 hover:text-white transition-colors"
            >
              ← Retour aux jeux
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="w-full max-w-4xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8 space-y-6">
        <div className="text-center">
          <motion.h1
            className="text-5xl md:text-6xl font-bold tracking-tight mb-2"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
              POKER
            </span>
          </motion.h1>
          <p className="text-slate-600 dark:text-slate-400">Lobby</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/60 p-4 space-y-3">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
            Nom du joueur
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value)
              if (localError) {
                setLocalError(null)
              }
            }}
            placeholder="Votre pseudo"
            maxLength={24}
            className="w-full min-h-[48px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span
            className={`text-sm ${
              poker.isConnected
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {poker.isConnected ? 'Connecté au serveur' : 'Connexion au serveur...'}
          </span>
          {validationMessage && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{validationMessage}</p>
          )}
        </div>

        <motion.button
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="w-full min-h-[44px] px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-500 dark:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {showCreateForm ? '✕ Annuler' : '+ Créer une table'}
        </motion.button>

        {showCreateForm && (
          <motion.div
            className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                  Small Blind ($)
                </label>
                <input
                  type="number"
                  value={createFormData.smallBlind / 100}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    if (Number.isFinite(value)) {
                      setCreateFormData((prev) => ({
                        ...prev,
                        smallBlind: Math.max(0, Math.round(value * 100)),
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                  Big Blind ($)
                </label>
                <input
                  type="number"
                  value={createFormData.bigBlind / 100}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    if (Number.isFinite(value)) {
                      setCreateFormData((prev) => ({
                        ...prev,
                        bigBlind: Math.max(0, Math.round(value * 100)),
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                  Min Buy-in ($)
                </label>
                <input
                  type="number"
                  value={createFormData.minBuyIn / 100}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    if (Number.isFinite(value)) {
                      setCreateFormData((prev) => ({
                        ...prev,
                        minBuyIn: Math.max(0, Math.round(value * 100)),
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                  Max Buy-in ($)
                </label>
                <input
                  type="number"
                  value={createFormData.maxBuyIn / 100}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    if (Number.isFinite(value)) {
                      setCreateFormData((prev) => ({
                        ...prev,
                        maxBuyIn: Math.max(0, Math.round(value * 100)),
                      }))
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <motion.button
              onClick={handleCreateTable}
              className="w-full min-h-[44px] px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Créer la table
            </motion.button>
          </motion.div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tables disponibles</h2>
          {poker.tableList.length === 0 ? (
            <div className="bg-slate-100 dark:bg-slate-900/60 rounded-lg p-4 text-center text-slate-600 dark:text-slate-400">
              Aucune table disponible
            </div>
          ) : (
            poker.tableList.map((table) => (
              <motion.div
                key={table.id}
                className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      ${formatChips(table.config.smallBlind)} / ${formatChips(table.config.bigBlind)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {table.playerCount} / {table.config.maxPlayers} joueurs
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Buy-in: ${formatChips(table.config.minBuyIn)} - ${formatChips(table.config.maxBuyIn)}
                    </p>
                  </div>
                  <motion.button
                    onClick={() => {
                      setSelectedTable(table.id)
                      setShowJoinForm(true)
                      setJoinFormData({
                        buyIn: table.config.minBuyIn,
                        seatIndex: 0,
                      })
                    }}
                    className="min-h-[44px] px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Rejoindre
                  </motion.button>
                </div>

                {selectedTable === table.id && showJoinForm && (
                  <motion.div
                    className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-300 dark:border-slate-600 space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                          Buy-in ($)
                        </label>
                        <input
                          type="number"
                          value={joinFormData.buyIn / 100}
                          onChange={(e) => {
                            const value = Number.parseFloat(e.target.value)
                            if (Number.isFinite(value)) {
                              const centimes = Math.round(value * 100)
                              const clamped = Math.min(
                                table.config.maxBuyIn,
                                Math.max(table.config.minBuyIn, centimes),
                              )
                              setJoinFormData((prev) => ({ ...prev, buyIn: clamped }))
                            }
                          }}
                          min={table.config.minBuyIn / 100}
                          max={table.config.maxBuyIn / 100}
                          className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                          Siège
                        </label>
                        <select
                          value={joinFormData.seatIndex}
                          onChange={(e) =>
                            setJoinFormData((prev) => ({
                              ...prev,
                              seatIndex: Number.parseInt(e.target.value, 10),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                        >
                          {Array.from({ length: table.config.maxPlayers }).map((_, index) => (
                            <option key={index} value={index}>
                              Siège {index + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleJoinTable(table.id)}
                        className="flex-1 min-h-[44px] px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        Rejoindre
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          setShowJoinForm(false)
                          setSelectedTable(null)
                        }}
                        className="flex-1 min-h-[44px] px-4 py-2 bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-semibold rounded-lg hover:bg-slate-400 dark:hover:bg-slate-500 transition-all"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        Annuler
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Retour aux jeux
          </button>
        )}
      </div>
    </motion.div>
  )
}
