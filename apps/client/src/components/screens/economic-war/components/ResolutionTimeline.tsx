import { motion } from 'motion/react'
import type { ResolutionEntry } from '@undercover/shared'

interface ResolutionTimelineProps {
  entries: ResolutionEntry[]
}

export function ResolutionTimeline({ entries }: ResolutionTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
        Aucun événement cette manche.
      </p>
    )
  }

  return (
    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
      {entries.map((entry, index) => (
        <motion.div
          key={`${entry.step}-${index}`}
          className={`flex items-start gap-2.5 rounded-xl p-2.5 border ${
            entry.positive
              ? 'border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/20'
              : 'border-red-200/60 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/20'
          }`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: index * 0.06 }}
        >
          <span className="text-lg shrink-0">{entry.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              {entry.description}
            </p>
          </div>
          <span className="shrink-0 text-xs">
            {entry.positive ? '✅' : '❌'}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
