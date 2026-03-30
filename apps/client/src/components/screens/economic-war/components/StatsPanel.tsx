import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { EcoWarPrivatePlayerState, IndustrySector, CropCategory, LivestockCategory } from '@undercover/shared'

// ─── Constants mirrored from server ──────────────────────────

// Mining
const MINING_BASE_RATE: Record<string, number> = {
  oil: 20, iron: 35, coal: 40, rareEarths: 15, precious: 10, uranium: 8,
}
const MINING_REFINERY_YIELD_BONUS = 0.30

// Agriculture
const FARM_EXPLOITATION: Record<string, number> = { basic: 50, mechanized: 75, advanced: 95 }
const FARM_FALLOW_EXPLOITATION = 30
const FARM_YIELD_MULT: Record<string, number> = { basic: 0.70, mechanized: 1.15, advanced: 1.80 }
const FARM_FERT_BASE = 0.30
const FARM_FERT_COEFF = 0.70
const FARM_BASE_YIELD: Record<CropCategory, number> = { cereals: 8, vegetables: 6, sugarOils: 5, fodder: 7 }
const FARM_IRRIGATION_BONUS_DIVISOR = 200

// Livestock
const LIVESTOCK_EXPLOITATION: Record<string, number> = { basic: 40, mechanized: 65, advanced: 85 }
const LIVESTOCK_YIELD_MULT: Record<string, number> = { basic: 1.0, mechanized: 1.50, advanced: 2.20 }
const LIVESTOCK_BASE_YIELD: Record<LivestockCategory, number> = { redMeat: 4, whiteMeat: 3, dairy: 3.5 }
const LIVESTOCK_FEED_RATE: Record<LivestockCategory, number> = { redMeat: 2.0, whiteMeat: 0.8, dairy: 1.2 }
const LIVESTOCK_WATER_THRESHOLD = 40

// Marine
const MARINE_EXPLOITATION: Record<string, number> = { basic: 20, mechanized: 35, advanced: 50 }
const MARINE_YIELD_MULT: Record<string, number> = { basic: 1.00, mechanized: 1.50, advanced: 2.00 }
const MARINE_FEED_RATE: Record<string, number> = { basic: 0.01, mechanized: 0.03, advanced: 0.06 }
const MARINE_WATER_THRESHOLD = 30
const MARINE_PRODUCTIVE_PCT = 0.60
const MARINE_STOCK_SAFETY_CAP = 0.80

// ─── Production Estimators ─────────────────────────────────

function estimateMining(state: EcoWarPrivatePlayerState, res: string): number {
  const deposit = (state.mining as unknown as Record<string, { machines: number; underground: number; hasRefinery: boolean }>)[res]
  if (!deposit || deposit.machines === 0 || deposit.underground <= 0) return 0
  const infraFactor = 0.5 + 0.5 * (state.infrastructure.electricity / 100)
  const refineryBonus = deposit.hasRefinery ? 1 + MINING_REFINERY_YIELD_BONUS : 1.0
  const maxExtraction = deposit.machines * (MINING_BASE_RATE[res] ?? 10) * infraFactor * refineryBonus
  return Math.round(Math.min(deposit.underground, maxExtraction))
}

function estimatePlot(state: EcoWarPrivatePlayerState, category: CropCategory): number {
  const plot = state.agriculture.plots.find(p => p.category === category)
  if (!plot) return 0
  const exploitation = plot.inFallow ? FARM_FALLOW_EXPLOITATION : (FARM_EXPLOITATION[plot.equipment] ?? 50)
  const fertilityMult = FARM_FERT_BASE + FARM_FERT_COEFF * (plot.fertility / 100)
  const equipMult = FARM_YIELD_MULT[plot.equipment] ?? 0.70
  const irrigBonus = 1.0 + state.agriculture.irrigationLevel / FARM_IRRIGATION_BONUS_DIVISOR
  return Math.round(plot.surface * (exploitation / 100) * fertilityMult * equipMult * FARM_BASE_YIELD[category] * irrigBonus)
}

function estimateHerd(state: EcoWarPrivatePlayerState, category: LivestockCategory): number {
  const herd = state.livestock.herds.find(h => h.category === category)
  if (!herd) return 0
  const totalFeedDemand = state.livestock.herds.reduce((s, h) => s + h.total * LIVESTOCK_FEED_RATE[h.category], 0)
  const feedRatio = Math.min(1.0, totalFeedDemand <= 0 ? 1 : state.resources.fodder / totalFeedDemand)
  const waterRatio = Math.min(1.0, state.infrastructure.waterTreatment / LIVESTOCK_WATER_THRESHOLD)
  const alim = feedRatio * 0.70 + waterRatio * 0.30
  const productive = herd.total * ((LIVESTOCK_EXPLOITATION[herd.equipment] ?? 40) / 100)
  return Math.round(productive * LIVESTOCK_BASE_YIELD[category] * (LIVESTOCK_YIELD_MULT[herd.equipment] ?? 1.0) * alim)
}

function estimateMarine(state: EcoWarPrivatePlayerState): number {
  const { marine } = state
  const feedDemand = marine.stockTotal * (MARINE_FEED_RATE[marine.equipment] ?? 0.01)
  const feedRatio = Math.min(1.0, feedDemand <= 0 ? 1 : state.resources.fodder / feedDemand)
  const waterRatio = Math.min(1.0, state.infrastructure.waterTreatment / MARINE_WATER_THRESHOLD)
  const alim = feedRatio * 0.40 + waterRatio * 0.60
  const productiveStock = marine.stockTotal * MARINE_PRODUCTIVE_PCT
  const baseExtraction = productiveStock * ((MARINE_EXPLOITATION[marine.equipment] ?? 20) / 100)
    * (MARINE_YIELD_MULT[marine.equipment] ?? 1.0) * alim
  return Math.round(Math.min(productiveStock * MARINE_STOCK_SAFETY_CAP, baseExtraction))
}

// ─── Manufacturing Production Estimators ───────────────────

