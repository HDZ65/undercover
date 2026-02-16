import { motion } from 'motion/react'

export interface DealerButtonProps {
  seatIndex: number
  seatPositions: Array<{ x: number; y: number }>
  isAnimating?: boolean
}

/**
 * DealerButton - Animated dealer button that slides between seat positions
 * Uses Framer Motion spring animation for smooth movement between hands
 *
 * The button is positioned absolutely and moves to the current dealer's seat
 * with a spring transition for natural, bouncy movement
 */
export function DealerButton({
  seatIndex,
  seatPositions,
  isAnimating = false,
}: DealerButtonProps) {
  // Validate seat index
  const validSeatIndex = Math.max(0, Math.min(seatIndex, seatPositions.length - 1))
  const targetPosition = seatPositions[validSeatIndex]

  if (!targetPosition) {
    return null
  }

  return (
    <motion.div
      className="fixed pointer-events-none"
      animate={{
        x: targetPosition.x,
        y: targetPosition.y,
      }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 15,
        duration: 0.6,
      }}
    >
      {/* Dealer Button Circle */}
      <div className="relative w-8 h-8 md:w-10 md:h-10">
        {/* Outer ring with glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 dark:from-yellow-400 dark:to-yellow-600 shadow-lg border-2 border-yellow-100 dark:border-yellow-200"
          animate={
            isAnimating
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(250, 204, 21, 0.7)',
                    '0 0 0 8px rgba(250, 204, 21, 0)',
                  ],
                }
              : {}
          }
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
        />

        {/* Inner ring for depth */}
        <div className="absolute inset-1 rounded-full border border-yellow-200 dark:border-yellow-300 opacity-60" />

        {/* Dealer "D" Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm md:text-base font-bold text-yellow-900 dark:text-yellow-950 select-none">
            D
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * DealerButtonStatic - Static version for use in seat components
 * Positioned relative to the seat, not fixed to viewport
 */
export interface DealerButtonStaticProps {
  isAnimating?: boolean
}

export function DealerButtonStatic({ isAnimating = false }: DealerButtonStaticProps) {
  return (
    <motion.div
      className="absolute -top-2 -right-2 w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 dark:from-yellow-400 dark:to-yellow-600 border-2 border-yellow-100 dark:border-yellow-200 flex items-center justify-center text-xs font-bold text-yellow-900 dark:text-yellow-950 shadow-md"
      animate={
        isAnimating
          ? {
              scale: [1, 1.1, 1],
            }
          : {}
      }
      transition={{
        duration: 0.6,
        repeat: Infinity,
        repeatDelay: 2,
      }}
    >
      D
    </motion.div>
  )
}
