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

  useEffect(() => {
    if (socket?.publicState?.winner !== 'civil') {
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
  }, [socket?.publicState?.winner])

  if (!socket?.publicState?.winner) {
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
          <div
            className={`inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r ${ROLE_COLORS[socket.publicState.winner]} text-white shadow-lg`}
          >
            <span className="font-bold uppercase tracking-wider">Victoire</span>
          </div>
          <h1 className="text-5xl font-black mt-4 text-slate-900 dark:text-slate-100">
            {ROLE_LABELS[socket.publicState.winner]}
          </h1>
        </div>

        <div className="grid gap-3">
          {socket.publicState.players.map((player) => {
            const role = player.role
            if (!role) {
              return null
            }

            return (
              <div
                key={player.id}
                className="rounded-lg p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{player.name}</p>
                  {player.isEliminated && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">Elimine</p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${ROLE_COLORS[role]}`}
                >
                  {ROLE_LABELS[role]}
                </span>
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
            L'hote prepare la prochaine partie...
          </p>
        )}
      </div>
    </motion.div>
  )
}
