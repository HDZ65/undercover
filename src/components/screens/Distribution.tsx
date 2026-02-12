import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function Distribution() {
  const [snapshot, send] = useGameActor()
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)

  const players = snapshot.context.players || []
  const wordPair = snapshot.context.wordPair
  const currentPlayer = players[currentPlayerIndex]

  if (!currentPlayer) {
    return null
  }

  const role = currentPlayer.role as Role
  const word = role === 'civil' ? wordPair?.civil : role === 'undercover' ? wordPair?.undercover : null

  const handleReveal = () => {
    setIsRevealed(true)
    vibrate(100)
  }

  const handleNext = () => {
    vibrate(50)
    
    if (currentPlayerIndex < players.length - 1) {
      // Next player
      setCurrentPlayerIndex(currentPlayerIndex + 1)
      setIsRevealed(false)
    } else {
      // All players revealed, start round
      send({ type: 'START_ROUND' })
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress Indicator */}
      <motion.div
        className="absolute top-6 left-0 right-0 px-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Joueur {currentPlayerIndex + 1}/{players.length}
          </span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {Math.round(((currentPlayerIndex + 1) / players.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentPlayerIndex + 1) / players.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center gap-8 max-w-md w-full">
        {/* Player Name */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {currentPlayer.name}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {isRevealed ? 'Mémorisez votre rôle et votre mot' : 'Appuyez pour révéler votre rôle'}
          </p>
        </motion.div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isRevealed ? 'revealed' : 'hidden'}
            className="relative w-full aspect-[3/4] max-w-sm cursor-pointer"
            onClick={!isRevealed ? handleReveal : undefined}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: isRevealed ? 180 : 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Card Back (Hidden State) */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 shadow-2xl flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center text-white">
                <svg
                  className="w-24 h-24 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p className="text-xl font-bold">Appuyez pour révéler</p>
              </div>
            </motion.div>

            {/* Card Front (Revealed State) */}
            <motion.div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${ROLE_COLORS[role]} shadow-2xl flex flex-col items-center justify-center p-8 text-white`}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Role Badge */}
              <div className="mb-8">
                <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                  <p className="text-sm font-medium uppercase tracking-wider">Rôle</p>
                </div>
                <h3 className="text-4xl font-bold mt-4">{ROLE_LABELS[role]}</h3>
              </div>

              {/* Word (with blur for Mr. White) */}
              {word ? (
                <div className="bg-white/20 backdrop-blur-sm px-8 py-6 rounded-2xl">
                  <p className="text-sm font-medium uppercase tracking-wider mb-2 opacity-90">
                    Votre mot
                  </p>
                  <p className="text-3xl font-bold">{word}</p>
                </div>
              ) : (
                <div className="bg-white/20 backdrop-blur-sm px-8 py-6 rounded-2xl relative overflow-hidden">
                  <p className="text-sm font-medium uppercase tracking-wider mb-2 opacity-90">
                    Votre mot
                  </p>
                  <p className="text-3xl font-bold blur-lg select-none">
                    ??? ??? ???
                  </p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-lg font-semibold">Aucun mot</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Next Button (only visible when revealed) */}
        <AnimatePresence>
          {isRevealed && (
            <motion.button
              onClick={handleNext}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-bold text-lg rounded-lg shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {currentPlayerIndex < players.length - 1 ? 'Joueur suivant' : 'Commencer la partie'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 px-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          ⚠️ Ne montrez votre carte qu'à vous-même
        </p>
      </motion.div>
    </motion.div>
  )
}
