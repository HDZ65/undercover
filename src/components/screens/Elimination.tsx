import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useGameActor } from '../../hooks/useGameActor'
import type { Role } from '../../types/game'

const ROLE_COLORS: Record<Role, string> = {
  civil: 'from-emerald-500 to-emerald-600',
  undercover: 'from-rose-500 to-rose-600',
  mrwhite: 'from-slate-500 to-slate-600',
}

const ROLE_LABELS: Record<Role, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mrwhite: 'Mr. White',
}

export function Elimination() {
  const [snapshot] = useGameActor()

  const players = snapshot.context.players || []
  const eliminatedPlayerId = snapshot.context.eliminatedPlayer
  const eliminatedPlayer = players.find((p) => p.id === eliminatedPlayerId)
  const voteResolution = snapshot.context.voteResolution || 'resolved'

  useEffect(() => {
    // Auto-transition after 3 seconds - machine handles via always guards
    const timer = setTimeout(() => {
      // Machine will auto-transition
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  if (!eliminatedPlayer) {
    return null
  }

  const role = eliminatedPlayer.role as Role

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Elimination Badge */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
      >
        <div className="inline-block bg-red-600 dark:bg-red-500 text-white px-6 py-3 rounded-full shadow-lg mb-4">
          <p className="text-sm font-bold uppercase tracking-wider">
            {voteResolution === 'secondTie' ? 'Élimination aléatoire' : 'Éliminé'}
          </p>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          {eliminatedPlayer.name}
        </h1>
      </motion.div>

      {/* Player Card with Role Reveal */}
      <motion.div
        className="max-w-sm w-full mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className={`rounded-2xl bg-gradient-to-br ${ROLE_COLORS[role]} p-8 shadow-2xl text-white text-center`}>
          {/* Avatar */}
          {eliminatedPlayer.avatar && (
            <motion.img
              src={eliminatedPlayer.avatar}
              alt={eliminatedPlayer.name}
              className="w-24 h-24 rounded-full mx-auto mb-6 bg-white/20 backdrop-blur-sm border-4 border-white/30"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4, type: 'spring', bounce: 0.5 }}
            />
          )}

          {/* Role Badge */}
          <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full inline-block mb-4">
            <p className="text-sm font-medium uppercase tracking-wider">Rôle révélé</p>
          </div>

          {/* Role Name */}
          <h2 className="text-3xl font-bold">{ROLE_LABELS[role]}</h2>
        </div>
      </motion.div>

      {/* Auto-transition Message */}
      <motion.p
        className="text-sm text-slate-500 dark:text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        Transition automatique dans 3 secondes...
      </motion.p>

      {/* Animated Dots */}
      <motion.div
        className="flex gap-2 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  )
}
