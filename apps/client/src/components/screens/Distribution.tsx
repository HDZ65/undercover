import { useContext } from 'react'
import { motion } from 'motion/react'
import type { Role } from '@undercover/shared'
import { SocketContext } from '../../App'

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

export function Distribution() {
  const socket = useContext(SocketContext)

  if (!socket || !socket.publicState || !socket.privateState) {
    return null
  }

  const role = socket.privateState.role
  const hideRoles = socket.publicState.hideRoles
  const isReady = socket.publicState.readyPlayers.includes(socket.privateState.playerId)
  const isAlive = socket.publicState.alivePlayers.includes(socket.privateState.playerId)
  const readyCount = socket.publicState.readyPlayers.length
  const totalAlive = socket.publicState.alivePlayers.length
  const currentRound = socket.publicState.currentRound

  // In hideRoles mode: no role shown, only the word (or "Pas de mot" for Mr. White)
  // The player doesn't know if they're Civil, Undercover, or Mr. White
  if (!hideRoles && !role) {
    return null
  }

  const isReminderRound = currentRound > 1

  const word = socket.privateState.word
  const hasWord = typeof word === 'string' && word.length > 0

  return (
    <motion.div
      className="w-full max-w-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-6 text-center">
        <motion.h1
          className="text-3xl font-bold text-slate-900 dark:text-slate-100"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {isReminderRound ? 'Rappel de votre mot' : hideRoles ? 'Votre mot secret' : 'Votre role secret'}
        </motion.h1>

        {hideRoles ? (
          <motion.div
            className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/20 rounded-xl p-4">
              <p className="uppercase tracking-wider text-xs opacity-90">Mot</p>
              {hasWord ? (
                <p className="text-3xl font-black mt-2">{word}</p>
              ) : (
                <p className="text-2xl font-bold mt-2">Pas de mot</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className={`rounded-2xl bg-gradient-to-br ${ROLE_COLORS[role!]} text-white p-8 shadow-2xl`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="uppercase tracking-wider text-sm opacity-90">Role</p>
            <h2 className="text-4xl font-black mt-2">{ROLE_LABELS[role!]}</h2>

            <div className="mt-6 bg-white/20 rounded-xl p-4">
              <p className="uppercase tracking-wider text-xs opacity-90">Mot</p>
              {role === 'mrwhite' ? (
                <p className="text-2xl font-bold mt-2">Vous etes Mr. White - Pas de mot</p>
              ) : (
                <p className="text-3xl font-black mt-2">{socket.privateState.word}</p>
              )}
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            {readyCount}/{totalAlive} joueurs prets
          </p>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${totalAlive ? (readyCount / totalAlive) * 100 : 0}%` }}
            />
          </div>
        </div>

        {isAlive ? (
          <motion.button
            onClick={socket.markReady}
            disabled={isReady}
            className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white font-bold text-lg rounded-lg shadow-lg disabled:opacity-50"
            whileHover={{ scale: isReady ? 1 : 1.01 }}
            whileTap={{ scale: isReady ? 1 : 0.99 }}
          >
            {isReady ? 'Pret ✓' : "J'ai memorise"}
          </motion.button>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Vous avez ete elimine. En attente des autres joueurs...
          </p>
        )}
      </div>
    </motion.div>
  )
}
