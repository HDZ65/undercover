import { motion } from 'motion/react'
import type { EcoWarPublicGameState } from '@undercover/shared'

// ─── Geographic positions ────────────────────────────────────
// SVG viewBox 1000×500 (simplified Mercator-like projection)

const COUNTRY_POS: Record<string, [number, number]> = {
  usa:       [175, 158],
  brazil:    [255, 308],
  france:    [474, 124],
  germany:   [504, 112],
  sweden:    [510, 82],
  russia:    [690, 92],
  nigeria:   [498, 240],
  morocco:   [448, 198],
  algeria:   [478, 206],
  tunisia:   [506, 190],
  libya:     [530, 202],
  israel:    [562, 190],
  palestine: [568, 202],
  saudi:     [612, 207],
  india:     [710, 202],
  china:     [776, 162],
  japan:     [874, 152],
  australia: [848, 362],
}

// ─── Continent shapes ────────────────────────────────────────

const CONTINENTS: { d: string; fill: string }[] = [
  {
    // North America
    d: 'M 66,84 L 134,68 L 204,73 L 256,91 L 285,115 L 299,171 L 280,261 L 235,304 L 199,315 L 143,295 L 93,259 L 63,204 L 53,149 Z',
    fill: '#c8aa82',
  },
  {
    // South America
    d: 'M 199,315 L 289,305 L 320,332 L 315,406 L 285,471 L 239,494 L 189,471 L 169,415 L 173,365 Z',
    fill: '#c0a07a',
  },
  {
    // Europe
    d: 'M 436,82 L 558,76 L 580,93 L 590,120 L 560,144 L 520,152 L 482,144 L 452,131 L 436,111 Z',
    fill: '#c8aa82',
  },
  {
    // Africa
    d: 'M 436,185 L 582,178 L 612,215 L 607,271 L 582,362 L 542,422 L 492,438 L 445,422 L 415,372 L 399,305 L 413,239 Z',
    fill: '#c0a07a',
  },
  {
    // Asia (Eurasia — joined to Europe)
    d: 'M 580,76 L 952,76 L 977,185 L 937,295 L 882,335 L 802,362 L 742,315 L 702,285 L 647,251 L 612,219 L 612,195 L 582,185 L 580,144 L 590,120 Z',
    fill: '#c8aa82',
  },
  {
    // Australia
    d: 'M 772,352 L 897,346 L 962,382 L 972,436 L 922,476 L 832,486 L 762,462 L 737,416 Z',
    fill: '#c0a07a',
  },
]

// ─── Wealth tier colours ──────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  hegemon:    '#f59e0b',
  superpower: '#8b5cf6',
  developed:  '#3b82f6',
  emerging:   '#22c55e',
  startup:    '#64748b',
}

// ─── Component ───────────────────────────────────────────────

interface WorldMapProps {
  publicState: EcoWarPublicGameState
  onClose: () => void
}

