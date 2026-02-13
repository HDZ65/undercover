import { useContext, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SocketContext } from '../../App'
import { WordPeek } from '../ui/WordPeek'

export function Vote() {
  const socket = useContext(SocketContext)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const candidates = useMemo(() => {
    if (!socket?.publicState || !socket.privateState) {
      return []
    }

    const aliveIds = socket.publicState.alivePlayers
    const tieCandidates = socket.publicState.tieCandidates

    return socket.publicState.players.filter((player) => {
      if (!aliveIds.includes(player.id)) {
        return false
      }
      if (player.id === socket.privateState?.playerId) {
        return false
      }
      if (tieCandidates.length > 0 && !tieCandidates.includes(player.id)) {
        return false
      }
      return true
    })
  }, [socket?.privateState, socket?.publicState])

  if (!socket || !socket.publicState || !socket.privateState) {
    return null
  }

  const hasVoted = socket.privateState.hasVoted

  const handleSelect = (targetId: string) => {
    if (hasVoted) {
      return
    }
    setSelectedTarget(targetId)
    setShowConfirmation(true)
  }

  const handleConfirm = () => {
    if (!selectedTarget) {
      return
    }
    socket.castVote(selectedTarget)
    setShowConfirmation(false)
    setSelectedTarget(null)
  }

  const voteProgress = socket.publicState.totalVoters
    ? (socket.publicState.voteCount / socket.publicState.totalVoters) * 100
    : 0

  return (
    <motion.div
      className="w-full max-w-3xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-xl space-y-5">
        <div className="text-center">
          <h1 className="text-4xl font-black bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">
            Vote d'elimination
          </h1>
          {socket.publicState.tieCandidates.length > 0 && (
            <p className="mt-2 text-rose-600 dark:text-rose-400 font-medium">
              Egalite! Revotez entre les candidats
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
            <span>Progression des votes</span>
            <span>
              {socket.publicState.voteCount}/{socket.publicState.totalVoters} votes
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
            <motion.div
              className="h-full bg-gradient-to-r from-rose-600 to-red-600"
              initial={{ width: 0 }}
              animate={{ width: `${voteProgress}%` }}
            />
          </div>
        </div>

        {hasVoted ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-5 text-center">
            <p className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">Vote enregistre ✓</p>
            <p className="text-emerald-700/80 dark:text-emerald-300/80 mt-1">En attente des votes...</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {candidates.map((candidate) => (
              <motion.button
                key={candidate.id}
                onClick={() => handleSelect(candidate.id)}
                className="w-full text-left rounded-lg p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:border-rose-500 dark:hover:border-rose-400 transition-all"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{candidate.name}</p>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showConfirmation && selectedTarget && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirmer votre vote</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Eliminer{' '}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {socket.publicState.players.find((player) => player.id === selectedTarget)?.name}
                </span>{' '}
                ?
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="min-h-[48px] rounded-lg bg-slate-200 dark:bg-slate-700 font-semibold text-slate-900 dark:text-slate-100"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  className="min-h-[48px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WordPeek />
    </motion.div>
  )
}
