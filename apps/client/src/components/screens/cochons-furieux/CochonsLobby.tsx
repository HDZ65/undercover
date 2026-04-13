import { useState } from 'react'
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
import { GRID_COLS, GRID_ROWS, cellIndex, WEAPON_SPECS, CASTLE_TEMPLATES, TOTAL_TURNS, sideRange } from '@undercover/shared'
import { useCochonsSocket } from './useCochonsSocket'

// ─── Cell colors ─────────────────────────────────────────────────

const CELL_BG: Record<CellType, string> = {
  empty: '', wood: 'bg-amber-600', stone: 'bg-slate-400', steel: 'bg-blue-400', pig: 'bg-green-400',
}
const CELL_BORDER: Record<CellType, string> = {
  empty: '', wood: 'border-amber-800', stone: 'border-slate-500', steel: 'border-blue-600', pig: 'border-green-600',
}

// ─── Grid Renderer ───────────────────────────────────────────────

function GridRenderer({ grid, mySide, editMode, onCellClick, impactResult, trajectory }: {
  grid: Grid
  mySide?: PlayerSide
  editMode?: { tool: 'pig' | CellType }
  onCellClick?: (col: number, row: number) => void
  impactResult?: ShotResult | null
  trajectory?: TrajectoryPoint[] | null
}) {
  const cellSize = Math.min(18, Math.floor((typeof window !== 'undefined' ? window.innerWidth - 32 : 700) / GRID_COLS))
  const gridW = GRID_COLS * cellSize
  const gridH = GRID_ROWS * cellSize

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-600 shadow-inner" style={{ width: gridW, height: gridH }}>
      {/* Sky background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 to-sky-100 dark:from-sky-900 dark:to-slate-800" />

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-800 to-amber-700" style={{ height: cellSize * 0.5 }} />

      {/* Center divider */}
      <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-400/40" style={{ left: gridW / 2 }} />

      {/* Side labels */}
      <div className="absolute top-1 left-2 text-[9px] font-bold text-slate-500/50">GAUCHE</div>
      <div className="absolute top-1 right-2 text-[9px] font-bold text-slate-500/50">DROITE</div>

      {/* Editable zone highlight during build */}
      {editMode && mySide && (
        <div
          className="absolute top-0 bottom-0 bg-emerald-400/10 border-2 border-emerald-400/30 rounded"
          style={{
            left: mySide === 'left' ? 0 : gridW / 2,
            width: gridW / 2,
          }}
        />
      )}

      {/* Cells */}
      {grid.map((cell, idx) => {
        if (cell.type === 'empty') return null
        const col = idx % GRID_COLS
        const row = Math.floor(idx / GRID_COLS)
        const visualTop = (GRID_ROWS - 1 - row) * cellSize
        const isDestroyed = impactResult?.destroyedCells.some(d => d.col === col && d.row === row)

        return (
          <motion.div
            key={`${col}-${row}-${cell.type}`}
            className={`absolute ${CELL_BG[cell.type]} ${CELL_BORDER[cell.type]} border rounded-[2px]`}
            style={{ left: col * cellSize, top: visualTop, width: cellSize - 1, height: cellSize - 1 }}
            onClick={() => onCellClick?.(col, row)}
            animate={isDestroyed ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {cell.type === 'pig' && <span className="flex items-center justify-center w-full h-full text-[10px]">🐷</span>}
          </motion.div>
        )
      })}

      {/* Clickable empty cells during build */}
      {editMode && mySide && (() => {
        const { minCol, maxCol } = sideRange(mySide)
        const cells = []
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            if (grid[cellIndex(c, r)].type === 'empty') {
              cells.push(
                <div
                  key={`empty-${c}-${r}`}
                  className="absolute cursor-pointer hover:bg-emerald-400/20 rounded-sm transition-colors"
                  style={{ left: c * cellSize, top: (GRID_ROWS - 1 - r) * cellSize, width: cellSize - 1, height: cellSize - 1 }}
                  onClick={() => onCellClick?.(c, r)}
                />
              )
            }
          }
        }
        return cells
      })()}

      {/* Trajectory animation */}
      {trajectory && trajectory.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" width={gridW} height={gridH}>
          <polyline
            points={trajectory.map(p => `${p.x * cellSize},${(GRID_ROWS - p.y) * cellSize}`).join(' ')}
            fill="none"
            stroke="rgba(255,100,50,0.6)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        </svg>
      )}

      {/* Impact explosion */}
      {impactResult && !impactResult.missed && (
        <motion.div
          className="absolute rounded-full bg-orange-500/50 border-2 border-orange-400"
          style={{
            left: impactResult.impactCol * cellSize - 15,
            top: (GRID_ROWS - 1 - impactResult.impactRow) * cellSize - 15,
            width: 30 + cellSize, height: 30 + cellSize,
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 1 }}
        />
      )}

      {/* Catapults */}
      <div className="absolute bottom-1 left-1 text-lg">🏹</div>
      <div className="absolute bottom-1 right-1 text-lg scale-x-[-1]">🏹</div>
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

