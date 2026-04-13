import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { CombatAnimationData } from './useDominosSocket'
import type { DominosPublicPlayer } from '@undercover/shared'
import { PixelCharacter } from './PixelCharacter'

type Phase = 'setup' | 'attack' | 'damage' | 'result'

interface CombatOverlayProps {
  data: CombatAnimationData
  players: DominosPublicPlayer[]
  targetScore: number
  onComplete: () => void
}

export function CombatOverlay({ data, players, targetScore, onComplete }: CombatOverlayProps) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [showResult, setShowResult] = useState(false)

  const winner = players.find(p => p.id === data.winnerId)
  const losers = players.filter(p => data.losers.includes(p.id))

  // Phase timing
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(setTimeout(() => setPhase('attack'), 600))

    const attackDuration = data.attackTier === 'combo' ? 2500 : data.attackTier === 'energyBall' ? 1500 : data.attackTier === 'miss' ? 1200 : 800
    timers.push(setTimeout(() => setPhase('damage'), 600 + attackDuration))
    timers.push(setTimeout(() => {
      setPhase('result')
      setShowResult(true)
    }, 600 + attackDuration + 1200))

    return () => timers.forEach(clearTimeout)
  }, [data.attackTier])

  if (!winner) return null

  // HP is inverse of OPPONENT's score, not own score
  // Winner's HP = 100% minus the max opponent score percentage
  const getHpForPlayer = (playerId: string) => {
    const opponents = players.filter(p => p.id !== playerId)
    const maxOppScore = Math.max(0, ...opponents.map(p => p.totalScore))
    return Math.max(0, 100 - (maxOppScore / targetScore) * 100)
  }

  const winnerHp = getHpForPlayer(winner.id)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Screen shake on combo */}
      <motion.div
        className="flex flex-col items-center gap-8 w-full max-w-lg px-4"
        animate={
          phase === 'attack' && data.attackTier === 'combo'
            ? { x: [0, -8, 6, -5, 7, -3, 5, -6, 4, -2, 0] }
            : {}
        }
        transition={{ duration: 0.5, delay: 1.8 }}
      >
        {/* Attack label */}
        <AnimatePresence>
          {phase === 'attack' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              {data.attackTier === 'miss' ? (
                <span className="text-3xl font-black text-slate-400">MISS !</span>
              ) : data.attackTier === 'punch' ? (
                <span className="text-3xl font-black text-amber-400">COUP !</span>
              ) : data.attackTier === 'energyBall' ? (
                <span className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
                  ÉNERGIE !
                </span>
              ) : (
                <span className="text-5xl font-black text-red-400 drop-shadow-[0_0_30px_rgba(255,0,0,0.6)]">
                  COMBO !!
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Battle scene */}
        <div className="flex items-end justify-center gap-16 w-full">
          {/* Winner */}
          <motion.div
            className="flex flex-col items-center"
            animate={
              phase === 'attack' && data.attackTier !== 'miss'
                ? { x: [0, 40, 0] }
                : {}
            }
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            <PixelCharacter
              characterIndex={winner.characterIndex}
              hp={winnerHp}
              name={winner.name}
              isAttacking={phase === 'attack' && data.attackTier !== 'miss'}
              isVictorious={phase === 'result'}
              size={5}
            />
          </motion.div>

          {/* Projectile (energy ball) */}
          <AnimatePresence>
            {phase === 'attack' && (data.attackTier === 'energyBall' || data.attackTier === 'combo') && (
              <motion.div
                className="absolute rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.8),0_0_40px_rgba(0,255,255,0.4)]"
                style={{ width: 24, height: 24 }}
                initial={{ x: -60, opacity: 0, scale: 0.3 }}
                animate={{ x: 60, opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 0.5] }}
                transition={{ duration: 0.6, delay: data.attackTier === 'combo' ? 1.0 : 0.3 }}
              />
            )}
          </AnimatePresence>

          {/* Losers */}
          <div className="flex gap-4">
            {losers.map(loser => {
              // Loser's HP = based on winner's score (inverse)
              // After damage: winner gained points, so loser HP drops
              const winnerScore = phase === 'damage' || phase === 'result'
                ? winner.totalScore + data.pointsScored
                : winner.totalScore
              const loserHp = Math.max(0, 100 - (winnerScore / targetScore) * 100)

              return (
                <motion.div
                  key={loser.id}
                  className="flex flex-col items-center"
                  animate={
                    phase === 'attack' && data.attackTier === 'miss'
                      ? {} // miss: no recoil
                      : phase === 'attack'
                        ? { x: [0, -20, 0] }
                        : {}
                  }
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <PixelCharacter
                    characterIndex={loser.characterIndex}
                    hp={loserHp}
                    name={loser.name}
                    isRecoiling={phase === 'attack' && data.attackTier !== 'miss'}
                    flipped
                    size={5}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Miss animation — attacker trips */}
        <AnimatePresence>
          {phase === 'attack' && data.attackTier === 'miss' && (
            <motion.p
              className="text-lg text-slate-400 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              L'attaque échoue... 0 point !
            </motion.p>
          )}
        </AnimatePresence>

        {/* Damage numbers */}
        <AnimatePresence>
          {phase === 'damage' && data.attackTier !== 'miss' && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-2xl font-black text-red-400">
                -{data.pointsScored} PV
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              className="bg-slate-900/80 rounded-2xl p-6 text-center space-y-4 border border-slate-600"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h2 className="text-xl font-bold text-white">
                {winner.name} remporte la manche !
              </h2>
              <p className="text-amber-400 font-bold text-lg">
                +{data.pointsScored} points
              </p>

              {/* Pip counts */}
              <div className="flex gap-4 justify-center text-sm text-slate-300">
                {players.map(p => (
                  <div key={p.id} className={p.id === data.winnerId ? 'text-emerald-400' : 'text-red-400'}>
                    <span className="font-bold">{p.name}</span>
                    <span className="ml-1">({data.damagePerPlayer[p.id] ?? 0} pips)</span>
                  </div>
                ))}
              </div>

              <button
                onClick={onComplete}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform"
              >
                Manche suivante
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
