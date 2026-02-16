import { useContext, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SocketContext } from '../../App'

type LandingMode = 'create' | 'join' | 'browse'

interface LandingProps {
  onBack?: () => void
}

export function Landing({ onBack }: LandingProps) {
  const socket = useContext(SocketContext)
  const [mode, setMode] = useState<LandingMode>('create')
  const [playerName, setPlayerName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    if (mode === 'browse' && socket) {
      socket.listRooms()
    }
  }, [mode, socket])

  if (!socket) {
    return null
  }

  const handleCreate = () => {
    socket.createRoom(playerName, isPublic)
  }

  const handleJoin = () => {
    socket.joinRoom(joinRoomCode, playerName)
  }

  const handleJoinPublic = (roomCode: string) => {
    const name = playerName.trim()
    if (!name) {
      return
    }
    socket.joinRoom(roomCode, name)
  }

  const tabClass = (tab: LandingMode) =>
    `min-h-[48px] rounded-lg font-semibold transition-all text-sm ${
      mode === tab
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
        : 'text-slate-700 dark:text-slate-300'
    }`

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

        <div className="grid grid-cols-3 gap-2 mb-5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/70">
          <button onClick={() => setMode('create')} className={tabClass('create')}>
            Creer
          </button>
          <button onClick={() => setMode('join')} className={tabClass('join')}>
            Rejoindre
          </button>
          <button onClick={() => setMode('browse')} className={tabClass('browse')}>
            Publiques
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

            {mode !== 'browse' && (
              <>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Nom du joueur"
                  className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={24}
                />

                {mode === 'create' && (
                  <label className="flex items-center gap-3 cursor-pointer select-none px-1">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-blue-600 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Partie publique
                    </span>
                  </label>
                )}

                <motion.button
                  onClick={mode === 'create' ? handleCreate : handleJoin}
                  className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white font-bold text-lg rounded-lg shadow-lg"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {mode === 'create' ? 'Creer une partie' : 'Rejoindre une partie'}
                </motion.button>
              </>
            )}

            {mode === 'browse' && (
              <>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Votre nom pour rejoindre"
                  className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={24}
                />

                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Parties publiques
                  </span>
                  <button
                    onClick={() => socket.listRooms()}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    Rafraichir
                  </button>
                </div>

                {socket.publicRooms.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Aucune partie publique disponible
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {socket.publicRooms.map((room) => (
                      <div
                        key={room.code}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {room.hostName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {room.playerCount}/{room.maxPlayers} joueurs
                          </p>
                        </div>
                        <button
                          onClick={() => handleJoinPublic(room.code)}
                          disabled={!playerName.trim()}
                          className="ml-3 shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Rejoindre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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

        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Retour aux jeux
          </button>
        )}
      </div>
    </motion.div>
  )
}
