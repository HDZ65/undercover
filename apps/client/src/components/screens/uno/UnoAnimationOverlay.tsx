import { AnimatePresence, motion } from 'motion/react'
import type { GameAnimationEvent } from '@uno/shared'
import { useEffect } from 'react'

interface UnoAnimationOverlayProps {
  animation: GameAnimationEvent | null
  onComplete: () => void
}

const DURATIONS: Record<GameAnimationEvent['type'], number> = {
  wildDraw4: 3000,
  draw2: 2400,
  skip: 2000,
  reverse: 2000,
  uno: 2200,
  multiCard: 2000,
}

const PARTICLE_COLORS = {
  wildDraw4: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
  draw2: ['#3b82f6', '#6366f1', '#60a5fa'],
  skip: ['#ef4444', '#f97316', '#fbbf24'],
  reverse: ['#10b981', '#34d399', '#6ee7b7'],
  uno: ['#ef4444', '#f59e0b', '#fbbf24'],
  multiCard: ['#f59e0b', '#f97316', '#fb923c'],
}

function ExplosionParticles({ count, colors }: { count: number; colors: string[] }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i * Math.PI * 2) / count
        const distance = 120 + Math.random() * 80
        const size = 4 + Math.random() * 8
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: colors[i % colors.length],
              boxShadow: `0 0 ${size * 2}px ${colors[i % colors.length]}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.9, delay: 0.05 + Math.random() * 0.15, ease: 'easeOut' }}
          />
        )
      })}
    </>
  )
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
      {/* Screen shake effect via parent */}
      <motion.div
        animate={{ x: [-6, 6, -4, 4, -2, 2, 0] }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          className="text-8xl md:text-[10rem] font-black leading-none"
          animate={{
            scale: [1, 1.2, 1, 1.15, 1],
            textShadow: [
              '0 0 20px rgba(239,68,68,0.6)',
              '0 0 80px rgba(239,68,68,1)',
              '0 0 20px rgba(239,68,68,0.6)',
              '0 0 60px rgba(245,158,11,1)',
              '0 0 20px rgba(239,68,68,0.6)',
            ],
          }}
          transition={{ duration: 0.7, repeat: 3 }}
          style={{
            background: 'linear-gradient(135deg, #ef4444, #f59e0b, #ef4444)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(239,68,68,0.5))',
          }}
        >
          +4
        </motion.div>

        <motion.div
          className="text-xl md:text-2xl font-bold text-white/90"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-red-400 font-black">{animation.sourcePlayerName}</span>
          <span className="text-white/50 mx-2">→</span>
          <span className="text-amber-300 font-black">{animation.targetPlayerName}</span>
        </motion.div>
      </motion.div>

      {/* Explosion particles */}
      <ExplosionParticles count={20} colors={PARTICLE_COLORS.wildDraw4} />

      {/* Shockwave ring */}
      <motion.div
        className="absolute rounded-full border-2 border-red-500/50"
        initial={{ width: 0, height: 0, opacity: 0.8 }}
        animate={{ width: 350, height: 350, opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        style={{ marginLeft: -175, marginTop: -175 }}
      />
    </motion.div>
  )
}

function Draw2Animation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      <motion.div
        className="text-7xl md:text-9xl font-black"
        animate={{
          x: [-10, 10, -10, 10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 0.5, repeat: 2 }}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 25px rgba(59,130,246,0.6))',
        }}
      >
        +2
      </motion.div>

      <motion.div
        className="text-lg md:text-xl font-bold text-white/90"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-blue-400 font-black">{animation.sourcePlayerName}</span>
        <span className="text-white/50 mx-2">→</span>
        <span className="text-amber-300 font-black">{animation.targetPlayerName}</span>
      </motion.div>

      <ExplosionParticles count={10} colors={PARTICLE_COLORS.draw2} />
    </motion.div>
  )
}

function SkipAnimation({ animation }: { animation: GameAnimationEvent }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.3, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 250, damping: 15 }}
    >
      <motion.div
        className="text-8xl md:text-[10rem]"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.5))' }}
      >
        ⊘
      </motion.div>

      <motion.div
        className="text-3xl md:text-4xl font-black uppercase tracking-wider text-white"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
        style={{ textShadow: '0 0 30px rgba(239,68,68,0.5)' }}
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

      <ExplosionParticles count={8} colors={PARTICLE_COLORS.skip} />
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
        className="text-8xl md:text-[10rem]"
        animate={{ rotate: [0, -720] }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 25px rgba(52,211,153,0.6))' }}
      >
        ↺
      </motion.div>

      <motion.div
        className="text-3xl md:text-4xl font-black uppercase tracking-wider"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
        style={{
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 20px rgba(52,211,153,0.5))',
        }}
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

      <ExplosionParticles count={10} colors={PARTICLE_COLORS.reverse} />
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
        className="text-8xl md:text-[10rem] font-black leading-none"
        animate={{
          scale: [1, 1.25, 1, 1.2, 1],
          rotate: [-5, 5, -5, 5, 0],
        }}
        transition={{ duration: 0.8 }}
        style={{
          background: 'linear-gradient(135deg, #ef4444, #f59e0b, #ef4444)',
          backgroundSize: '200% 200%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 40px rgba(239,68,68,0.6))',
        }}
      >
        UNO!
      </motion.div>

      <motion.p
        className="text-xl font-black text-amber-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {animation.sourcePlayerName}
      </motion.p>

      <ExplosionParticles count={14} colors={PARTICLE_COLORS.uno} />

      {/* Shockwave */}
      <motion.div
        className="absolute rounded-full border-2 border-amber-400/40"
        initial={{ width: 0, height: 0, opacity: 0.7 }}
        animate={{ width: 300, height: 300, opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        style={{ marginLeft: -150, marginTop: -150 }}
      />
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
      <div className="relative h-40 w-56 flex items-center justify-center">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-20 h-32 rounded-2xl border-2 border-white/50 shadow-xl overflow-hidden"
            initial={{ x: 0, y: 0, rotate: 0, scale: 0 }}
            animate={{
              x: (i - (count - 1) / 2) * 28,
              rotate: (i - (count - 1) / 2) * 14,
              scale: 1,
            }}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 250, damping: 12 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-600" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(255,255,255,0.4),transparent_50%)]" />
            <div className="absolute inset-2 rounded-xl border border-white/25" />
          </motion.div>
        ))}
      </div>

      <motion.div
        className="text-5xl md:text-7xl font-black"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring' }}
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.5))',
        }}
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

      <ExplosionParticles count={12} colors={PARTICLE_COLORS.multiCard} />
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
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              background: animation.type === 'wildDraw4'
                ? 'radial-gradient(circle at center, rgba(239,68,68,0.15), rgba(0,0,0,0.7))'
                : 'radial-gradient(circle at center, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
            }}
          />
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
