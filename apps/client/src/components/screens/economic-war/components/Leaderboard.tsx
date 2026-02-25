import { motion } from 'motion/react'
import type { LeaderboardEntry, WealthTier } from '@undercover/shared'

const TIER_STYLES: Record<WealthTier, { bg: string; text: string; label: string }> = {
  startup: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: 'Startup' },
  emerging: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: 'Émergent' },
  developed: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: 'Développé' },
  superpower: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Superpuissance' },
  hegemon: { bg: 'bg-gradient-to-r from-yellow-200 to-amber-200 dark:from-yellow-900/60 dark:to-amber-900/60', text: 'text-amber-800 dark:text-yellow-300', label: 'Hégémon' },
}

const RANK_ICONS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentPlayerId: string | null
  showDetails?: boolean
}

export function Leaderboard({ entries, currentPlayerId, showDetails }: LeaderboardProps) {
  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 shadow-lg">
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        Classement
      </p>
      <div className="space-y-1.5">
        {entries.map((entry, index) => {
          const tier = TIER_STYLES[entry.wealthTier]
          const isMe = entry.playerId === currentPlayerId

          return (
            <motion.div
              key={entry.playerId}
              className={`flex items-center gap-2 rounded-xl p-2.5 border ${
                entry.abandoned
                  ? 'border-slate-200/40 dark:border-slate-700/40 bg-slate-100/40 dark:bg-slate-900/30 opacity-60'
                  : isMe
                    ? 'border-amber-400/60 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60'
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <span className="text-lg w-7 text-center shrink-0">
                {RANK_ICONS[entry.rank] ?? (
                  <span className="text-sm font-black text-slate-400 dark:text-slate-500">{entry.rank}</span>
                )}
              </span>

              <span className="text-lg shrink-0">{entry.countryFlag}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`font-bold text-sm truncate ${isMe ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                    {entry.playerName}
                    {isMe ? ' (vous)' : ''}
                  </p>
                  {entry.abandoned && (
                    <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                      Abandon
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{entry.countryName}</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold ${tier.bg} ${tier.text}`}>
                    {tier.label}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                  {entry.score.toLocaleString('fr-FR')}
                </p>
                {showDetails && (
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">
                    PIB {entry.gdp.toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
