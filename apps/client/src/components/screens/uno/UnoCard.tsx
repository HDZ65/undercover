import { motion } from 'motion/react'
import type { Card } from '@uno/shared'

interface UnoCardProps {
  card?: Card | null
  faceDown?: boolean
  playable?: boolean
  selected?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}

const COLOR_CLASSES: Record<'red' | 'blue' | 'green' | 'yellow' | 'wild', string> = {
  red: 'from-red-500 to-rose-700',
  blue: 'from-blue-500 to-indigo-700',
  green: 'from-emerald-500 to-green-700',
  yellow: 'from-yellow-400 to-amber-600',
  wild: 'from-slate-700 via-slate-900 to-black',
}

function getCardLabel(value: Card['value']): string {
  if (value === 'skip') return 'Skip'
  if (value === 'reverse') return 'Reverse'
  if (value === 'draw2') return '+2'
  if (value === 'wild') return 'Wild'
  if (value === 'wild-draw4') return 'Wild +4'
  return value
}

export function UnoCard({
  card,
  faceDown = false,
  playable = false,
  selected = false,
  disabled = false,
  className = '',
  onClick,
}: UnoCardProps) {
  const colorKey = card?.color ?? 'wild'
  const cardLabel = card ? getCardLabel(card.value) : '?'
  const isDisabled = disabled || !onClick

  if (faceDown) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        whileHover={isDisabled ? undefined : { y: -4, scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-2 border-white/40 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 shadow-xl overflow-hidden ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
        <div className="absolute inset-3 rounded-xl border border-white/25 bg-gradient-to-br from-red-500/65 via-yellow-500/65 to-blue-500/65" />
        <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xl tracking-tight">
          UNO
        </div>
      </motion.button>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      animate={selected ? { y: -12, scale: 1.06 } : { y: 0, scale: 1 }}
      whileHover={isDisabled ? undefined : { y: playable ? -10 : -4, scale: playable ? 1.04 : 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-2 shadow-xl overflow-hidden transition-all ${
        selected
          ? 'border-cyan-300 ring-2 ring-cyan-400/90 ring-offset-2 ring-offset-transparent shadow-[0_0_20px_rgba(34,211,238,0.4)]'
          : playable
            ? 'border-white ring-2 ring-yellow-300/80 ring-offset-2 ring-offset-transparent'
            : 'border-white/60'
      } ${isDisabled ? 'opacity-75 cursor-default' : 'cursor-pointer'} ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${COLOR_CLASSES[colorKey]}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
      <div className="absolute inset-2 rounded-xl border border-white/35 bg-black/10" />

      <span className="absolute top-2 left-2 text-xs font-black text-white drop-shadow-md">{cardLabel}</span>
      <span className="absolute bottom-2 right-2 text-xs font-black text-white rotate-180 drop-shadow-md">{cardLabel}</span>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-2xl md:text-3xl font-black tracking-tight drop-shadow-xl px-2 text-center leading-tight">
          {cardLabel}
        </span>
      </div>
    </motion.button>
  )
}
