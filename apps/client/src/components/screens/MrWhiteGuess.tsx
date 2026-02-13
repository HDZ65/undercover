import { useContext, useState } from 'react'
import { motion } from 'motion/react'
import { SocketContext } from '../../App'

export function MrWhiteGuess() {
  const socket = useContext(SocketContext)
  const [guess, setGuess] = useState('')

  if (!socket || !socket.publicState || !socket.privateState) {
    return null
  }

  const inGuessPhase = socket.phase === 'mrWhiteGuess'
  const isMrWhite = socket.privateState.role === 'mrwhite'

  if (inGuessPhase) {
    if (!isMrWhite) {
      return (
        <motion.div
          className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Mr. White devine...</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Mr. White est en train de deviner...</p>
        </motion.div>
      )
    }

    return (
      <motion.div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <h1 className="text-3xl font-black text-center bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-400 dark:to-slate-500 bg-clip-text text-transparent">
          Mr. White
        </h1>
        <p className="text-center mt-2 text-slate-600 dark:text-slate-400">Tentez de deviner le mot secret</p>

        <div className="mt-6 space-y-3">
          <input
            type="text"
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            placeholder="Votre proposition"
            className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
            maxLength={50}
          />
          <motion.button
            onClick={() => socket.submitMrWhiteGuess(guess)}
            disabled={!guess.trim()}
            className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white font-bold text-lg rounded-lg shadow-lg disabled:opacity-50"
            whileHover={{ scale: guess.trim() ? 1.01 : 1 }}
            whileTap={{ scale: guess.trim() ? 0.99 : 1 }}
          >
            Soumettre
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const voteProgress = socket.publicState.totalVoters
    ? (socket.publicState.mrWhiteVoteCount / socket.publicState.totalVoters) * 100
    : 0

  return (
    <motion.div
      className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-8 space-y-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="text-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Vote sur la devinette</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Mr. White a propose : <span className="font-semibold">"{socket.publicState.mrWhiteGuess}"</span>
        </p>
      </div>

      <div>
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
          <span>Progression des votes</span>
          <span>
            {socket.publicState.mrWhiteVoteCount}/{socket.publicState.totalVoters} votes
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full bg-gradient-to-r from-slate-600 to-slate-700"
            initial={{ width: 0 }}
            animate={{ width: `${voteProgress}%` }}
          />
        </div>
      </div>

      {socket.privateState.hasVoted ? (
        <div className="rounded-lg p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-center">
          <p className="font-bold text-emerald-700 dark:text-emerald-300">Vote enregistre ✓</p>
          <p className="text-emerald-700/80 dark:text-emerald-300/80">En attente des autres joueurs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => socket.castMrWhiteVote(false)}
            className="min-h-[64px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-lg"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Refuser
          </motion.button>
          <motion.button
            onClick={() => socket.castMrWhiteVote(true)}
            className="min-h-[64px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Accepter
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}
