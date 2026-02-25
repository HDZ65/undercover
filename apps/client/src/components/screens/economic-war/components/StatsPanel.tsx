import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { EcoWarPrivatePlayerState, IndustrySector } from '@undercover/shared'

// ─── Constants mirrored from server ──────────────────────────

const FACTORY_BASE_INCOME: Record<string, number> = {
  rawMaterials:  80,
  energy:       120,
  manufacturing: 100,
  electronics:  180,
  pharmaceutical: 160,
  armament:     200,
  luxury:       140,
  food:          70,
}

const TIER_MULT: Record<string, number> = {
  basic: 1.0,
  advanced: 1.8,
  robotized: 3.0,
}

const TOOL_MULT: Record<string, number> = {
  basic: 1.2,
  advanced: 1.5,
  robotized: 2.0,
}

const SECTOR_LABELS: Record<string, { label: string; icon: string }> = {
  rawMaterials:   { label: 'Matières premières', icon: '⛏️' },
  energy:         { label: 'Énergie',             icon: '⚡' },
  manufacturing:  { label: 'Manufacture',          icon: '🏭' },
  electronics:    { label: 'Électronique',          icon: '💻' },
  pharmaceutical: { label: 'Pharmaceutique',        icon: '💊' },
  armament:       { label: 'Armement',              icon: '🔫' },
  luxury:         { label: 'Luxe',                  icon: '💎' },
  food:           { label: 'Agroalimentaire',       icon: '🌾' },
}

// ─── Helpers ──────────────────────────────────────────────────

function estimateSectorProduction(
  state: EcoWarPrivatePlayerState,
  sector: IndustrySector,
): number {
  const toolMult = TOOL_MULT[state.tools?.tier ?? 'basic'] ?? 1.2
  return state.factories
    .filter(f => f.sector === sector)
    .reduce((sum, f) => {
      const base = FACTORY_BASE_INCOME[f.sector] ?? 100
      const tierM = TIER_MULT[f.tier] ?? 1.0
      const healthM = f.health / 100
      return sum + base * tierM * healthM * toolMult
    }, 0)
}

/** Approximate need per sector per turn (rough economic model) */
function estimateSectorNeed(
  state: EcoWarPrivatePlayerState,
  sector: IndustrySector,
): number {
  const pop = state.population.total // millions
  switch (sector) {
    case 'food':          return pop * 25           // food demand scales with population
    case 'energy':        return state.factories.length * 20 + pop * 8
    case 'pharmaceutical': return pop * 6 + (100 - state.health) * 2
    case 'manufacturing': return state.gdp * 0.08
    case 'electronics':   return state.research.globalLevel * 3 + pop * 2
    case 'armament':      return state.military.maintenanceCost * 0.5
    case 'rawMaterials':  return state.factories.length * 15
    case 'luxury':        return pop * (state.happiness / 100) * 10
    default:              return 0
  }
}

// ─── Bar Chart ────────────────────────────────────────────────

