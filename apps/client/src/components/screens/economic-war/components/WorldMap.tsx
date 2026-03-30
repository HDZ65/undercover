import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { motion, AnimatePresence } from 'motion/react'
import type { EcoWarPublicGameState, EcoWarPrivatePlayerState, MilitaryUnits, AttackOrder } from '@undercover/shared'
import casque1 from '../../../../assets/casque1.png'
import casque2 from '../../../../assets/casque2.png'
import casque3 from '../../../../assets/casque3.png'
import tank1   from '../../../../assets/tank1.png'
import tank2   from '../../../../assets/tank2.png'
import tank3   from '../../../../assets/tank3.png'
import avion1  from '../../../../assets/avion-de-chasse1.png'
import avion2  from '../../../../assets/avion-de-chasse2.png'
import avion3  from '../../../../assets/avion-de-chasse3.png'

const UNIT_ICONS: Record<string, [string, string, string]> = {
  infantry: [casque1, casque2, casque3],
  tanks:    [tank1,   tank2,   tank3],
  planes:   [avion1,  avion2,  avion3],
}

const PROVINCES_URL = '/game-provinces.json?v=7'
const WORLD_URL = '/world-countries.json'
const W = 800
const H = 400

// ─── Projection (module-level, stable reference) ──────────────
const proj = geoMercator().scale(128).translate([W / 2, H / 2 + 30])
const pathGen = geoPath().projection(proj)

// ─── Player colors ────────────────────────────────────────────
const PLAYER_COLORS = [
  '#3b82f6','#ef4444','#10b981','#f59e0b',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16',
  '#f97316','#6366f1','#14b8a6','#e11d48',
]
const NEUTRAL_COLOR = '#c8b99a'

// ─── Country centers [lng, lat] ───────────────────────────────
const COUNTRY_LATLNG: Record<string, [number, number]> = {
  usa: [-97, 38], brazil: [-55, -10], france: [2, 46], germany: [10, 51],
  sweden: [15, 62], russia: [90, 60], nigeria: [8, 9], morocco: [-5, 32],
  algeria: [3, 28], tunisia: [9, 34], libya: [17, 27], israel: [35, 31],
  palestine: [35, 32], saudi: [45, 24], india: [77, 20], china: [105, 36],
  japan: [138, 36], australia: [133, -27], uk: [-2, 54], spain: [-4, 40],
  italy: [12, 42], poland: [19, 52], ukraine: [32, 49], turkey: [35, 39],
  norway: [13, 65], netherlands: [5, 52], greece: [22, 39],
  south_korea: [128, 36], indonesia: [118, -2], vietnam: [107, 16],
  thailand: [101, 15], pakistan: [70, 30], iran: [53, 32], iraq: [44, 33],
  south_africa: [25, -29], egypt: [30, 27], kenya: [38, 1], ethiopia: [40, 9],
  canada: [-97, 60], mexico: [-102, 24], argentina: [-64, -34],
  chile: [-71, -35], colombia: [-72, 4], peru: [-76, -10],
  // ─── Pays additionnels ───────────────────────────────────────
  tanzania: [35, -6], w_sahara: [-13, 24], kazakhstan: [67, 48],
  uzbekistan: [64, 41], papua_new_guinea: [149, -7], dem_rep_congo: [22, -4],
  somalia: [46, 5], sudan: [30, 15], chad: [19, 15], haiti: [-73, 19],
  dominican_rep: [-70, 19], bahamas: [-78, 25], falkland_is: [-59, -52],
  greenland: [-43, 72], fr_s_antarctic_lands: [70, -49], timor_leste: [126, -9],
  lesotho: [28, -30], uruguay: [-56, -33], bolivia: [-64, -16], panama: [-80, 8],
  costa_rica: [-84, 10], nicaragua: [-85, 13], honduras: [-86, 14],
  el_salvador: [-89, 14], guatemala: [-90, 16], belize: [-89, 17],
  venezuela: [-67, 6], guyana: [-59, 5], suriname: [-56, 4], ecuador: [-78, -2],
  puerto_rico: [-66, 18], jamaica: [-77, 18], cuba: [-80, 22],
  zimbabwe: [29, -19], botswana: [25, -22], namibia: [18, -23],
  senegal: [-15, 14], mali: [-4, 18], mauritania: [-11, 21], benin: [2, 9],
  niger: [8, 18], cameroon: [12, 7], togo: [1, 8], ghana: [-1, 8],
  c_te_d_ivoire: [-6, 7], guinea: [-11, 10], guinea_bissau: [-15, 12],
  liberia: [-9, 6], sierra_leone: [-12, 8], burkina_faso: [-2, 12],
  central_african_rep: [21, 7], congo: [15, -1], gabon: [12, -1],
  eq_guinea: [10, 2], zambia: [28, -13], malawi: [34, -13], mozambique: [35, -19],
  eswatini: [31, -26], angola: [18, -11], burundi: [30, -3], lebanon: [36, 34],
  madagascar: [47, -19], gambia: [-15, 14], jordan: [37, 31],
  united_arab_emirates: [54, 24], qatar: [51, 25], kuwait: [47, 29], oman: [56, 22],
  vanuatu: [167, -16], cambodia: [105, 13], laos: [104, 18], myanmar: [97, 19],
  north_korea: [128, 40], mongolia: [104, 47], bangladesh: [90, 24],
  bhutan: [90, 28], nepal: [84, 28], afghanistan: [68, 34], tajikistan: [71, 39],
  kyrgyzstan: [75, 41], turkmenistan: [60, 39], syria: [39, 35], armenia: [45, 40],
  belarus: [28, 54], austria: [13, 48], hungary: [19, 47], moldova: [28, 47],
  romania: [25, 46], lithuania: [24, 55], latvia: [25, 57], estonia: [26, 59],
  bulgaria: [25, 43], albania: [20, 41], croatia: [17, 44], switzerland: [8, 47],
  luxembourg: [6, 50], belgium: [4, 51], portugal: [-8, 40], ireland: [-8, 53],
  new_caledonia: [166, -21], solomon_is: [159, -9], new_zealand: [173, -41],
  sri_lanka: [81, 8], taiwan: [121, 24], denmark: [10, 56], iceland: [-19, 65],
  azerbaijan: [48, 40], georgia: [43, 42], philippines: [122, 12],
  malaysia: [110, 4], brunei: [115, 5], slovenia: [15, 46], finland: [26, 65],
  slovakia: [20, 49], czechia: [16, 50], eritrea: [40, 15], paraguay: [-58, -23],
  yemen: [48, 16], n_cyprus: [34, 35], cyprus: [33, 35], djibouti: [42, 12],
  somaliland: [46, 10], uganda: [32, 1], rwanda: [30, -2], bosnia_and_herz: [18, 44],
  macedonia: [22, 42], serbia: [21, 44], montenegro: [19, 43], kosovo: [21, 43],
  trinidad_and_tobago: [-61, 10], s_sudan: [30, 8],
}

