import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameActor } from '../../hooks/useGameActor'

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function Vote() {
  const [snapshot, send] = useGameActor()
  const [currentVoterIndex, setCurrentVoterIndex] = useState(0)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const players = snapshot.context.players || []
  const alivePlayers = players.filter((p) => !p.isEliminated)
  const votes = snapshot.context.votes || {}
  const tieCandidates = snapshot.context.tieCandidates || []

  // Determine vote targets (all alive players or tie candidates)
  const voteTargets = tieCandidates.length > 0 ? tieCandidates : alivePlayers.map((p) => p.id)
  const voteCandidates = players.filter((p) => voteTargets.includes(p.id))

  const currentVoter = alivePlayers[currentVoterIndex]
  const hasVoted = currentVoter && votes[currentVoter.id] !== undefined
  const allVoted = alivePlayers.every((p) => votes[p.id] !== undefined)

  const handleSelectTarget = (targetId: string) => {
    setSelectedTarget(targetId)
    setShowConfirmation(true)
    vibrate(30)
  }

  const handleConfirmVote = () => {
    if (!currentVoter || !selectedTarget) return

    send({
      type: 'CAST_VOTE',
      voterId: currentVoter.id,
      targetId: selectedTarget,
    })

    vibrate(50)
    setShowConfirmation(false)
    setSelectedTarget(null)

    // Move to next voter
    if (currentVoterIndex < alivePlayers.length - 1) {
      setCurrentVoterIndex(currentVoterIndex + 1)
    }
  }

  const handleCancelVote = () => {
    setShowConfirmation(false)
    setSelectedTarget(null)
    vibrate(30)
  }

  const handleFinishVoting = () => {
    if (!allVoted) return
    vibrate(100)
    send({ type: 'FINISH_VOTING' })
  }

  if (!currentVoter) {
    return null
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">
          {tieCandidates.length > 0 ? 'Vote de départage' : 'Vote d\'élimination'}
        </h1>
        {tieCandidates.length > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Égalité détectée - Vote entre les candidats à égalité
          </p>
        )}
      </motion.div>

      {/* Progress */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Votant {currentVoterIndex + 1}/{alivePlayers.length}
          </span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {Object.keys(votes).length}/{alivePlayers.length} votes
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-500 dark:to-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${(Object.keys(votes).length / alivePlayers.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Current Voter */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {hasVoted ? 'Vote enregistré' : 'C\'est votre tour'}
          </p>
          <div className="flex items-center gap-3">
            {currentVoter.avatar && (
              <img
                src={currentVoter.avatar}
                alt={currentVoter.name}
                className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700"
              />
            )}
            <div className="flex-1">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {currentVoter.name}
              </p>
              {hasVoted && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ A voté
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vote Candidates */}
      {!hasVoted && (
        <motion.div
          className="flex-1 mb-6 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Qui voulez-vous éliminer ?
          </p>
          <div className="grid gap-3">
            {voteCandidates.map((candidate) => {
              const isCurrentVoter = candidate.id === currentVoter.id
              return (
                <motion.button
                  key={candidate.id}
                  onClick={() => !isCurrentVoter && handleSelectTarget(candidate.id)}
                  disabled={isCurrentVoter}
                  className={`flex items-center gap-4 p-4 rounded-lg shadow-sm border transition-all ${
                    isCurrentVoter
                      ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-400 hover:shadow-md'
                  }`}
                  whileHover={!isCurrentVoter ? { scale: 1.02 } : {}}
                  whileTap={!isCurrentVoter ? { scale: 0.98 } : {}}
                >
                  {candidate.avatar && (
                    <img
                      src={candidate.avatar}
                      alt={candidate.name}
                      className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700"
                    />
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {candidate.name}
                    </p>
                    {isCurrentVoter && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Vous ne pouvez pas voter pour vous-même
                      </p>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Finish Voting Button */}
      {allVoted && (
        <motion.button
          onClick={handleFinishVoting}
          className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-500 dark:to-red-500 hover:from-rose-700 hover:to-red-700 dark:hover:from-rose-600 dark:hover:to-red-600 text-white font-bold text-lg rounded-lg shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Voir les résultats
        </motion.button>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && selectedTarget && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelVote}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Confirmer votre vote
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Vous votez pour éliminer{' '}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {players.find((p) => p.id === selectedTarget)?.name}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <motion.button
                  onClick={handleCancelVote}
                  className="flex-1 min-h-[48px] px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-lg transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Annuler
                </motion.button>
                <motion.button
                  onClick={handleConfirmVote}
                  className="flex-1 min-h-[48px] px-4 py-3 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white font-semibold rounded-lg transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Confirmer
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
