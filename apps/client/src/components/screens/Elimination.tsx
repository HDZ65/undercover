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

export function Elimination() {
  const socket = useContext(SocketContext)

  const eliminated = socket?.publicState?.eliminatedPlayer

  if (!eliminated || !eliminated.role) {
    return null
  }

  const role: Role = eliminated.role

  return (
    <motion.div
      className="w-full max-w-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`rounded-2xl bg-gradient-to-br ${ROLE_COLORS[role]} text-white shadow-2xl p-8 text-center`}>
        <p className="uppercase tracking-wider text-sm opacity-90">Éliminé</p>
        <h1 className="text-4xl font-black mt-2">{eliminated.name}</h1>
        <div className="mt-6 bg-white/20 rounded-xl p-4">
          <p className="text-sm uppercase tracking-wider opacity-90">Rôle révélé</p>
          <p className="text-2xl font-bold mt-1">{ROLE_LABELS[role]}</p>
        </div>

        {socket?.isHost ? (
          <motion.button
            onClick={socket.continueGame}
            className="mt-6 w-full min-h-[56px] px-6 py-4 bg-white/20 hover:bg-white/30 text-white font-bold text-lg rounded-lg backdrop-blur-sm border border-white/30 transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Continuer
          </motion.button>
        ) : (
          <p className="mt-6 text-white/85">L'hôte continue la partie...</p>
        )}
      </div>
    </motion.div>
  )
}
