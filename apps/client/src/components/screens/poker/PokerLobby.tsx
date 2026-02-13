import { motion } from 'motion/react'

interface PokerLobbyProps {
  onBack?: () => void
}

export function PokerLobby({ onBack }: PokerLobbyProps) {
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
          <span className="bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
            POKER
          </span>
        </motion.h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
          Lobby - Coming Soon
        </p>

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
