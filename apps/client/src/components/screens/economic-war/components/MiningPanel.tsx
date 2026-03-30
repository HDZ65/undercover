import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import type {
  EcoWarPrivatePlayerState,
  MineralDeposit,
  MineralType,
  FarmPlot,
  CropCategory,
  HerdUnit,
  LivestockCategory,
  MarineState,
} from '@undercover/shared'
import { MINERAL_TYPES } from '@undercover/shared'

// ─── Mining constants (mirrored from server/constants.ts) ─────

type MiningRes = 'oil' | MineralType

const MAX_RESERVES: Record<MiningRes, number> = {
  oil:        5000,
  iron:       4500,
  coal:       5000,
  rareEarths: 2500,
  precious:   2000,
  uranium:    1500,
}

const MACHINE_BASE_COST: Record<MiningRes, number> = {
  oil:        500,
  iron:       300,
  coal:       280,
  rareEarths: 500,
  precious:   450,
  uranium:    700,
}

const REFINERY_COST_TABLE: Record<MiningRes, number> = {
  oil:        1500,
  iron:       1000,
  coal:       900,
  rareEarths: 1500,
  precious:   1400,
  uranium:    2000,
}

const BASE_RATE_TABLE: Record<MiningRes, number> = {
  oil:        20,
  iron:       35,
  coal:       40,
  rareEarths: 15,
  precious:   10,
  uranium:    8,
}

const POLLUTION_RATE_TABLE: Record<MiningRes, number> = {
  oil:        0.060,
  iron:       0.025,
  coal:       0.055,
  rareEarths: 0.020,
  precious:   0.030,
  uranium:    0.100,
}

const RESOURCE_LABEL: Record<MiningRes, string> = {
  oil:        '🛢️ Pétrole',
  iron:       '🔩 Fer',
  coal:       '🪨 Charbon',
  rareEarths: '✨ Terres rares',
  precious:   '💛 Métaux précieux',
  uranium:    '☢️ Uranium',
}

function nextMachineCost(machines: number, res: MiningRes): number {
  return Math.round(MACHINE_BASE_COST[res] * (1 + machines * 0.6))
}

function refineryCost(res: MiningRes): number {
  return REFINERY_COST_TABLE[res]
}

function computeExtraction(deposit: MineralDeposit, electricity: number, res: MiningRes): number {
  if (deposit.machines === 0) return 0
  const infraFactor   = 0.5 + 0.5 * (electricity / 100)
  const refineryBonus = deposit.hasRefinery ? 1.30 : 1.0
  return Math.min(deposit.underground, Math.round(deposit.machines * BASE_RATE_TABLE[res] * infraFactor * refineryBonus))
}

function computePollution(deposit: MineralDeposit, extraction: number, cleanEnergy: number, res: MiningRes): number {
  if (extraction === 0) return 0
  const cleanMod = Math.max(0.5, 1 - cleanEnergy / 200)
  const refinMod = deposit.hasRefinery ? 0.70 : 1.0
  return Math.round(extraction * POLLUTION_RATE_TABLE[res] * cleanMod * refinMod * 10) / 10
}

// ─── Agriculture constants (mirrored from server/constants.ts) ─

const EQUIP_EXPLOITATION: Record<string, number> = { basic: 50, mechanized: 75, advanced: 95 }
const EQUIP_YIELD_MULT:   Record<string, number> = { basic: 0.70, mechanized: 1.15, advanced: 1.80 }
const BASE_YIELD: Record<CropCategory, number>   = { cereals: 8, vegetables: 6, sugarOils: 5, fodder: 7 }
const UPGRADE_COST: Record<string, number>       = { basic: 800, mechanized: 2000 }
const IRRIGATION_COST = 400
const IRRIGATION_MAX  = 100

function computePlotProduction(plot: FarmPlot, irrigationLevel: number): number {
  const exploitation  = plot.inFallow ? 30 : (EQUIP_EXPLOITATION[plot.equipment] ?? 50)
  const fertilityMult = 0.30 + 0.70 * (plot.fertility / 100)
  const equipMult     = EQUIP_YIELD_MULT[plot.equipment] ?? 0.70
  const irrigBonus    = 1.0 + irrigationLevel / 200
  return Math.round(plot.surface * (exploitation / 100) * fertilityMult * equipMult * BASE_YIELD[plot.category] * irrigBonus)
}

function cropLabel(category: CropCategory): string {
  switch (category) {
    case 'cereals':    return '🌾 Céréales'
    case 'vegetables': return '🥦 Légumes'
    case 'sugarOils':  return '🌻 Sucre/Oléagineux'
    case 'fodder':     return '🌿 Fourrage'
  }
}

function equipLabel(level: string): string {
  switch (level) {
    case 'advanced':   return 'Avancé'
    case 'mechanized': return 'Mécanisé'
    default:           return 'Basique'
  }
}

// ─── Mining sub-component ─────────────────────────────────────

interface DepositCardProps {
  res: MiningRes
  deposit: MineralDeposit
  electricity: number
  cleanEnergy: number
  money: number
  onBuyMachine: () => void
  onBuyRefinery: () => void
}

