import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { EcoWarPublicGameState } from '@undercover/shared'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Geographic coordinates (lat, lng) ───────────────────────

const COUNTRY_LATLNG: Record<string, [number, number]> = {
  usa:       [38.9,  -77.0],
  brazil:    [-15.8, -47.9],
  france:    [48.8,    2.3],
  germany:   [52.5,   13.4],
  sweden:    [59.3,   18.1],
  russia:    [55.7,   37.6],
  nigeria:   [9.1,    7.5],
  morocco:   [33.9,   -6.9],
  algeria:   [36.7,    3.1],
  tunisia:   [36.8,   10.2],
  libya:     [32.9,   13.2],
  israel:    [31.8,   35.2],
  palestine: [31.5,   35.1],
  saudi:     [24.7,   46.7],
  india:     [28.6,   77.2],
  china:     [39.9,  116.4],
  japan:     [35.7,  139.7],
  australia: [-35.3, 149.1],
}

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
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Build lookup maps
  const playerByCountry = new Map<string, (typeof publicState.players)[0]>()
  for (const p of publicState.players) {
    if (p.countryId) playerByCountry.set(p.countryId, p)
  }

  const playerPosLatLng = new Map<string, [number, number]>()
  for (const p of publicState.players) {
    if (p.countryId && COUNTRY_LATLNG[p.countryId]) {
      playerPosLatLng.set(p.id, COUNTRY_LATLNG[p.countryId])
    }
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Init map
    const map = L.map(mapContainerRef.current, {
      center: [20, 10],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    })

    mapRef.current = map

    // OpenStreetMap tiles (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 6,
      minZoom: 1,
    }).addTo(map)

    // Sanction lines
    const sanctionSeen = new Set<string>()
    for (const s of publicState.activeSanctions) {
      const key = [s.imposedBy, s.targetId].sort().join('↔')
      if (sanctionSeen.has(key)) continue
      sanctionSeen.add(key)
      const from = playerPosLatLng.get(s.imposedBy)
      const to = playerPosLatLng.get(s.targetId)
      if (!from || !to) continue
      L.polyline([from, to], {
        color: '#f97316',
        weight: 2,
        dashArray: '8, 6',
        opacity: 0.75,
      }).addTo(map)
    }

    // War lines (red arrows)
    for (const w of publicState.activeWars) {
      const from = playerPosLatLng.get(w.attackerId)
      const to = playerPosLatLng.get(w.defenderId)
      if (!from || !to) continue
      L.polyline([from, to], {
        color: '#ef4444',
        weight: 2.5,
        opacity: 0.9,
      }).addTo(map)
    }

    // Country markers
    for (const [countryId, latlng] of Object.entries(COUNTRY_LATLNG)) {
      const player = playerByCountry.get(countryId)
      const inGame = !!player
      const color = player ? (TIER_COLORS[player.wealthTier] ?? '#64748b') : '#334155'
      const atWar = player?.atWar ?? false

      // Custom circular marker
      const outerSize = inGame ? 36 : 22
      const emoji = inGame && player ? player.countryFlag : ''
      const borderStyle = atWar
        ? 'border: 2.5px solid #ef4444; box-shadow: 0 0 0 4px rgba(239,68,68,0.3);'
        : inGame
          ? 'border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);'
          : 'border: 1px solid #475569;'

      const icon = L.divIcon({
        className: '',
        iconSize: [outerSize, outerSize],
        iconAnchor: [outerSize / 2, outerSize / 2],
        html: `
          <div style="
            width: ${outerSize}px; height: ${outerSize}px;
            border-radius: 50%;
            background: ${color};
            ${borderStyle}
            display: flex; align-items: center; justify-content: center;
            font-size: ${inGame ? 16 : 10}px;
            opacity: ${inGame ? 1 : 0.35};
          ">
            ${emoji}
          </div>
        `,
      })

      const marker = L.marker(latlng as L.LatLngExpression, { icon })
        .addTo(map)

      if (inGame && player) {
        marker.bindTooltip(
          `<strong>${player.countryFlag} ${player.name}</strong><br/>` +
          `Tier: ${player.wealthTier} · Score: ${player.score.toLocaleString('fr-FR')} pts` +
          (player.atWar ? '<br/><span style="color:#ef4444">⚔️ En guerre</span>' : ''),
          { direction: 'top', offset: [0, -outerSize / 2 - 2] }
        )
      }
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

        {/* Leaflet Map */}
        <div
          ref={mapContainerRef}
          style={{ height: '52vh' }}
          className="w-full"
        />

        {/* Wealth tier legend + player list */}
        <div className="px-4 py-3 space-y-2 border-t border-slate-700">
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
