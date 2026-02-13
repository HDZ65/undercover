import type { Card as CardType } from '@undercover/shared'

interface CardProps {
  card: CardType | null
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors: Record<string, string> = {
  hearts: 'text-red-600 dark:text-red-400',
  diamonds: 'text-red-600 dark:text-red-400',
  clubs: 'text-slate-900 dark:text-slate-100',
  spades: 'text-slate-900 dark:text-slate-100',
}

const sizeClasses = {
  sm: 'w-12 h-16 text-xs',
  md: 'w-16 h-24 text-sm',
  lg: 'w-20 h-28 text-base',
}

export function Card({ card, faceDown = false, size = 'md' }: CardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg border-2 border-slate-400 dark:border-slate-600 bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 flex items-center justify-center shadow-md`}
      >
        <div className="text-white text-2xl font-bold opacity-50">♠</div>
      </div>
    )
  }

  const suitColor = suitColors[card.suit]
  const suitSymbol = suitSymbols[card.suit]

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex flex-col items-center justify-center shadow-md`}
    >
      <div className={`font-bold ${suitColor}`}>{card.rank}</div>
      <div className={`text-lg ${suitColor}`}>{suitSymbol}</div>
    </div>
  )
}
