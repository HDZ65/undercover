import { useContext, useState } from 'react'
import { motion } from 'motion/react'
import { createAvatar } from '@dicebear/core'
import { lorelei } from '@dicebear/collection'
import type { WordCategory } from '@undercover/shared'
import { SocketContext } from '../../App'

const CATEGORIES: { value: WordCategory; label: string }[] = [
  { value: 'aleatoire', label: 'Aléatoire' },
  { value: 'facile', label: 'Facile' },
  { value: 'expert', label: 'Expert' },
  { value: 'adulte', label: 'Adulte' },
  { value: 'gastronomie', label: 'Gastronomie' },
  { value: 'voyage', label: 'Voyage' },
]

const generateAvatar = (name: string): string =>
  createAvatar(lorelei, {
    seed: name,
    size: 128,
  }).toDataUri()

interface LobbyProps {
  onBack?: () => void
}

export function Lobby({ onBack }: LobbyProps) {
  const socket = useContext(SocketContext)
  const [selectedCategory, setSelectedCategory] = useState<WordCategory>('facile')

  if (!socket || !socket.publicState) {
    return null
  }

  const publicState = socket.publicState
  const players = publicState.players
  const canStart = players.length >= 3 && players.length <= 20
  const hideRoles = publicState.hideRoles
  const noElimination = publicState.noElimination

  const handleCopyRoom = async () => {
    if (!socket.roomCode) {
      return
    }

    await navigator.clipboard.writeText(socket.roomCode)
  }

  const handleSelectCategory = (category: WordCategory) => {
    setSelectedCategory(category)
    socket.setCategory(category)
  }

  return (
    <motion.div
      className="w-full max-w-3xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-xl space-y-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">Code de la salle</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-widest bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              {socket.roomCode}
            </h1>
            <button
              onClick={handleCopyRoom}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200"
            >
              Copier
            </button>
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{players.length}/20 joueurs connectes</p>
        </div>

        <div className="grid gap-3 max-h-[340px] overflow-y-auto">
          {players.map((player) => (
            <motion.div
              key={player.id}
              className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex items-center gap-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <img src={player.avatar ?? generateAvatar(player.name)} alt={player.name} className="w-11 h-11 rounded-full" />
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{player.name}</p>
                {player.id === publicState.hostId && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">Hote</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {socket.isHost ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categorie</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <motion.button
                    key={category.value}
                    onClick={() => handleSelectCategory(category.value)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold transition-all ${
                      selectedCategory === category.value
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                    }`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {category.label}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => socket.setHideRoles(!hideRoles)}
                className="w-full flex items-center justify-between min-h-[44px] px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 transition-all"
              >
                <div className="text-left">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Rôles masqués</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Personne ne connaît son rôle, seulement son mot</p>
                </div>
                <div
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    hideRoles ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <motion.div
                    className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                    animate={{ left: hideRoles ? 22 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>

              <button
                onClick={() => socket.setNoElimination(!noElimination)}
                className="w-full flex items-center justify-between min-h-[44px] px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 transition-all"
              >
                <div className="text-left">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Mode sans élimination</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Les joueurs votés sont démasqués mais restent en jeu. Points individuels.</p>
                </div>
                <div
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    noElimination ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <motion.div
                    className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                    animate={{ left: noElimination ? 22 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>
            </div>

            {!canStart && (
              <p className="text-sm text-rose-600 dark:text-rose-400 text-center">
                Minimum 3 joueurs pour commencer
              </p>
            )}

            <motion.button
              onClick={socket.startDistribution}
              disabled={!canStart}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white font-bold text-lg rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: canStart ? 1.01 : 1 }}
              whileTap={{ scale: canStart ? 0.99 : 1 }}
            >
              Commencer la partie
            </motion.button>
          </div>
        ) : (
          <div className="bg-slate-100 dark:bg-slate-900/60 rounded-lg p-4 text-center text-slate-600 dark:text-slate-400 font-medium">
            En attente de l'hote...
          </div>
        )}

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
