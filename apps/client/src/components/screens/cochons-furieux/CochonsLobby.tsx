import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  Grid,
  CellType,
  WeaponType,
  ShotResult,
  CochonsPublicState,
  CochonsPrivateState,
  PlayerSide,
  TrajectoryPoint,
} from '@undercover/shared'
import { GRID_COLS, GRID_ROWS, cellIndex, WEAPON_SPECS, TOTAL_TURNS, sideRange } from '@undercover/shared'
import { useCochonsSocket } from './useCochonsSocket'

// ─── Block styles (Angry Birds look) ─────────────────────────────

const BLOCK_STYLE: Record<CellType, { bg: string; border: string; shadow: string }> = {
  empty:  { bg: '', border: '', shadow: '' },
  wood:   { bg: 'bg-amber-500', border: 'border-amber-700', shadow: 'shadow-[inset_0_-2px_0_rgba(120,53,15,0.5),inset_0_2px_0_rgba(255,220,150,0.4)]' },
  stone:  { bg: 'bg-slate-400', border: 'border-slate-600', shadow: 'shadow-[inset_0_-2px_0_rgba(51,65,85,0.5),inset_0_2px_0_rgba(203,213,225,0.5)]' },
  steel:  { bg: 'bg-sky-300', border: 'border-sky-500', shadow: 'shadow-[inset_0_-2px_0_rgba(14,116,144,0.5),inset_0_2px_0_rgba(186,230,253,0.6)]' },
  pig:    { bg: 'bg-lime-400', border: 'border-lime-600', shadow: 'shadow-[inset_0_-3px_0_rgba(63,98,18,0.4)]' },
}

// ─── Grid Renderer (Angry Birds style) ───────────────────────────

// Physics constants — MUST match server (physics.ts)
const PH = { GRAVITY: 10, MAX_VELOCITY: 28, DT: 0.03, MAX_TIME: 15 }

function getLaunchPos(side: PlayerSide) {
  return side === 'left' ? { x: 1.5, y: 2 } : { x: GRID_COLS - 1.5, y: 2 }
}

function previewTrajectory(angle: number, power: number, side: PlayerSide): TrajectoryPoint[] {
  const { x: x0, y: y0 } = getLaunchPos(side)
  const v0 = power * PH.MAX_VELOCITY
  const dirX = side === 'left' ? 1 : -1
  const vx = v0 * Math.cos(angle) * dirX
  const vy = v0 * Math.sin(angle)
  const pts: TrajectoryPoint[] = []
  for (let t = 0; t < PH.MAX_TIME; t += PH.DT) {
    const x = x0 + vx * t
    const y = y0 + vy * t - 0.5 * PH.GRAVITY * t * t
    if (y < -1 || x < -3 || x > GRID_COLS + 3) break
    pts.push({ x, y })
  }
  return pts
}

