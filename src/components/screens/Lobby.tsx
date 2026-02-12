import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createAvatar } from '@dicebear/core'
import { lorelei } from '@dicebear/collection'
import { useGameActor } from '../../hooks/useGameActor'
import type { Player, WordCategory } from '../../types/game'

const CATEGORIES: { value: WordCategory; label: string }[] = [
  { value: 'facile', label: 'Facile' },
  { value: 'expert', label: 'Expert' },
  { value: 'adulte', label: 'Adulte' },
  { value: 'gastronomie', label: 'Gastronomie' },
  { value: 'voyage', label: 'Voyage' },
]

const generateAvatar = (name: string): string => {
  return createAvatar(lorelei, {
    seed: name,
    size: 128,
  }).toDataUri()
}

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function Lobby() {
  const [snapshot, send] = useGameActor()
  const [playerName, setPlayerName] = useState('')
  const [pulseId, setPulseId] = useState<string | null>(null)

  const players = snapshot.context.players || []
  const category = snapshot.context.category || 'facile'
  const canStart = players.length >= 3 && players.length <= 20

  const handleAddPlayer = () => {
    if (!playerName.trim()) return
    if (players.length >= 20) return

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: playerName.trim(),
      role: undefined,
      isEliminated: false,
      avatar: generateAvatar(playerName.trim()),
    }

    send({
      type: 'UPDATE_PLAYERS',
      players: [...players, newPlayer],
    })

    // Haptic feedback + visual pulse
    vibrate(50)
    setPulseId(newPlayer.id)
    setTimeout(() => setPulseId(null), 300)

    setPlayerName('')
  }

  const handleRemovePlayer = (playerId: string) => {
    send({
      type: 'UPDATE_PLAYERS',
      players: players.filter((p) => p.id !== playerId),
    })

    // Haptic feedback
    vibrate(50)
  }

  const handleCategoryChange = (newCategory: WordCategory) => {
    send({ type: 'SET_CATEGORY', category: newCategory })
    vibrate(30)
  }

  const handleStartGame = () => {
    if (!canStart) return
    vibrate(100)
    send({ type: 'START_ROLE_DISTRIBUTION' })
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
          Lobby
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          {players.length}/20 joueurs
        </p>
      </motion.div>

      {/* Add Player Section */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
            placeholder="Nom du joueur"
            className="flex-1 min-h-[44px] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            maxLength={20}
          />
          <motion.button
            onClick={handleAddPlayer}
            disabled={!playerName.trim() || players.length >= 20}
            className="min-h-[44px] min-w-[44px] px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: playerName.trim() && players.length < 20 ? 1.05 : 1 }}
            whileTap={{ scale: playerName.trim() && players.length < 20 ? 0.95 : 1 }}
          >
            Ajouter
          </motion.button>
        </div>
      </motion.div>

      {/* Category Selection */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Catégorie
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={`min-h-[44px] px-4 py-2 rounded-lg font-medium transition-all ${
                category === cat.value
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {cat.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Player List */}
      <motion.div
        className="flex-1 mb-6 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {players.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Aucun joueur. Ajoutez au moins 3 joueurs pour commencer.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3">
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: pulseId === player.id ? 1.05 : 1,
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
                >
                  {/* Avatar */}
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700"
                  />

                  {/* Name */}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {player.name}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <motion.button
                    onClick={() => handleRemovePlayer(player.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label={`Retirer ${player.name}`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        {!canStart && players.length > 0 && (
          <p className="text-center text-sm text-red-600 dark:text-red-400 mb-2">
            {players.length < 3
              ? `Ajoutez encore ${3 - players.length} joueur(s) minimum`
              : 'Maximum 20 joueurs'}
          </p>
        )}
        <motion.button
          onClick={handleStartGame}
          disabled={!canStart}
          className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-bold text-lg rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 shadow-lg"
          whileHover={{ scale: canStart ? 1.02 : 1 }}
          whileTap={{ scale: canStart ? 0.98 : 1 }}
        >
          Commencer la partie
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
