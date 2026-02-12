import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useGameActor } from '../../hooks/useGameActor'

export function Elimination() {
  const [snapshot] = useGameActor()

  useEffect(() => {
    // Auto-transition after 3 seconds
    const timer = setTimeout(() => {
      // The machine will auto-transition via always guards
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-8 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="text-4xl font-bold">Elimination - Coming Soon</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Player eliminated: {snapshot.context.eliminatedPlayer || 'None'}
      </p>
      <div className="text-sm text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 p-4 rounded">
        <p>Current State: {String(snapshot.value)}</p>
      </div>
      <p className="text-sm text-slate-500">Auto-transitioning in 3 seconds...</p>
    </motion.div>
  )
}