function SectorBar({
  sector,
  production,
  need,
  maxVal,
}: {
  sector: string
  production: number
  need: number
  maxVal: number
}) {
  const meta = SECTOR_LABELS[sector] ?? { label: sector, icon: '🏭' }
  const prodPct = Math.min(100, (production / maxVal) * 100)
  const needPct = Math.min(100, (need / maxVal) * 100)
  const surplus = production - need
  const surplusColor = surplus >= 0 ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {meta.icon} {meta.label}
        </span>
        <span className={`font-black ${surplusColor}`}>
          {surplus >= 0 ? '+' : ''}{Math.round(surplus)}
        </span>
      </div>
      <div className="relative h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        {/* Production bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-blue-500 opacity-80"
          style={{ width: `${prodPct}%` }}
        />
        {/* Need line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-400"
          style={{ left: `${needPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
        <span>Production: {Math.round(production)}</span>
        <span className="text-red-400">Besoin: {Math.round(need)}</span>
      </div>
    </div>
  )
}

// ─── Resource Bar ─────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────

interface StatsPanelProps {
  state: EcoWarPrivatePlayerState
  onClose: () => void
}

export function StatsPanel({ state, onClose }: StatsPanelProps) {
  const [tab, setTab] = useState<'production' | 'resources' | 'needs'>('production')

  const sectors = Object.keys(SECTOR_LABELS) as IndustrySector[]

  // Production data
  const sectorData = sectors.map(s => ({
    sector: s,
    production: estimateSectorProduction(state, s),
    need: estimateSectorNeed(state, s),
  }))
  const maxProd = Math.max(...sectorData.map(d => Math.max(d.production, d.need)), 1)

  // Needs summary
  const needs = [
    { label: 'Nourriture',        icon: '🌾', need: estimateSectorNeed(state, 'food'),          production: estimateSectorProduction(state, 'food') },
    { label: 'Énergie',           icon: '⚡', need: estimateSectorNeed(state, 'energy'),         production: estimateSectorProduction(state, 'energy') },
    { label: 'Santé',             icon: '💊', need: estimateSectorNeed(state, 'pharmaceutical'), production: estimateSectorProduction(state, 'pharmaceutical') },
    { label: 'Militaire',         icon: '⚔️', need: state.military.maintenanceCost,              production: 0 },
    { label: 'Infra. (moy.)',     icon: '🏗️', need: 60,                                          production: Math.round((state.infrastructure.electricity + state.infrastructure.telecom + state.infrastructure.waterTreatment) / 3) },
  ]

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
          {([['production', '🏭 Production'], ['resources', '🛢️ Ressources'], ['needs', '📋 Besoins']] as const).map(([key, label]) => (
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
          <AnimatePresence mode="wait">
            {tab === 'production' && (
              <motion.div key="prod" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center gap-3 text-[9px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><span className="block w-3 h-2 rounded bg-blue-500 opacity-80" /> Production estimée</span>
                  <span className="flex items-center gap-1"><span className="block w-0.5 h-3 bg-red-400" /> Besoin</span>
                </div>
                {sectorData.map(d => (
                  <SectorBar key={d.sector} {...d} maxVal={maxProd} />
                ))}
                <p className="text-[9px] text-slate-400 mt-1">
                  Production estimée depuis {state.factories.length} usine(s). Valeur réelle affichée en résolution.
                </p>
              </motion.div>
            )}

            {tab === 'resources' && (
              <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <ResourceBar icon="🛢️" label="Pétrole"   value={state.resources.oil}          max={500} />
                <ResourceBar icon="⛏️" label="Minerais"  value={state.resources.minerals}      max={500} />
                <ResourceBar icon="🌾" label="Agri."     value={state.resources.agriculture}   max={500} />
                <ResourceBar icon="💧" label="Eau"       value={state.resources.water}         max={500} />
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Infrastructure</p>
                  <ResourceBar icon="⚡" label="Électricité"  value={state.infrastructure.electricity}    max={100} />
                  <ResourceBar icon="📡" label="Télécom"      value={state.infrastructure.telecom}        max={100} />
                  <ResourceBar icon="💧" label="Traitement eau" value={state.infrastructure.waterTreatment} max={100} />
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Population</p>
                  <ResourceBar icon="😊" label={`Bonheur (${Math.round(state.happiness)}%)`}   value={state.happiness}                          max={100} />
                  <ResourceBar icon="🏥" label={`Santé (${Math.round(state.health)}%)`}        value={state.health}                             max={100} />
                  <ResourceBar icon="🌿" label={`Pollution — bas = bien`}                      value={Math.max(0, 100 - state.pollution)}        max={100} />
                </div>
              </motion.div>
            )}

            {tab === 'needs' && (
              <motion.div key="needs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Vos besoins estimés par tour ce manche — une sur-production (vert) laisse une marge de sécurité.
                </p>
                {needs.map(n => {
                  const surplus = n.production - n.need
                  const ok = surplus >= 0
                  return (
                    <div key={n.label} className={`rounded-xl border p-3 flex items-center gap-3 ${
                      ok
                        ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-red-200 dark:border-red-800/40 bg-red-50/40 dark:bg-red-950/20'
                    }`}>
                      <span className="text-2xl">{n.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.label}</p>
                        <div className="flex gap-3 mt-0.5 text-[10px]">
                          <span className="text-blue-600 dark:text-blue-400">Dispo: {Math.round(n.production)}</span>
                          <span className="text-red-500">Besoin: {Math.round(n.need)}</span>
                        </div>
                      </div>
                      <div className={`text-sm font-black ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {ok ? '✓' : '⚠️'}
                        <span className="text-[10px] block">{ok ? `+${Math.round(surplus)}` : Math.round(surplus)}</span>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