const MFG_OUTPUT_PER_FACTORY_STATS: Record<string, number> = {
  manufacturing: 2.0, energy: 3.0, electronics: 1.0,
  pharmaceutical: 1.5, food: 2.0, chemicalPlant: 2.0,
  phonesFactory: 1.0, computersFactory: 0.5,
  powerPlant: 5.0, nuclearPlant: 12.0,
}

const MFG_OUTPUT_LABELS_STATS: Record<string, { label: string; icon: string }> = {
  manufacturing:    { label: 'Acier',              icon: '⚙️' },
  energy:           { label: 'Carburant',           icon: '⛽' },
  electronics:      { label: 'Composants élec.',    icon: '🔌' },
  pharmaceutical:   { label: 'Médicaments',         icon: '💊' },
  food:             { label: 'Alim. transf.',       icon: '🍞' },
  chemicalPlant:    { label: 'Engrais',             icon: '🌱' },
  phonesFactory:    { label: 'Téléphones',          icon: '📱' },
  computersFactory: { label: 'Ordinateurs',         icon: '💻' },
  powerPlant:       { label: 'Électricité (infra)', icon: '⚡' },
  nuclearPlant:     { label: 'Électricité (nuc.)',  icon: '☢️' },
}

// MFG_INPUTS: ce que chaque secteur consomme par unité produite (mirrored from server)
const MFG_INPUTS: Record<string, { resource: string; amount: number }[]> = {
  manufacturing:    [{ resource: 'iron', amount: 1.5 }, { resource: 'coal', amount: 0.8 }],
  energy:           [{ resource: 'oil', amount: 2.0 }],
  electronics:      [{ resource: 'rareEarths', amount: 0.8 }, { resource: 'coal', amount: 0.3 }],
  pharmaceutical:   [{ resource: 'vegetables', amount: 0.5 }, { resource: 'water', amount: 0.4 }],
  food:             [{ resource: 'cereals', amount: 1.0 }, { resource: 'water', amount: 0.3 }],
  chemicalPlant:    [{ resource: 'coal', amount: 0.8 }, { resource: 'water', amount: 0.6 }, { resource: 'oil', amount: 0.3 }],
  phonesFactory:    [{ resource: 'electronicComponents', amount: 0.8 }, { resource: 'rareEarths', amount: 0.2 }],
  computersFactory: [{ resource: 'electronicComponents', amount: 1.2 }, { resource: 'steel', amount: 0.5 }, { resource: 'rareEarths', amount: 0.3 }],
  powerPlant:       [{ resource: 'coal', amount: 1.5 }],
  nuclearPlant:     [{ resource: 'uranium', amount: 0.5 }],
}

function estimateMfgProduction(state: EcoWarPrivatePlayerState, sector: string): number {
  const tierMult: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 }
  const outputPerFactory = MFG_OUTPUT_PER_FACTORY_STATS[sector] ?? 0
  return Math.ceil(
    state.factories
      .filter(f => f.sector === sector)
      .reduce((s, f) => s + outputPerFactory * (tierMult[f.tier] ?? 1.0) * (f.health / 100), 0),
  )
}

/** Estime la consommation de matière première par les usines MFG (inputs consommés par tour) */
function estimateMfgInputConsumption(state: EcoWarPrivatePlayerState, resource: string): number {
  const tierMult: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 }
  let total = 0
  for (const [sector, inputs] of Object.entries(MFG_INPUTS)) {
    const inputDef = inputs.find(i => i.resource === resource)
    if (!inputDef) continue
    const outputPerFactory = MFG_OUTPUT_PER_FACTORY_STATS[sector] ?? 0
    const factoryOutput = state.factories
      .filter(f => f.sector === sector)
      .reduce((s, f) => s + outputPerFactory * (tierMult[f.tier] ?? 1.0) * (f.health / 100), 0)
    total += factoryOutput * inputDef.amount
  }
  return Math.ceil(total)
}

// ─── Consumption Estimators ────────────────────────────────

function estimateConsumption(state: EcoWarPrivatePlayerState, resource: string): number {
  const pop = state.population.total
  // Consommation par les usines MFG (inputs réels depuis MFG_INPUTS)
  const mfgInput = estimateMfgInputConsumption(state, resource)

  switch (resource) {
    // Mining — factory MFG inputs + vehicle/weapon production
    case 'oil':        return mfgInput // energy + chemicalPlant consume oil via MFG_INPUTS
    case 'iron':       return mfgInput // manufacturing consumes iron via MFG_INPUTS
    case 'coal':       return mfgInput // manufacturing + electronics + chemicalPlant
    case 'rareEarths': return mfgInput // electronics + phones + computers
    case 'precious':   return 0
    case 'uranium':    return mfgInput + state.military.nuclearBombs * 3
    // Agriculture — population food demand per turn
    case 'cereals':    return Math.ceil(pop * 2.5) + mfgInput  // food factories consume cereals
    case 'vegetables': return Math.ceil(pop * 1.8) + mfgInput  // pharmaceutical consumes vegetables
    case 'sugarOils':  return Math.ceil(pop * 1.2)
    case 'fodder': {
      const livestockFeed = state.livestock.herds.reduce((s, h) => s + h.total * LIVESTOCK_FEED_RATE[h.category], 0)
      const marineFeed = state.marine.stockTotal * (MARINE_FEED_RATE[state.marine.equipment] ?? 0.01)
      return Math.ceil(livestockFeed + marineFeed)
    }
    // Livestock & Marine — population consumption
    case 'redMeat':   return Math.ceil(pop * 1.0)
    case 'whiteMeat': return Math.ceil(pop * 1.8)
    case 'dairy':     return Math.ceil(pop * 2.0)
    case 'fish':      return Math.ceil(pop * 0.8)
    // Manufactured goods — factory inputs + population consumption
    case 'steel':                return mfgInput + Math.ceil(state.factories.filter(f => ['vehicleFactory','shipyard','aerospace','tankFactory','militaryAirbase','navalBase'].includes(f.sector)).length * 5)
    case 'fuel':                 return Math.ceil((state.fleet?.vehicles ?? []).filter(v => v.fuelType === 'oil').reduce((s, v) => s + v.fuelConsumption, 0))
    case 'electronicComponents': return mfgInput // phones + computers factories consume components
    case 'pharmaceuticals':      return Math.ceil(pop * 0.5 * 0.15)  // population consumes 15% of need/turn
    case 'processedFood':        return Math.ceil(pop * 1.0 * 0.15)  // population consumes 15% of need/turn
    case 'fertilizer':           return 0  // bonus passif, pas consommé directement
    case 'phones':               return Math.ceil(pop * 0.5 * 0.15)  // population consumes 15% of need/turn
    case 'computers':            return Math.ceil(pop * 0.33 * 0.15) // population consumes 15% of need/turn
    case 'water':                return mfgInput // pharmaceutical + food + chemicalPlant consume water
    default:                     return 0
  }
}