// ─── Helpers ──────────────────────────────────────────────────
function countTroops(units: MilitaryUnits): number {
  return units.infantry.reduce((s, v) => s + v, 0)
    + units.tanks.reduce((s, v) => s + v, 0)
    + units.planes.reduce((s, v) => s + v, 0)
    + units.warships.reduce((s, v) => s + v, 0)
}

// ─── Types ────────────────────────────────────────────────────
interface WorldMapProps {
  publicState:      EcoWarPublicGameState
  privateState?:    EcoWarPrivatePlayerState | null
  onClose?:         () => void
  inline?:          boolean
  onSelectProvince?: (regionId: string) => void
  onAttackProvince?: (order: AttackOrder) => void
  onOccupyNeutral?:  (fromRegionId: string, toRegionId: string, units?: MilitaryUnits) => void
  onTransferTroops?: (fromRegionId: string, toRegionId: string, units: MilitaryUnits) => void
  onFortifyProvince?: (regionId: string) => void
}

interface Transform { x: number; y: number; k: number }

type MapMode =
  | { type: 'idle' }
  | { type: 'attack'; sourceRegionId: string }   // en attente du clic sur la cible
  | { type: 'move';   sourceRegionId: string }    // en attente du clic sur destination

interface UnitPicker {
  fromRegionId: string
  toRegionId:   string
  mode:         'attack' | 'move' | 'occupy'  // occupy = province neutre
  available:    MilitaryUnits   // troupes dispo dans la province source
}