// ─── Slingshot ───────────────────────────────────────────────────

function Slingshot({ onFire, disabled }: { onFire: (angle: number, power: number) => void; disabled: boolean }) {
  const [power, setPower] = useState(0)
  const [angle, setAngle] = useState(45)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-4 items-center">
        <div className="flex flex-col items-center gap-1">
          <label className="text-[10px] text-slate-400">Angle</label>
          <input type="range" min={10} max={80} value={angle} onChange={e => setAngle(Number(e.target.value))}
            disabled={disabled} className="w-24 accent-orange-500" />
          <span className="text-xs font-bold text-slate-300">{angle}°</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <label className="text-[10px] text-slate-400">Puissance</label>
          <input type="range" min={10} max={100} value={power || 50} onChange={e => setPower(Number(e.target.value))}
            disabled={disabled} className="w-24 accent-red-500" />
          <span className="text-xs font-bold text-slate-300">{power || 50}%</span>
        </div>
      </div>
      <button
        onClick={() => !disabled && onFire(angle * Math.PI / 180, (power || 50) / 100)}
        disabled={disabled}
        className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
      >
        🔥 Tirer !
      </button>
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
        {CASTLE_TEMPLATES.map(t => (
          <button key={t.id} onClick={() => !isReady && game.selectTemplate(t.id)} disabled={isReady}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">{t.labelFr}</button>
        ))}
      </div>

      <div className="flex gap-2 justify-center">
        {([
          { key: 'pig' as const, label: '🐷 Cochon', color: 'bg-green-500' },
          { key: 'wood' as CellType, label: '🪵 Bois', color: 'bg-amber-600' },
          { key: 'stone' as CellType, label: '🪨 Pierre', color: 'bg-slate-400' },
          { key: 'steel' as CellType, label: '🔩 Acier', color: 'bg-blue-400' },
          { key: 'empty' as CellType, label: '❌ Suppr.', color: 'bg-red-400' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTool(t.key)} disabled={isReady}
            className={`px-2 py-1 rounded-lg text-xs font-bold text-white transition-all ${tool === t.key ? `${t.color} ring-2 ring-white/50 scale-105` : 'bg-slate-400 dark:bg-slate-600'}`}>{t.label}</button>
        ))}
      </div>

      <GridRenderer grid={grid} mySide={priv.side} editMode={isReady ? undefined : { tool }} onCellClick={handleCellClick} />

      {!isReady ? (
        <button onClick={game.confirmBuild} disabled={pigCount < 5}
          className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-lime-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
          {pigCount < 5 ? `Placez encore ${5 - pigCount} cochon(s)` : 'Confirmer'}
        </button>
      ) : <p className="text-center text-emerald-500 font-bold">✓ En attente de l'adversaire...</p>}
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
      />

      {isMyTurn && myPlayer && (
        <>
          <WeaponSelector inventory={myPlayer.weaponInventory} selected={selectedWeapon} onSelect={setSelectedWeapon} />
          <Slingshot onFire={(angle, power) => game.fire(angle, power, selectedWeapon)} disabled={!isMyTurn} />
        </>
      )}

      {lastShot && (
        <p className="text-center text-xs text-slate-400">
          {lastShot.result.missed
            ? `${pub.players.find(p => p.id === lastShot.playerId)?.name} a raté !`
            : `${pub.players.find(p => p.id === lastShot.playerId)?.name} a touché ! ${lastShot.result.killedPigs > 0 ? `${lastShot.result.killedPigs} cochon(s) éliminé(s) !` : ''}`}
        </p>
      )}
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
