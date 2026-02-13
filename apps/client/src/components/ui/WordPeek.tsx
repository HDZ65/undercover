import { useContext, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SocketContext } from '../../App'

/**
 * Small floating button that lets a player peek at their secret word
 * during gameplay (discussion / voting phases).
 */
export function WordPeek() {
  const socket = useContext(SocketContext)
  const [open, setOpen] = useState(false)

  if (!socket?.privateState) {
    return null
  }

  const word = socket.privateState.word
  const hasWord = typeof word === 'string' && word.length > 0

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 min-h-[44px] px-4 py-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg text-sm font-semibold text-slate-700 dark:text-slate-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Voir mon mot"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Mon mot
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="w-full max-w-xs rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">Votre mot</p>
              {hasWord ? (
                <p className="text-3xl font-black mt-3 text-slate-900 dark:text-slate-100">{word}</p>
              ) : (
                <p className="text-xl font-bold mt-3 text-slate-500 dark:text-slate-400">Pas de mot</p>
              )}
              <motion.button
                onClick={() => setOpen(false)}
                className="mt-5 w-full min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Fermer
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