function GridRenderer({ grid, mySide, editMode, onCellClick, impactResult, trajectory, shootSide, onFire }: {
  grid: Grid
  mySide?: PlayerSide
  editMode?: { tool: 'pig' | CellType }
  onCellClick?: (col: number, row: number) => void
  impactResult?: ShotResult | null
  trajectory?: TrajectoryPoint[] | null
  shootSide?: PlayerSide       // which side the current player shoots from
  onFire?: (angle: number, power: number) => void
}) {
  // Drag state for slingshot
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null)
  const dragOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Flying projectile animation
  const [projectilePos, setProjectilePos] = useState<{ x: number; y: number } | null>(null)
  const [showImpact, setShowImpact] = useState(false)
  const prevTrajectoryLen = useRef(0)

  useEffect(() => {
    // Detect new trajectory (new shot fired)
    const tLen = trajectory?.length ?? 0
    if (tLen > 1 && tLen !== prevTrajectoryLen.current) {
      prevTrajectoryLen.current = tLen
      setShowImpact(false)
      // Animate projectile along trajectory points over ~4 seconds
      const pts = trajectory!
      const totalMs = 3500
      const stepMs = totalMs / pts.length
      let i = 0
      const interval = setInterval(() => {
        if (i < pts.length) {
          setProjectilePos({ x: pts[i].x, y: pts[i].y })
          i++
        } else {
          clearInterval(interval)
          setProjectilePos(null)
          setShowImpact(true)
          // Hide impact after 1.5s
          setTimeout(() => setShowImpact(false), 1500)
        }
      }, stepMs)
      return () => clearInterval(interval)
    }
  }, [trajectory])

  // Responsive cell size — fill the viewport width
  const cs = Math.max(12, Math.floor((typeof window !== 'undefined' ? window.innerWidth - 16 : 800) / GRID_COLS))
  const W = GRID_COLS * cs
  const H = GRID_ROWS * cs
  const groundH = Math.round(cs * 1.5)

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none" style={{ height: H + groundH }}>

      {/* ── Sky ── */}
      <div className="absolute inset-0" style={{ height: H }}>
        {/* Gradient sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#63cdff] via-[#8edcff] to-[#c5eaff]" />
        {/* Clouds */}
        <div className="absolute top-[8%] left-[5%] w-24 h-8 bg-white/60 rounded-full blur-sm" />
        <div className="absolute top-[6%] left-[8%] w-16 h-6 bg-white/70 rounded-full blur-sm" />
        <div className="absolute top-[12%] left-[30%] w-32 h-10 bg-white/50 rounded-full blur-sm" />
        <div className="absolute top-[5%] left-[33%] w-20 h-7 bg-white/60 rounded-full blur-sm" />
        <div className="absolute top-[15%] right-[15%] w-28 h-9 bg-white/55 rounded-full blur-sm" />
        <div className="absolute top-[10%] right-[18%] w-18 h-6 bg-white/65 rounded-full blur-sm" />
        <div className="absolute top-[20%] right-[40%] w-20 h-7 bg-white/45 rounded-full blur-sm" />
        {/* Distant hills */}
        <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-[#7ab648]/30 to-transparent" />
      </div>

      {/* ── Ground ── */}
      <div className="absolute left-0 right-0" style={{ top: H, height: groundH }}>
        <div className="w-full h-full bg-gradient-to-b from-[#5a8a2a] via-[#4a7a24] to-[#3d6620]" />
        {/* Grass top edge */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-[#7ab648]" />
      </div>

      {/* ── Center divider ── */}
      <div className="absolute top-0 border-l-2 border-dashed border-white/20 z-10" style={{ left: W / 2, height: H }} />

      {/* ── Build zone highlight ── */}
      {editMode && mySide && (
        <div className="absolute top-0 z-10 border-2 border-emerald-400/40 bg-emerald-400/5 rounded"
          style={{ left: mySide === 'left' ? 0 : W / 2, width: W / 2, height: H }} />
      )}

      {/* ── Blocks & Pigs ── */}
      {grid.map((cell, idx) => {
        if (cell.type === 'empty') return null
        const col = idx % GRID_COLS
        const row = Math.floor(idx / GRID_COLS)
        const x = col * cs
        const y = (GRID_ROWS - 1 - row) * cs
        const style = BLOCK_STYLE[cell.type]

        // Only destroy a cell visually when the projectile has reached or passed it
        const isMarkedDestroyed = impactResult?.destroyedCells.some(d => d.col === col && d.row === row)
        let isDestroyed = false
        if (isMarkedDestroyed && projectilePos) {
          // Projectile is flying — only destroy if projectile is near this cell
          const projCol = Math.floor(projectilePos.x)
          const projRow = Math.floor(projectilePos.y)
          const dist = Math.abs(projCol - col) + Math.abs(projRow - row)
          isDestroyed = dist <= (impactResult?.weapon === 'bomb' ? 5 : 3)
        } else if (isMarkedDestroyed && !projectilePos) {
          // Projectile has landed — all destroyed cells should be gone
          isDestroyed = true
        }

        if (cell.type === 'pig') {
          return (
            <motion.div
              key={`${col}-${row}`}
              className="absolute flex items-center justify-center cursor-pointer"
              style={{ left: x, top: y, width: cs, height: cs }}
              onClick={() => onCellClick?.(col, row)}
              animate={isDestroyed ? { scale: 0, opacity: 0, rotate: 180 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Pig body */}
              <div className={`w-[90%] h-[90%] rounded-full ${style.bg} ${style.border} border-2 ${style.shadow} flex items-center justify-center relative`}>
                {/* Eyes */}
                <div className="absolute top-[20%] left-[22%] w-[20%] h-[24%] bg-white rounded-full flex items-center justify-center">
                  <div className="w-[55%] h-[55%] bg-black rounded-full" />
                </div>
                <div className="absolute top-[20%] right-[22%] w-[20%] h-[24%] bg-white rounded-full flex items-center justify-center">
                  <div className="w-[55%] h-[55%] bg-black rounded-full" />
                </div>
                {/* Snout */}
                <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[40%] h-[28%] bg-lime-300 rounded-full border border-lime-600 flex items-center justify-center gap-[2px]">
                  <div className="w-[18%] h-[30%] bg-lime-600 rounded-full" />
                  <div className="w-[18%] h-[30%] bg-lime-600 rounded-full" />
                </div>
              </div>
            </motion.div>
          )
        }

        return (
          <motion.div
            key={`${col}-${row}`}
            className={`absolute ${style.bg} ${style.border} border ${style.shadow} rounded-sm cursor-pointer`}
            style={{ left: x + 0.5, top: y + 0.5, width: cs - 1, height: cs - 1 }}
            onClick={() => onCellClick?.(col, row)}
            animate={isDestroyed ? { scale: 0, opacity: 0, y: 20 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Wood grain texture */}
            {cell.type === 'wood' && (
              <div className="w-full h-full opacity-30 overflow-hidden">
                <div className="w-full h-[2px] bg-amber-800/40 mt-[30%]" />
                <div className="w-full h-[1px] bg-amber-800/30 mt-[25%]" />
              </div>
            )}
            {/* Steel shine */}
            {cell.type === 'steel' && (
              <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-white/30 rounded-full blur-[1px]" />
            )}
          </motion.div>
        )
      })}

      {/* ── Build: clickable empty cells ── */}
      {editMode && mySide && (() => {
        const { minCol, maxCol } = sideRange(mySide)
        const cells = []
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            if (grid[cellIndex(c, r)].type === 'empty') {
              cells.push(
                <div key={`e-${c}-${r}`}
                  className="absolute cursor-pointer hover:bg-white/15 rounded-sm transition-colors z-10"
                  style={{ left: c * cs, top: (GRID_ROWS - 1 - r) * cs, width: cs - 1, height: cs - 1 }}
                  onClick={() => onCellClick?.(c, r)} />
              )
            }
          }
        }
        return cells
      })()}

      {/* ── Flying projectile + trail ── */}
      {projectilePos && (
        <>
          {/* The stone — positioned with same coord system as trajectory dots */}
          <div className="absolute z-40 pointer-events-none rounded-full bg-gradient-to-br from-slate-400 to-slate-700 border-2 border-slate-800"
            style={{
              left: projectilePos.x * cs - cs * 0.7,
              top: (GRID_ROWS - projectilePos.y) * cs - cs * 0.7,
              width: cs * 1.4, height: cs * 1.4,
              boxShadow: '0 0 12px rgba(0,0,0,0.6), 0 0 4px rgba(255,150,50,0.4)',
            }}
          />
          {/* Trail dots behind the projectile */}
          <svg className="absolute inset-0 pointer-events-none z-30" width={W} height={H}>
            {trajectory && trajectory.map((p, i) => {
              // Only show dots up to the current projectile position
              const px = projectilePos.x * cs; const py = (GRID_ROWS - projectilePos.y) * cs
              const dotX = p.x * cs; const dotY = (GRID_ROWS - p.y) * cs
              const dist = Math.sqrt((dotX - px) ** 2 + (dotY - py) ** 2)
              if (dist < cs * 2) return null // skip dots near the projectile
              if (i % 4 !== 0) return null
              return <circle key={i} cx={dotX} cy={dotY} r={2.5} fill="rgba(255,255,255,0.5)" />
            })}
          </svg>
        </>
      )}

      {/* ── Full trajectory dots (after projectile has landed) ── */}
      {!projectilePos && trajectory && trajectory.length > 1 && (
        <svg className="absolute inset-0 pointer-events-none z-20" width={W} height={H}>
          {trajectory.filter((_, i) => i % 3 === 0).map((p, i) => (
            <circle key={i} cx={p.x * cs} cy={(GRID_ROWS - p.y) * cs} r={2.5}
              fill="rgba(255,255,255,0.6)" stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} />
          ))}
        </svg>
      )}

      {/* ── Impact explosion (after projectile finishes flying) ── */}
      {showImpact && impactResult && !impactResult.missed && (
        <>
          <motion.div className="absolute rounded-full border-4 border-orange-400/60 z-30"
            style={{
              left: impactResult.impactCol * cs - cs * 2,
              top: (GRID_ROWS - 1 - impactResult.impactRow) * cs - cs * 2,
              width: cs * 5, height: cs * 5,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
          <motion.div className="absolute rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 z-30"
            style={{
              left: impactResult.impactCol * cs - cs,
              top: (GRID_ROWS - 1 - impactResult.impactRow) * cs - cs,
              width: cs * 3, height: cs * 3,
            }}
            initial={{ scale: 0.3, opacity: 1 }}
            animate={{ scale: [0.3, 1.5, 0], opacity: [1, 0.8, 0] }}
            transition={{ duration: 0.6 }}
          />
        </>
      )}

      {/* ── Slingshots ── */}
      {(['left', 'right'] as PlayerSide[]).map(side => {
        const slingshotX = side === 'left' ? cs * 1.5 : W - cs * 2.5
        const slingshotY = H - cs * 2
        const isActive = shootSide === side && !!onFire
        const forkW = cs * 1.5
        const forkH = cs * 3

        // Compute drag angle/power for preview
        const dragAngle = dragDelta && dragging && isActive
          ? Math.atan2(-dragDelta.dy, side === 'left' ? -dragDelta.dx : dragDelta.dx)
          : null
        const dragPower = dragDelta && dragging && isActive
          ? Math.min(1, Math.sqrt(dragDelta.dx ** 2 + dragDelta.dy ** 2) / 150)
          : null
        const preview = dragAngle !== null && dragPower !== null && dragPower > 0.05
          ? previewTrajectory(dragAngle, dragPower, side)
          : null

        return (
          <div key={side}>
            {/* Slingshot body */}
            <div
              className={`absolute z-30 ${isActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ left: slingshotX, top: slingshotY, width: forkW, height: forkH, touchAction: 'none' }}
              onPointerDown={isActive ? (e) => {
                const rect = containerRef.current?.getBoundingClientRect()
                if (!rect) return
                dragOrigin.current = { x: e.clientX, y: e.clientY }
                setDragging(true)
                setDragDelta({ dx: 0, dy: 0 })
                ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              } : undefined}
              onPointerMove={dragging && isActive ? (e) => {
                setDragDelta({
                  dx: e.clientX - dragOrigin.current.x,
                  dy: e.clientY - dragOrigin.current.y,
                })
              } : undefined}
              onPointerUp={dragging && isActive ? () => {
                if (dragDelta && onFire) {
                  const dist = Math.sqrt(dragDelta.dx ** 2 + dragDelta.dy ** 2)
                  const power = Math.min(1, dist / 150)
                  const angle = Math.atan2(-dragDelta.dy, side === 'left' ? -dragDelta.dx : dragDelta.dx)
                  if (power > 0.05) onFire(angle, power)
                }
                setDragging(false)
                setDragDelta(null)
              } : undefined}
            >
              {/* Fork (Y shape) */}
              <svg width={forkW} height={forkH} viewBox="0 0 30 60" className="drop-shadow-md">
                {/* Trunk */}
                <rect x="12" y="25" width="6" height="35" rx="2" fill="#6D4C2E" />
                {/* Left fork */}
                <rect x="3" y="5" width="5" height="25" rx="2" fill="#6D4C2E" transform="rotate(-12, 5, 30)" />
                {/* Right fork */}
                <rect x="22" y="5" width="5" height="25" rx="2" fill="#6D4C2E" transform="rotate(12, 25, 30)" />
                {/* Fork tips */}
                <circle cx="5" cy="5" r="3" fill="#8B6F47" />
                <circle cx="25" cy="5" r="3" fill="#8B6F47" />
              </svg>

              {/* Elastic band when dragging */}
              {dragging && dragDelta && isActive && (
                <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" width={forkW} height={forkH} viewBox="0 0 30 60" style={{ zIndex: 40 }}>
                  {/* Left band */}
                  <line x1="5" y1="5" x2={15 + dragDelta.dx * 0.2} y2={30 + dragDelta.dy * 0.2} stroke="#5C3A1E" strokeWidth="3" strokeLinecap="round" />
                  {/* Right band */}
                  <line x1="25" y1="5" x2={15 + dragDelta.dx * 0.2} y2={30 + dragDelta.dy * 0.2} stroke="#5C3A1E" strokeWidth="3" strokeLinecap="round" />
                  {/* Projectile in the pouch */}
                  <circle cx={15 + dragDelta.dx * 0.2} cy={30 + dragDelta.dy * 0.2} r="5" fill="#666" stroke="#444" strokeWidth="1" />
                </svg>
              )}
            </div>

            {/* Trajectory preview while dragging */}
            {preview && (
              <svg className="absolute inset-0 pointer-events-none z-20" width={W} height={H}>
                {preview.filter((_, i) => i % 4 === 0).map((p, i) => (
                  <circle key={i} cx={p.x * cs} cy={(GRID_ROWS - p.y) * cs} r={2.5}
                    fill="rgba(255,255,255,0.5)" />
                ))}
              </svg>
            )}

            {/* Power indicator while dragging */}
            {dragging && dragDelta && isActive && dragPower !== null && (
              <div className="absolute z-40 text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-lg"
                style={{ left: slingshotX - 10, top: slingshotY - 30 }}>
                {Math.round(dragPower * 100)}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Weapon Selector ─────────────────────────────────────────────

function WeaponSelector({ inventory, selected, onSelect }: {
  inventory: Record<WeaponType, number>; selected: WeaponType; onSelect: (w: WeaponType) => void
}) {
  const weapons: WeaponType[] = ['rock', 'bomb', 'missile']
  const gradients: Record<WeaponType, string> = { rock: 'from-amber-600 to-amber-800', bomb: 'from-red-500 to-orange-600', missile: 'from-slate-500 to-blue-600' }
  return (
    <div className="flex gap-2 justify-center">
      {weapons.map(w => {
        const spec = WEAPON_SPECS[w]; const count = inventory[w] ?? 0
        return (
          <button key={w} onClick={() => count > 0 && onSelect(w)} disabled={count === 0}
            className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${selected === w ? `bg-gradient-to-r ${gradients[w]} text-white ring-2 ring-white/50 scale-105` : count > 0 ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50'}`}>
            <span className="text-lg">{spec.emoji}</span> <span className="ml-1">{spec.labelFr}</span> <span className="ml-1 text-xs opacity-70">×{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Landing ─────────────────────────────────────────────────────

function Landing({ onCreateRoom, onJoinRoom }: { onCreateRoom: (name: string) => void; onJoinRoom: (code: string, name: string) => void }) {
  const [name, setName] = useState(''); const [joinCode, setJoinCode] = useState(''); const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100">🐷 Cochons Furieux</h1>
        <p className="text-slate-500 dark:text-slate-400">Construisez, visez, détruisez !</p>
      </div>
      {mode === 'menu' && (
        <div className="space-y-3">
          <button onClick={() => setMode('create')} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">Créer une partie</button>
          <button onClick={() => setMode('join')} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">Rejoindre</button>
        </div>
      )}
      {mode === 'create' && (
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre pseudo" className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" maxLength={20} />
          <button onClick={() => name.trim() && onCreateRoom(name.trim())} disabled={!name.trim()} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl disabled:opacity-50">Créer</button>
          <button onClick={() => setMode('menu')} className="w-full py-2 text-slate-500">Retour</button>
        </div>
      )}
      {mode === 'join' && (
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre pseudo" className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" maxLength={20} />
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Code du salon" className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 tracking-widest text-center font-mono text-xl" maxLength={6} />
          <button onClick={() => name.trim() && joinCode.trim() && onJoinRoom(joinCode.trim(), name.trim())} disabled={!name.trim() || joinCode.length < 4} className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-50">Rejoindre</button>
          <button onClick={() => setMode('menu')} className="w-full py-2 text-slate-500">Retour</button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Lobby Phase ─────────────────────────────────────────────────

function LobbyPhase({ pub, priv, game }: { pub: CochonsPublicState; priv: CochonsPrivateState; game: ReturnType<typeof useCochonsSocket> }) {
  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="text-center"><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Salon {pub.roomCode}</h2></div>
      <div className="space-y-2">
        {pub.players.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-2xl">🐷</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            <span className="text-xs text-slate-400">{p.side === 'left' ? '← Gauche' : 'Droite →'}</span>
            {p.id === pub.hostId && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Hôte</span>}
          </div>
        ))}
        {pub.players.length < 2 && <div className="px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-400">En attente d'un adversaire...</div>}
      </div>
      {priv.isHost && <button onClick={game.startGame} disabled={pub.players.length < 2} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50">Lancer la partie</button>}
      <button onClick={game.leaveRoom} className="w-full py-2 text-red-500 font-medium">Quitter</button>
    </motion.div>
  )
}

// ─── Build Phase ─────────────────────────────────────────────────

function BuildPhase({ pub, priv, game }: { pub: CochonsPublicState; priv: CochonsPrivateState; game: ReturnType<typeof useCochonsSocket> }) {
  const [tool, setTool] = useState<'pig' | CellType>('pig')
  const myPlayer = pub.players.find(p => p.id === priv.playerId)
  const grid = priv.buildGrid ?? []
  const pigCount = grid.filter(c => c.type === 'pig' && c.ownerId === priv.playerId).length
  const isReady = myPlayer?.ready ?? false

  const handleCellClick = (col: number, row: number) => {
    if (isReady) return
    const cell = grid[cellIndex(col, row)]
    if (tool === 'pig') {
      if (cell?.type === 'pig' && cell.ownerId === priv.playerId) game.removePig(col, row)
      else if (cell?.type === 'empty') game.placePig(col, row)
    } else if (tool === 'empty') {
      if (cell?.type !== 'empty' && cell?.type !== 'pig' && cell.ownerId === priv.playerId) game.removeBlock(col, row)
    } else {
      if (cell?.type === 'empty') game.placeBlock(col, row, tool)
    }
  }

  return (
    <div className="w-full flex-1 flex flex-col gap-3 px-2 py-3 items-center">
      <div className="text-center">
        <span className={`text-3xl font-black ${game.buildTimeRemaining <= 10 ? 'text-red-500' : game.buildTimeRemaining <= 30 ? 'text-amber-500' : 'text-emerald-500'}`}>{game.buildTimeRemaining}s</span>
        <p className="text-sm text-slate-500">Construisez sur votre côté ({priv.side === 'left' ? 'gauche' : 'droite'})</p>
      </div>

      <div className="flex gap-2 justify-center flex-wrap">
        {(() => {
          const woodCount = grid.filter(c => c.type === 'wood' && c.ownerId === priv.playerId).length
          const stoneCount = grid.filter(c => c.type === 'stone' && c.ownerId === priv.playerId).length
          const steelCount = grid.filter(c => c.type === 'steel' && c.ownerId === priv.playerId).length
          const tools = [
            { key: 'pig' as const, label: '🐷 Cochon', color: 'bg-green-500', count: `${pigCount}/5` },
            { key: 'wood' as CellType, label: '🪵 Bois', color: 'bg-amber-600', count: `${woodCount}/20` },
            { key: 'stone' as CellType, label: '🪨 Pierre', color: 'bg-slate-400', count: `${stoneCount}/12` },
            { key: 'steel' as CellType, label: '🔩 Acier', color: 'bg-blue-400', count: `${steelCount}/5` },
            { key: 'empty' as CellType, label: '❌ Suppr.', color: 'bg-red-400', count: '' },
          ]
          return tools.map(t => (
            <button key={t.key} onClick={() => setTool(t.key)} disabled={isReady}
              className={`px-2 py-1 rounded-lg text-xs font-bold text-white transition-all ${tool === t.key ? `${t.color} ring-2 ring-white/50 scale-105` : 'bg-slate-400 dark:bg-slate-600'}`}>
              {t.label}{t.count && <span className="ml-1 opacity-70">({t.count})</span>}
            </button>
          ))
        })()}
      </div>

      <GridRenderer grid={grid} mySide={priv.side} editMode={isReady ? undefined : { tool }} onCellClick={handleCellClick} />

      {!isReady ? (
        <button onClick={game.confirmBuild} disabled={pigCount < 5}
          className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
          {pigCount < 5 ? `Placez encore ${5 - pigCount} cochon(s)` : 'Confirmer'}
        </button>
      ) : <p className="text-center text-emerald-500 font-bold">✓ En attente de l'adversaire...</p>}

      <button onClick={game.leaveRoom}
        className="px-4 py-2 text-red-400 hover:text-red-300 text-sm font-medium border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors">
        Abandonner la partie
      </button>
    </div>
  )
}

// ─── Battle Phase ────────────────────────────────────────────────

function BattlePhase({ pub, priv, game }: { pub: CochonsPublicState; priv: CochonsPrivateState; game: ReturnType<typeof useCochonsSocket> }) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>('rock')
  const isMyTurn = pub.currentPlayerId === priv.playerId
  const myPlayer = pub.players.find(p => p.id === priv.playerId)
  const opponent = pub.players.find(p => p.id !== priv.playerId)
  const grid = pub.grid ?? []

  const lastShot = pub.shotHistory[pub.shotHistory.length - 1]

  return (
    <div className="w-full flex-1 flex flex-col gap-3 px-2 py-3 items-center">
      <div className="flex items-center justify-between w-full px-4">
        <div className="text-sm">
          <span className="font-bold text-slate-700 dark:text-slate-300">{myPlayer?.name}</span>
          <span className="text-emerald-500 ml-1">🐷×{myPlayer?.pigsAlive ?? 0}</span>
          <span className="text-red-500 ml-2">💀×{myPlayer?.pigsKilled ?? 0}</span>
        </div>
        <span className="text-sm font-bold text-slate-500">Tour {pub.turnNumber}/{TOTAL_TURNS}</span>
        <div className="text-sm text-right">
          <span className="font-bold text-slate-700 dark:text-slate-300">{opponent?.name}</span>
          <span className="text-emerald-500 ml-1">🐷×{opponent?.pigsAlive ?? 0}</span>
          <span className="text-red-500 ml-2">💀×{opponent?.pigsKilled ?? 0}</span>
        </div>
      </div>

      <div className="text-center">
        {isMyTurn
          ? <span className="text-emerald-500 font-bold text-lg">A vous de tirer !</span>
          : <span className="text-slate-500">L'adversaire vise...</span>}
      </div>

      <GridRenderer
        grid={grid}
        impactResult={lastShot?.result}
        trajectory={lastShot?.result.trajectory}
        shootSide={isMyTurn ? priv.side : undefined}
        onFire={isMyTurn ? (angle, power) => game.fire(angle, power, selectedWeapon) : undefined}
      />

      {isMyTurn && myPlayer && (
        <WeaponSelector inventory={myPlayer.weaponInventory} selected={selectedWeapon} onSelect={setSelectedWeapon} />
      )}

      {isMyTurn && (
        <p className="text-sm text-amber-500 font-medium animate-pulse">↕ Glissez la catapulte pour viser et tirer !</p>
      )}

      {lastShot && (
        <p className="text-center text-xs text-slate-400">
          {lastShot.result.missed
            ? `${pub.players.find(p => p.id === lastShot.playerId)?.name} a raté !`
            : `${pub.players.find(p => p.id === lastShot.playerId)?.name} a touché ! ${lastShot.result.killedPigs > 0 ? `${lastShot.result.killedPigs} cochon(s) éliminé(s) !` : ''}`}
        </p>
      )}

      <button onClick={game.leaveRoom}
        className="px-4 py-2 text-red-400 hover:text-red-300 text-sm font-medium border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors">
        Abandonner la partie
      </button>
    </div>
  )
}

// ─── Results ─────────────────────────────────────────────────────

function ResultsPhase({ pub, priv, game }: { pub: CochonsPublicState; priv: CochonsPrivateState; game: ReturnType<typeof useCochonsSocket> }) {
  const winner = pub.players.find(p => p.id === pub.winnerId)
  const sorted = [...pub.players].sort((a, b) => b.pigsKilled - a.pigsKilled)
  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6 text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      {pub.isDraw ? <h1 className="text-3xl font-black text-amber-500">Égalité !</h1> : (
        <><h1 className="text-3xl font-black text-emerald-500">Victoire !</h1><p className="text-xl font-bold text-slate-800 dark:text-slate-200">{winner?.name} gagne !</p></>
      )}
      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${i === 0 && !pub.isDraw ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            <span className="text-lg font-bold text-slate-400 w-6">{i + 1}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            <span className="text-red-500 font-bold">💀 {p.pigsKilled}</span>
          </div>
        ))}
      </div>
      {pub.grid && <div className="flex justify-center"><GridRenderer grid={pub.grid} /></div>}
      {priv.isHost && <button onClick={game.resetGame} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl shadow-lg">Nouvelle partie</button>}
    </motion.div>
  )
}

// ─── Main ────────────────────────────────────────────────────────

export function CochonsLobby({ onBack }: { onBack: () => void }) {
  const game = useCochonsSocket()
  const { publicState: pub, privateState: priv } = game

  if (!pub || !priv) {
    return (
      <>
        <Landing onCreateRoom={game.createRoom} onJoinRoom={game.joinRoom} />
        <button onClick={onBack} className="mt-8 text-sm text-slate-400 hover:text-slate-600">← Retour au menu</button>
        {game.error && <p className="mt-4 text-red-500 font-medium">{game.error}</p>}
      </>
    )
  }

  const isPlayPhase = pub.phase === 'buildPhase' || pub.phase === 'battle' || pub.phase === 'resolving'

  return (
    <div className={isPlayPhase ? 'fixed inset-0 z-10 flex flex-col overflow-auto bg-gradient-to-b from-emerald-50 to-sky-100 dark:from-slate-900 dark:to-emerald-950' : 'w-full'}>
      <AnimatePresence mode="wait">
        {pub.phase === 'lobby' && <LobbyPhase key="lobby" pub={pub} priv={priv} game={game} />}
        {pub.phase === 'buildPhase' && <BuildPhase key="build" pub={pub} priv={priv} game={game} />}
        {(pub.phase === 'battle' || pub.phase === 'resolving') && <BattlePhase key="battle" pub={pub} priv={priv} game={game} />}
        {pub.phase === 'results' && <ResultsPhase key="results" pub={pub} priv={priv} game={game} />}
      </AnimatePresence>
    </div>
  )
}
