import { motion } from 'motion/react'

interface GameOption {
  id: string
  title: string
  description: string
  gradient: string
  players: string
  available: boolean
}

const GAMES: GameOption[] = [
  {
    id: 'undercover',
    title: 'Undercover',
    description: 'Jeu de deduction sociale. Trouvez les imposteurs parmi vous grace aux mots secrets.',
    gradient: 'from-blue-600 to-purple-600',
    players: '3-20 joueurs',
    available: true,
  },
  {
    id: 'uno',
    title: 'UNO',
    description: 'Le classique des jeux de cartes. Soyez le premier a vider votre main.',
    gradient: 'from-red-500 to-yellow-500',
    players: '2-10 joueurs',
    available: false,
  },
  {
    id: 'poker',
    title: 'Texas Hold\'em',
    description: 'Poker en ligne entre amis. Bluffez et misez pour remporter la mise.',
    gradient: 'from-emerald-600 to-teal-600',
    players: '2-8 joueurs',
    available: true,
  },
]

interface GameMenuProps {
  onSelectGame: (gameId: string) => void
}

export function GameMenu({ onSelectGame }: GameMenuProps) {
  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="text-center mb-8">
        <motion.h1
          className="text-5xl md:text-6xl font-black tracking-tight"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            GAME HUB
          </span>
        </motion.h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Choisis un jeu pour commencer
        </p>
      </div>

      <div className="grid gap-4">
        {GAMES.map((game, index) => (
          <motion.button
            key={game.id}
            onClick={() => game.available && onSelectGame(game.id)}
            disabled={!game.available}
            className="group w-full text-left rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-xl overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            whileHover={game.available ? { scale: 1.02 } : {}}
            whileTap={game.available ? { scale: 0.98 } : {}}
          >
            <div className="flex items-stretch">
              <div className={`w-2 bg-gradient-to-b ${game.gradient} shrink-0`} />
              <div className="flex-1 p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {game.title}
                    </h2>
                    {!game.available && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        Bientot
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {game.description}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-500">
                    {game.players}
                  </p>
                </div>
                {game.available && (
                  <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
