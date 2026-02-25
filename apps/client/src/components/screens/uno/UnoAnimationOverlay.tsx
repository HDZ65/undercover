import { AnimatePresence, motion } from 'motion/react'
import type { GameAnimationEvent } from '@uno/shared'
import { useEffect } from 'react'

interface UnoAnimationOverlayProps {
  animation: GameAnimationEvent | null
  onComplete: () => void
}

const DURATIONS: Record<GameAnimationEvent['type'], number> = {
  wildDraw4: 2800,
  draw2: 2200,
  skip: 1800,
  reverse: 1800,
  uno: 2000,
  multiCard: 1800,
}

function WildDraw4Animation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
    >
      <motion.div
        className="text-8xl md:text-9xl font-black"
        animate={{
          scale: [1, 1.15, 1],
          textShadow: [
            '0 0 20px rgba(239,68,68,0.8)',
            '0 0 60px rgba(239,68,68,1)',
            '0 0 20px rgba(239,68,68,0.8)',
          ],
        }}
        transition={{ duration: 0.6, repeat: 3 }}
        style={{
          background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        +4
      </motion.div>

      <motion.div
        className="text-lg md:text-xl font-bold text-white/90"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-red-400">{animation.sourcePlayerName}</span>
        {' → '}
        <span className="text-amber-300">{animation.targetPlayerName}</span>
      </motion.div>

      {/* Explosion particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full bg-red-500"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((i * Math.PI * 2) / 12) * 180,
            y: Math.sin((i * Math.PI * 2) / 12) * 180,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.8, delay: 0.1 }}
          style={{
            background: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#f59e0b' : '#3b82f6',
          }}
        />
      ))}
    </motion.div>
  )
}

function Draw2Animation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      <motion.div
        className="text-7xl md:text-8xl font-black text-blue-400"
        animate={{
          x: [-8, 8, -8, 8, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{ duration: 0.5, repeat: 2 }}
        style={{
          textShadow: '0 0 30px rgba(59,130,246,0.6)',
        }}
      >
        +2
      </motion.div>

      <motion.div
        className="text-lg font-bold text-white/90"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-blue-400">{animation.sourcePlayerName}</span>
        {' → '}
        <span className="text-amber-300">{animation.targetPlayerName}</span>
      </motion.div>
    </motion.div>
  )
}

function SkipAnimation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 250, damping: 15 }}
    >
      <motion.div
        className="text-8xl md:text-9xl"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.8 }}
      >
        ⊘
      </motion.div>

      <motion.div
        className="text-2xl font-black uppercase tracking-wider text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}
      >
        PASSE !
      </motion.div>

      <motion.p
        className="text-lg font-bold text-red-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {animation.targetPlayerName} est passe
      </motion.p>
    </motion.div>
  )
}

function ReverseAnimation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, rotate: -180 }}
      animate={{ opacity: 1, rotate: 0 }}
      exit={{ opacity: 0, rotate: 180 }}
      transition={{ type: 'spring', stiffness: 150, damping: 12 }}
    >
      <motion.div
        className="text-8xl md:text-9xl"
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      >
        ↺
      </motion.div>

      <motion.div
        className="text-2xl font-black uppercase tracking-wider text-emerald-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ textShadow: '0 0 20px rgba(52,211,153,0.5)' }}
      >
        REVERSE !
      </motion.div>

      <motion.p
        className="text-lg font-bold text-white/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {animation.sourcePlayerName}
      </motion.p>
    </motion.div>
  )
}

function UnoCallAnimation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 10 }}
    >
      <motion.div
        className="text-8xl md:text-9xl font-black"
        animate={{
          scale: [1, 1.2, 1, 1.2, 1],
          rotate: [-5, 5, -5, 5, 0],
        }}
        transition={{ duration: 0.8 }}
        style={{
          background: 'linear-gradient(135deg, #ef4444, #f59e0b, #ef4444)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 30px rgba(239,68,68,0.6))',
        }}
      >
        UNO!
      </motion.div>

      <motion.p
        className="text-xl font-bold text-amber-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {animation.sourcePlayerName}
      </motion.p>
    </motion.div>
  )
}

function MultiCardAnimation({ animation }: { animation: GameAnimationEvent }) {
  const count = animation.cards?.length ?? 0
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
    >
      {/* Fanned cards */}
      <div className="relative h-36 w-48 flex items-center justify-center">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-20 h-32 rounded-2xl border-2 border-white/60 bg-gradient-to-br from-amber-400 to-orange-600 shadow-xl"
            initial={{ x: 0, y: 0, rotate: 0, scale: 0 }}
            animate={{
              x: (i - (count - 1) / 2) * 25,
              rotate: (i - (count - 1) / 2) * 12,
              scale: 1,
            }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 250, damping: 12 }}
          />
        ))}
      </div>

      <motion.div
        className="text-5xl md:text-6xl font-black text-amber-400"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ textShadow: '0 0 25px rgba(245,158,11,0.5)' }}
      >
        x{count} !
      </motion.div>

      <motion.p
        className="text-lg font-bold text-white/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {animation.sourcePlayerName}
      </motion.p>
    </motion.div>
  )
}

export function UnoAnimationOverlay({ animation, onComplete }: UnoAnimationOverlayProps) {
  useEffect(() => {
    if (!animation) return

    const duration = DURATIONS[animation.type] ?? 2000
    const timer = setTimeout(onComplete, duration)
    return () => clearTimeout(timer)
  }, [animation, onComplete])

  return (
    <AnimatePresence>
      {animation && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative">
            {animation.type === 'wildDraw4' && <WildDraw4Animation animation={animation} />}
            {animation.type === 'draw2' && <Draw2Animation animation={animation} />}
            {animation.type === 'skip' && <SkipAnimation animation={animation} />}
            {animation.type === 'reverse' && <ReverseAnimation animation={animation} />}
            {animation.type === 'uno' && <UnoCallAnimation animation={animation} />}
            {animation.type === 'multiCard' && <MultiCardAnimation animation={animation} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
