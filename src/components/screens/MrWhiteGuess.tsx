import { useState } from 'react'
import { motion } from 'motion/react'
import { useGameActor } from '../../hooks/useGameActor'

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function MrWhiteGuess() {
  const [snapshot, send] = useGameActor()
  const [guess, setGuess] = useState('')
  const [currentVoterIndex, setCurrentVoterIndex] = useState(0)
  const [showVoting, setShowVoting] = useState(false)

  const players = snapshot.context.players || []
  const alivePlayers = players.filter((p) => !p.isEliminated)
  const votes = snapshot.context.votes || {}
  const mrWhiteGuess = snapshot.context.mrWhiteGuess || ''

  const currentVoter = alivePlayers[currentVoterIndex]
  const hasVoted = currentVoter && (votes[currentVoter.id] === 'accept' || votes[currentVoter.id] === 'reject')
  const allVoted = alivePlayers.every((p) => votes[p.id] === 'accept' || votes[p.id] === 'reject')

  const handleSubmitGuess = () => {
    if (!guess.trim()) return
    vibrate(100)
    send({ type: 'SUBMIT_MRWHITE_GUESS', guess: guess.trim() })
    setShowVoting(true)
  }

  const handleVote = (accepted: boolean) => {
    if (!currentVoter) return

    send({
      type: 'CAST_MRWHITE_VOTE',
      voterId: currentVoter.id,
      accepted,
    })

    vibrate(50)

    // Move to next voter
    if (currentVoterIndex < alivePlayers.length - 1) {
      setCurrentVoterIndex(currentVoterIndex + 1)
    }
  }

  const handleResolveVote = () => {
    if (!allVoted) return
    vibrate(100)
    send({ type: 'RESOLVE_MRWHITE_VOTE' })
  }

  // Guess input phase
  if (!showVoting && !mrWhiteGuess) {
    return (
      <motion.div
        className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-block bg-slate-600 dark:bg-slate-500 text-white px-6 py-3 rounded-full shadow-lg mb-4">
            <p className="text-sm font-bold uppercase tracking-wider">Mr. White</p>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Devinez le mot
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Vous avez une chance de gagner !
          </p>
        </motion.div>

        {/* Guess Input */}
        <motion.div
          className="w-full max-w-md mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitGuess()}
            placeholder="Entrez votre devinette..."
            className="w-full min-h-[56px] px-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 dark:focus:ring-slate-400 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-lg text-center font-semibold"
            maxLength={50}
            autoFocus
          />
        </motion.div>

        {/* Submit Button */}
        <motion.button
          onClick={handleSubmitGuess}
          disabled={!guess.trim()}
          className="w-full max-w-md min-h-[56px] px-6 py-4 bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 hover:from-slate-700 hover:to-slate-800 dark:hover:from-slate-600 dark:hover:to-slate-700 text-white font-bold text-lg rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          whileHover={{ scale: guess.trim() ? 1.02 : 1 }}
          whileTap={{ scale: guess.trim() ? 0.98 : 1 }}
        >
          Soumettre
        </motion.button>
      </motion.div>
    )
  }

  // Voting phase
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-400 dark:to-slate-500 bg-clip-text text-transparent">
          Vote sur la devinette
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Mr. White a deviné : <span className="font-bold text-slate-900 dark:text-slate-100">"{mrWhiteGuess}"</span>
        </p>
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
            className="h-full bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600"
            initial={{ width: 0 }}
            animate={{ width: `${(Object.keys(votes).length / alivePlayers.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Current Voter */}
      {!allVoted && currentVoter && (
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
      )}

      {/* Vote Buttons */}
      {!hasVoted && !allVoted && (
        <motion.div
          className="flex gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <motion.button
            onClick={() => handleVote(false)}
            className="flex-1 min-h-[80px] px-6 py-4 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white font-bold text-lg rounded-lg shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ✗ Refuser
          </motion.button>
          <motion.button
            onClick={() => handleVote(true)}
            className="flex-1 min-h-[80px] px-6 py-4 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white font-bold text-lg rounded-lg shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ✓ Accepter
          </motion.button>
        </motion.div>
      )}

      {/* Resolve Button */}
      {allVoted && (
        <motion.button
          onClick={handleResolveVote}
          className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 hover:from-slate-700 hover:to-slate-800 dark:hover:from-slate-600 dark:hover:to-slate-700 text-white font-bold text-lg rounded-lg shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Voir le résultat
        </motion.button>
      )}
    </motion.div>
  )
}
