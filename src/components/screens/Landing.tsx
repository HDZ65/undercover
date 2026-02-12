import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameActor } from '../../hooks/useGameActor'
import { ThemeToggle } from '../ui/ThemeToggle'

const STORAGE_KEY = 'undercover-game-state'

/**
 * Landing screen with animated logo, "Nouvelle Partie" button,
 * and conditional "Reprendre" button based on saved game state.
 */
export function Landing() {
  const [, send] = useGameActor()
  const [hasSavedGame, setHasSavedGame] = useState(false)

  // Check if there's a saved game state in localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY)
    setHasSavedGame(savedState !== null)
  }, [])

  const handleNewGame = () => {
    send({ type: 'START_GAME' })
  }

  const handleResume = () => {
    // State is already loaded by useGameActor, just navigate
    send({ type: 'START_GAME' })
  }

  return (
    <AnimatePresence>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Main Content */}
        <motion.div
          className="flex flex-col items-center justify-center gap-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                UNDERCOVER
              </span>
            </h1>
          </motion.div>

          {/* Buttons Container */}
          <motion.div
            className="flex flex-col gap-4 w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Nouvelle Partie Button */}
            <motion.button
              onClick={handleNewGame}
              className="min-h-12 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200 text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Nouvelle Partie
            </motion.button>

            {/* Reprendre Button - Conditional */}
            {hasSavedGame && (
              <motion.button
                onClick={handleResume}
                className="min-h-12 px-6 py-3 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors duration-200 text-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                Reprendre
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
