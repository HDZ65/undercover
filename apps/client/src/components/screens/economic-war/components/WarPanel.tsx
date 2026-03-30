import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  EcoWarPrivatePlayerState,
  EcoWarPublicGameState,
  PublicWarInfo,
  Region,
  WarAllocationSubmission,
  FrontAllocation,
  UnitCounts,
  MilitaryUnits,
} from '@undercover/shared'

// ─── Constants (mirrored from server) ─────────────────────────

const UNIT_LABELS = {
  infantry: { icon: '👣', label: 'Infanterie' },
  tanks:    { icon: '🪖', label: 'Chars' },
  planes:   { icon: '🛩️', label: 'Avions' },
  warships: { icon: '⚓',  label: 'Navires' },
} as const

const TERRAIN_LABELS: Record<string, string> = {
  plains:   '🌾 Plaines',
  mountain: '⛰️ Montagne',
  urban:    '🏙️ Urbain',
  coast:    '🌊 Côtier',
}

const INFANTRY_RECRUIT_COST: [number, number, number] = [50, 150, 400]
// Ammo icons for display (ammo now comes from resources, not bought directly)
const AMMO_ICONS = { munitions: '🔴', obus: '🟠', bombs: '💣' }

type UnitType = 'infantry' | 'tanks' | 'planes' | 'warships'

// ─── Props ─────────────────────────────────────────────────────

interface WarPanelProps {
  privateState: EcoWarPrivatePlayerState | null
  publicState: EcoWarPublicGameState
  onSubmitAllocation: (a: WarAllocationSubmission) => void
  onRecruitInfantry: (tier: 1 | 2 | 3, count: number, regionId: string) => void
  onTrainInfantry: (regionId: string, fromTier: 1 | 2, count: number) => void
  onDeployTroops: (regionId: string, units: MilitaryUnits) => void
  onTransferTroops: (fromRegionId: string, toRegionId: string, units: MilitaryUnits) => void
}

// ─── Helpers ──────────────────────────────────────────────────

function emptyForces(): FrontAllocation {
  return {
    infantry: [0, 0, 0],
    tanks:    [0, 0, 0],
    planes:   [0, 0, 0],
    warships: [0, 0, 0],
  }
}

function emptyUnits(): MilitaryUnits {
  return {
    infantry: [0, 0, 0],
    tanks:    [0, 0, 0],
    planes:   [0, 0, 0],
    warships: [0, 0, 0],
  }
}

function totalUnits(counts: UnitCounts) {
  return counts[0] + counts[1] + counts[2]
}

function totalMilitaryUnits(u: MilitaryUnits) {
  return totalUnits(u.infantry) + totalUnits(u.tanks) + totalUnits(u.planes) + totalUnits(u.warships)
}

// ─── Tab type ─────────────────────────────────────────────────

type Tab = 'guerre' | 'troupes'

// ─── WarPanel ─────────────────────────────────────────────────

