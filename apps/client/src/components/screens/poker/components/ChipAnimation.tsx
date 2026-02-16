import React from 'react'
import { motion } from 'motion/react'

export interface ChipAnimationProps {
  fromPosition: { x: number; y: number }
  toPosition: { x: number; y: number }
  amount: number
  onComplete?: () => void
  color?: string
}

/**
 * ChipAnimation - Animates chips flying from source to target position
 * Used for:
 * - Chips flying from player to pot
 * - Chips being distributed to winner
 * - Pot collection animations
 */
export function ChipAnimation({
  fromPosition,
  toPosition,
  amount,
  onComplete,
  color = 'bg-red-500',
}: ChipAnimationProps) {
  const formatChips = (centimes: number) => {
    return (centimes / 100).toFixed(0)
  }

  return (
    <motion.div
      className="fixed pointer-events-none"
      initial={{
        x: fromPosition.x,
        y: fromPosition.y,
        opacity: 1,
        scale: 1,
      }}
      animate={{
        x: toPosition.x,
        y: toPosition.y,
        opacity: 0,
        scale: 0.5,
      }}
      transition={{
        duration: 0.6,
        ease: 'easeInOut',
      }}
      onAnimationComplete={onComplete}
    >
      {/* Chip Visual */}
      <div
        className={`w-12 h-12 md:w-16 md:h-16 rounded-full ${color} shadow-lg flex items-center justify-center border-2 border-yellow-300 dark:border-yellow-400`}
      >
        {/* Chip Stack Effect */}
        <div className="absolute inset-0 rounded-full border-2 border-yellow-200 dark:border-yellow-300 opacity-50 scale-90" />

        {/* Amount Label */}
        <span className="text-white font-bold text-xs md:text-sm text-center z-10">
          ${formatChips(amount)}
        </span>
      </div>
    </motion.div>
  )
}

/**
 * ChipAnimationContainer - Manages multiple chip animations
 * Useful for animating multiple chips in sequence or parallel
 */
export interface ChipAnimationContainerProps {
  animations: Array<{
    id: string
    fromPosition: { x: number; y: number }
    toPosition: { x: number; y: number }
    amount: number
    color?: string
  }>
  onAllComplete?: () => void
}

export function ChipAnimationContainer({
  animations,
  onAllComplete,
}: ChipAnimationContainerProps) {
  const [completedCount, setCompletedCount] = React.useState(0)

  React.useEffect(() => {
    if (completedCount === animations.length && animations.length > 0) {
      onAllComplete?.()
    }
  }, [completedCount, animations.length, onAllComplete])

  return (
    <>
      {animations.map((anim) => (
        <ChipAnimation
          key={anim.id}
          fromPosition={anim.fromPosition}
          toPosition={anim.toPosition}
          amount={anim.amount}
          color={anim.color}
          onComplete={() => setCompletedCount((c) => c + 1)}
        />
      ))}
    </>
  )
}