export function WorldMap({ publicState, onClose }: WorldMapProps) {
  // Build playerId → SVG position
  const playerPos = new Map<string, [number, number]>()
  for (const p of publicState.players) {
    if (p.countryId && COUNTRY_POS[p.countryId]) {
      playerPos.set(p.id, COUNTRY_POS[p.countryId])
    }
  }

  // Build countryId → player
  const playerByCountry = new Map<string, (typeof publicState.players)[0]>()
  for (const p of publicState.players) {
    if (p.countryId) playerByCountry.set(p.countryId, p)
  }

  // War connection lines
  const warLines = publicState.activeWars
    .map(w => {
      const from = playerPos.get(w.attackerId)
      const to = playerPos.get(w.defenderId)
      return from && to ? { id: w.id, from, to, status: w.status } : null
    })
    .filter(Boolean) as { id: string; from: [number, number]; to: [number, number]; status: string }[]

  // Sanction connection lines (deduplicated)
  const sanctionSeen = new Set<string>()
  const sanctionLines = publicState.activeSanctions.flatMap(s => {
    const key = [s.imposedBy, s.targetId].sort().join('↔')
    if (sanctionSeen.has(key)) return []
    sanctionSeen.add(key)
    const from = playerPos.get(s.imposedBy)
    const to = playerPos.get(s.targetId)
    return from && to ? [{ key, from, to }] : []
  })

  const activePlayers = publicState.players.filter(p => !p.abandoned)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-base font-black text-slate-100">
            🌍 Carte du monde — Manche {publicState.currentRound}
          </h3>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="block w-5 h-px bg-red-500" />
              Guerre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block w-5 border-t-2 border-dashed border-orange-400" />
              Sanction
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* SVG Map */}
        <div className="px-3 pt-3">
          <svg
            viewBox="0 0 1000 500"
            className="w-full rounded-xl"
            style={{ maxHeight: '60vh' }}
          >
            {/* Ocean */}
            <rect width="1000" height="500" fill="#0f2744" rx="8" />

            {/* Equator guide line */}
            <line x1="0" y1="250" x2="1000" y2="250" stroke="#1a3a5c" strokeWidth="1" />

            {/* Continents */}
            {CONTINENTS.map((c, i) => (
              <path key={i} d={c.d} fill={c.fill} stroke="#9a7850" strokeWidth="1" />
            ))}

            {/* Sanction lines */}
            {sanctionLines.map(s => (
              <line
                key={s.key}
                x1={s.from[0]} y1={s.from[1]}
                x2={s.to[0]} y2={s.to[1]}
                stroke="#f97316"
                strokeWidth="1.5"
                strokeDasharray="6,4"
                opacity="0.75"
              />
            ))}

            {/* War lines */}
            {warLines.map(w => {
              // Draw arrow from attacker to defender
              const dx = w.to[0] - w.from[0]
              const dy = w.to[1] - w.from[1]
              const len = Math.sqrt(dx * dx + dy * dy)
              const ux = dx / len
              const uy = dy / len
              const r = 16 // node radius — stop line before center
              const x2 = w.to[0] - ux * r
              const y2 = w.to[1] - uy * r
              // Arrow head
              const ax = x2 - ux * 8 + uy * 5
              const ay = y2 - uy * 8 - ux * 5
              const bx = x2 - ux * 8 - uy * 5
              const by = y2 - uy * 8 + ux * 5
              return (
                <g key={w.id}>
                  <line
                    x1={w.from[0]} y1={w.from[1]}
                    x2={x2} y2={y2}
                    stroke="#ef4444"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  <polygon
                    points={`${x2},${y2} ${ax},${ay} ${bx},${by}`}
                    fill="#ef4444"
                    opacity="0.9"
                  />
                </g>
              )
            })}

            {/* Country nodes — all 18 countries */}
            {Object.entries(COUNTRY_POS).map(([countryId, [cx, cy]]) => {
              const player = playerByCountry.get(countryId)
              const inGame = !!player
              const atWar = player?.atWar ?? false
              const nodeR = inGame ? 14 : 8
              const color = player ? (TIER_COLORS[player.wealthTier] ?? '#64748b') : '#1e2d40'
              const strokeColor = inGame ? 'white' : '#374151'

              return (
                <g key={countryId}>
                  {/* Pulse ring for countries at war */}
                  {atWar && (
                    <circle cx={cx} cy={cy} r={nodeR + 3} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4">
                      <animate attributeName="r" values={`${nodeR + 2};${nodeR + 7};${nodeR + 2}`} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Node circle */}
                  <circle
                    cx={cx} cy={cy} r={nodeR}
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth={inGame ? 1.5 : 0.5}
                    opacity={inGame ? 1 : 0.4}
                  />
                  {/* Flag (only for in-game countries) */}
                  {inGame && player && (
                    <text
                      x={cx} y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {player.countryFlag}
                    </text>
                  )}
                  {/* Player name label */}
                  {inGame && player && (
                    <text
                      x={cx} y={cy + nodeR + 9}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#cbd5e1"
                      fontWeight="700"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {player.name}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Wealth tier legend + player list */}
        <div className="px-4 py-3 space-y-2">
          {/* Tier legend */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <span key={tier} className="flex items-center gap-1 text-slate-400">
                <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
            ))}
          </div>

          {/* Player chips */}
          <div className="flex flex-wrap gap-1.5">
            {activePlayers.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border"
                style={{
                  backgroundColor: (TIER_COLORS[p.wealthTier] ?? '#64748b') + '22',
                  borderColor: (TIER_COLORS[p.wealthTier] ?? '#64748b') + '55',
                  color: '#e2e8f0',
                }}
              >
                <span>{p.countryFlag}</span>
                <span>{p.name}</span>
                <span className="text-slate-400 font-normal">{p.score.toLocaleString()} pts</span>
                {p.atWar && <span className="text-red-400">⚔️</span>}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