export default function WarPanel({
  privateState,
  publicState,
  onSubmitAllocation,
  onRecruitInfantry,
  onTrainInfantry,
  onDeployTroops,
  onTransferTroops,
}: WarPanelProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('guerre')

  // Recruit state (T1 only + region)
  const [recruitCount, setRecruitCount] = useState(1)
  const [recruitRegionId, setRecruitRegionId] = useState<string>('')

  // Training state
  const [trainRegionId, setTrainRegionId] = useState<string>('')
  const [trainFromTier, setTrainFromTier] = useState<1 | 2>(1)
  const [trainCount, setTrainCount] = useState(1)

  // War allocation state
  const [allocations, setAllocations] = useState<Record<string, Record<string, FrontAllocation>>>({})
  const [submittedWars, setSubmittedWars] = useState<Set<string>>(new Set())

  // Deploy troops state
  const [deployRegionId, setDeployRegionId] = useState<string>('')
  const [deployUnits, setDeployUnits] = useState<MilitaryUnits>(emptyUnits())

  // Transfer troops state
  const [transferFrom, setTransferFrom] = useState<string>('')
  const [transferTo, setTransferTo] = useState<string>('')
  const [transferUnits, setTransferUnits] = useState<MilitaryUnits>(emptyUnits())

  const myId = privateState?.playerId ?? ''
  const units = privateState?.military.units ?? {
    infantry: [0, 0, 0] as UnitCounts,
    tanks:    [0, 0, 0] as UnitCounts,
    planes:   [0, 0, 0] as UnitCounts,
    warships: [0, 0, 0] as UnitCounts,
  }
  const troopsByRegion = privateState?.troopsByRegion ?? {}
  const munitions = (privateState?.resources as Record<string, number> | undefined)?.['munitions'] ?? 0
  const obus      = (privateState?.resources as Record<string, number> | undefined)?.['obus']      ?? 0
  const bombs     = (privateState?.resources as Record<string, number> | undefined)?.['bombs']     ?? 0

  const myWars = publicState.activeWars.filter(
    w => (w.attackerId === myId || w.defenderId === myId) && w.status === 'active',
  )
  const atWarCount = myWars.length

  // ─── Allocation helpers ─────────────────────────────────────

  function getContested(war: PublicWarInfo): Region[] {
    if (!privateState) return []
    if (war.defenderId === myId) {
      return privateState.regions.filter(r => r.contestedByWarId === war.id && !r.destroyed)
    } else {
      const defenderPublic = publicState.players.find(p => p.id === war.defenderId)
      return (defenderPublic?.regions ?? []).filter(
        r => r.contestedByWarId === war.id && !r.occupiedBy && !r.destroyed,
      )
    }
  }

  function getAlloc(warId: string, regionId: string): FrontAllocation {
    return allocations[warId]?.[regionId] ?? emptyForces()
  }

  function setFrontUnit(warId: string, regionId: string, unit: UnitType, tier: number, value: number) {
    setAllocations(prev => {
      const warAlloc = { ...(prev[warId] ?? {}) }
      const front = { ...(warAlloc[regionId] ?? emptyForces()) }
      const arr = [...front[unit]] as [number, number, number]
      arr[tier] = Math.max(0, value)
      front[unit] = arr
      warAlloc[regionId] = front
      return { ...prev, [warId]: warAlloc }
    })
  }

  function submitAllocation(war: PublicWarInfo) {
    const contested = getContested(war)
    const fronts = contested.map(r => ({
      regionId: r.id,
      forces: getAlloc(war.id, r.id),
    }))
    onSubmitAllocation({ warId: war.id, fronts })
    setSubmittedWars(prev => new Set(prev).add(war.id))
  }

  // ─── Deploy helpers ─────────────────────────────────────────

  function setDeployUnit(unit: UnitType, tier: number, value: number) {
    setDeployUnits(prev => {
      const next = { ...prev, [unit]: [...prev[unit]] as [number, number, number] }
      next[unit][tier] = Math.max(0, value)
      return next
    })
  }

  function setTransferUnit(unit: UnitType, tier: number, value: number) {
    setTransferUnits(prev => {
      const next = { ...prev, [unit]: [...prev[unit]] as [number, number, number] }
      next[unit][tier] = Math.max(0, value)
      return next
    })
  }

  function handleDeploy() {
    if (!deployRegionId) return
    if (totalMilitaryUnits(deployUnits) === 0) return
    onDeployTroops(deployRegionId, deployUnits)
    setDeployUnits(emptyUnits())
  }

  function handleTransfer() {
    if (!transferFrom || !transferTo || transferFrom === transferTo) return
    if (totalMilitaryUnits(transferUnits) === 0) return
    onTransferTroops(transferFrom, transferTo, transferUnits)
    setTransferUnits(emptyUnits())
  }

  // ─── Render helpers ─────────────────────────────────────────

  const myRegions = (privateState?.regions ?? []).filter(r => !r.occupiedBy && !r.destroyed)

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex-1 relative">
      {/* Bottom bar button — same style as DiplomacyButton */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex flex-col items-center gap-0.5 py-2 rounded-xl border transition-colors active:scale-[0.98] ${
          atWarCount > 0
            ? 'border-red-400 bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/90'
        }`}
      >
        <span className="text-lg">⚔️</span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Armée</span>
        {atWarCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black">
            {atWarCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-full mb-2 right-0 w-80 sm:w-[28rem] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-sm font-bold text-white">⚔️ Panneau Guerre</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700">
              {(['guerre', 'troupes'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-[11px] font-bold transition-colors ${
                    tab === t
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'guerre' ? '⚔️ Guerre' : '🗺️ Troupes'}
                  {t === 'guerre' && atWarCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                      {atWarCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto max-h-[70vh] p-3 space-y-4">

              {/* ── TAB: GUERRE ──────────────────────────────── */}
              {tab === 'guerre' && (
                <>
                  {/* Total troops across all provinces */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Forces totales (toutes provinces)</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['infantry', 'tanks', 'planes', 'warships'] as UnitType[]).map(key => {
                        const info = UNIT_LABELS[key]
                        // Sum across all deployed regions + reserve
                        const totals: UnitCounts = [0, 0, 0]
                        for (const t of [0, 1, 2]) {
                          totals[t] += units[key][t]
                          for (const regionTroops of Object.values(troopsByRegion)) {
                            totals[t] += regionTroops[key][t]
                          }
                        }
                        const total = totals[0] + totals[1] + totals[2]
                        return (
                          <div key={key} className="bg-slate-800/60 rounded-lg px-2.5 py-1.5 text-[11px]">
                            <span className="font-semibold text-slate-200">{info.icon} {info.label} <span className="text-amber-400">({total})</span></span>
                            <div className="text-slate-400 mt-0.5 space-x-2">
                              <span>T1:{totals[0]}</span><span>T2:{totals[1]}</span><span>T3:{totals[2]}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {/* Recruit infantry (T1 only, deployed to province) */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Recruter infanterie (T1)</p>
                    <div className="flex flex-wrap items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                      <select
                        value={recruitRegionId}
                        onChange={e => setRecruitRegionId(e.target.value)}
                        className="flex-1 min-w-[120px] text-[11px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                      >
                        <option value="">Province…</option>
                        {myRegions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={recruitCount}
                        onChange={e => setRecruitCount(Math.max(1, Number(e.target.value)))}
                        className="w-16 text-center text-[11px] bg-slate-700 border border-slate-600 rounded px-1 py-1 text-white"
                      />
                      <span className="text-[10px] text-slate-400">
                        = {(INFANTRY_RECRUIT_COST[0] * recruitCount).toLocaleString('fr-FR')} €
                      </span>
                      <button
                        onClick={() => { if (recruitCount > 0 && recruitRegionId) onRecruitInfantry(1, recruitCount, recruitRegionId) }}
                        disabled={!recruitRegionId}
                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold rounded transition-colors"
                      >
                        Recruter
                      </button>
                    </div>
                  </section>

                  {/* Train infantry (T1→T2, T2→T3) */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Entraîner infanterie</p>
                    <div className="flex flex-wrap items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                      <select
                        value={trainRegionId}
                        onChange={e => setTrainRegionId(e.target.value)}
                        className="flex-1 min-w-[120px] text-[11px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                      >
                        <option value="">Province…</option>
                        {Object.entries(troopsByRegion)
                          .filter(([, t]) => t.infantry[0] > 0 || t.infantry[1] > 0)
                          .map(([rid, t]) => {
                            const rName = myRegions.find(r => r.id === rid)?.name ?? rid
                            return <option key={rid} value={rid}>{rName} (T1:{t.infantry[0]} T2:{t.infantry[1]})</option>
                          })}
                      </select>
                      <div className="flex gap-1">
                        {([1, 2] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setTrainFromTier(t)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              trainFromTier === t
                                ? 'bg-amber-500 text-black'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            T{t}→T{t + 1}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={trainCount}
                        onChange={e => setTrainCount(Math.max(1, Number(e.target.value)))}
                        className="w-14 text-center text-[11px] bg-slate-700 border border-slate-600 rounded px-1 py-1 text-white"
                      />
                      <span className="text-[10px] text-slate-400">
                        {(() => {
                          const base = trainFromTier === 1 ? 25 : 37
                          const discount = Math.min(0.20, trainCount * 0.01)
                          return `= ${Math.round(base * trainCount * (1 - discount)).toLocaleString('fr-FR')} €`
                        })()}
                        {trainCount >= 10 && <span className="text-green-400 ml-1">(-{Math.min(20, trainCount)}%)</span>}
                      </span>
                      <button
                        onClick={() => { if (trainCount > 0 && trainRegionId) onTrainInfantry(trainRegionId, trainFromTier, trainCount) }}
                        disabled={!trainRegionId}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold rounded transition-colors"
                      >
                        Entraîner
                      </button>
                    </div>
                  </section>

                  {/* Active wars */}
                  {myWars.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-2">Aucune guerre active</p>
                  ) : (
                    myWars.map(war => {
                      const isAttacker = war.attackerId === myId
                      const opponentName = isAttacker ? war.defenderName : war.attackerName
                      const contested = getContested(war)
                      const submitted = submittedWars.has(war.id)

                      return (
                        <section key={war.id} className="border border-red-800/40 rounded-lg overflow-hidden">
                          <div className="bg-red-900/30 px-3 py-2 flex items-center justify-between">
                            <div className="text-[11px] font-bold text-red-200">
                              {isAttacker ? '⚔️ Attaque' : '🛡️ Défense'} vs {opponentName}
                            </div>
                            <span className="text-[10px] text-red-400">Tour {war.duration}</span>
                          </div>

                          <div className="p-2 space-y-2">
                            {contested.length === 0 ? (
                              <p className="text-[10px] text-slate-500">Aucun front actif</p>
                            ) : (
                              contested.map(region => {
                                const alloc = getAlloc(war.id, region.id)
                                const regionTroops = troopsByRegion[region.id]
                                return (
                                  <div key={region.id} className="bg-slate-800/50 rounded p-2 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-semibold text-slate-200">
                                        📍 {region.name}
                                      </span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                        <span>{TERRAIN_LABELS[region.terrain] ?? region.terrain}</span>
                                        <span className={`font-bold ${region.warIntegrity <= 30 ? 'text-red-400' : region.warIntegrity <= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                                          ❤️ {region.warIntegrity}%
                                        </span>
                                      </div>
                                    </div>

                                    {/* Show troops deployed in this region (defender info) */}
                                    {!isAttacker && regionTroops && totalMilitaryUnits(regionTroops) > 0 && (
                                      <p className="text-[9px] text-blue-400">
                                        🔵 Troupes déployées ici — utilisées en priorité pour la défense
                                      </p>
                                    )}
                                    {!isAttacker && (!regionTroops || totalMilitaryUnits(regionTroops) === 0) && (
                                      <p className="text-[9px] text-yellow-500">
                                        ⚠️ Aucune troupe déployée ici — défense depuis la réserve
                                      </p>
                                    )}

                                    {/* Force allocation inputs */}
                                    {(['infantry', 'tanks', 'planes', 'warships'] as UnitType[]).map(unitKey => {
                                      const info = UNIT_LABELS[unitKey]
                                      const avail = units[unitKey]
                                      if (totalUnits(avail) === 0) return null
                                      return (
                                        <div key={unitKey} className="flex items-center gap-1.5 text-[10px]">
                                          <span className="w-14 text-slate-400">{info.icon} {info.label.substring(0, 6)}</span>
                                          <div className="flex gap-1 flex-1">
                                            {([0, 1, 2] as const).map(t => {
                                              if (avail[t] === 0) return null
                                              return (
                                                <div key={t} className="flex items-center gap-0.5">
                                                  <span className="text-slate-500">T{t+1}:</span>
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={avail[t]}
                                                    value={alloc[unitKey][t]}
                                                    onChange={e => setFrontUnit(war.id, region.id, unitKey, t, Number(e.target.value))}
                                                    className="w-12 text-center bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px]"
                                                  />
                                                  <span className="text-slate-500">/{avail[t]}</span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })
                            )}

                            {contested.length > 0 && (
                              <button
                                onClick={() => submitAllocation(war)}
                                className={`w-full py-1.5 rounded text-[11px] font-bold transition-colors ${
                                  submitted
                                    ? 'bg-green-800/50 text-green-400 border border-green-700/50'
                                    : 'bg-red-600 hover:bg-red-500 text-white'
                                }`}
                              >
                                {submitted ? '✅ Allocation soumise' : '📤 Soumettre allocation'}
                              </button>
                            )}
                          </div>
                        </section>
                      )
                    })
                  )}
                </>
              )}

              {/* ── TAB: TROUPES ─────────────────────────────── */}
              {tab === 'troupes' && (
                <>
                  {/* Per-region troop view */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Déploiement par région</p>
                    {myRegions.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Aucune région</p>
                    ) : (
                      <div className="space-y-1.5">
                        {myRegions.map(region => {
                          const rt = troopsByRegion[region.id]
                          const hasTroops = rt && totalMilitaryUnits(rt) > 0
                          return (
                            <div key={region.id} className="bg-slate-800/60 rounded-lg px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-semibold text-slate-200">
                                  📍 {region.name}
                                </span>
                                <span className="text-[9px] text-slate-500">
                                  {TERRAIN_LABELS[region.terrain] ?? region.terrain}
                                  {region.contestedByWarId && <span className="ml-1 text-red-400 font-bold">⚔️ Contestée</span>}
                                </span>
                              </div>
                              {hasTroops ? (
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                                  {(['infantry', 'tanks', 'planes', 'warships'] as UnitType[]).map(k => {
                                    const u = rt![k]
                                    if (totalUnits(u) === 0) return null
                                    return (
                                      <span key={k}>{UNIT_LABELS[k].icon} T1:{u[0]} T2:{u[1]} T3:{u[2]}</span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-600">Aucune troupe déployée</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Deploy from reserve */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Déployer depuis la réserve</p>
                    <div className="bg-slate-800/60 rounded-lg p-2 space-y-2">
                      <select
                        value={deployRegionId}
                        onChange={e => setDeployRegionId(e.target.value)}
                        className="w-full text-[11px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                      >
                        <option value="">Choisir une région…</option>
                        {myRegions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      {(['infantry', 'tanks', 'planes', 'warships'] as UnitType[]).map(unitKey => {
                        const avail = units[unitKey]
                        if (totalUnits(avail) === 0) return null
                        return (
                          <div key={unitKey} className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-16 text-slate-400">{UNIT_LABELS[unitKey].icon} {UNIT_LABELS[unitKey].label}</span>
                            <div className="flex gap-1">
                              {([0, 1, 2] as const).map(t => avail[t] === 0 ? null : (
                                <div key={t} className="flex items-center gap-0.5">
                                  <span className="text-slate-500">T{t+1}:</span>
                                  <input
                                    type="number" min={0} max={avail[t]}
                                    value={deployUnits[unitKey][t]}
                                    onChange={e => setDeployUnit(unitKey, t, Number(e.target.value))}
                                    className="w-10 text-center bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px]"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      <button
                        onClick={handleDeploy}
                        disabled={!deployRegionId || totalMilitaryUnits(deployUnits) === 0}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded transition-colors"
                      >
                        🏕️ Déployer
                      </button>
                    </div>
                  </section>

                  {/* Transfer between regions */}
                  <section>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Transférer entre régions</p>
                    <div className="bg-slate-800/60 rounded-lg p-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-slate-500 mb-0.5">Depuis</p>
                          <select
                            value={transferFrom}
                            onChange={e => { setTransferFrom(e.target.value); setTransferUnits(emptyUnits()) }}
                            className="w-full text-[11px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                          >
                            <option value="">—</option>
                            {myRegions.filter(r => troopsByRegion[r.id] && totalMilitaryUnits(troopsByRegion[r.id]) > 0).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 mb-0.5">Vers</p>
                          <select
                            value={transferTo}
                            onChange={e => setTransferTo(e.target.value)}
                            className="w-full text-[11px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                          >
                            <option value="">—</option>
                            {myRegions.filter(r => r.id !== transferFrom).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {transferFrom && troopsByRegion[transferFrom] && (
                        <>
                          {(['infantry', 'tanks', 'planes', 'warships'] as UnitType[]).map(unitKey => {
                            const avail = troopsByRegion[transferFrom][unitKey]
                            if (totalUnits(avail) === 0) return null
                            return (
                              <div key={unitKey} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-16 text-slate-400">{UNIT_LABELS[unitKey].icon} {UNIT_LABELS[unitKey].label}</span>
                                <div className="flex gap-1">
                                  {([0, 1, 2] as const).map(t => avail[t] === 0 ? null : (
                                    <div key={t} className="flex items-center gap-0.5">
                                      <span className="text-slate-500">T{t+1}:</span>
                                      <input
                                        type="number" min={0} max={avail[t]}
                                        value={transferUnits[unitKey][t]}
                                        onChange={e => setTransferUnit(unitKey, t, Number(e.target.value))}
                                        className="w-10 text-center bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-white text-[10px]"
                                      />
                                      <span className="text-slate-500">/{avail[t]}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}
                      <button
                        onClick={handleTransfer}
                        disabled={!transferFrom || !transferTo || totalMilitaryUnits(transferUnits) === 0}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded transition-colors"
                      >
                        🚚 Transférer
                      </button>
                      <p className="text-[9px] text-slate-500 text-center">
                        ⚠️ Les transferts entre régions propres sont gratuits. Les troupes déployées partent en priorité au combat sur la région où elles se trouvent.
                      </p>
                    </div>
                  </section>
                </>
              )}

              {/* Ammo stocks (shown in guerre tab header) */}
              {(munitions > 0 || obus > 0 || bombs > 0) && (
                <section className="border border-slate-700/50 rounded-lg p-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1.5">Munitions (ressources)</p>
                  <div className="flex gap-3 text-[11px] text-slate-300">
                    <span>{AMMO_ICONS.munitions} {munitions} mun.</span>
                    <span>{AMMO_ICONS.obus} {obus} obus</span>
                    <span>{AMMO_ICONS.bombs} {bombs} bombes</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Produites en usine · achetables via Commerce</p>
                </section>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
