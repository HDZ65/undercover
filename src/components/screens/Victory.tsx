import { useEffect } from 'react'
import { motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { useGameActor } from '../../hooks/useGameActor'
import type { Role } from '../../types/game'

const ROLE_COLORS: Record<Role, string> = {
  civil: 'from-emerald-500 to-emerald-600',
  undercover: 'from-rose-500 to-rose-600',
  mrwhite: 'from-slate-500 to-slate-600',
}

const ROLE_LABELS: Record<Role, string> = {
  civil: 'Civils',
  undercover: 'Undercovers',
  mrwhite: 'Mr. White',
}

const ROLE_MESSAGES: Record<Role, string> = {
  civil: 'Les civils ont démasqué tous les imposteurs !',
  undercover: 'Les undercovers ont infiltré la partie !',
  mrwhite: 'Mr. White a deviné le mot secret !',
}

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function Victory() {
  const [snapshot, send] = useGameActor()

  const winner = snapshot.context.winner as Role
  const players = snapshot.context.players || []

  useEffect(() => {
    // Trigger confetti for civil victory
    if (winner === 'civil') {
      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#34d399', '#6ee7b7'],
        })
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#34d399', '#6ee7b7'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }

      frame()
    }

    // Haptic feedback
    vibrate(200)
  }, [winner])

  const handleResetGame = () => {
    vibrate(100)
    send({ type: 'RESET_GAME' })
  }

  if (!winner) {
    return null
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col p-6 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Victory Badge */}
      <motion.div
        className="text-center mb-8 mt-8"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.5 }}
      >
        <div className={`inline-block bg-gradient-to-r ${ROLE_COLORS[winner]} text-white px-8 py-4 rounded-full shadow-2xl mb-6`}>
          <p className="text-lg font-bold uppercase tracking-wider">Victoire !</p>
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {ROLE_LABELS[winner]}
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          {ROLE_MESSAGES[winner]}
        </p>
      </motion.div>

      {/* Role Reveal Table */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 text-center">
          Révélation des rôles
        </h2>
        <div className="grid gap-3">
          {players.map((player, index) => {
            const role = player.role as Role
            return (
              <motion.div
                key={player.id}
                className={`flex items-center gap-4 p-4 rounded-lg shadow-sm border-2 ${
                  player.isEliminated
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 opacity-60'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
              >
                {/* Avatar */}
                {player.avatar && (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700"
                  />
                )}

                {/* Name */}
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {player.name}
                    {player.isEliminated && (
                      <span className="ml-2 text-sm text-red-600 dark:text-red-400">
                        (Éliminé)
                      </span>
                    )}
                  </p>
                </div>

                {/* Role Badge */}
                <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${ROLE_COLORS[role]} text-white font-semibold text-sm`}>
                  {ROLE_LABELS[role]}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Reset Button */}
      <motion.button
        onClick={handleResetGame}
        className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-bold text-lg rounded-lg shadow-lg mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Nouvelle partie
      </motion.button>
    </motion.div>
  )
}
