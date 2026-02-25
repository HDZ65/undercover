import { AnimatePresence, motion } from 'motion/react'

interface ConnectionStatusOverlayProps {
  connected: boolean
}

export function ConnectionStatusOverlay({ connected }: ConnectionStatusOverlayProps) {
  return (
    <AnimatePresence>
      {!connected && (
        <motion.div
          key="connection-overlay"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 pt-3 pb-2 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-300/60 dark:border-amber-600/40 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-md shadow-lg px-5 py-3 max-w-md w-full">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
            <p className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              Connexion perdue. Reconnexion en cours...
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2 transition-colors"
            >
              Reconnecter
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}