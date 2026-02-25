import { useMemo } from 'react'
import { motion } from 'motion/react'

const UNO_COLORS = [
  'rgba(239, 68, 68, 0.35)',   // red
  'rgba(59, 130, 246, 0.35)',  // blue
  'rgba(16, 185, 129, 0.35)',  // green
  'rgba(245, 158, 11, 0.35)',  // yellow
  'rgba(168, 85, 247, 0.25)',  // violet accent
]

interface Particle {
  id: number
  x: number
  size: number
  color: string
  duration: number
  delay: number
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100,
      size: 4 + Math.random() * 12,
      color: UNO_COLORS[i % UNO_COLORS.length],
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
    })
  }
  return particles
}

export function UnoParticles() {
  const particles = useMemo(() => generateParticles(18), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, ${p.color}, transparent)`,
            filter: `blur(${p.size > 10 ? 2 : 1}px)`,
          }}
          initial={{ y: '110vh', opacity: 0, scale: 0 }}
          animate={{
            y: [110, -20].map((v) => `${v}vh`),
            opacity: [0, 0.7, 0.5, 0],
            scale: [0.3, 1, 0.8, 0.4],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Subtle ambient glow spots */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.6), transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.6), transparent 70%)' }}
      />
      <div
        className="absolute top-1/2 right-1/3 w-40 h-40 rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)' }}
      />
    </div>
  )
}
