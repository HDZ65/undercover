import { useContext, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SocketContext } from '../../App'

type LandingMode = 'create' | 'join'

export function Landing() {
  const socket = useContext(SocketContext)
  const [mode, setMode] = useState<LandingMode>('create')
  const [playerName, setPlayerName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')

  if (!socket) {
    return null
  }

  const handleCreate = () => {
    socket.createRoom(playerName)
  }

  const handleJoin = () => {
    socket.joinRoom(joinRoomCode, playerName)
  }

  return (
    <motion.div
      className="w-full max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
        <motion.h1
          className="text-5xl md:text-6xl font-bold text-center tracking-tight mb-2"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            UNDERCOVER
          </span>
        </motion.h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          Multijoueur en temps reel
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/70">
          <button
            onClick={() => setMode('create')}
            className={`min-h-[48px] rounded-lg font-semibold transition-all ${
              mode === 'create'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            Creer une partie
          </button>
          <button
            onClick={() => setMode('join')}
            className={`min-h-[48px] rounded-lg font-semibold transition-all ${
              mode === 'join'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            Rejoindre une partie
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {mode === 'join' && (
              <input
                type="text"
                value={joinRoomCode}
                onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
                placeholder="Code de la salle"
                className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            )}

            <input
              type="text"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Nom du joueur"
              className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={24}
            />

            <motion.button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-bold text-lg rounded-lg shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {mode === 'create' ? 'Creer une partie' : 'Rejoindre une partie'}
            </motion.button>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 text-sm text-center">
          <span className={socket.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {socket.connected ? 'Connecte au serveur' : 'Connexion au serveur...'}
          </span>
          {socket.error && (
            <p className="text-rose-600 dark:text-rose-400 mt-2">{socket.error}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
