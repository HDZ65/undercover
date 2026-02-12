import { motion } from 'motion/react'
import { useGameActor } from '../../hooks/useGameActor'

export function Distribution() {
  const [snapshot, send] = useGameActor()

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-8 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="text-4xl font-bold">Role Distribution - Coming Soon</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Distributing roles to {snapshot.context.players.length} players
      </p>
      <div className="text-sm text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 p-4 rounded">
        <p>Current State: {String(snapshot.value)}</p>
      </div>
      <motion.button
        onClick={() => send({ type: 'START_ROUND' })}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Start Round
      </motion.button>
    </motion.div>
  )
}