function DepositCard({ res, deposit, electricity, cleanEnergy, money, onBuyMachine, onBuyRefinery }: DepositCardProps) {
  const maxReserve   = MAX_RESERVES[res]
  const reservePct   = Math.min(100, Math.round((deposit.underground / maxReserve) * 100))
  const extraction   = computeExtraction(deposit, electricity, res)
  const pollution    = computePollution(deposit, extraction, cleanEnergy, res)
  const machineCost  = nextMachineCost(deposit.machines, res)
  const refinery     = refineryCost(res)
  const canMachine   = money >= machineCost && deposit.machines < 10
  const canRefinery  = money >= refinery && !deposit.hasRefinery

  const reserveColor     = reservePct > 50 ? 'bg-emerald-500' : reservePct > 20 ? 'bg-amber-500' : 'bg-red-500'
  const reserveTextColor = reservePct > 50 ? 'text-emerald-600 dark:text-emerald-400' : reservePct > 20 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  const label = RESOURCE_LABEL[res]

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-black text-slate-900 dark:text-slate-100">{label}</span>
        <span className={`text-xs font-bold ${reserveTextColor}`}>
          {Math.round(deposit.underground).toLocaleString('fr-FR')} / {maxReserve.toLocaleString('fr-FR')} u
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Reserve gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Réserves souterraines</span>
            <span className={reserveTextColor}>{reservePct}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${reserveColor}`} style={{ width: `${reservePct}%` }} />
          </div>
          {reservePct < 20 && (
            <p className="text-[10px] text-red-500 font-semibold">
              ⚠️ Réserves critiques — l'extraction ralentira bientôt
            </p>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-center">
            <div className="text-sm font-black text-blue-700 dark:text-blue-300">
              {extraction > 0 ? `+${extraction}` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {extraction > 0 ? 'unités/tour' : 'Aucune machine'}
            </div>
          </div>
          <div className={`rounded-lg px-3 py-2 text-center ${pollution > 3 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
            <div className={`text-sm font-black ${pollution > 3 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {pollution > 0 ? `+${pollution}` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">pollution/tour</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            {deposit.machines} machine{deposit.machines !== 1 ? 's' : ''}
          </span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${deposit.hasRefinery ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {deposit.hasRefinery ? '✓ Raffinerie' : '✗ Pas de raffinerie'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
            Infra ×{(0.5 + 0.5 * (electricity / 100)).toFixed(2)}
          </span>
        </div>

        {pollution > 3 && (
          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 px-3 py-2">
            <p className="text-[10px] text-orange-700 dark:text-orange-300 font-semibold">
              🌿 Extraction intensive — construisez une raffinerie (−30% pollution) ou investissez en énergie propre.
            </p>
          </div>
        )}

        {deposit.machines === 0 && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              ℹ️ Aucune machine — vos réserves ne sont pas exploitées. Achetez via <strong>Investir</strong>.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Machine */}
          <div className="relative group">
            <button
              disabled={!canMachine}
              onClick={onBuyMachine}
              className={`w-full px-3 py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
                canMachine
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              + Machine
              <span className="block font-normal opacity-80">{machineCost.toLocaleString('fr-FR')} $</span>
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
              <p className="font-bold mb-1">Machine d'extraction</p>
              <p>Extrait <strong>{BASE_RATE_TABLE[res]} unités/tour</strong> × bonus infrastructure × raffinerie.</p>
              <p className="mt-1 text-slate-300">Max 10 machines par gisement. Le coût augmente à chaque achat.</p>
              {deposit.machines >= 10 && <p className="mt-1 text-amber-400 font-semibold">Capacité maximale atteinte.</p>}
            </div>
          </div>

          {/* Raffinerie */}
          <div className="relative group">
            <button
              disabled={!canRefinery}
              onClick={onBuyRefinery}
              className={`w-full px-3 py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
                deposit.hasRefinery
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                  : canRefinery
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {deposit.hasRefinery ? '✓ Raffinerie' : 'Raffinerie'}
              {!deposit.hasRefinery && (
                <span className="block font-normal opacity-80">{refinery.toLocaleString('fr-FR')} $</span>
              )}
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
              <p className="font-bold mb-1">Raffinerie</p>
              <p><strong>+30% d'extraction</strong> et <strong>−30% de pollution</strong> pour ce gisement.</p>
              <p className="mt-1 text-slate-300">Construction unique, permanente. Rentable si vous avez ≥3 machines.</p>
              {deposit.hasRefinery && <p className="mt-1 text-emerald-400 font-semibold">Déjà construite.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Agriculture sub-component ────────────────────────────────

interface FarmPlotRowProps {
  plot: FarmPlot
  irrigationLevel: number
  money: number
  onUpgrade: () => void
  onToggleFallow: () => void
}

function FarmPlotRow({ plot, irrigationLevel, money, onUpgrade, onToggleFallow }: FarmPlotRowProps) {
  const production   = computePlotProduction(plot, irrigationLevel)
  const exploitation = plot.inFallow ? 30 : (EQUIP_EXPLOITATION[plot.equipment] ?? 50)
  const fertilityPct = Math.round(plot.fertility)
  const upgradeCost  = UPGRADE_COST[plot.equipment] ?? 0
  const canUpgrade   = plot.equipment !== 'advanced' && money >= upgradeCost

  const fertColor = fertilityPct > 60
    ? 'bg-emerald-500'
    : fertilityPct > 30
      ? 'bg-amber-500'
      : 'bg-red-500'
  const fertText = fertilityPct > 60
    ? 'text-emerald-600 dark:text-emerald-400'
    : fertilityPct > 30
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-black text-slate-900 dark:text-slate-100">{cropLabel(plot.category)}</span>
        <span className="text-[10px] text-slate-500">
          {plot.surface} ha · {exploitation}% exploitation
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Fertility gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Fertilité</span>
            <span className={fertText}>{fertilityPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fertColor}`}
              style={{ width: `${fertilityPct}%` }}
            />
          </div>
          {fertilityPct < 30 && (
            <p className="text-[10px] text-red-500 font-semibold">
              ⚠️ Fertilité critique — mettez en jachère pour récupérer
            </p>
          )}
        </div>

        {/* Production metric */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 text-center">
            <div className="text-sm font-black text-green-700 dark:text-green-300">
              {production > 0 ? `+${production}` : '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">agriculture/tour</div>
          </div>
          <div className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-center">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {equipLabel(plot.equipment)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">équipement</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {/* Upgrade button */}
          <div className="relative group">
            <button
              disabled={!canUpgrade && plot.equipment !== 'advanced'}
              onClick={onUpgrade}
              className={`w-full px-3 py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
                plot.equipment === 'advanced'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                  : canUpgrade
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {plot.equipment === 'advanced' ? '✓ Max' : '↑ Améliorer'}
              {plot.equipment !== 'advanced' && (
                <span className="block font-normal opacity-80">{upgradeCost.toLocaleString('fr-FR')} $</span>
              )}
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
              <p className="font-bold mb-1">Améliorer l'équipement</p>
              {plot.equipment === 'basic' && <p>→ <strong>Mécanisé</strong> : exploitation 50%→75%, rendement ×1.15</p>}
              {plot.equipment === 'mechanized' && <p>→ <strong>Avancé</strong> : exploitation 75%→95%, rendement ×1.80</p>}
              {plot.equipment === 'advanced' && <p className="text-emerald-400">Niveau maximal atteint.</p>}
            </div>
          </div>

          {/* Fallow toggle */}
          <div className="relative group">
            <button
              onClick={onToggleFallow}
              className={`w-full px-3 py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
                plot.inFallow
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {plot.inFallow ? '🌱 En jachère' : '🔄 Jachère'}
              <span className="block font-normal opacity-80">{plot.inFallow ? '+0.17 fert/tour' : 'récupérer sols'}</span>
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
              <p className="font-bold mb-1">Jachère</p>
              {plot.inFallow
                ? <p>La parcelle se repose : <strong>+0.17 fertilité/tour</strong>. Production réduite à 30%.</p>
                : <p>Met la parcelle en jachère pour régénérer les sols. Utile si la fertilité est {'<'}40%.</p>
              }
              <p className="mt-1 text-slate-300">Fertilité actuelle : {Math.round(plot.fertility)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Livestock constants (mirrored from server/constants.ts) ──

const LIVESTOCK_EQUIP_EXPLOITATION: Record<string, number> = { basic: 40, mechanized: 65, advanced: 85 }
const LIVESTOCK_EQUIP_YIELD_MULT:   Record<string, number> = { basic: 1.0, mechanized: 1.50, advanced: 2.20 }
const LIVESTOCK_BASE_YIELD: Record<LivestockCategory, number> = { redMeat: 4, whiteMeat: 3, dairy: 3.5 }
const LIVESTOCK_FEED_RATE:  Record<LivestockCategory, number> = { redMeat: 2.0, whiteMeat: 0.8, dairy: 1.2 }
const LIVESTOCK_POLL_RATE:  Record<string, number> = { basic: 0.003, mechanized: 0.005, advanced: 0.009 }
const LIVESTOCK_UPGRADE_COST: Record<LivestockCategory, Record<string, number>> = {
  redMeat:   { basic: 1000, mechanized: 3000 },
  whiteMeat: { basic: 1000, mechanized: 2500 },
  dairy:     { basic: 1000, mechanized: 2500 },
}
const LIVESTOCK_WATER_THRESHOLD = 40

function computeAlimRatios(state: EcoWarPrivatePlayerState) {
  const feedDemand  = state.livestock.herds.reduce((s, h) => s + h.total * LIVESTOCK_FEED_RATE[h.category], 0)
  const feedRatio   = feedDemand <= 0 ? 1 : Math.min(1, (state.resources.fodder ?? 0) / feedDemand)
  const waterRatio  = Math.min(1, state.infrastructure.waterTreatment / LIVESTOCK_WATER_THRESHOLD)
  const alim        = feedRatio * 0.70 + waterRatio * 0.30
  return { feedDemand, feedRatio, waterRatio, alim }
}

function computeHerdProduction(herd: HerdUnit, alim: number): number {
  const productive = herd.total * (LIVESTOCK_EQUIP_EXPLOITATION[herd.equipment] ?? 40) / 100
  return Math.round(productive * LIVESTOCK_BASE_YIELD[herd.category] * (LIVESTOCK_EQUIP_YIELD_MULT[herd.equipment] ?? 1.0) * alim)
}

function herdNextUpgradeCost(herd: HerdUnit): number {
  return LIVESTOCK_UPGRADE_COST[herd.category]?.[herd.equipment] ?? 0
}

function herdLabel(category: LivestockCategory): string {
  switch (category) {
    case 'redMeat':   return '🐄 Viande rouge'
    case 'whiteMeat': return '🐔 Viande blanche'
    case 'dairy':     return '🥛 Lait & Œufs'
  }
}

function livestockEquipLabel(level: string): string {
  switch (level) {
    case 'advanced':   return 'Avancé'
    case 'mechanized': return 'Mécanisé'
    default:           return 'Basique'
  }
}

// ─── Herd card ────────────────────────────────────────────────

interface HerdCardProps {
  herd: HerdUnit
  alim: number
  money: number
  onUpgrade: () => void
}

function HerdCard({ herd, alim, money, onUpgrade }: HerdCardProps) {
  const productive   = Math.round(herd.total * (LIVESTOCK_EQUIP_EXPLOITATION[herd.equipment] ?? 40) / 100)
  const production   = computeHerdProduction(herd, alim)
  const pollution    = Math.round(herd.total * (LIVESTOCK_POLL_RATE[herd.equipment] ?? 0.003) * 10) / 10
  const reproRate    = ((-0.02 + 0.03 * alim) * 100).toFixed(1)
  const upgradeCost  = herdNextUpgradeCost(herd)
  const canUpgrade   = herd.equipment !== 'advanced' && money >= upgradeCost

  // reproduction color
  const reproNum    = parseFloat(reproRate)
  const reproColor  = reproNum > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : reproNum < -0.5
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-400'

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-black text-slate-900 dark:text-slate-100">{herdLabel(herd.category)}</span>
        <span className="text-[10px] text-slate-500">
          {Math.round(herd.total)} animaux
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-2 py-2 text-center">
            <div className="text-sm font-black text-green-700 dark:text-green-300">
              {production > 0 ? `+${production}` : '0'}
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">agri/tour</div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-2 py-2 text-center">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {productive} ({LIVESTOCK_EQUIP_EXPLOITATION[herd.equipment]}%)
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">productifs</div>
          </div>
          <div className={`rounded-lg px-2 py-2 text-center ${pollution > 1.0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
            <div className={`text-xs font-bold ${pollution > 1.0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}>
              +{pollution}
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">pollution</div>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            {livestockEquipLabel(herd.equipment)}
          </span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${reproNum > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'} ${reproColor}`}>
            {reproNum > 0 ? '▲' : '▼'} {reproRate}%/tour
          </span>
        </div>

        {/* Upgrade button */}
        <div className="relative group">
          <button
            disabled={!canUpgrade && herd.equipment !== 'advanced'}
            onClick={onUpgrade}
            className={`w-full py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
              herd.equipment === 'advanced'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                : canUpgrade
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {herd.equipment === 'advanced'
              ? '✓ Équipement maximal'
              : `↑ ${herd.equipment === 'basic' ? 'Mécanisé' : 'Avancé'} — ${upgradeCost.toLocaleString('fr-FR')} $`}
          </button>
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
            <p className="font-bold mb-1">Améliorer l'équipement d'élevage</p>
            {herd.equipment === 'basic' && <p>→ <strong>Mécanisé</strong> : productivité 40%→65%, rendement ×1.5</p>}
            {herd.equipment === 'mechanized' && <p>→ <strong>Avancé</strong> : productivité 65%→85%, rendement ×2.2</p>}
            {herd.equipment === 'advanced' && <p className="text-emerald-400">Niveau maximal atteint.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Marine constants (mirrored from server/constants.ts) ─────

const MARINE_EQUIP_EXPLOITATION: Record<string, number> = { basic: 20, mechanized: 35, advanced: 50 }
const MARINE_EQUIP_YIELD:        Record<string, number> = { basic: 1.0, mechanized: 1.50, advanced: 2.00 }
const MARINE_FEED_RATE_BY_EQUIP: Record<string, number> = { basic: 0.01, mechanized: 0.03, advanced: 0.06 }
const MARINE_POLL_BY_EQUIP:      Record<string, number> = { basic: 0.001, mechanized: 0.003, advanced: 0.006 }
const MARINE_UPGRADE_COST:       Record<string, number> = { basic: 1200, mechanized: 3000 }
const MARINE_PRODUCTIVE_PCT = 0.60
const MARINE_SAFETY_CAP     = 0.80
const MARINE_WATER_THRESHOLD = 30

function computeMarineAlim(state: EcoWarPrivatePlayerState): { feedDemand: number; feedRatio: number; waterRatio: number; alim: number } {
  const { marine } = state
  const feedDemand = marine.stockTotal * (MARINE_FEED_RATE_BY_EQUIP[marine.equipment] ?? 0.01)
  const feedRatio  = feedDemand <= 0 ? 1 : Math.min(1, (state.resources.fodder ?? 0) / feedDemand)
  const waterRatio = Math.min(1, state.infrastructure.waterTreatment / MARINE_WATER_THRESHOLD)
  const alim       = feedRatio * 0.40 + waterRatio * 0.60
  return { feedDemand, feedRatio, waterRatio, alim }
}

function computeMarineProductionPreview(marine: MarineState, alim: number): number {
  const productiveStock = marine.stockTotal * MARINE_PRODUCTIVE_PCT
  const baseExtraction  = productiveStock * ((MARINE_EQUIP_EXPLOITATION[marine.equipment] ?? 20) / 100)
                         * (MARINE_EQUIP_YIELD[marine.equipment] ?? 1.0) * alim
  return Math.round(Math.min(productiveStock * MARINE_SAFETY_CAP, baseExtraction))
}

function marineNextUpgradeCost(equipment: string): number {
  return MARINE_UPGRADE_COST[equipment] ?? 0
}

function marineEquipLabel(level: string): string {
  switch (level) {
    case 'advanced':   return 'Aquaculture avancée'
    case 'mechanized': return 'Pêche semi-industrielle'
    default:           return 'Pêche artisanale'
  }
}

// ─── Marine card ──────────────────────────────────────────────

interface MarineCardProps {
  state: EcoWarPrivatePlayerState
  onUpgrade: () => void
}

function MarineCard({ state, onUpgrade }: MarineCardProps) {
  const { marine } = state
  const { feedDemand, feedRatio, waterRatio, alim } = computeMarineAlim(state)
  const production    = computeMarineProductionPreview(marine, alim)
  const stockMax      = marine.initialStock * 1.5
  const stockMin      = marine.initialStock * 0.15
  const stockPct      = stockMax > 0 ? Math.min(100, Math.round((marine.stockTotal / stockMax) * 100)) : 0
  const pollution     = Math.round(production * (MARINE_POLL_BY_EQUIP[marine.equipment] ?? 0.001) * 10) / 10
  const upgradeCost   = marineNextUpgradeCost(marine.equipment)
  const canUpgrade    = marine.equipment !== 'advanced' && state.money >= upgradeCost

  // Natural growth approximation (at current exploitation)
  const productiveStock  = marine.stockTotal * MARINE_PRODUCTIVE_PCT
  const baseExtraction   = productiveStock * ((MARINE_EQUIP_EXPLOITATION[marine.equipment] ?? 20) / 100)
                          * (MARINE_EQUIP_YIELD[marine.equipment] ?? 1.0) * alim
  const extraction       = Math.min(productiveStock * MARINE_SAFETY_CAP, baseExtraction)
  const exploitRate      = productiveStock > 0 ? extraction / productiveStock : 0
  const naturalGrowth    = 0.020 * (1 - marine.stockTotal / stockMax)
  const fishDepletion    = 0.022 * exploitRate
  const alimMort         = Math.max(0, 0.015 * (0.70 - alim) / 0.70)
  const stockChangeRate  = ((naturalGrowth - fishDepletion - alimMort) * 100).toFixed(2)
  const stockChangePct   = parseFloat(stockChangeRate)

  const stockColor = stockPct > 60
    ? 'bg-emerald-500'
    : stockPct > 30
      ? 'bg-amber-500'
      : 'bg-red-500'
  const stockTextColor = stockPct > 60
    ? 'text-emerald-600 dark:text-emerald-400'
    : stockPct > 30
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  const alimColor     = alim > 0.75 ? 'bg-emerald-500' : alim > 0.50 ? 'bg-amber-500' : 'bg-red-500'
  const alimTextColor = alim > 0.75 ? 'text-emerald-600 dark:text-emerald-400' : alim > 0.50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="space-y-3">
      {/* Stock card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-black text-slate-900 dark:text-slate-100">🐟 Produits de la Mer</span>
          <span className={`text-xs font-bold ${stockTextColor}`}>
            {Math.round(marine.stockTotal).toLocaleString('fr-FR')} u.
          </span>
        </div>

        <div className="p-3 space-y-3">
          {/* Stock gauge */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Stock marin</span>
              <span className={stockTextColor}>{stockPct}% de max</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${stockColor}`} style={{ width: `${stockPct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>Min : {Math.round(stockMin)}</span>
              <span>Max : {Math.round(stockMax)}</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-cyan-50 dark:bg-cyan-950/30 px-2 py-2 text-center">
              <div className="text-sm font-black text-cyan-700 dark:text-cyan-300">
                {production > 0 ? `+${production}` : '0'}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">agri/tour</div>
            </div>
            <div className={`rounded-lg px-2 py-2 text-center ${stockChangePct < -0.5 ? 'bg-red-50 dark:bg-red-950/30' : stockChangePct > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
              <div className={`text-xs font-bold ${stockChangePct < -0.5 ? 'text-red-600 dark:text-red-400' : stockChangePct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {stockChangePct > 0 ? '+' : ''}{stockChangeRate}%
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">stock/tour</div>
            </div>
            <div className={`rounded-lg px-2 py-2 text-center ${pollution > 0.5 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
              <div className={`text-xs font-bold ${pollution > 0.5 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}>
                +{pollution}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">pollution</div>
            </div>
          </div>

          {/* Equipment badge */}
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
              {marineEquipLabel(marine.equipment)}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${stockChangePct >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
              {stockChangePct >= 0 ? '▲' : '▼'} stock {stockChangePct >= 0 ? 'croît' : 'décroît'}
            </span>
          </div>

          {stockPct < 30 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-3 py-2">
              <p className="text-[10px] text-red-700 dark:text-red-300 font-semibold">
                ⚠️ Stocks critiques — surpêche ou mauvaise alimentation. Réduisez l'intensité ou améliorez l'eau.
              </p>
            </div>
          )}

          {/* Upgrade button */}
          <div className="relative group">
            <button
              disabled={!canUpgrade && marine.equipment !== 'advanced'}
              onClick={onUpgrade}
              className={`w-full py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
                marine.equipment === 'advanced'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                  : canUpgrade
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {marine.equipment === 'advanced'
                ? '✓ Aquaculture maximale'
                : `↑ ${marine.equipment === 'basic' ? 'Semi-industriel' : 'Aquaculture'} — ${upgradeCost.toLocaleString('fr-FR')} $`}
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
              <p className="font-bold mb-1">Améliorer la technique de pêche</p>
              {marine.equipment === 'basic' && <p>→ <strong>Pêche semi-industrielle</strong> : exploitation 20%→35%, rendement ×1.5. Nécessite plus de nourriture.</p>}
              {marine.equipment === 'mechanized' && <p>→ <strong>Aquaculture avancée</strong> : exploitation 35%→50%, rendement ×2.0. Nécessite eau propre ≥30.</p>}
              {marine.equipment === 'advanced' && <p className="text-emerald-400">Niveau maximal atteint.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Alimentation block */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">💧 Qualité de l'eau & alimentation</span>
          <span className={`text-xs font-black ${alimTextColor}`}>{Math.round(alim * 100)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${alimColor}`} style={{ width: `${Math.round(alim * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Eau (×0.6) : {Math.round(waterRatio * 100)}%</span>
          <span>Nourriture (×0.4) : {Math.round(feedRatio * 100)}%</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Demande : {feedDemand.toFixed(1)} agri/tour</span>
          <span>Eau nécessaire : {MARINE_WATER_THRESHOLD} niveaux</span>
        </div>
        {alim < 0.50 && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-3 py-2">
            <p className="text-[10px] text-red-700 dark:text-red-300 font-semibold">
              ⚠️ Alimentation critique — mortalité des stocks. Améliorez votre traitement d'eau ou l'agriculture.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

type PanelTab = 'mining' | 'agriculture' | 'livestock' | 'marine'

interface MiningPanelProps {
  state: EcoWarPrivatePlayerState
  onClose: () => void
  onInvestAction?: (action: { resource: MiningRes; type: 'machine' | 'refinery' }) => void
  onFarmAction?: (action: { plotCategory?: CropCategory; type: 'upgradeEquipment' | 'toggleFallow' | 'investIrrigation' }) => void
  onLivestockAction?: (action: { herdCategory: LivestockCategory; type: 'upgradeEquipment' }) => void
  onMarineAction?: (action: { type: 'upgradeEquipment' }) => void
}

export function MiningPanel({ state, onClose, onInvestAction, onFarmAction, onLivestockAction, onMarineAction }: MiningPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('mining')

  // ── Optimistic local state (immediate visual feedback on purchases) ──
  const [local, setLocal] = useState(state)
  useEffect(() => { setLocal(state) }, [state])

  const handleMiningAction = (res: MiningRes, type: 'machine' | 'refinery') => {
    if (type === 'machine') {
      const cost = nextMachineCost(local.mining[res].machines, res)
      if (local.money < cost || local.mining[res].machines >= 10) return
      setLocal(prev => ({
        ...prev, money: prev.money - cost,
        mining: { ...prev.mining, [res]: { ...prev.mining[res], machines: prev.mining[res].machines + 1 } },
      }))
    } else {
      const cost = refineryCost(res)
      if (local.money < cost || local.mining[res].hasRefinery) return
      setLocal(prev => ({
        ...prev, money: prev.money - cost,
        mining: { ...prev.mining, [res]: { ...prev.mining[res], hasRefinery: true } },
      }))
    }
    onInvestAction?.({ resource: res, type })
  }

  const handleFarmAction = (action: { plotCategory?: CropCategory; type: 'upgradeEquipment' | 'toggleFallow' | 'investIrrigation' }) => {
    if (action.type === 'investIrrigation') {
      if (local.money < IRRIGATION_COST || local.agriculture.irrigationLevel >= IRRIGATION_MAX) return
      setLocal(prev => ({
        ...prev, money: prev.money - IRRIGATION_COST,
        agriculture: { ...prev.agriculture, irrigationLevel: Math.min(IRRIGATION_MAX, prev.agriculture.irrigationLevel + 10) },
      }))
    } else if (action.type === 'upgradeEquipment' && action.plotCategory) {
      const plot = local.agriculture.plots.find(p => p.category === action.plotCategory)
      if (!plot || plot.equipment === 'advanced') return
      const cost = UPGRADE_COST[plot.equipment] ?? 0
      if (local.money < cost) return
      const nextEquip = plot.equipment === 'basic' ? 'mechanized' : 'advanced'
      setLocal(prev => ({
        ...prev, money: prev.money - cost,
        agriculture: { ...prev.agriculture, plots: prev.agriculture.plots.map(p => p.category === action.plotCategory ? { ...p, equipment: nextEquip } : p) },
      }))
    } else if (action.type === 'toggleFallow' && action.plotCategory) {
      setLocal(prev => ({
        ...prev,
        agriculture: { ...prev.agriculture, plots: prev.agriculture.plots.map(p => p.category === action.plotCategory ? { ...p, inFallow: !p.inFallow } : p) },
      }))
    }
    onFarmAction?.(action)
  }

  const handleLivestockAction = (action: { herdCategory: LivestockCategory; type: 'upgradeEquipment' }) => {
    const herd = local.livestock.herds.find(h => h.category === action.herdCategory)
    if (!herd || herd.equipment === 'advanced') return
    const cost = LIVESTOCK_UPGRADE_COST[action.herdCategory]?.[herd.equipment] ?? 0
    if (local.money < cost) return
    const nextEquip = herd.equipment === 'basic' ? 'mechanized' : 'advanced'
    setLocal(prev => ({
      ...prev, money: prev.money - cost,
      livestock: { ...prev.livestock, herds: prev.livestock.herds.map(h => h.category === action.herdCategory ? { ...h, equipment: nextEquip } : h) },
    }))
    onLivestockAction?.(action)
  }

  const handleMarineAction = (action: { type: 'upgradeEquipment' }) => {
    const cost = MARINE_UPGRADE_COST[local.marine.equipment] ?? 0
    if (local.money < cost || local.marine.equipment === 'advanced') return
    const nextEquip = local.marine.equipment === 'basic' ? 'mechanized' : 'advanced'
    setLocal(prev => ({
      ...prev, money: prev.money - cost,
      marine: { ...prev.marine, equipment: nextEquip },
    }))
    onMarineAction?.(action)
  }
  // ─────────────────────────────────────────────────────────────────────

  const electricity = local.infrastructure.electricity
  const cleanEnergy = local.research.branches.cleanEnergy

  const allMiningRes: MiningRes[] = ['oil', ...MINERAL_TYPES]
  const totalExtractionPollution = allMiningRes.reduce((sum, res) => {
    const dep = local.mining[res]
    return sum + computePollution(dep, computeExtraction(dep, electricity, res), cleanEnergy, res)
  }, 0)

  const totalAgriProduction = local.agriculture.plots.reduce(
    (sum, plot) => sum + computePlotProduction(plot, local.agriculture.irrigationLevel), 0
  )

  const canUpgradeIrrigation = local.agriculture.irrigationLevel < IRRIGATION_MAX && local.money >= IRRIGATION_COST

  const { feedDemand, feedRatio, waterRatio, alim } = computeAlimRatios(local)

  const totalLivestockProduction = local.livestock.herds.reduce(
    (sum, h) => sum + computeHerdProduction(h, alim), 0
  )

  const { alim: marineAlim } = computeMarineAlim(local)
  const totalMarineProduction = computeMarineProductionPreview(local.marine, marineAlim)

  const alimentationColor = alim > 0.75
    ? 'bg-emerald-500'
    : alim > 0.50
      ? 'bg-amber-500'
      : 'bg-red-500'
  const alimentationTextColor = alim > 0.75
    ? 'text-emerald-600 dark:text-emerald-400'
    : alim > 0.50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  // header subtitle per tab
  const headerSub =
    activeTab === 'mining'
      ? `Pollution extraction : ${totalExtractionPollution > 0 ? `+${totalExtractionPollution}/tour` : 'aucune'}`
      : activeTab === 'agriculture'
        ? `Production agricole : +${totalAgriProduction}/tour`
        : activeTab === 'livestock'
          ? `Production élevage : +${totalLivestockProduction}/tour · Alim. ${Math.round(alim * 100)}%`
          : `Production maritime : +${totalMarineProduction}/tour · Stock ${Math.round(local.marine.stockTotal)} u.`

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
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">⛏️ Ressources & Extraction</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{headerSub}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {([
            { key: 'mining',      label: '⛏️ Mines' },
            { key: 'agriculture', label: '🌾 Agri.' },
            { key: 'livestock',   label: '🐄 Élevage' },
            { key: 'marine',      label: '🎣 Maritime' },
          ] as { key: PanelTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[10px] font-bold transition-colors ${
                activeTab === tab.key
                  ? 'text-slate-900 dark:text-slate-100 border-b-2 border-blue-500'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* ── Mining tab ── */}
          {activeTab === 'mining' && (
            <>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Chaque machine extrait des ressources chaque tour. La recharge naturelle est très lente (géologique).
                La pollution s'accumule et impacte la santé après 20–40 tours d'extraction intensive.
              </p>
              {allMiningRes.map(res => (
                <DepositCard
                  key={res}
                  res={res}
                  deposit={local.mining[res]}
                  electricity={electricity}
                  cleanEnergy={cleanEnergy}
                  money={local.money}
                  onBuyMachine={() => handleMiningAction(res, 'machine')}
                  onBuyRefinery={() => handleMiningAction(res, 'refinery')}
                />
              ))}
            </>
          )}

          {/* ── Agriculture tab ── */}
          {activeTab === 'agriculture' && (
            <>
              {/* Irrigation block */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">💧 Irrigation</span>
                  <span className="text-[10px] text-slate-500">
                    Bonus : ×{(1 + local.agriculture.irrigationLevel / 200).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Niveau {local.agriculture.irrigationLevel} / {IRRIGATION_MAX}</span>
                    <span>{Math.round(local.agriculture.irrigationLevel)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${local.agriculture.irrigationLevel}%` }}
                    />
                  </div>
                </div>
                <div className="relative group">
                  <button
                    disabled={!canUpgradeIrrigation}
                    onClick={() => handleFarmAction({ type: 'investIrrigation' })}
                    className={`w-full py-2 rounded-lg text-[10px] font-bold transition-colors ${
                      canUpgradeIrrigation
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : local.agriculture.irrigationLevel >= IRRIGATION_MAX
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {local.agriculture.irrigationLevel >= IRRIGATION_MAX
                      ? '✓ Irrigation maximale'
                      : `+10 niveaux — ${IRRIGATION_COST.toLocaleString('fr-FR')} $`}
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-lg bg-slate-900 dark:bg-slate-950 text-white text-[10px] p-2.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
                    <p className="font-bold mb-1">Améliorer l'irrigation</p>
                    <p>Ajoute <strong>+10 niveaux</strong> d'irrigation (max {IRRIGATION_MAX}). Bonus de production : <strong>×{(1 + Math.min(IRRIGATION_MAX, local.agriculture.irrigationLevel + 10) / 200).toFixed(2)}</strong> sur toutes les parcelles.</p>
                    <p className="mt-1 text-slate-300">Niveau actuel : {local.agriculture.irrigationLevel} / {IRRIGATION_MAX}</p>
                  </div>
                </div>
              </div>

              {/* Plot cards */}
              {local.agriculture.plots.map(plot => (
                <FarmPlotRow
                  key={plot.category}
                  plot={plot}
                  irrigationLevel={local.agriculture.irrigationLevel}
                  money={local.money}
                  onUpgrade={() => handleFarmAction({ plotCategory: plot.category, type: 'upgradeEquipment' })}
                  onToggleFallow={() => handleFarmAction({ plotCategory: plot.category, type: 'toggleFallow' })}
                />
              ))}
            </>
          )}

          {/* ── Maritime tab ── */}
          {activeTab === 'marine' && (
            <>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Stock renouvelable par croissance logistique. La surpêche ou une mauvaise qualité d'eau peut épuiser durablement les stocks.
                L'aquaculture avancée maximise la production mais nécessite davantage de nourriture et d'eau propre.
              </p>
              <MarineCard
                state={local}
                onUpgrade={() => handleMarineAction({ type: 'upgradeEquipment' })}
              />
            </>
          )}

          {/* ── Élevage tab ── */}
          {activeTab === 'livestock' && (
            <>
              {/* Alimentation block */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">🌾 Alimentation du cheptel</span>
                  <span className={`text-xs font-black ${alimentationTextColor}`}>
                    {Math.round(alim * 100)}%
                  </span>
                </div>

                {/* Alim bar */}
                <div className="space-y-1">
                  <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${alimentationColor}`}
                      style={{ width: `${Math.round(alim * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Fourrage & céréales : {Math.round(feedRatio * 100)}%</span>
                    <span>Eau : {Math.round(waterRatio * 100)}%</span>
                  </div>
                </div>

                {/* Feed demand info */}
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Demande : {Math.round(feedDemand)} agri/tour</span>
                  <span>Stock : {Math.round(local.resources.fodder ?? 0)} fourrage</span>
                </div>

                {/* Alim warning */}
                {alim < 0.50 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-3 py-2">
                    <p className="text-[10px] text-red-700 dark:text-red-300 font-semibold">
                      ⚠️ Alimentation critique — mortalité animale en cours. Améliorez vos fermes (🌾 Agriculture) ou réduisez le cheptel.
                    </p>
                  </div>
                )}
                {alim >= 0.50 && alim < 0.70 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    ⚡ Alimentation insuffisante — cheptel en légère diminution.
                  </p>
                )}
              </div>

              {/* Herd cards */}
              {local.livestock.herds.map(herd => (
                <HerdCard
                  key={herd.category}
                  herd={herd}
                  alim={alim}
                  money={local.money}
                  onUpgrade={() => handleLivestockAction({ herdCategory: herd.category, type: 'upgradeEquipment' })}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Capital disponible : <strong className="text-slate-600 dark:text-slate-300">{local.money.toLocaleString('fr-FR')} $</strong>
            <span className="ml-2">— Les achats sont immédiats et ne consomment pas de slot d'action.</span>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
