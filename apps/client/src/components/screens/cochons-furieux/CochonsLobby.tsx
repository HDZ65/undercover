import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  Grid,
  CellType,
  WeaponType,
  ShotResult,
  CochonsPublicState,
  CochonsPrivateState,
} from '@undercover/shared'
import { GRID_COLS, GRID_ROWS, cellIndex, WEAPON_SPECS, CASTLE_TEMPLATES, TOTAL_TURNS } from '@undercover/shared'
import { useCochonsSocket } from './useCochonsSocket'

// ─── Cell colors ─────────────────────────────────────────────────

const CELL_COLORS: Record<CellType, string> = {
  empty: 'transparent',
  wood: 'bg-amber-600',
  stone: 'bg-slate-400',
  steel: 'bg-blue-400',
  pig: 'bg-green-400',
}

const CELL_BORDERS: Record<CellType, string> = {
  empty: '',
  wood: 'border-amber-800',
  stone: 'border-slate-500',
  steel: 'border-blue-600',
  pig: 'border-green-600',
}

// ─── Grid Renderer ───────────────────────────────────────────────

function GridRenderer({ grid, onCellClick, disabled, impactResult, label }: {
  grid: Grid
  onCellClick?: (col: number, row: number) => void
  disabled?: boolean
  impactResult?: ShotResult | null
  label?: string
}) {
  const cellSize = 20

  return (
    <div className="flex flex-col items-center">
      {label && <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>}
      <div
        className="relative bg-sky-100 dark:bg-sky-950/30 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden"
        style={{ width: GRID_COLS * cellSize, height: GRID_ROWS * cellSize }}
      >
        {/* Ground */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-amber-800/30"
          style={{ height: cellSize }}
        />

        {/* Cells — render top-to-bottom visually (row GRID_ROWS-1 at top) */}
        {grid.map((cell, idx) => {
          if (cell.type === 'empty') return null
          const col = idx % GRID_COLS
          const row = Math.floor(idx / GRID_COLS)
          const visualTop = (GRID_ROWS - 1 - row) * cellSize

          const isDestroyed = impactResult?.destroyedCells.some(d => d.col === col && d.row === row)

          return (
            <motion.div
              key={`${col}-${row}`}
              className={`absolute ${CELL_COLORS[cell.type]} ${CELL_BORDERS[cell.type]} border rounded-sm ${!disabled && onCellClick ? 'cursor-pointer hover:brightness-110' : ''}`}
              style={{
                left: col * cellSize,
                top: visualTop,
                width: cellSize - 1,
                height: cellSize - 1,
              }}
              onClick={() => !disabled && onCellClick?.(col, row)}
              animate={isDestroyed ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {cell.type === 'pig' && (
                <span className="flex items-center justify-center text-[10px] w-full h-full">🐷</span>
              )}
            </motion.div>
          )
        })}

        {/* Impact marker */}
        {impactResult && !impactResult.missed && (
          <motion.div
            className="absolute rounded-full bg-red-500/40 border-2 border-red-500"
            style={{
              left: impactResult.impactCol * cellSize - 20,
              top: (GRID_ROWS - 1 - impactResult.impactRow) * cellSize - 20,
              width: 40 + cellSize,
              height: 40 + cellSize,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Weapon Selector ─────────────────────────────────────────────

function WeaponSelector({ inventory, selected, onSelect }: {
  inventory: Record<WeaponType, number>
  selected: WeaponType
  onSelect: (w: WeaponType) => void
}) {
  const weapons: WeaponType[] = ['rock', 'bomb', 'missile']
  const gradients: Record<WeaponType, string> = {
    rock: 'from-amber-600 to-amber-800',
    bomb: 'from-red-500 to-orange-600',
    missile: 'from-slate-500 to-blue-600',
  }

  return (
    <div className="flex gap-2 justify-center">
      {weapons.map(w => {
        const spec = WEAPON_SPECS[w]
        const count = inventory[w] ?? 0
        const isSelected = selected === w
        return (
          <button
            key={w}
            onClick={() => count > 0 && onSelect(w)}
            disabled={count === 0}
            className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${
              isSelected
                ? `bg-gradient-to-r ${gradients[w]} text-white ring-2 ring-white/50 scale-105`
                : count > 0
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50'
            }`}
          >
            <span className="text-lg">{spec.emoji}</span>
            <span className="ml-1">{spec.labelFr}</span>
            <span className="ml-1 text-xs opacity-70">×{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Slingshot ───────────────────────────────────────────────────

function Slingshot({ onFire, disabled }: {
  onFire: (angle: number, power: number) => void
  disabled: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const originRef = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 }
    setDragging(true)
    setDragPos({ x: e.clientX, y: e.clientY })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [disabled])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    setDragPos({ x: e.clientX, y: e.clientY })
  }, [dragging])

  const handlePointerUp = useCallback(() => {
    if (!dragging || !dragPos) { setDragging(false); return }
    const dx = originRef.current.x - dragPos.x
    const dy = originRef.current.y - dragPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = 150
    const power = Math.min(1, dist / maxDist)
    const angle = Math.atan2(dy, dx) // pull back → shoot forward

    if (power > 0.05) {
      onFire(angle, power)
    }
    setDragging(false)
    setDragPos(null)
  }, [dragging, dragPos, onFire])

  const power = dragPos
    ? Math.min(1, Math.sqrt(
        Math.pow(originRef.current.x - dragPos.x, 2) +
        Math.pow(originRef.current.y - dragPos.y, 2)
      ) / 150)
    : 0

  return (
    <div
      ref={containerRef}
      className={`relative w-32 h-40 flex items-center justify-center select-none ${disabled ? 'opacity-40' : 'cursor-crosshair'}`}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Slingshot body */}
      <div className="relative">
        <div className="w-2 h-20 bg-amber-800 rounded-full mx-auto" />
        <div className="absolute -top-1 -left-4 w-3 h-8 bg-amber-800 rounded-full -rotate-12" />
        <div className="absolute -top-1 -right-4 w-3 h-8 bg-amber-800 rounded-full rotate-12" />

        {/* Elastic band */}
        {dragging && dragPos && (
          <svg className="absolute -top-2 -left-8 w-24 h-24 pointer-events-none" viewBox="-30 -10 80 60">
            <line x1="-5" y1="0" x2={dragPos.x - originRef.current.x} y2={dragPos.y - originRef.current.y} stroke="#8B4513" strokeWidth="2" />
            <line x1="25" y1="0" x2={dragPos.x - originRef.current.x} y2={dragPos.y - originRef.current.y} stroke="#8B4513" strokeWidth="2" />
            <circle cx={dragPos.x - originRef.current.x} cy={dragPos.y - originRef.current.y} r="6" fill="#666" />
          </svg>
        )}
      </div>

      {/* Power indicator */}
      {dragging && (
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${power > 0.7 ? 'bg-red-500' : power > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${power * 100}%` }}
          />
        </div>
      )}

      {!disabled && !dragging && (
        <p className="absolute -bottom-6 text-[10px] text-slate-400 text-center w-full">
          Glissez pour viser
        </p>
      )}
    </div>
  )
}

// ─── Landing ─────────────────────────────────────────────────────

function Landing({ onCreateRoom, onJoinRoom }: {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')

  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100">🐷 Cochons Furieux</h1>
        <p className="text-slate-500 dark:text-slate-400">Construisez, visez, détruisez !</p>
      </div>

      {mode === 'menu' && (
        <div className="space-y-3">
          <button onClick={() => setMode('create')} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
            Créer une partie
          </button>
          <button onClick={() => setMode('join')} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
            Rejoindre
          </button>
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

function LobbyPhase({ pub, priv, game }: {
  pub: CochonsPublicState
  priv: CochonsPrivateState
  game: ReturnType<typeof useCochonsSocket>
}) {
  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Salon {pub.roomCode}</h2>
        <p className="text-sm text-slate-500">{pub.players.length}/2 joueurs</p>
      </div>

      <div className="space-y-2">
        {pub.players.map(p => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${p.connected ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-900 opacity-50'} border border-slate-200 dark:border-slate-700`}>
            <span className="text-2xl">🐷</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            {p.id === pub.hostId && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Hôte</span>}
          </div>
        ))}
        {pub.players.length < 2 && (
          <div className="px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center text-slate-400">
            En attente d'un adversaire...
          </div>
        )}
      </div>

      {priv.isHost && (
        <button
          onClick={game.startGame}
          disabled={pub.players.length < 2}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50"
        >
          Lancer la partie
        </button>
      )}

      <button onClick={game.leaveRoom} className="w-full py-2 text-red-500 font-medium">Quitter</button>
    </motion.div>
  )
}

// ─── Build Phase ─────────────────────────────────────────────────

function BuildPhase({ pub, priv, game }: {
  pub: CochonsPublicState
  priv: CochonsPrivateState
  game: ReturnType<typeof useCochonsSocket>
}) {
  const [tool, setTool] = useState<'pig' | CellType>('pig')
  const myPlayer = pub.players.find(p => p.id === priv.playerId)
  const grid = priv.myGrid ?? []
  const pigCount = grid.filter(c => c.type === 'pig').length
  const isReady = myPlayer?.ready ?? false

  const handleCellClick = (col: number, row: number) => {
    if (isReady) return
    const cell = grid[cellIndex(col, row)]
    if (tool === 'pig') {
      if (cell?.type === 'pig') game.removePig(col, row)
      else if (cell?.type === 'empty') game.placePig(col, row)
    } else if (tool === 'empty') {
      if (cell?.type !== 'empty' && cell?.type !== 'pig') game.removeBlock(col, row)
    } else {
      if (cell?.type === 'empty') game.placeBlock(col, row, tool)
    }
  }

  return (
    <motion.div className="w-full max-w-2xl mx-auto space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Timer */}
      <div className="text-center">
        <span className={`text-3xl font-black ${game.buildTimeRemaining <= 10 ? 'text-red-500' : game.buildTimeRemaining <= 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
          {game.buildTimeRemaining}s
        </span>
        <p className="text-sm text-slate-500">Phase de construction</p>
      </div>

      {/* Templates */}
      <div className="flex gap-2 justify-center flex-wrap">
        {CASTLE_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => !isReady && game.selectTemplate(t.id)}
            disabled={isReady}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {t.labelFr}
          </button>
        ))}
      </div>

      {/* Tool palette */}
      <div className="flex gap-2 justify-center">
        {([
          { key: 'pig' as const, label: '🐷 Cochon', color: 'bg-green-500' },
          { key: 'wood' as CellType, label: '🪵 Bois', color: 'bg-amber-600' },
          { key: 'stone' as CellType, label: '🪨 Pierre', color: 'bg-slate-400' },
          { key: 'steel' as CellType, label: '🔩 Acier', color: 'bg-blue-400' },
          { key: 'empty' as CellType, label: '❌ Suppr.', color: 'bg-red-400' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            disabled={isReady}
            className={`px-2 py-1 rounded-lg text-xs font-bold text-white transition-all ${tool === t.key ? `${t.color} ring-2 ring-white/50 scale-105` : 'bg-slate-400 dark:bg-slate-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex justify-center">
        <GridRenderer grid={grid} onCellClick={handleCellClick} disabled={isReady} label={`Votre château (${pigCount}/5 cochons)`} />
      </div>

      {/* Confirm */}
      {!isReady ? (
        <button
          onClick={game.confirmBuild}
          disabled={pigCount < 5}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50"
        >
          {pigCount < 5 ? `Placez encore ${5 - pigCount} cochon(s)` : 'Confirmer la construction'}
        </button>
      ) : (
        <p className="text-center text-emerald-500 font-bold">✓ En attente de l'adversaire...</p>
      )}
    </motion.div>
  )
}

// ─── Battle Phase ────────────────────────────────────────────────

function BattlePhase({ pub, priv, game }: {
  pub: CochonsPublicState
  priv: CochonsPrivateState
  game: ReturnType<typeof useCochonsSocket>
}) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>('rock')
  const isMyTurn = pub.currentPlayerId === priv.playerId
  const myPlayer = pub.players.find(p => p.id === priv.playerId)
  const opponent = pub.players.find(p => p.id !== priv.playerId)
  const myGrid = pub.grids?.[priv.playerId] ?? []
  const opponentGrid = pub.grids?.[opponent?.id ?? ''] ?? []

  const handleFire = (angle: number, power: number) => {
    game.fire(angle, power, selectedWeapon)
  }

  // Show last shot impact on opponent grid
  const lastShot = pub.shotHistory[pub.shotHistory.length - 1]
  const impactResult = lastShot?.result ?? null

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
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

      {/* Turn indicator */}
      <div className="text-center">
        {isMyTurn ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">A vous de tirer !</span>
        ) : (
          <span className="text-slate-500">L'adversaire vise...</span>
        )}
      </div>

      {/* Grids side by side */}
      <div className="flex items-start justify-center gap-4 flex-wrap">
        <GridRenderer grid={myGrid} disabled label="Votre château" />

        {/* Slingshot between grids */}
        {isMyTurn && (
          <div className="flex flex-col items-center gap-2">
            <Slingshot onFire={handleFire} disabled={!isMyTurn} />
          </div>
        )}

        <GridRenderer grid={opponentGrid} disabled impactResult={impactResult} label="Château adverse" />
      </div>

      {/* Weapon selector */}
      {isMyTurn && myPlayer && (
        <WeaponSelector
          inventory={myPlayer.weaponInventory}
          selected={selectedWeapon}
          onSelect={setSelectedWeapon}
        />
      )}

      {/* Last action */}
      {lastShot && (
        <p className="text-center text-xs text-slate-400">
          {lastShot.result.missed
            ? `${pub.players.find(p => p.id === lastShot.playerId)?.name} a raté son tir !`
            : `${pub.players.find(p => p.id === lastShot.playerId)?.name} a touché ! ${lastShot.result.killedPigs > 0 ? `${lastShot.result.killedPigs} cochon(s) éliminé(s) !` : ''}`
          }
        </p>
      )}
    </div>
  )
}

// ─── Results ─────────────────────────────────────────────────────

function ResultsPhase({ pub, priv, game }: {
  pub: CochonsPublicState
  priv: CochonsPrivateState
  game: ReturnType<typeof useCochonsSocket>
}) {
  const winner = pub.players.find(p => p.id === pub.winnerId)
  const sorted = [...pub.players].sort((a, b) => b.pigsKilled - a.pigsKilled)

  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6 text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      {pub.isDraw ? (
        <h1 className="text-3xl font-black text-amber-500">Égalité !</h1>
      ) : (
        <>
          <h1 className="text-3xl font-black text-emerald-500">Victoire !</h1>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{winner?.name} remporte la partie !</p>
        </>
      )}

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${i === 0 && !pub.isDraw ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            <span className="text-lg font-bold text-slate-400 w-6">{i + 1}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            <span className="text-red-500 font-bold">💀 {p.pigsKilled} cochons tués</span>
          </div>
        ))}
      </div>

      {/* Final grids */}
      {pub.grids && (
        <div className="flex gap-4 justify-center flex-wrap">
          {pub.players.map(p => (
            <GridRenderer key={p.id} grid={pub.grids![p.id] ?? []} disabled label={p.name} />
          ))}
        </div>
      )}

      {priv.isHost && (
        <button onClick={game.resetGame} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl shadow-lg">
          Nouvelle partie
        </button>
      )}
    </motion.div>
  )
}

// ─── Main ────────────────────────────────────────────────────────

export function CochonsLobby({ onBack }: { onBack: () => void }) {
  const game = useCochonsSocket()
  const { publicState: pub, privateState: priv } = game

  if (!pub || !priv) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-sky-100 dark:from-slate-900 dark:to-emerald-950">
        <Landing onCreateRoom={game.createRoom} onJoinRoom={game.joinRoom} />
        <button onClick={onBack} className="mt-8 text-sm text-slate-400 hover:text-slate-600">← Retour au menu</button>
        {game.error && <p className="mt-4 text-red-500 font-medium">{game.error}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-sky-100 dark:from-slate-900 dark:to-emerald-950">
      <AnimatePresence mode="wait">
        {pub.phase === 'lobby' && <LobbyPhase key="lobby" pub={pub} priv={priv} game={game} />}
        {pub.phase === 'buildPhase' && <BuildPhase key="build" pub={pub} priv={priv} game={game} />}
        {(pub.phase === 'battle' || pub.phase === 'resolving') && <BattlePhase key="battle" pub={pub} priv={priv} game={game} />}
        {pub.phase === 'results' && <ResultsPhase key="results" pub={pub} priv={priv} game={game} />}
      </AnimatePresence>
    </div>
  )
}
