import { motion } from 'motion/react'
import type { HandRank } from '@undercover/shared'

interface HandStrengthDisplayProps {
  handStrength?: string // e.g., "Paire de Rois"
  handRank?: HandRank // Numeric rank for color coding
  draws?: string[] // e.g., ["Tirage couleur"]
  visible?: boolean
}

// Color mapping for hand strength
const handRankColors: Record<number, { bg: string; bar: string; text: string }> = {
  0: { bg: 'bg-gray-100 dark:bg-gray-800', bar: 'bg-gray-400', text: 'text-gray-700 dark:text-gray-300' }, // HIGH_CARD
  1: { bg: 'bg-blue-100 dark:bg-blue-900', bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' }, // ONE_PAIR
  2: { bg: 'bg-green-100 dark:bg-green-900', bar: 'bg-green-500', text: 'text-green-700 dark:text-green-300' }, // TWO_PAIR
  3: { bg: 'bg-teal-100 dark:bg-teal-900', bar: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300' }, // THREE_OF_A_KIND
  4: { bg: 'bg-yellow-100 dark:bg-yellow-900', bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300' }, // STRAIGHT
  5: { bg: 'bg-orange-100 dark:bg-orange-900', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' }, // FLUSH
  6: { bg: 'bg-red-100 dark:bg-red-900', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' }, // FULL_HOUSE
  7: { bg: 'bg-purple-100 dark:bg-purple-900', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' }, // FOUR_OF_A_KIND
  8: { bg: 'bg-pink-100 dark:bg-pink-900', bar: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300' }, // STRAIGHT_FLUSH
  9: { bg: 'bg-amber-100 dark:bg-amber-900', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' }, // ROYAL_FLUSH
}

// Get strength percentage for bar width (0-100)
const getStrengthPercentage = (rank?: HandRank): number => {
  if (rank === undefined) return 0
  return ((rank + 1) / 10) * 100
}

export function HandStrengthDisplay({
  handStrength,
  handRank,
  draws = [],
  visible = true,
}: HandStrengthDisplayProps) {
  if (!visible || !handStrength) {
    return null
  }

  const colors = handRank !== undefined ? handRankColors[handRank] : handRankColors[0]
  const strengthPercent = getStrengthPercentage(handRank)

  return (
    <motion.div
      className={`rounded-lg p-4 ${colors.bg} border border-slate-200 dark:border-slate-700`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hand Strength Title */}
      <div className="mb-3">
        <p className={`text-sm font-semibold ${colors.text}`}>{handStrength}</p>
      </div>

      {/* Strength Bar */}
      <div className="mb-3">
        <div className="w-full h-2 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${colors.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${strengthPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Draws Display */}
      {draws.length > 0 && (
        <div className="space-y-1">
          {draws.map((draw, idx) => (
            <motion.div
              key={idx}
              className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              {draw}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
