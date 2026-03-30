import { motion } from 'motion/react'
import type { EcoWarPublicGameState, Region } from '@undercover/shared'

// ─── Country colour palette (one hex per country ID) ──────────

const COUNTRY_COLORS: Record<string, string> = {
  japan:      '#ef4444', // red-500
  brazil:     '#16a34a', // green-600
  usa:        '#2563eb', // blue-600
  china:      '#b91c1c', // red-700
  russia:     '#1d4ed8', // blue-700
  germany:    '#ca8a04', // yellow-600
  india:      '#ea580c', // orange-600
  france:     '#3b82f6', // blue-500
  uk:         '#7c3aed', // violet-600
  nigeria:    '#15803d', // green-700
  australia:  '#d97706', // amber-600
  canada:     '#e11d48', // rose-600
}

// Fallback colours when country ID is not in the map
const FALLBACK_COLORS = [
  '#6366f1', '#0891b2', '#059669', '#dc2626',
  '#9333ea', '#f59e0b', '#10b981', '#f97316',
]

function getCountryColor(countryId: string, playerIndex: number): string {
  return COUNTRY_COLORS[countryId] ?? FALLBACK_COLORS[playerIndex % FALLBACK_COLORS.length]
}

// ─── Types ────────────────────────────────────────────────────

interface TerritoryPanelProps {
  pub: EcoWarPublicGameState
  myPlayerId: string
  onClose: () => void
}

// ─── Region chip ──────────────────────────────────────────────

interface RegionChipProps {
  region: Region
  ownerColor: string         // original owner's color
  conquerorColor?: string    // set if occupied by someone else
  isConquered: boolean
  conquerorName?: string
  isDestroyed: boolean
}

function RegionChip({ region, ownerColor, conquerorColor, isConquered, conquerorName, isDestroyed }: RegionChipProps) {
  const bg     = isDestroyed ? '#374151' : isConquered ? conquerorColor! : ownerColor
  const border = isDestroyed ? '#6b7280' : isConquered ? conquerorColor! : ownerColor

  return (
    <div
      className="relative group flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white transition-all"
      style={{ backgroundColor: bg, borderWidth: 1, borderStyle: 'solid', borderColor: border, opacity: isDestroyed ? 0.5 : 1 }}
    >
      {isDestroyed && <span>💥</span>}
      {isConquered && !isDestroyed && <span>⚔️</span>}
      <span>{region.name}</span>
      {(region.population > 0) && (
        <span className="opacity-70 font-normal">
          {(region.population / 1_000_000).toFixed(1)}M
        </span>
      )}
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-slate-900 text-white text-[10px] p-2 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl whitespace-normal">
        <p className="font-bold">{region.name}</p>
        <p>Population : {(region.population / 1_000_000).toFixed(2)} M</p>
        {isDestroyed && <p className="text-red-400 font-semibold">💥 Détruite (frappe nucléaire)</p>}
        {isConquered && !isDestroyed && <p className="text-amber-400 font-semibold">⚔️ Occupée par {conquerorName}</p>}
        {region.resistanceRemaining > 0 && <p className="text-orange-400">Résistance : {region.resistanceRemaining} tour(s)</p>}
        {!isConquered && !isDestroyed && <p className="text-emerald-400">Contrôle : {region.productionCapacity}%</p>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function TerritoryPanel({ pub, myPlayerId, onClose }: TerritoryPanelProps) {
  // Build a map: playerId → { color, countryName, countryFlag }
  const playerMap = new Map(
    pub.players.map((p, i) => [p.id, {
      color: getCountryColor(p.countryId, i),
      countryName: p.countryName,
      countryFlag: p.countryFlag,
      population: p.population,
      regionCount: p.regions.length,
    }])
  )

  // Count total regions and conquered regions for each player
  const activePlayers = pub.players.filter(p => !p.abandoned && p.countryId)

  const totalRegions = activePlayers.reduce((s, p) => s + p.regions.length, 0)
  const conqueredCount = activePlayers.reduce(
    (s, p) => s + p.regions.filter(r => r.occupiedBy && r.occupiedBy !== p.id).length, 0
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">🗺️ Carte des Territoires</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {totalRegions} provinces · {conqueredCount > 0 ? `${conqueredCount} occupée(s)` : 'Aucune occupation'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            ✕
          </button>
        </div>

        {/* Legend */}
        <div className="px-4 pt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-current" />Province libre</span>
          <span className="flex items-center gap-1">⚔️ Province occupée (couleur du conquérant)</span>
          <span className="flex items-center gap-1">💥 Province détruite</span>
        </div>

        {/* Country list */}
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {activePlayers.map((player) => {
            const info = playerMap.get(player.id)!
            const isMe = player.id === myPlayerId
            const myConqueredCount = player.regions.filter(r => r.occupiedBy && r.occupiedBy !== player.id).length
            const freeCount = player.regions.filter(r => !r.occupiedBy && !r.destroyed).length

            return (
              <div
                key={player.id}
                className={`rounded-xl border overflow-hidden ${isMe ? 'border-blue-400 dark:border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}
              >
                {/* Country header */}
                <div
                  className="px-3 py-2 flex items-center justify-between"
                  style={{ backgroundColor: info.color + '22', borderBottom: `2px solid ${info.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{player.countryFlag}</span>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">{player.countryName}</span>
                      {isMe && <span className="ml-1 text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded-full font-bold">Vous</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{freeCount} libre{freeCount !== 1 ? 's' : ''}</span>
                    {myConqueredCount > 0 && (
                      <span className="text-red-500 font-semibold">⚔️ {myConqueredCount} occupée{myConqueredCount !== 1 ? 's' : ''}</span>
                    )}
                    <span className="font-medium">{player.population.toFixed(1)} M hab.</span>
                  </div>
                </div>

                {/* Regions */}
                <div className="p-2.5 flex flex-wrap gap-1.5">
                  {player.regions.map(region => {
                    const isConquered = !!region.occupiedBy && region.occupiedBy !== player.id
                    const conquerorInfo = isConquered ? playerMap.get(region.occupiedBy!) : undefined
                    return (
                      <RegionChip
                        key={region.id}
                        region={region}
                        ownerColor={info.color}
                        conquerorColor={conquerorInfo?.color}
                        isConquered={isConquered}
                        conquerorName={conquerorInfo?.countryName}
                        isDestroyed={region.destroyed}
                      />
                    )
                  })}
                  {player.regions.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">Aucune province définie</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Conquérir une province absorbe sa population (bonheur bas) et 15% de l'infrastructure ennemie.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
