import { useState } from 'react'
import { motion } from 'motion/react'
import type { TableConfig } from '@undercover/shared'

interface PokerLobbyProps {
  onBack?: () => void
}

interface Table {
  id: string
  playerCount: number
  config: TableConfig
}

export function PokerLobby({ onBack }: PokerLobbyProps) {
  const [tables] = useState<Table[]>([
    {
      id: 'table-1',
      playerCount: 3,
      config: {
        maxPlayers: 6,
        smallBlind: 50,
        bigBlind: 100,
        minBuyIn: 1000,
        maxBuyIn: 10000,
        actionTimeoutMs: 30000,
        straddleEnabled: false,
        runItTwiceEnabled: false,
      },
    },
    {
      id: 'table-2',
      playerCount: 5,
      config: {
        maxPlayers: 6,
        smallBlind: 100,
        bigBlind: 200,
        minBuyIn: 2000,
        maxBuyIn: 20000,
        actionTimeoutMs: 30000,
        straddleEnabled: false,
        runItTwiceEnabled: false,
      },
    },
  ])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showJoinForm, setShowJoinForm] = useState(false)

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

  const playerBalance = 50000 // Mock player balance in centimes

  const handleCreateTable = () => {
    // TODO: Connect to socket when backend is ready
    console.log('Creating table with config:', {
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
    // TODO: Connect to socket when backend is ready
    console.log('Joining table:', {
      tableId,
      playerName: 'Player',
      buyIn: joinFormData.buyIn,
      seatIndex: joinFormData.seatIndex,
    })
    setShowJoinForm(false)
    setSelectedTable(null)
  }

  const formatChips = (centimes: number) => {
    return (centimes / 100).toFixed(2)
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
        {/* Header */}
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

        {/* Player Balance */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Votre solde</p>
          <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">
            ${formatChips(playerBalance)}
          </p>
        </div>

        {/* Create Table Button */}
        <motion.button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full min-h-[44px] px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-500 dark:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {showCreateForm ? '✕ Annuler' : '+ Créer une table'}
        </motion.button>

        {/* Create Table Form */}
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
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      smallBlind: Math.round(parseFloat(e.target.value) * 100),
                    })
                  }
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
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      bigBlind: Math.round(parseFloat(e.target.value) * 100),
                    })
                  }
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
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      minBuyIn: Math.round(parseFloat(e.target.value) * 100),
                    })
                  }
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
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      maxBuyIn: Math.round(parseFloat(e.target.value) * 100),
                    })
                  }
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

        {/* Tables List */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tables disponibles</h2>
          {tables.length === 0 ? (
            <div className="bg-slate-100 dark:bg-slate-900/60 rounded-lg p-4 text-center text-slate-600 dark:text-slate-400">
              Aucune table disponible
            </div>
          ) : (
            tables.map((table) => (
              <motion.div
                key={table.id}
                className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
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
                    }}
                    className="min-h-[44px] px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Rejoindre
                  </motion.button>
                </div>

                {/* Join Form for Selected Table */}
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
                          onChange={(e) =>
                            setJoinFormData({
                              ...joinFormData,
                              buyIn: Math.round(parseFloat(e.target.value) * 100),
                            })
                          }
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
                            setJoinFormData({
                              ...joinFormData,
                              seatIndex: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                        >
                          {Array.from({ length: table.config.maxPlayers }).map((_, i) => (
                            <option key={i} value={i}>
                              Siège {i + 1}
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

        {/* Back Button */}
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
