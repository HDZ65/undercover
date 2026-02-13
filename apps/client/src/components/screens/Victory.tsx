import { useContext, useEffect } from 'react'
import { motion } from 'motion/react'
import confetti from 'canvas-confetti'
import type { Role } from '@undercover/shared'
import { SocketContext } from '../../App'

const ROLE_COLORS: Record<Role, string> = {
  civil: 'from-emerald-500 to-emerald-600',
  undercover: 'from-rose-500 to-rose-600',
  mrwhite: 'from-slate-500 to-slate-600',
}

const ROLE_LABELS: Record<Role, string> = {
  civil: 'Civils',
  undercover: 'Undercovers',
  mrwhite: 'Mr. White',
}

export function Victory() {
  const socket = useContext(SocketContext)
  const winner = socket?.publicState?.winner ?? null
  const noElimination = socket?.publicState?.noElimination ?? false
  const wordPair = socket?.publicState?.wordPair

  useEffect(() => {
    if (winner !== 'civil') {
      return
    }

    const end = Date.now() + 3000
    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      })
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [winner])

  if (!socket?.publicState) {
    return null
  }

  return (
    <motion.div
      className="w-full max-w-3xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-xl space-y-6">
        <div className="text-center">
          {winner ? (
            <>
              <div
                className={`inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r ${ROLE_COLORS[winner]} text-white shadow-lg`}
              >
                <span className="font-bold uppercase tracking-wider">Victoire</span>
              </div>
              <h1 className="text-5xl font-black mt-4 text-slate-900 dark:text-slate-100">
                {ROLE_LABELS[winner]}
              </h1>
            </>
          ) : (
            <>
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                <span className="font-bold uppercase tracking-wider">Partie terminée</span>
              </div>
              {noElimination && (
                <p className="mt-3 text-slate-600 dark:text-slate-400">Scores individuels</p>
              )}
            </>
          )}
        </div>

        {wordPair && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 text-center">Les mots</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Civils</p>
                <p className="font-bold text-emerald-800 dark:text-emerald-200">{wordPair.civil}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                <p className="text-xs text-rose-600 dark:text-rose-400">Undercover</p>
                <p className="font-bold text-rose-800 dark:text-rose-200">{wordPair.undercover}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {socket.publicState.players.map((player) => {
            const role = player.role
            if (!role) {
              return null
            }

            const playerScore = socket.publicState?.scores?.find((s) => s.playerId === player.id)

            return (
              <div
                key={player.id}
                className="rounded-lg p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{player.name}</p>
                    {player.isEliminated && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">Éliminé</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {playerScore && playerScore.score > 0 && (
                    <span className="px-2 py-1 rounded-lg text-sm font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      {playerScore.score} pts
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${ROLE_COLORS[role]}`}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {socket.isHost ? (
          <motion.button
            onClick={socket.resetGame}
            className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white font-bold text-lg rounded-lg shadow-lg"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Nouvelle partie
          </motion.button>
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 font-medium">
            L'hôte prépare la prochaine partie...
          </p>
        )}
      </div>
    </motion.div>
  )
}
