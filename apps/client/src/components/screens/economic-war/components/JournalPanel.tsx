import { motion } from 'motion/react'
import type { JournalHeadline } from '@undercover/shared'

interface JournalPanelProps {
  headlines: JournalHeadline[]
}

const TONE_STYLES: Record<string, string> = {
  satirical: 'text-amber-700 dark:text-amber-300',
  dramatic: 'text-red-700 dark:text-red-300',
  mocking: 'text-purple-700 dark:text-purple-300',
}

export function JournalPanel({ headlines }: JournalPanelProps) {
  if (headlines.length === 0) return null

  return (
    <motion.div
      className="rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
        Le Monde en Bref
      </p>
      <div className="space-y-1.5">
        {headlines.map((h, i) => (
          <motion.p
            key={i}
            className={`text-xs font-medium leading-relaxed ${TONE_STYLES[h.tone] ?? 'text-slate-700 dark:text-slate-300'}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            {h.tone === 'satirical' && '📰 '}
            {h.tone === 'dramatic' && '🔥 '}
            {h.tone === 'mocking' && '🎭 '}
            {h.text}
          </motion.p>
        ))}
      </div>
    </motion.div>
  )
}
