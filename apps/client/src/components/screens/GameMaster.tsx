import { useContext, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { SocketContext } from '../../App'

export function GameMaster() {
  const socket = useContext(SocketContext)
  const [timeRemaining, setTimeRemaining] = useState(0)

  const alivePlayers = useMemo(() => {
    if (!socket?.publicState) {
      return []
    }

    return socket.publicState.players.filter((player) =>
      socket.publicState?.alivePlayers.includes(player.id),
    )
  }, [socket?.publicState])

  useEffect(() => {
    if (!socket?.publicState) {
      return
    }

    setTimeRemaining(socket.publicState.timerDuration)
  }, [socket?.publicState?.currentRound, socket?.publicState?.timerDuration])

  useEffect(() => {
    if (timeRemaining <= 0) {
      return
    }

    const timer = setTimeout(() => {
      setTimeRemaining((previous) => Math.max(0, previous - 1))
    }, 1000)

    return () => clearTimeout(timer)
  }, [timeRemaining])

  if (!socket || !socket.publicState) {
    return null
  }

  const currentSpeaker = alivePlayers[socket.publicState.currentSpeakerIndex] ?? null
  const minutes = String(Math.floor(timeRemaining / 60)).padStart(2, '0')
  const seconds = String(timeRemaining % 60).padStart(2, '0')

  return (
    <motion.div
      className="w-full max-w-3xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Discussion - Tour {socket.publicState.currentRound}
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Orateur actuel</p>
            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {currentSpeaker?.name ?? 'Aucun orateur'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Temps restant</p>
            <p className="text-4xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {minutes}:{seconds}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Joueurs en vie</p>
          <div className="grid md:grid-cols-2 gap-2">
            {alivePlayers.map((player) => (
              <div
                key={player.id}
                className={`rounded-lg p-3 border ${
                  player.id === currentSpeaker?.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60'
                }`}
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100">{player.name}</p>
              </div>
            ))}
          </div>
        </div>

        {socket.isHost ? (
          <div className="grid md:grid-cols-2 gap-3">
            <motion.button
              onClick={socket.nextSpeaker}
              className="w-full min-h-[56px] px-6 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-lg rounded-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Orateur suivant
            </motion.button>
            <motion.button
              onClick={socket.startVoting}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-500 dark:to-red-500 text-white font-bold text-lg rounded-lg shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Passer au vote
            </motion.button>
          </div>
        ) : (
          <div className="text-center text-slate-500 dark:text-slate-400 font-medium">
            L'hote controle le tour de parole
          </div>
        )}
      </div>
    </motion.div>
  )
}
