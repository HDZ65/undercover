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
  wild: 'from-violet-600 via-fuchsia-600 to-pink-600',
}

const COLOR_GLOW: Record<'red' | 'blue' | 'green' | 'yellow' | 'wild', string> = {
  red: '0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2)',
  blue: '0 0 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.2)',
  green: '0 0 20px rgba(16,185,129,0.5), 0 0 40px rgba(16,185,129,0.2)',
  yellow: '0 0 20px rgba(245,158,11,0.5), 0 0 40px rgba(245,158,11,0.2)',
  wild: '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2)',
}

const COLOR_SELECTED_GLOW: Record<'red' | 'blue' | 'green' | 'yellow' | 'wild', string> = {
  red: '0 0 25px rgba(239,68,68,0.7), 0 0 50px rgba(239,68,68,0.3), 0 8px 32px rgba(0,0,0,0.3)',
  blue: '0 0 25px rgba(59,130,246,0.7), 0 0 50px rgba(59,130,246,0.3), 0 8px 32px rgba(0,0,0,0.3)',
  green: '0 0 25px rgba(16,185,129,0.7), 0 0 50px rgba(16,185,129,0.3), 0 8px 32px rgba(0,0,0,0.3)',
  yellow: '0 0 25px rgba(245,158,11,0.7), 0 0 50px rgba(245,158,11,0.3), 0 8px 32px rgba(0,0,0,0.3)',
  wild: '0 0 25px rgba(168,85,247,0.7), 0 0 50px rgba(168,85,247,0.3), 0 8px 32px rgba(0,0,0,0.3)',
}

function getCardLabel(value: Card['value']): string {
  if (value === 'skip') return '⊘'
  if (value === 'reverse') return '⟲'
  if (value === 'draw2') return '+2'
  if (value === 'wild') return '✦'
  if (value === 'wild-draw4') return '+4'
  return value
}

function getCardSubLabel(value: Card['value']): string | null {
  if (value === 'skip') return 'PASSE'
  if (value === 'reverse') return 'INVERSE'
  if (value === 'draw2') return 'PIOCHE'
  if (value === 'wild') return 'JOKER'
  if (value === 'wild-draw4') return 'JOKER'
  return null
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
  const subLabel = card ? getCardSubLabel(card.value) : null
  const isDisabled = disabled || !onClick

  if (faceDown) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        whileHover={isDisabled ? undefined : { y: -6, scale: 1.04 }}
        whileTap={isDisabled ? undefined : { scale: 0.96 }}
        className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-2 border-white/30 shadow-xl overflow-hidden ${className}`}
      >
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />

        {/* UNO pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.05) 16px)',
        }} />

        {/* Inner oval border */}
        <div className="absolute inset-3 rounded-[40%] border-2 border-white/15 bg-gradient-to-br from-red-600/40 via-yellow-500/30 to-blue-600/40" />

        {/* Shimmer effect */}
        <div className="absolute inset-0 uno-shimmer rounded-2xl" />

        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-black text-lg tracking-tight drop-shadow-lg" style={{
            textShadow: '0 0 10px rgba(255,255,255,0.3)',
          }}>UNO</span>
        </div>
      </motion.button>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      animate={selected
        ? { y: -16, scale: 1.08, boxShadow: COLOR_SELECTED_GLOW[colorKey] }
        : { y: 0, scale: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }
      }
      whileHover={isDisabled ? undefined : {
        y: playable ? -14 : -5,
        scale: playable ? 1.06 : 1.02,
        boxShadow: playable ? COLOR_GLOW[colorKey] : '0 6px 20px rgba(0,0,0,0.25)',
      }}
      whileTap={isDisabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-2 overflow-hidden transition-[border-color] duration-200 ${
        selected
          ? 'border-cyan-300 z-10'
          : playable
            ? 'border-white/90'
            : 'border-white/40'
      } ${isDisabled ? 'opacity-65 cursor-default' : 'cursor-pointer'} ${className}`}
    >
      {/* Base color gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${COLOR_CLASSES[colorKey]}`} />

      {/* Specular highlight (top-left light source) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(255,255,255,0.45),transparent_50%)]" />

      {/* Inner card frame */}
      <div className="absolute inset-2 rounded-xl border border-white/30 bg-black/8" />

      {/* Shimmer on playable cards */}
      {playable && !isDisabled && (
        <div className="absolute inset-0 uno-shimmer rounded-2xl" />
      )}

      {/* Playable ring indicator */}
      {playable && !isDisabled && !selected && (
        <motion.div
          className="absolute -inset-[2px] rounded-2xl border-2 border-yellow-300/60"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Top-left label */}
      <span className="absolute top-1.5 left-2 text-[10px] md:text-xs font-black text-white drop-shadow-md">
        {cardLabel}
      </span>

      {/* Bottom-right label */}
      <span className="absolute bottom-1.5 right-2 text-[10px] md:text-xs font-black text-white rotate-180 drop-shadow-md">
        {cardLabel}
      </span>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-white text-3xl md:text-4xl font-black tracking-tight drop-shadow-xl leading-none"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
          {cardLabel}
        </span>
        {subLabel && (
          <span className="text-white/80 text-[7px] md:text-[8px] font-bold uppercase tracking-[0.15em] drop-shadow-md">
            {subLabel}
          </span>
        )}
      </div>

      {/* Wild card rainbow stripe */}
      {colorKey === 'wild' && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
          <div className="flex-1 bg-red-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-yellow-400" />
        </div>
      )}
    </motion.button>
  )
}