// ─── Component ────────────────────────────────────────────────
export function WorldMap({ publicState, privateState, onClose, inline, onSelectProvince, onAttackProvince, onOccupyNeutral, onTransferTroops, onFortifyProvince }: WorldMapProps) {
  const [provinces, setProvinces]   = useState<GeoJSON.Feature[]>([])
  const [, setCountries]   = useState<GeoJSON.Feature[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [mapMode, setMapMode]       = useState<MapMode>({ type: 'idle' })
  const [unitPicker, setUnitPicker] = useState<UnitPicker | null>(null)
  // Initial transform: zoom=2.5 centered on [lng=15, lat=20] (Europe/Africa)
  const [tf, setTf] = useState<Transform>({ x: -684, y: -261, k: 2.5 })
  const dragging  = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const svgRef    = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetch(PROVINCES_URL).then(r => r.json()).then((d: GeoJSON.FeatureCollection) => setProvinces(d.features ?? []))
    fetch(WORLD_URL).then(r => r.json()).then((d: GeoJSON.FeatureCollection)  => setCountries(d.features ?? []))
  }, [])

  // Player lookup maps
  const activePlayers = useMemo(() => publicState.players.filter(p => !p.abandoned), [publicState.players])
  const playerColorMap = useMemo(() => {
    const m = new Map<string, string>()
    activePlayers.forEach((p, i) => m.set(p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]))
    return m
  }, [activePlayers])

  const provinceOwnerMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of activePlayers) {
      for (const r of p.regions) m.set(r.id, p.id)
    }
    return m
  }, [activePlayers])

  const myPlayerId = privateState?.playerId ?? null
  const myPlayer = useMemo(() =>
    myPlayerId ? publicState.players.find(p => p.id === myPlayerId) : undefined,
    [myPlayerId, publicState.players]
  )
  const myCountryId = myPlayer?.countryId

  // Adjacence : map regionId → Set<neighborId> (depuis game-provinces.json déjà chargé)
  const adjacencyMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const f of provinces) {
      const p = (f as any).properties
      const id = p?.regionId as string
      if (!id) continue
      if (!m.has(id)) m.set(id, new Set())
      for (const n of (p?.adjacentTo ?? []) as string[]) {
        m.get(id)!.add(n)
        if (!m.has(n)) m.set(n, new Set())
        m.get(n)!.add(id)
      }
    }
    return m
  }, [provinces])

  // Ensemble des provinces adjacentes à la province source (mode attaque/déplacement)
  const adjacentToSource = useMemo(() => {
    if (mapMode.type === 'idle') return null
    return adjacencyMap.get(mapMode.sourceRegionId) ?? new Set<string>()
  }, [mapMode, adjacencyMap])

  // Mes propres régions
  const myRegionIds = useMemo(() => new Set(myPlayer?.regions.map(r => r.id) ?? []), [myPlayer])

  // Guerres actives où je suis impliqué
  const myWarEnemyIds = useMemo(() => {
    if (!myPlayerId) return new Set<string>()
    const ids = new Set<string>()
    for (const w of publicState.activeWars) {
      if (w.status !== 'active') continue
      if (w.attackerId === myPlayerId) ids.add(w.defenderId)
      if (w.defenderId === myPlayerId) ids.add(w.attackerId)
    }
    return ids
  }, [myPlayerId, publicState.activeWars])

  // Troupes disponibles (total - épuisées) dans la province source (pour unitPicker)
  const sourceTroops = useMemo((): MilitaryUnits => {
    if (!unitPicker || !privateState) return { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] }
    const total    = privateState.troopsByRegion[unitPicker.fromRegionId]
      ?? { infantry:[0,0,0] as [number,number,number], tanks:[0,0,0] as [number,number,number], planes:[0,0,0] as [number,number,number], warships:[0,0,0] as [number,number,number] }
    const exhausted = privateState.exhaustedTroopsByRegion?.[unitPicker.fromRegionId]
      ?? { infantry:[0,0,0] as [number,number,number], tanks:[0,0,0] as [number,number,number], planes:[0,0,0] as [number,number,number], warships:[0,0,0] as [number,number,number] }
    return {
      infantry: total.infantry.map((v, i) => Math.max(0, v - exhausted.infantry[i])) as [number,number,number],
      tanks:    total.tanks.map((v, i)    => Math.max(0, v - exhausted.tanks[i]))    as [number,number,number],
      planes:   total.planes.map((v, i)   => Math.max(0, v - exhausted.planes[i]))   as [number,number,number],
      warships: total.warships.map((v, i) => Math.max(0, v - exhausted.warships[i])) as [number,number,number],
    }
  }, [unitPicker, privateState])

  const cancelMode = useCallback(() => {
    setMapMode({ type: 'idle' })
    setUnitPicker(null)
    setSelected(null)
  }, [])

  const handleProvinceClick = useCallback((regionId: string) => {
    const isMyProvince = myRegionIds.has(regionId)
    const ownerPlayerId = provinceOwnerMap.get(regionId) ?? null
    const ownerPlayer = ownerPlayerId ? publicState.players.find(p => p.id === ownerPlayerId) : undefined

    if (mapMode.type === 'attack') {
      const sourceId = mapMode.sourceRegionId
      // Cible doit être adjacente et ennemie
      if (!adjacentToSource?.has(regionId)) { cancelMode(); return }
      if (isMyProvince) { cancelMode(); return }

      const sourceTroopsNow = privateState?.troopsByRegion[sourceId]
        ?? { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] }

      if (!ownerPlayerId) {
        // Province neutre → occupation + déplacement de troupes via UnitPickerModal
        setUnitPicker({ fromRegionId: sourceId, toRegionId: regionId, mode: 'occupy', available: sourceTroopsNow })
        setMapMode({ type: 'idle' })
        return
      }
      // Province ennemie : guerre obligatoire
      if (!myWarEnemyIds.has(ownerPlayerId)) { setSelected(regionId); setMapMode({ type: 'idle' }); return }
      setUnitPicker({ fromRegionId: sourceId, toRegionId: regionId, mode: 'attack', available: sourceTroopsNow })
      setMapMode({ type: 'idle' })
      return
    }

    if (mapMode.type === 'move') {
      const sourceId = mapMode.sourceRegionId
      if (!adjacentToSource?.has(regionId) || regionId === sourceId) { cancelMode(); return }
      const sourceTroopsNow = privateState?.troopsByRegion[sourceId]
        ?? { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] }

      if (!ownerPlayerId) {
        // Province neutre en mode déplacement → occupation + troupes
        setUnitPicker({ fromRegionId: sourceId, toRegionId: regionId, mode: 'occupy', available: sourceTroopsNow })
        setMapMode({ type: 'idle' })
        return
      }
      if (!isMyProvince) { cancelMode(); return }
      setUnitPicker({ fromRegionId: sourceId, toRegionId: regionId, mode: 'move', available: sourceTroopsNow })
      setMapMode({ type: 'idle' })
      return
    }

    // Mode idle : ouvrir le panneau
    setSelected(prev => prev === regionId ? null : regionId)
    onSelectProvince?.(regionId)
    void ownerPlayer // used for side-effects above
  }, [mapMode, adjacentToSource, myRegionIds, myWarEnemyIds, provinceOwnerMap, publicState.players, privateState, cancelMode, onOccupyNeutral, onSelectProvince])

  // Troop markers: own troops (green) + enemy troops (red) per province
  const troopMarkers = useMemo(() => {
    if (!privateState) return []
    const result: { regionId: string; cx: number; cy: number; own: MilitaryUnits | null; enemies: { name: string; units: MilitaryUnits }[] }[] = []
    const allRegions = new Set([
      ...Object.keys(privateState.troopsByRegion),
      ...Object.keys(privateState.enemyTroopsByRegion ?? {}),
    ])
    for (const regionId of allRegions) {
      const feat = provinces.find((f: any) => f.properties?.regionId === regionId)
      if (!feat) continue
      const c = pathGen.centroid(feat as GeoJSON.Feature)
      if (!c || isNaN(c[0])) continue
      const own = privateState.troopsByRegion[regionId] ?? null
      const ownCount = own ? countTroops(own) : 0
      const enemies = (privateState.enemyTroopsByRegion?.[regionId] ?? [])
        .filter(e => countTroops(e.units) > 0)
        .map(e => ({ name: e.playerName, units: e.units }))
      if (ownCount === 0 && enemies.length === 0) continue
      result.push({ regionId, cx: c[0], cy: c[1], own: ownCount > 0 ? own : null, enemies })
    }
    return result
  }, [privateState, provinces])

  // War / sanction lines in projected SVG coords
  const warLines = useMemo(() =>
    publicState.activeWars.map(w => {
      const ac = publicState.players.find(p => p.id === w.attackerId)?.countryId
      const dc = publicState.players.find(p => p.id === w.defenderId)?.countryId
      const a = ac ? COUNTRY_LATLNG[ac] : undefined
      const d = dc ? COUNTRY_LATLNG[dc] : undefined
      if (!a || !d) return null
      const pa = proj(a)!
      const pd = proj(d)!
      return { id: w.id, x1: pa[0], y1: pa[1], x2: pd[0], y2: pd[1] }
    }).filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number }[],
    [publicState]
  )
  const sanctionLines = useMemo(() =>
    publicState.activeSanctions.map((s, i) => {
      const ac = publicState.players.find(p => p.id === s.imposedBy)?.countryId
      const tc = publicState.players.find(p => p.id === s.targetId)?.countryId
      const a = ac ? COUNTRY_LATLNG[ac] : undefined
      const t2 = tc ? COUNTRY_LATLNG[tc] : undefined
      if (!a || !t2) return null
      const pa = proj(a)!
      const pt = proj(t2)!
      return { id: `s-${i}`, x1: pa[0], y1: pa[1], x2: pt[0], y2: pt[1] }
    }).filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number }[],
    [publicState]
  )

  // ─── Zoom / Pan ────────────────────────────────────────────
  const getSvgCoords = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    return [(clientX - rect.left) / rect.width * W, (clientY - rect.top) / rect.height * H]
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const [mx, my] = getSvgCoords(e.clientX, e.clientY)
    setTf(t => {
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
      const newK = Math.max(1, Math.min(16, t.k * factor))
      const wx = (mx - t.x) / t.k
      const wy = (my - t.y) / t.k
      return { x: mx - wx * newK, y: my - wy * newK, k: newK }
    })
  }, [getSvgCoords])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y }
  }, [tf.x, tf.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const { x, y, tx, ty } = dragStart.current
    const svg = svgRef.current
    const rect = svg?.getBoundingClientRect()
    if (!rect) return
    const dx = (e.clientX - x) / rect.width * W
    const dy = (e.clientY - y) / rect.height * H
    setTf(t => ({ ...t, x: tx + dx, y: ty + dy }))
  }, [])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const resetView = useCallback(() => setTf({ x: -684, y: -261, k: 2.5 }), [])

  // ─── Map SVG content ───────────────────────────────────────
  const mapSvg = (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        cursor: dragging.current ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        {/* Static ocean background */}
        <rect width={W} height={H} fill="#7ec8e3" />

        <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
          {/* Extended ocean background inside the zoom group */}
          <rect x={-5000} y={-5000} width={15000} height={15000} fill="#7ec8e3" />

          {/* Provinces */}
          {provinces.map((f: any) => {
            const { regionId } = f.properties as { regionId: string }
            const playerId = provinceOwnerMap.get(regionId)
            const isSelected = selected === regionId
            const isMyProvince = myRegionIds.has(regionId)
            const isSource = (mapMode.type === 'attack' || mapMode.type === 'move') && mapMode.sourceRegionId === regionId
            const isAdjacent = !!adjacentToSource?.has(regionId)
            const isNeutralProvince = !playerId

            // Cibles valides selon le mode
            const ownerIdHere = provinceOwnerMap.get(regionId)
            const isAtWarWithOwner = ownerIdHere ? myWarEnemyIds.has(ownerIdHere) : true // neutre = toujours attaquable
            const isAttackTarget = mapMode.type === 'attack' && isAdjacent && !isMyProvince && isAtWarWithOwner
            const isMoveOwn      = mapMode.type === 'move'   && isAdjacent && isMyProvince   // propre province
            const isMoveNeutral  = mapMode.type === 'move'   && isAdjacent && isNeutralProvince // neutre occupable

            let fill: string
            if (isSource)       fill = '#fbbf24'           // jaune = source
            else if (isSelected) fill = '#f59e0b'
            else if (isAttackTarget && !isNeutralProvince) fill = '#fca5a5' // rouge = province ennemie
            else if (isAttackTarget &&  isNeutralProvince) fill = '#fde68a' // jaune pâle = neutre attaquable
            else if (isMoveOwn)     fill = '#86efac'        // vert = propre province déplaçable
            else if (isMoveNeutral) fill = '#fde68a'        // jaune pâle = neutre occupable
            else fill = playerId ? (playerColorMap.get(playerId) ?? NEUTRAL_COLOR) : NEUTRAL_COLOR

            const d = pathGen(f)
            if (!d) return null
            return (
              <path
                key={regionId}
                d={d}
                fill={fill}
                stroke={isSource ? '#f59e0b' : isSelected ? '#fbbf24' : '#1a1a2e'}
                strokeWidth={isSource || isSelected ? 2 / tf.k : 0.8 / tf.k}
                style={{ cursor: (isAttackTarget || isMoveOwn || isMoveNeutral || mapMode.type === 'idle') ? 'pointer' : 'default' }}
                onClick={() => handleProvinceClick(regionId)}
              />
            )
          })}

          {/* Country borders supprimés — seules les bordures de provinces restent */}

          {/* Sanction lines */}
          {sanctionLines.map(l => (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#f97316" strokeWidth={1.5 / tf.k} strokeDasharray={`${5 / tf.k} ${4 / tf.k}`}
              strokeOpacity={0.8} style={{ pointerEvents: 'none' }} />
          ))}

          {/* War lines */}
          {warLines.map(l => (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#ef4444" strokeWidth={2 / tf.k} strokeOpacity={0.9}
              style={{ pointerEvents: 'none' }} />
          ))}

          {/* Player flag markers */}
          {activePlayers.map(p => {
            const lngLat = p.countryId ? COUNTRY_LATLNG[p.countryId] : undefined
            if (!lngLat) return null
            const [px, py] = proj(lngLat)!
            const color = playerColorMap.get(p.id) ?? '#64748b'
            const isMe = p.countryId === myCountryId
            const r = 8 / tf.k
            return (
              <g key={p.id} transform={`translate(${px},${py})`} style={{ pointerEvents: 'none' }}>
                <circle r={r} fill={color}
                  stroke={isMe ? '#f59e0b' : p.atWar ? '#ef4444' : 'white'}
                  strokeWidth={(isMe ? 2.5 : 1.5) / tf.k} />
                <text textAnchor="middle" dominantBaseline="central"
                  fontSize={10 / tf.k} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {p.countryFlag}
                </text>
              </g>
            )
          })}

          {/* Troop markers — direct icons + count, no box */}
          {troopMarkers.map(t => {
            // Grows when zooming: base size in SVG coords, clamped so it stays readable when zoomed out
            const iconSz  = Math.max(14 / tf.k, 6)   // min 6 SVG units, grows with zoom
            const countSz = iconSz * 0.5
            const gap     = iconSz * 0.15

            // One icon per unit type + tier (e.g. infantry T1: 10, infantry T2: 5 = 2 icons)
            type UnitGroup = { img: string; count: number; isEnemy: boolean; label?: string }
            const groups: UnitGroup[] = []

            const addGroups = (units: MilitaryUnits, isEnemy: boolean, prefix?: string) => {
              for (const type of ['infantry','tanks','planes'] as const) {
                const icons = UNIT_ICONS[type]
                for (let tier = 0; tier < 3; tier++) {
                  if (units[type][tier] > 0) {
                    groups.push({ img: icons[tier], count: units[type][tier], isEnemy, label: prefix })
                  }
                }
              }
              for (let tier = 0; tier < 3; tier++) {
                if (units.warships[tier] > 0) {
                  groups.push({ img: '', count: units.warships[tier], isEnemy, label: (prefix ? prefix + ' ' : '') + `⚓T${tier+1}` })
                }
              }
            }
            if (t.own) addGroups(t.own, false)
            for (const e of t.enemies) addGroups(e.units, true, e.name.slice(0,4))
            if (groups.length === 0) return null

            // Layout: icons side by side horizontally
            const totalW = groups.length * (iconSz + gap) - gap
            const startX = -totalW / 2
            const startY = -iconSz - 4 / tf.k

            return (
              <g key={t.regionId} transform={`translate(${t.cx},${t.cy})`} style={{ pointerEvents: 'none' }}>
                {groups.map((g, i) => {
                  const x = startX + i * (iconSz + gap)
                  const color = g.isEnemy ? '#fca5a5' : '#ffffff'
                  const strokeColor = g.isEnemy ? '#ef4444' : '#22c55e'
                  return (
                    <g key={i}>
                      {g.img ? (
                        <image
                          href={g.img}
                          x={x}
                          y={startY}
                          width={iconSz}
                          height={iconSz}
                          style={{ filter: `drop-shadow(0 0 ${1.5/tf.k}px ${strokeColor})` }}
                        />
                      ) : (
                        <text
                          x={x + iconSz / 2}
                          y={startY + iconSz * 0.75}
                          fontSize={iconSz * 0.7}
                          fill={color}
                          textAnchor="middle"
                          fontFamily="monospace"
                          style={{ filter: `drop-shadow(0 0 ${1.5/tf.k}px ${strokeColor})` }}
                        >
                          {g.label}
                        </text>
                      )}
                      {/* Count below the icon */}
                      <text
                        x={x + iconSz / 2}
                        y={startY + iconSz + countSz}
                        fontSize={countSz}
                        fill={color}
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                        stroke="rgba(0,0,0,0.7)"
                        strokeWidth={0.5/tf.k}
                        paintOrder="stroke"
                      >
                        {g.count}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Zoom buttons */}
      <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20 }}>
        <button onClick={() => setTf(t => { const newK = Math.min(16, t.k * 1.5); const cx = W/2; const cy = H/2; const wx = (cx-t.x)/t.k; const wy = (cy-t.y)/t.k; return { x: cx-wx*newK, y: cy-wy*newK, k: newK } })}
          style={{ width: 28, height: 28, background: 'rgba(15,23,42,0.9)', color: 'white', border: '1px solid #475569', borderRadius: 4, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        <button onClick={() => setTf(t => { const newK = Math.max(1, t.k / 1.5); const cx = W/2; const cy = H/2; const wx = (cx-t.x)/t.k; const wy = (cy-t.y)/t.k; return { x: cx-wx*newK, y: cy-wy*newK, k: newK } })}
          style={{ width: 28, height: 28, background: 'rgba(15,23,42,0.9)', color: 'white', border: '1px solid #475569', borderRadius: 4, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <button onClick={resetView}
          style={{ width: 28, height: 28, background: 'rgba(15,23,42,0.9)', color: '#94a3b8', border: '1px solid #475569', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⌂</button>
      </div>

      {/* ── Bandeau mode attaque/déplacement ── */}
      <AnimatePresence>
        {mapMode.type !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              background: mapMode.type === 'attack' ? '#7f1d1d' : '#14532d',
              color: 'white', borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: 10, zIndex: 30, whiteSpace: 'nowrap',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            <span>{mapMode.type === 'attack' ? '⚔️ Choisir la cible à attaquer' : '🚶 Choisir la destination'}</span>
            <button onClick={cancelMode}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>Annuler</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panneau de province ── */}
      <AnimatePresence>
        {selected && !unitPicker && mapMode.type === 'idle' && (
          <ProvincePanel
            regionId={selected}
            provinces={provinces}
            publicState={publicState}
            privateState={privateState}
            myRegionIds={myRegionIds}
            myWarEnemyIds={myWarEnemyIds}
            provinceOwnerMap={provinceOwnerMap}
            playerColorMap={playerColorMap}
            phase={publicState.phase}
            onAttack={() => setMapMode({ type: 'attack', sourceRegionId: selected })}
            onMove={() => setMapMode({ type: 'move', sourceRegionId: selected })}
            onFortify={onFortifyProvince ? () => onFortifyProvince(selected) : undefined}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Modal sélection d'unités ── */}
      <AnimatePresence>
        {unitPicker && (
          <UnitPickerModal
            picker={unitPicker}
            sourceTroops={sourceTroops}
            onConfirm={(units) => {
              if (unitPicker.mode === 'attack') {
                onAttackProvince?.({ fromRegionId: unitPicker.fromRegionId, toRegionId: unitPicker.toRegionId, units })
              } else if (unitPicker.mode === 'occupy') {
                onOccupyNeutral?.(unitPicker.fromRegionId, unitPicker.toRegionId, units)
              } else {
                onTransferTroops?.(unitPicker.fromRegionId, unitPicker.toRegionId, units)
              }
              setUnitPicker(null)
              setSelected(null)
            }}
            onCancel={() => setUnitPicker(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )

  if (inline) {
    return (
      <div style={{ width: '100%', height: '33vh', borderBottom: '1px solid #334155', overflow: 'hidden' }}>
        {mapSvg}
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-base font-black text-slate-100">
            🌍 Carte du monde — Manche {publicState.currentRound}
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span style={{ display: 'block', width: 20, height: 2, background: '#ef4444' }} />Guerre</span>
            <span className="flex items-center gap-1"><span style={{ display: 'block', width: 20, borderTop: '2px dashed #fb923c' }} />Sanction</span>
          </div>
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm">✕</button>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          {activePlayers.map(p => (
            <div key={p.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border"
              style={{ backgroundColor: (playerColorMap.get(p.id) ?? '#475569') + '30',
                borderColor: playerColorMap.get(p.id) ?? '#475569', color: '#e2e8f0' }}>
              <span>{p.countryFlag}</span>
              <span>{p.name}</span>
              <span className="font-normal opacity-70">{p.score.toLocaleString()} pts</span>
              {p.atWar && <span className="text-red-400">⚔️</span>}
            </div>
          ))}
        </div>
        <div style={{ height: '50vh' }}>
          {mapSvg}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── ProvincePanel ────────────────────────────────────────────
interface ProvincePanelProps {
  regionId:        string
  provinces:       GeoJSON.Feature[]
  publicState:     EcoWarPublicGameState
  privateState?:   EcoWarPrivatePlayerState | null
  myRegionIds:     Set<string>
  myWarEnemyIds:   Set<string>
  provinceOwnerMap: Map<string, string>
  playerColorMap:  Map<string, string>
  phase:           string
  onAttack:        () => void
  onMove:          () => void
  onFortify?:      () => void
  onClose:         () => void
}

function ProvincePanel({ regionId, provinces, publicState, privateState, myRegionIds, myWarEnemyIds, provinceOwnerMap, playerColorMap, phase, onAttack, onMove, onFortify, onClose }: ProvincePanelProps) {
  const feat = provinces.find((f: any) => f.properties?.regionId === regionId) as any
  const props = feat?.properties ?? {}
  const ownerPlayerId = provinceOwnerMap.get(regionId) ?? null
  const ownerPlayer   = ownerPlayerId ? publicState.players.find(p => p.id === ownerPlayerId) : undefined
  const ownerRegion   = ownerPlayer?.regions.find(r => r.id === regionId)
  const isMyProvince  = myRegionIds.has(regionId)
  const isEnemy       = !!ownerPlayerId && myWarEnemyIds.has(ownerPlayerId)
  const isNeutral     = !ownerPlayerId
  const ownerColor    = ownerPlayerId ? (playerColorMap.get(ownerPlayerId) ?? '#64748b') : '#6b7280'

  const myTroops = privateState?.troopsByRegion[regionId] ?? null
  const exhaustedTroops = privateState?.exhaustedTroopsByRegion?.[regionId] ?? null
  const totalMyTroops = myTroops
    ? myTroops.infantry.reduce((s,v) => s+v,0) + myTroops.tanks.reduce((s,v) => s+v,0)
      + myTroops.planes.reduce((s,v) => s+v,0) + myTroops.warships.reduce((s,v) => s+v,0)
    : 0
  const totalExhausted = exhaustedTroops
    ? exhaustedTroops.infantry.reduce((s,v) => s+v,0) + exhaustedTroops.tanks.reduce((s,v) => s+v,0)
      + exhaustedTroops.planes.reduce((s,v) => s+v,0) + exhaustedTroops.warships.reduce((s,v) => s+v,0)
    : 0
  const availableTroops = totalMyTroops - totalExhausted
  const enemyTroopsList = privateState?.enemyTroopsByRegion?.[regionId] ?? []

  const terrainEmoji: Record<string, string> = { plains:'🌾', mountain:'⛰️', urban:'🏙️', coast:'🌊' }
  const terrain = ownerRegion?.terrain ?? props.terrain ?? 'plains'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      style={{ position: 'absolute', bottom: 48, left: 10, minWidth: 200, maxWidth: 240,
        background: 'rgba(15,23,42,0.95)', border: `1px solid ${ownerColor}60`,
        borderRadius: 10, padding: 12, zIndex: 30, color: 'white', fontSize: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 'bold', fontSize: 13 }}>{props.name ?? regionId}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
          <span>{terrainEmoji[terrain] ?? '🌍'}</span>
          <span style={{ textTransform: 'capitalize' }}>{terrain}</span>
          {ownerRegion && <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>Intégrité {ownerRegion.warIntegrity}%</span>}
        </div>

        {/* Propriétaire */}
        {ownerPlayer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ownerColor }} />
            <span>{ownerPlayer.countryFlag} {ownerPlayer.name}</span>
          </div>
        ) : (
          <div style={{ color: '#94a3b8' }}>🏳️ Province neutre</div>
        )}

        {/* Mes troupes dans cette province */}
        {myTroops && totalMyTroops > 0 && (
          <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
            <div style={{ color: '#94a3b8', marginBottom: 2 }}>
              Mes troupes :{availableTroops < totalMyTroops && <span style={{ color: '#f59e0b', marginLeft: 4 }}>({availableTroops} disponibles)</span>}
            </div>
            {myTroops.infantry.some(v=>v>0) && <div>👣 Infanterie : {myTroops.infantry.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}{exhaustedTroops?.infantry.some(v=>v>0) && <span style={{ color:'#f59e0b', fontSize:10 }}> (épuisé: {exhaustedTroops.infantry.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')})</span>}</div>}
            {myTroops.tanks.some(v=>v>0)    && <div>🪖 Chars : {myTroops.tanks.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
            {myTroops.planes.some(v=>v>0)   && <div>🛩️ Avions : {myTroops.planes.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
            {myTroops.warships.some(v=>v>0) && <div>⚓ Navires : {myTroops.warships.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
          </div>
        )}

        {/* Info ennemie réduite */}
        {isEnemy && ownerRegion && (
          <div style={{ color: '#fca5a5', fontSize: 11 }}>
            ⚔️ En guerre — Intégrité {ownerRegion.warIntegrity}%
            {ownerRegion.warIntegrity < 50 && ' (vulnérable)'}
          </div>
        )}

        {/* Troupes ennemies dans cette province */}
        {enemyTroopsList.length > 0 && enemyTroopsList.map(e => (
          <div key={e.playerId} style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}>
            <div style={{ color: '#fca5a5', marginBottom: 2 }}>⚠️ {e.playerName} ici :</div>
            {e.units.infantry.some(v=>v>0) && <div style={{ color: '#fca5a5' }}>👣 {e.units.infantry.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
            {e.units.tanks.some(v=>v>0)    && <div style={{ color: '#fca5a5' }}>🪖 {e.units.tanks.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
            {e.units.planes.some(v=>v>0)   && <div style={{ color: '#fca5a5' }}>🛩️ {e.units.planes.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
            {e.units.warships.some(v=>v>0) && <div style={{ color: '#fca5a5' }}>⚓ {e.units.warships.map((v,i) => v>0 ? `T${i+1}×${v}` : '').filter(Boolean).join(' ')}</div>}
          </div>
        ))}
      </div>

      {/* Actions — uniquement en phase d'action */}
      {isMyProvince && totalMyTroops > 0 && (
        phase === 'actionSelection' ? (
          availableTroops > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={onMove}
                style={{ flex: 1, padding: '5px 8px', background: '#14532d', color: 'white', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                🚶 Déplacer
              </button>
              <button onClick={onAttack}
                style={{ flex: 1, padding: '5px 8px', background: '#7f1d1d', color: 'white', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                ⚔️ Attaquer
              </button>
            </div>
          ) : (
            <div style={{ color: '#f59e0b', fontSize: 11, textAlign: 'center', padding: '4px 0' }}>
              Toutes les troupes ont déjà bougé ce tour.
            </div>
          )
        ) : (
          <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: '4px 0' }}>
            Déplacements uniquement disponibles en phase d'action.
          </div>
        )
      )}
      {/* Fortification */}
      {isMyProvince && (phase === 'actionSelection' || phase === 'preparation') && (
        ownerRegion?.fortified ? (
          <div style={{ marginTop: 6, color: '#a78bfa', fontSize: 11, textAlign: 'center' }}>
            🛡️ Province fortifiée (permanent)
          </div>
        ) : onFortify ? (
          <button onClick={onFortify}
            style={{ marginTop: 6, width: '100%', padding: '5px 8px', background: '#4c1d95', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
            🛡️ Fortifier (4 000$)
          </button>
        ) : null
      )}
      {isNeutral && !isMyProvince && (
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Cliquez sur cette province depuis une province adjacente en mode attaque pour l'occuper.</div>
      )}
    </motion.div>
  )
}

// ─── UnitPickerModal ──────────────────────────────────────────
interface UnitPickerModalProps {
  picker:      UnitPicker
  sourceTroops: MilitaryUnits
  onConfirm:   (units: MilitaryUnits) => void
  onCancel:    () => void
}

function UnitPickerModal({ picker, sourceTroops, onConfirm, onCancel }: UnitPickerModalProps) {
  const [chosen, setChosen] = useState<MilitaryUnits>({
    infantry: [0,0,0], tanks: [0,0,0], planes: [0,0,0], warships: [0,0,0],
  })

  const totalChosen = (u: MilitaryUnits) =>
    u.infantry.reduce((s,v)=>s+v,0) + u.tanks.reduce((s,v)=>s+v,0) +
    u.planes.reduce((s,v)=>s+v,0)   + u.warships.reduce((s,v)=>s+v,0)

  const setUnit = (type: keyof MilitaryUnits, tier: number, val: string) => {
    const n = Math.max(0, Math.min(sourceTroops[type][tier], parseInt(val) || 0))
    setChosen(prev => {
      const updated = { ...prev, [type]: [...prev[type]] as [number,number,number] }
      updated[type][tier] = n
      return updated
    })
  }

  const rows: { key: keyof MilitaryUnits; label: string; emoji: string }[] = [
    { key: 'infantry', label: 'Infanterie', emoji: '👣' },
    { key: 'tanks',    label: 'Chars',      emoji: '🪖' },
    { key: 'planes',   label: 'Avions',     emoji: '🛩️' },
    { key: 'warships', label: 'Navires',    emoji: '⚓' },
  ]

  const isAttack = picker.mode === 'attack'
  const isOccupy = picker.mode === 'occupy'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', zIndex: 40 }}>
      <motion.div
        initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        style={{ background: '#0f172a', border: `1px solid ${isAttack ? '#ef444480' : isOccupy ? '#f59e0b80' : '#22c55e80'}`,
          borderRadius: 12, padding: 20, minWidth: 280, color: 'white' }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12 }}>
          {isAttack ? '⚔️ Choisir les unités pour l\'attaque' : isOccupy ? '🏳️ Choisir les troupes à envoyer' : '🚶 Choisir les unités à déplacer'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {rows.map(({ key, label, emoji }) => (
            <div key={key}>
              {[0,1,2].map(t => sourceTroops[key][t] > 0 && (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 80, fontSize: 12 }}>{emoji} {label} T{t+1}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>/{sourceTroops[key][t]}</span>
                  <input
                    type="number" min={0} max={sourceTroops[key][t]}
                    value={chosen[key][t]}
                    onChange={e => setUnit(key, t, e.target.value)}
                    style={{ width: 60, padding: '3px 6px', background: '#1e293b', border: '1px solid #334155',
                      borderRadius: 4, color: 'white', fontSize: 12, textAlign: 'center' }}
                  />
                  <button onClick={() => setUnit(key, t, String(sourceTroops[key][t]))}
                    style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Max</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {totalChosen(chosen) === 0 && (
          <div style={{ color: '#f59e0b', fontSize: 11, marginBottom: 8 }}>Sélectionnez au moins une unité</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '7px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
              borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Annuler</button>
          <button
            onClick={() => totalChosen(chosen) > 0 && onConfirm(chosen)}
            disabled={totalChosen(chosen) === 0}
            style={{ flex: 2, padding: '7px', background: isAttack ? '#7f1d1d' : isOccupy ? '#78350f' : '#14532d', color: 'white',
              border: 'none', borderRadius: 6, cursor: totalChosen(chosen) > 0 ? 'pointer' : 'not-allowed',
              fontSize: 12, fontWeight: 'bold', opacity: totalChosen(chosen) === 0 ? 0.5 : 1 }}>
            {isAttack ? '⚔️ Confirmer l\'attaque' : isOccupy ? '🏳️ Occuper et envoyer' : '🚶 Confirmer le déplacement'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