// ─── Bar Chart Components ──────────────────────────────────

function ItemBar({
  icon, label, production, consumption, maxVal, unit = '',
}: {
  icon: string
  label: string
  production: number
  consumption: number
  maxVal: number
  unit?: string
}) {
  const prodPct = maxVal > 0 ? Math.min(100, (production / maxVal) * 100) : 0
  const consPct = maxVal > 0 ? Math.min(100, (consumption / maxVal) * 100) : 0
  const surplus = production - consumption
  const surplusColor = consumption === 0 ? 'text-slate-400' : surplus >= 0 ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-slate-700 dark:text-slate-300">{icon} {label}</span>
        {consumption > 0
          ? <span className={`font-black ${surplusColor}`}>{surplus >= 0 ? '+' : ''}{Math.round(surplus)}{unit}</span>
          : <span className="text-slate-400 text-[9px]">production pure</span>
        }
      </div>
      <div className="relative h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-blue-500 opacity-80"
          style={{ width: `${prodPct}%` }}
        />
        {consumption > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-red-400"
            style={{ left: `${Math.min(99, consPct)}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
        <span className="text-blue-500">▐ {Math.round(production)}{unit}/tour</span>
        {consumption > 0 && <span className="text-red-400">│ {Math.round(consumption)}{unit}/tour</span>}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pt-1 border-t border-slate-200 dark:border-slate-700 first:border-none first:pt-0">
      {icon} {title}
    </p>
  )
}

// ─── Resource Stock Bar ────────────────────────────────────

function ResourceBar({
  icon, label, value, max,
}: { icon: string; label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-slate-700 dark:text-slate-300">{icon} {label}</span>
        <span className="font-black text-slate-900 dark:text-slate-100">{Math.round(value)}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Alerts Panel (from server) ──────────────────────────

function AlertsPanel({ alerts }: { alerts: { icon: string; label: string; detail: string; severity: 'warning' | 'critical' }[] }) {
  if (!alerts || alerts.length === 0) return null

  return (
    <div className="space-y-1.5 mb-2">
      {alerts.map((a, i) => {
        const isCrit = a.severity === 'critical'
        return (
          <div key={i} className={`rounded-lg border px-2.5 py-1.5 ${
            isCrit
              ? 'bg-red-100 dark:bg-red-950/50 border-red-400'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black ${isCrit ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>{a.label}</p>
                <p className={`text-[9px] ${isCrit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{a.detail}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Factory Production List (from server) ───────────────

function FactoryList({ factories }: { factories: { factoryId: string; sector: string; tier: string; output: string; productionRate: number }[] }) {
  if (!factories || factories.length === 0) {
    return <p className="text-[10px] text-slate-400 italic text-center py-2">Aucune usine construite</p>
  }

  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">🏭 Vos usines</p>
      {factories.map(f => {
        const rateColor = f.productionRate >= 90 ? 'text-emerald-500' : f.productionRate >= 60 ? 'text-amber-500' : 'text-red-500'
        return (
          <div key={f.factoryId} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">{f.sector} <span className="text-slate-400 font-normal">({f.tier})</span></p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400">{f.output}</p>
            </div>
            <span className={`text-[10px] font-black shrink-0 ${rateColor}`}>{f.productionRate}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Collapsible Stock Section ─────────────────────────────

function StockSection({
  label, items,
}: {
  label: string
  items: { icon: string; label: string; value: number; max: number }[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const nonZero = items.filter(it => Math.round(it.value) !== 0)
  if (nonZero.length === 0) return null

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={e => { e.stopPropagation(); setIsOpen(v => !v) }}
      >
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-slate-400 font-normal">{nonZero.length} article{nonZero.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-200 dark:border-slate-700">
          {nonZero.map(it => (
            <ResourceBar key={it.label} icon={it.icon} label={it.label} value={Math.round(it.value)} max={it.max} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

interface StatsPanelProps {
  state: EcoWarPrivatePlayerState
  onClose: () => void
}

export function StatsPanel({ state, onClose }: StatsPanelProps) {
  const [tab, setTab] = useState<'production' | 'resources' | 'needs' | 'population'>('production')
  const [openPopCard, setOpenPopCard] = useState<string | null>(null)

  // ── Production data per item ──
  const miningItems = [
    { key: 'oil',        icon: '🛢️', label: 'Pétrole' },
    { key: 'iron',       icon: '🔩', label: 'Fer' },
    { key: 'coal',       icon: '🪨', label: 'Charbon' },
    { key: 'rareEarths', icon: '✨', label: 'Terres rares' },
    { key: 'precious',   icon: '💛', label: 'Métaux précieux' },
    { key: 'uranium',    icon: '☢️', label: 'Uranium' },
  ].map(({ key, icon, label }) => ({
    icon, label,
    production: estimateMining(state, key),
    consumption: estimateConsumption(state, key),
  })).filter(d => d.production > 0 || d.consumption > 0)

  const agriItems = [
    { key: 'cereals' as CropCategory,    icon: '🌾', label: 'Céréales' },
    { key: 'vegetables' as CropCategory, icon: '🥦', label: 'Légumes' },
    { key: 'sugarOils' as CropCategory,  icon: '🌻', label: 'Sucre / Oléagineux' },
    { key: 'fodder' as CropCategory,     icon: '🌿', label: 'Fourrage' },
  ].map(({ key, icon, label }) => ({
    icon, label,
    production: estimatePlot(state, key),
    consumption: estimateConsumption(state, key),
  }))

  const livestockItems = [
    { key: 'redMeat' as LivestockCategory,   icon: '🥩', label: 'Viande rouge' },
    { key: 'whiteMeat' as LivestockCategory, icon: '🍗', label: 'Viande blanche' },
    { key: 'dairy' as LivestockCategory,     icon: '🥛', label: 'Lait & Œufs' },
  ].map(({ key, icon, label }) => ({
    icon, label,
    production: estimateHerd(state, key),
    consumption: estimateConsumption(state, key),
  })).filter(d => d.production > 0 || d.consumption > 0)

  const fishProduction = estimateMarine(state)
  const fishConsumption = estimateConsumption(state, 'fish')

  // Manufactured goods production estimates — show all goods (not just owned factories)
  const mfgGoodsSectors = Object.keys(MFG_OUTPUT_LABELS_STATS) as IndustrySector[]
  const mfgItems = mfgGoodsSectors
    .map(s => {
      const meta = MFG_OUTPUT_LABELS_STATS[s]!
      const production = estimateMfgProduction(state, s)
      const consumption = estimateConsumption(state, s)
      return { icon: meta.icon, label: meta.label, production, consumption }
    })
    .filter(d => d.production > 0 || d.consumption > 0)
  const mfgMax = Math.max(...mfgItems.map(d => Math.max(d.production, d.consumption)), 1)

  // Compute max for each group's scale
  const miningMax    = Math.max(...miningItems.map(d => Math.max(d.production, d.consumption)), 1)
  const agriMax      = Math.max(...agriItems.map(d => Math.max(d.production, d.consumption)), 1)
  const livestockMax = Math.max(...livestockItems.map(d => Math.max(d.production, d.consumption)), fishProduction, fishConsumption, 1)

  // Needs tab data — items with stock use net balance logic
  const r = state.resources
  const needsData: {
    label: string; icon: string
    production: number; need: number
    stock?: number   // present = physical resource, absent = GDP/money metric
    deficit?: string // conséquence d'un manque
  }[] = [
    // ── Matières premières (consommées par usines MFG) ──
    { label: 'Fer',              icon: '🔩', stock: r.iron,       production: estimateMining(state, 'iron'),      need: estimateConsumption(state, 'iron'),      deficit: 'Production d\'acier réduite ou stoppée' },
    { label: 'Charbon',          icon: '🪨', stock: r.coal,       production: estimateMining(state, 'coal'),      need: estimateConsumption(state, 'coal'),      deficit: 'Acier, composants, engrais réduits' },
    { label: 'Pétrole',          icon: '🛢️', stock: r.oil,        production: estimateMining(state, 'oil'),       need: estimateConsumption(state, 'oil'),       deficit: 'Carburant + engrais non produits' },
    { label: 'Terres rares',     icon: '✨', stock: r.rareEarths, production: estimateMining(state, 'rareEarths'), need: estimateConsumption(state, 'rareEarths'), deficit: 'Composants, téléphones, ordis bloqués' },
    { label: 'Eau',              icon: '💧', stock: r.water,      production: 0,                                   need: estimateConsumption(state, 'water'),      deficit: 'Médicaments, nourriture, engrais réduits' },
    // ── Alimentation ──
    { label: 'Céréales',           icon: '🌾', stock: r.cereals    ?? 0, production: estimatePlot(state, 'cereals'),   need: estimateConsumption(state, 'cereals'),    deficit: 'Bonheur −3 à −8/tour, nourriture transf. réduite' },
    { label: 'Légumes',            icon: '🥦', stock: r.vegetables ?? 0, production: estimatePlot(state, 'vegetables'), need: estimateConsumption(state, 'vegetables'), deficit: 'Bonheur −3/tour, médicaments non produits' },
    { label: 'Sucre / Oléagineux', icon: '🌻', stock: r.sugarOils  ?? 0, production: estimatePlot(state, 'sugarOils'),  need: estimateConsumption(state, 'sugarOils'),  deficit: 'Bonheur réduit' },
    { label: 'Fourrage',           icon: '🌿', stock: r.fodder     ?? 0, production: estimatePlot(state, 'fodder'),     need: estimateConsumption(state, 'fodder'),     deficit: 'Élevage et pêche en rendement réduit' },
    { label: 'Viande rouge',       icon: '🥩', stock: r.redMeat    ?? 0, production: estimateHerd(state, 'redMeat'),    need: estimateConsumption(state, 'redMeat'),    deficit: 'Bonheur réduit (alimentation insuffisante)' },
    { label: 'Viande blanche',     icon: '🍗', stock: r.whiteMeat  ?? 0, production: estimateHerd(state, 'whiteMeat'),  need: estimateConsumption(state, 'whiteMeat'),  deficit: 'Bonheur réduit' },
    { label: 'Lait & Œufs',        icon: '🥛', stock: r.dairy      ?? 0, production: estimateHerd(state, 'dairy'),      need: estimateConsumption(state, 'dairy'),      deficit: 'Bonheur réduit' },
    { label: 'Poissons',           icon: '🐟', stock: r.fish       ?? 0, production: fishProduction,                    need: fishConsumption,                          deficit: 'Bonheur réduit' },
    // ── Biens manufacturés (consommés par la pop + usines aval) ──
    { label: 'Acier',              icon: '⚙️', stock: r.steel                ?? 0, production: estimateMfgProduction(state, 'manufacturing'), need: estimateConsumption(state, 'steel'),                deficit: 'Véhicules, armes, ordis non produits' },
    { label: 'Carburant',          icon: '⛽', stock: r.fuel                 ?? 0, production: estimateMfgProduction(state, 'energy'),         need: estimateConsumption(state, 'fuel'),                 deficit: 'Flotte immobilisée, pas de transport' },
    { label: 'Composants élec.',   icon: '🔌', stock: r.electronicComponents ?? 0, production: estimateMfgProduction(state, 'electronics'),    need: estimateConsumption(state, 'electronicComponents'), deficit: 'Téléphones et ordinateurs non produits' },
    { label: 'Médicaments',        icon: '💊', stock: r.pharmaceuticals      ?? 0, production: estimateMfgProduction(state, 'pharmaceutical'), need: estimateConsumption(state, 'pharmaceuticals'),      deficit: 'Santé −2/tour, mortalité ↑, bonheur −4' },
    { label: 'Alim. transformée',  icon: '🍞', stock: r.processedFood        ?? 0, production: estimateMfgProduction(state, 'food'),           need: estimateConsumption(state, 'processedFood'),        deficit: 'Bonheur −5 (besoin population)' },
    { label: 'Engrais',            icon: '🌱', stock: r.fertilizer           ?? 0, production: estimateMfgProduction(state, 'chemicalPlant'),  need: 0,                                                  deficit: '' },
    { label: 'Téléphones',         icon: '📱', stock: r.phones               ?? 0, production: estimateMfgProduction(state, 'phonesFactory'),  need: estimateConsumption(state, 'phones'),               deficit: 'Bonheur −5 (besoin population)' },
    { label: 'Ordinateurs',        icon: '💻', stock: r.computers            ?? 0, production: estimateMfgProduction(state, 'computersFactory'), need: estimateConsumption(state, 'computers'),           deficit: 'Bonheur −4 (besoin population)' },
    // ── Budget ──
    { label: 'Militaire (budget)', icon: '⚔️', production: 0,                                                 need: state.military.maintenanceCost,                     deficit: 'Soldats/véhicules dissous, force réduite' },
  ]
  const needsDeduped = needsData.filter((n, i, arr) => arr.findIndex(x => x.label === n.label) === i)

  // ── Stock sections data ──
  const stockSections = [
    {
      id: 'minerals',
      label: '⛏️ Minéraux & Énergie',
      items: [
        { icon: '🛢️', label: 'Pétrole',         value: state.resources.oil,        max: 500 },
        { icon: '🔩', label: 'Fer',              value: state.resources.iron,       max: 500 },
        { icon: '🪨', label: 'Charbon',          value: state.resources.coal,       max: 500 },
        { icon: '✨', label: 'Terres rares',     value: state.resources.rareEarths, max: 300 },
        { icon: '💛', label: 'Métaux précieux',  value: state.resources.precious,   max: 300 },
        { icon: '☢️', label: 'Uranium',          value: state.resources.uranium,    max: 200 },
        { icon: '💧', label: 'Eau',              value: state.resources.water,      max: 500 },
      ],
    },
    {
      id: 'crops',
      label: '🌾 Cultures agricoles',
      items: [
        { icon: '🌾', label: 'Céréales',           value: state.resources.cereals    ?? 0, max: 500 },
        { icon: '🥦', label: 'Légumes',            value: state.resources.vegetables ?? 0, max: 300 },
        { icon: '🌻', label: 'Sucre / Oléagineux', value: state.resources.sugarOils  ?? 0, max: 300 },
        { icon: '🌿', label: 'Fourrage',           value: state.resources.fodder     ?? 0, max: 400 },
      ],
    },
    {
      id: 'livestock',
      label: '🐄 Élevage & Pêche',
      items: [
        { icon: '🥩', label: 'Viande rouge',   value: state.resources.redMeat   ?? 0, max: 300 },
        { icon: '🍗', label: 'Viande blanche', value: state.resources.whiteMeat ?? 0, max: 300 },
        { icon: '🥛', label: 'Lait & Œufs',    value: state.resources.dairy     ?? 0, max: 300 },
        { icon: '🐟', label: 'Poissons',       value: state.resources.fish      ?? 0, max: 300 },
      ],
    },
    {
      id: 'manufactured',
      label: '🏭 Biens manufacturés',
      items: [
        { icon: '⚙️', label: 'Acier',            value: state.resources.steel                ?? 0, max: 200 },
        { icon: '⛽', label: 'Carburant',         value: state.resources.fuel                 ?? 0, max: 200 },
        { icon: '🔌', label: 'Composants élec.',  value: state.resources.electronicComponents ?? 0, max: 100 },
        { icon: '💊', label: 'Médicaments',       value: state.resources.pharmaceuticals      ?? 0, max: 200 },
        { icon: '🍞', label: 'Alim. transf.',     value: state.resources.processedFood        ?? 0, max: 300 },
        { icon: '🌱', label: 'Engrais',           value: state.resources.fertilizer           ?? 0, max: 200 },
        { icon: '📱', label: 'Téléphones',        value: state.resources.phones               ?? 0, max: 100 },
        { icon: '💻', label: 'Ordinateurs',       value: state.resources.computers            ?? 0, max: 100 },
      ],
    },
    {
      id: 'ammo',
      label: '🔴 Munitions',
      items: [
        { icon: '🔴', label: 'Munitions (infanterie)', value: state.resources.munitions ?? 0, max: 200 },
        { icon: '🟠', label: 'Obus (chars)',           value: state.resources.obus      ?? 0, max: 100 },
        { icon: '💣', label: 'Bombes (avions)',        value: state.resources.bombs     ?? 0, max: 50 },
      ],
    },
    {
      id: 'infra',
      label: '⚡ Infrastructure',
      items: [
        { icon: '⚡', label: 'Électricité',    value: state.infrastructure.electricity,    max: 100 },
        { icon: '📡', label: 'Télécom',        value: state.infrastructure.telecom,        max: 100 },
        { icon: '💧', label: 'Traitement eau', value: state.infrastructure.waterTreatment, max: 100 },
      ],
    },
    {
      id: 'population',
      label: '👥 Population',
      items: [
        { icon: '😊', label: `Bonheur (${Math.round(state.happiness)}%)`,  value: state.happiness,                   max: 100 },
        { icon: '🏥', label: `Santé (${Math.round(state.health)}%)`,       value: state.health,                      max: 100 },
        { icon: '🌿', label: 'Pollution — bas = bien',                      value: Math.max(0, 100 - state.pollution), max: 100 },
      ],
    },
  ]

  const togglePopCard = (id: string) => {
    setOpenPopCard(prev => prev === id ? null : id)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">📊 Statistiques</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs">
          {([['production', '🏭 Production'], ['resources', '🛢️ Stocks'], ['needs', '📋 Besoins'], ['population', '🧑‍🤝‍🧑 Population']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 font-bold transition-colors ${
                tab === key
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-3">
          <AlertsPanel alerts={state.alerts ?? []} />

          <AnimatePresence mode="wait">

            {/* ── PRODUCTION TAB ── */}
            {tab === 'production' && (
              <motion.div key="prod" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Factory production summary from server */}
                <FactoryList factories={state.factoryProduction ?? []} />

                {/* Legend */}
                <div className="flex items-center gap-3 text-[9px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><span className="block w-3 h-2 rounded bg-blue-500 opacity-80" /> Production / tour</span>
                  <span className="flex items-center gap-1"><span className="block w-0.5 h-3 bg-red-400" /> Consommation estimée</span>
                </div>

                {/* Mining */}
                {miningItems.length > 0 && (
                  <>
                    <SectionTitle icon="⛏️" title="Extraction minière" />
                    {miningItems.map(d => (
                      <ItemBar key={d.label} {...d} maxVal={miningMax} />
                    ))}
                  </>
                )}

                {/* Agriculture */}
                <SectionTitle icon="🌾" title="Cultures agricoles" />
                {agriItems.map(d => (
                  <ItemBar key={d.label} {...d} maxVal={agriMax} />
                ))}

                {/* Livestock */}
                {livestockItems.length > 0 && (
                  <>
                    <SectionTitle icon="🐄" title="Élevage" />
                    {livestockItems.map(d => (
                      <ItemBar key={d.label} {...d} maxVal={livestockMax} />
                    ))}
                  </>
                )}

                {/* Marine */}
                {(fishProduction > 0 || fishConsumption > 0) && (
                  <>
                    <SectionTitle icon="🎣" title="Pêche & Aquaculture" />
                    <ItemBar icon="🐟" label="Poissons" production={fishProduction} consumption={fishConsumption} maxVal={Math.max(fishProduction, fishConsumption, 1)} />
                  </>
                )}

                {/* Manufactured Goods (physical goods output) */}
                {mfgItems.length > 0 && (
                  <>
                    <SectionTitle icon="🏭" title="Biens manufacturés (u./tour)" />
                    {mfgItems.map(d => (
                      <ItemBar key={d.label} {...d} maxVal={mfgMax} />
                    ))}
                  </>
                )}


                <p className="text-[9px] text-slate-400 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  Estimations calculées depuis votre état actuel. Valeurs réelles affichées en résolution.
                </p>
              </motion.div>
            )}

            {/* ── STOCKS TAB ── */}
            {tab === 'resources' && (
              <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {stockSections.map(section => (
                  <StockSection
                    key={section.id}
                    label={section.label}
                    items={section.items}
                  />
                ))}
              </motion.div>
            )}

            {/* ── BESOINS TAB ── */}
            {tab === 'needs' && (
              <motion.div key="needs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Stock + production − consommation/tour. Tant que le solde est positif, aucun besoin urgent.
                </p>
                {needsDeduped.map(n => {
                  const netPerTurn = n.production - n.need
                  const hasStock  = n.stock !== undefined

                  // For physical resources: covered if stock + production >= need
                  const covered   = hasStock
                    ? (n.stock! + n.production) >= n.need
                    : netPerTurn >= 0
                  const noProduction = n.production === 0 && n.need > 0

                  // Turns of autonomy when in deficit
                  const turnsLeft = hasStock && !covered && n.need > 0
                    ? Math.floor(n.stock! / Math.max(1, n.need - n.production))
                    : null

                  const borderColor = noProduction && !hasStock
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20'
                    : covered
                      ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-red-200 dark:border-red-800/40 bg-red-50/40 dark:bg-red-950/20'

                  return (
                    <div key={n.label} className={`rounded-xl border p-3 flex items-center gap-3 ${borderColor}`}>
                      <span className="text-xl">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.label}</p>
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-[9px]">
                          {hasStock && (
                            <span className="text-slate-500">Stock: <strong>{Math.round(n.stock!)}</strong></span>
                          )}
                          <span className="text-blue-500">+{Math.round(n.production)}/tour</span>
                          <span className="text-red-400">−{Math.round(n.need)}/tour</span>
                          {netPerTurn !== 0 && (
                            <span className={netPerTurn > 0 ? 'text-emerald-500' : 'text-orange-400'}>
                              ({netPerTurn > 0 ? '+' : ''}{Math.round(netPerTurn)}/tour)
                            </span>
                          )}
                        </div>
                        {turnsLeft !== null && (
                          <p className="text-[9px] text-red-400 mt-0.5">⏳ {turnsLeft} tour{turnsLeft !== 1 ? 's' : ''} d'autonomie</p>
                        )}
                        {!covered && n.deficit && (
                          <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5 font-semibold">⚠ {n.deficit}</p>
                        )}
                      </div>
                      <div className={`text-sm font-black shrink-0 text-right ${
                        noProduction && !hasStock ? 'text-slate-400'
                          : covered ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {noProduction && !hasStock ? '—'
                          : covered ? '✓'
                          : '⚠️'}
                      </div>
                    </div>
                  )
                })}

                {/* GDP / Military balance */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mt-2">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Équilibre budgétaire</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">PIB (revenu estimé)</span>
                      <span className="font-bold text-emerald-600">+{state.gdp.toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Maintenance militaire</span>
                      <span className="font-bold text-red-500">−{state.military.maintenanceCost}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">Solde net</span>
                      <span className={`font-black ${state.gdp - state.military.maintenanceCost >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {(state.gdp - state.military.maintenanceCost >= 0 ? '+' : '')}{(state.gdp - state.military.maintenanceCost).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Infrastructure — current levels & actual effects */}
                {(() => {
                  const { electricity, telecom, waterTreatment } = state.infrastructure
                  const avg = (electricity + telecom + waterTreatment) / 3
                  const elecPct  = Math.round((0.5 + 0.5 * electricity / 100) * 100)
                  const resMult  = (1 + telecom / 200).toFixed(2)
                  const facMult  = (0.5 + avg / 100).toFixed(2)
                  const wLive    = waterTreatment >= 40
                  const wMarine  = waterTreatment >= 30
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">⚡ Infrastructure — effets actifs</p>
                      {[
                        {
                          icon: '⚡', label: 'Électricité', level: electricity,
                          effect: `Mines à ${elecPct}%`,
                          hint: 'À 0% → mines à 50%. À 100% → mines à pleine capacité.',
                          color: electricity >= 70 ? 'bg-emerald-500' : electricity >= 40 ? 'bg-amber-500' : 'bg-red-500',
                          textColor: electricity >= 70 ? 'text-emerald-600' : electricity >= 40 ? 'text-amber-600' : 'text-red-600',
                        },
                        {
                          icon: '📡', label: 'Télécom', level: telecom,
                          effect: `Recherche ×${resMult} /tour`,
                          hint: 'Formule : 1 + télécom/200. À 100% → +50% points de recherche.',
                          color: telecom >= 70 ? 'bg-emerald-500' : telecom >= 40 ? 'bg-amber-500' : 'bg-red-500',
                          textColor: telecom >= 70 ? 'text-emerald-600' : telecom >= 40 ? 'text-amber-600' : 'text-red-600',
                        },
                        {
                          icon: '💧', label: 'Traitement eau', level: waterTreatment,
                          effect: `Élevage ${wLive ? '✓ plein' : `⚠ ${Math.round(waterTreatment/40*100)}%`} — Pêche ${wMarine ? '✓' : `⚠ ${Math.round(waterTreatment/30*100)}%`}`,
                          hint: 'Seuil élevage : 40. Seuil pêche : 30. En-dessous → rendement réduit.',
                          color: wLive ? 'bg-emerald-500' : waterTreatment >= 20 ? 'bg-amber-500' : 'bg-red-500',
                          textColor: wLive ? 'text-emerald-600' : waterTreatment >= 20 ? 'text-amber-600' : 'text-red-600',
                        },
                      ].map(item => (
                        <div key={item.label} className="space-y-0.5 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{item.icon} {item.label} — {item.level}/100</span>
                            <span className={`font-black ${item.textColor} dark:${item.textColor}`}>{item.effect}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.level}%` }} />
                          </div>
                          <p className="text-[9px] text-slate-500">{item.hint}</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-400">🏭 Multiplicateur global usines (moy. {Math.round(avg)}/100)</span>
                        <span className={`font-black ${parseFloat(facMult) >= 1.0 ? 'text-emerald-600' : parseFloat(facMult) >= 0.75 ? 'text-amber-600' : 'text-red-600'}`}>×{facMult}</span>
                      </div>
                    </div>
                  )
                })()}

                {/* General rules reminder */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 p-3">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">Règles générales</p>
                  <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-400">
                    <p>📉 Bonheur &lt; 70% → productivité réduite (plancher 50%) → <strong>moins de revenus</strong></p>
                    <p>😟 Bonheur &lt; 40% → <strong>population en déclin</strong> malgré natalité</p>
                    <p>🔗 Les usines aval (téléphones, ordis) consomment les produits des usines amont (composants, acier)</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── POPULATION TAB ── */}
            {tab === 'population' && (
              <motion.div key="pop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">

                {/* Population size impact */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2">
                  <p className="text-xs font-black text-blue-800 dark:text-blue-300">📊 Effet de la taille ({state.population.total.toFixed(1)}M hab.)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">👷 Main d'œuvre</span><span className="font-bold text-blue-600 dark:text-blue-400">↑ prod. proportionnelle</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">🍞 Nourriture /tour</span><span className="font-bold text-red-500">−{Math.round(state.population.total * 11.1)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">💊 Médicaments /tour</span><span className="font-bold text-red-500">−{Math.round(state.population.total * 0.5)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">⚡ Énergie (budget)</span><span className="font-bold text-red-500">−{Math.round(state.population.total * 8)}$/t</span></div>
                  </div>
                  <p className="text-[9px] text-blue-700 dark:text-blue-400 border-t border-blue-200 dark:border-blue-800/30 pt-1">
                    ↑ Pop = ↑ production (mines, usines, fermes) ET ↑ consommation. L'optimum dépend de votre industrialisation. Croissance si bonheur ≥ 60 + santé ≥ 50.
                  </p>
                </div>

                {/* Population totale — clickable card */}
                {(() => {
                  const isOpen = openPopCard === 'totalPop'
                  return (
                    <button
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => togglePopCard('totalPop')}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">👥 Population totale</p>
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">{state.population.total.toLocaleString('fr-FR')}</span>
                          <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </div>
                      {isOpen && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                          Une grande population produit davantage (plus de travailleurs dans les usines, mines et fermes), mais consomme proportionnellement plus en nourriture, énergie et médicaments. ↑ Pop. = ↑ production ET ↑ consommation. La croissance démographique dépend du bonheur + santé.
                        </p>
                      )}
                    </button>
                  )
                })()}

                {/* Development Index */}
                {(() => {
                  const id = state.population.developmentIndex ?? 30
                  const idColor = id >= 70 ? 'text-emerald-600 dark:text-emerald-400' : id >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  const tier = id >= 70 ? 'Développé' : id >= 45 ? 'Émergent' : 'En développement'
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">🌍 Indice de Développement</p>
                        <span className={`text-sm font-black ${idColor}`}>{id} <span className="text-[10px] font-normal">{tier}</span></span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${id >= 70 ? 'bg-emerald-500' : id >= 45 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${id}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        Formule : santé×0.40 + bonheur×0.30 + éducation×0.20 + infra×0.10
                      </p>
                    </div>
                  )
                })()}

                {/* Needs Satisfaction */}
                {(() => {
                  const ns = state.population.needsSatisfaction ?? 60
                  const nsColor = ns >= 70 ? 'text-emerald-600 dark:text-emerald-400' : ns >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">🍞 Satisfaction des besoins</p>
                        <span className={`text-sm font-black ${nsColor}`}>{ns}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${ns >= 70 ? 'bg-emerald-500' : ns >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${ns}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        Santé (40%) + eau disponible (35%) + environnement propre (25%). Impacte la mortalité.
                      </p>
                    </div>
                  )
                })()}

                {/* Productivity breakdown */}
                {(() => {
                  const prod = state.population.productivityMultiplier
                  const prodPct = Math.round(prod * 100)
                  const prodColor = prod >= 0.90 ? 'text-emerald-600 dark:text-emerald-400' : prod >= 0.75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  const barColor = prod >= 0.90 ? 'bg-emerald-500' : prod >= 0.75 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">⚡ Productivité globale</p>
                        <span className={`text-sm font-black ${prodColor}`}>×{Math.round(prod * 100) / 100} <span className="text-[10px] font-normal">({prodPct}%)</span></span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, prodPct)}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        ≥70% bonheur = 100% productivité. En dessous : baisse linéaire (plancher 50%).
                        {prod < 1.0 && <span className="text-amber-500 dark:text-amber-400"> — augmentez le bonheur pour restaurer la pleine capacité</span>}
                      </p>
                    </div>
                  )
                })()}

                {/* Birth / Mortality / Net growth */}
                {(() => {
                  const br = (state.population.birthRate ?? 0.02) * 100
                  const mr = (state.population.mortalityRate ?? 0.008) * 100
                  const net = br - mr
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">👶 Démographie par tour</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 py-2">
                          <div className="font-black text-emerald-600 dark:text-emerald-400">+{Math.round(br * 100) / 100}%</div>
                          <div className="text-slate-500 mt-0.5">Natalité</div>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 py-2">
                          <div className="font-black text-red-600 dark:text-red-400">−{Math.round(mr * 100) / 100}%</div>
                          <div className="text-slate-500 mt-0.5">Mortalité</div>
                        </div>
                        <div className={`rounded-lg py-2 ${net >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-orange-50 dark:bg-orange-950/30'}`}>
                          <div className={`font-black ${net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{net >= 0 ? '+' : ''}{Math.round(net * 100) / 100}%</div>
                          <div className="text-slate-500 mt-0.5">Croissance</div>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        Natalité ↓ avec l'Indice de Dévpt. Mortalité ↑ si santé et besoins sont bas.
                      </p>
                    </div>
                  )
                })()}

                {/* Happiness — clickable explanation card */}
                {(() => {
                  const isOpen = openPopCard === 'happiness'
                  const val = Math.round(state.happiness)
                  const color = val >= 70 ? 'text-emerald-600 dark:text-emerald-400' : val >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  return (
                    <button
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => togglePopCard('happiness')}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">😊 Bonheur</p>
                        <span className="flex items-center gap-2">
                          <span className={`text-sm font-black ${color}`}>{val}%</span>
                          <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </div>
                      {isOpen && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                          ≥70% de bonheur = productivité à 100%. En dessous, la productivité baisse progressivement (plancher : 50%). Même à très bas bonheur, vos usines tournent encore — vous pouvez toujours rebondir. Pour améliorer : santé, réduire la pollution, nourrir la population.
                        </p>
                      )}
                    </button>
                  )
                })()}

                {/* Health — clickable explanation card */}
                {(() => {
                  const isOpen = openPopCard === 'health'
                  const val = Math.round(state.health)
                  const color = val >= 70 ? 'text-emerald-600 dark:text-emerald-400' : val >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  return (
                    <button
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => togglePopCard('health')}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">🏥 Santé</p>
                        <span className="flex items-center gap-2">
                          <span className={`text-sm font-black ${color}`}>{val}%</span>
                          <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </div>
                      {isOpen && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                          La santé impacte directement la mortalité de votre population (santé basse = plus de décès) et la satisfaction des besoins (santé haute = besoins mieux couverts). En-dessous de 50%, la population décroît rapidement. Améliorez la santé via les usines pharmaceutiques et les infrastructures médicales.
                        </p>
                      )}
                    </button>
                  )
                })()}

                {/* Pollution — clickable explanation card */}
                {(() => {
                  const isOpen = openPopCard === 'pollution'
                  const val = Math.round(state.pollution)
                  const invertedVal = Math.max(0, 100 - val)
                  const color = invertedVal >= 70 ? 'text-emerald-600 dark:text-emerald-400' : invertedVal >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  return (
                    <button
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => togglePopCard('pollution')}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">🌿 Pollution</p>
                        <span className="flex items-center gap-2">
                          <span className={`text-sm font-black ${color}`}>{val} <span className="text-[10px] font-normal">pts</span></span>
                          <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </div>
                      {isOpen && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                          La pollution détériore progressivement la santé et le bonheur. Chaque point de pollution réduit l'indice de santé et entraîne une baisse de productivité en cascade. Sources : industries lourdes, mines sans équipement propre. Réduire la pollution nécessite des investissements en technologies vertes.
                        </p>
                      )}
                    </button>
                  )
                })()}

                {/* Consumption demand by sector */}
                {(() => {
                  const cm = state.population.consumptionMultiplier ?? 0.72
                  const id = state.population.developmentIndex ?? 30
                  const t = id / 100
                  const energyMult = Math.round((0.30 + 1.40 * Math.pow(t, 0.85)) * 100) / 100
                  const foodMult   = Math.round((0.30 + 1.20 * Math.pow(t, 0.70)) * 100) / 100
                  const healthMult = Math.round((0.40 + 0.90 * Math.pow(t, 0.65)) * 100) / 100
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">🛍️ Exigences consommation</p>
                        <span className="text-[10px] text-slate-500">×{Math.round(cm * 100) / 100} global</span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { icon: '⚡', label: 'Énergie',     mult: energyMult, color: 'bg-yellow-400' },
                          { icon: '💊', label: 'Santé',       mult: healthMult, color: 'bg-blue-400' },
                          { icon: '🍞', label: 'Alimentation', mult: foodMult,  color: 'bg-amber-400' },
                        ].map(({ icon, label, mult, color }) => (
                          <div key={label} className="flex items-center gap-2 text-[10px]">
                            <span className="w-4">{icon}</span>
                            <span className="w-14 text-slate-600 dark:text-slate-400">{label}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, mult / 1.70 * 100)}%` }} />
                            </div>
                            <span className="w-10 text-right font-bold text-slate-700 dark:text-slate-300">×{Math.round(mult * 100) / 100}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        Plus votre pays est développé, plus votre population exige. Si la production ne suit pas, le bonheur baisse.
                      </p>
                    </div>
                  )
                })()}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
