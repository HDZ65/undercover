import { useState } from 'react'
import { motion } from 'motion/react'
import type { EcoWarPrivatePlayerState } from '@undercover/shared'

interface ResourcePanelProps {
  state: EcoWarPrivatePlayerState
  compact?: boolean
}

export function ResourcePanel({ state, compact }: ResourcePanelProps) {
  const [openSection, setOpenSection] = useState<string | null>(null)

  const militaryLabel =
    state.military.effectiveForce > 80 ? 'Superpuissance' :
    state.military.effectiveForce > 50 ? 'Fort' :
    state.military.effectiveForce > 25 ? 'Modéré' : 'Faible'

  const toggle = (id: string) =>
    setOpenSection(prev => prev === id ? null : id)

  const r = state.resources
  const infra = state.infrastructure

  // Pre-computed infra multipliers
  const elecMult   = Math.round((0.5 + 0.5 * infra.electricity / 100) * 100)   // mines %
  const researchMult = (1 + infra.telecom / 200).toFixed(2)                      // research ×
  const infraAvg   = (infra.electricity + infra.telecom + infra.waterTreatment) / 3
  const factoryMult = (0.5 + infraAvg / 100).toFixed(2)                         // factories ×
  const waterLivestockOk = infra.waterTreatment >= 40
  const waterMarineOk    = infra.waterTreatment >= 30

  const mineralItems = [
    { icon: '🔩', label: 'Fer',             value: r.iron },
    { icon: '🪨', label: 'Charbon',         value: r.coal },
    { icon: '✨', label: 'Terres rares',    value: r.rareEarths },
    { icon: '💛', label: 'Métaux précieux', value: r.precious },
    { icon: '☢️', label: 'Uranium',         value: r.uranium },
  ].filter(x => Math.round(x.value) > 0)

  const foodItems = [
    { icon: '🌾', label: 'Céréales',           value: r.cereals    ?? 0 },
    { icon: '🥦', label: 'Légumes',            value: r.vegetables ?? 0 },
    { icon: '🌻', label: 'Sucre / Oléagineux', value: r.sugarOils  ?? 0 },
    { icon: '🌿', label: 'Fourrage',           value: r.fodder     ?? 0 },
    { icon: '🥩', label: 'Viande rouge',       value: r.redMeat    ?? 0 },
    { icon: '🍗', label: 'Viande blanche',     value: r.whiteMeat  ?? 0 },
    { icon: '🥛', label: 'Lait & Œufs',        value: r.dairy      ?? 0 },
    { icon: '🐟', label: 'Poissons',           value: r.fish       ?? 0 },
  ].filter(x => Math.round(x.value) > 0)

  const mineralTotal = mineralItems.reduce((s, x) => s + x.value, 0)
  const foodTotal    = foodItems.reduce((s, x) => s + x.value, 0)

  const happinessProd = Math.round((0.40 + 0.80 * Math.pow(state.happiness / 100, 0.85)) * 100)
  const happinessColor = state.happiness > 60 ? 'text-emerald-600 dark:text-emerald-400' : state.happiness > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  return (
    <motion.div
      className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 shadow-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Top row: Money + Score */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Capital</p>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100">
            💰 {state.money.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</p>
          <p className="text-xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            {state.score.toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      {/* GDP + Influence row */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 p-2">
          <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">PIB</p>
          <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">{state.gdp.toLocaleString('fr-FR')}</p>
        </div>
        <div className="flex-1 rounded-lg bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 p-2">
          <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase">Influence</p>
          <p className="text-sm font-black text-purple-800 dark:text-purple-200">{state.influence.toLocaleString('fr-FR')}</p>
        </div>
      </div>

      {!compact && (
        <>
          {/* Resources row */}
          <div className="grid grid-cols-4 gap-2 mb-1">
            <StatBadge icon="🛢️" label="Pétrole" value={Math.round(r.oil)} />
            <ExpandableBadge
              icon="⛏️" label="Minerais" value={Math.round(mineralTotal)}
              isOpen={openSection === 'minerals'}
              onClick={() => toggle('minerals')}
              hasDetail={mineralItems.length > 0}
            />
            <ExpandableBadge
              icon="🌾" label="Nourriture" value={Math.round(foodTotal)}
              isOpen={openSection === 'food'}
              onClick={() => toggle('food')}
              hasDetail={foodItems.length > 0}
            />
            <StatBadge icon="💧" label="Eau" value={Math.round(r.water)} />
          </div>

          {/* Expandable — minerals */}
          {openSection === 'minerals' && mineralItems.length > 0 && (
            <div className="mb-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {mineralItems.map(item => (
                <div key={item.label} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-400">{item.icon} {item.label}</span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{Math.round(item.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Expandable — food */}
          {openSection === 'food' && foodItems.length > 0 && (
            <div className="mb-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {foodItems.map(item => (
                <div key={item.label} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-400">{item.icon} {item.label}</span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{Math.round(item.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Population + Happiness + Factories */}
          <div className="grid grid-cols-3 gap-2 mb-2 mt-2">
            <ExpandableBadge
              icon="👥" label="Population" value={state.population.total}
              isOpen={openSection === 'pop'}
              onClick={() => toggle('pop')}
              hasDetail={true}
              displayValue={`${state.population.total.toFixed(1)}M`}
            />
            <ExpandableBadge
              icon="😊" label="Bonheur" value={state.happiness}
              isOpen={openSection === 'happiness'}
              onClick={() => toggle('happiness')}
              hasDetail={true}
              displayValue={`${Math.round(state.happiness)}%`}
              valueColor={happinessColor}
            />
            <StatBadge icon="🏭" label="Usines" value={state.factories.length} />
          </div>

          {/* Expandable — population */}
          {openSection === 'pop' && (
            <div className="mb-2 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 space-y-1 text-[10px]">
              <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">Impact de {state.population.total.toFixed(1)}M d'habitants</p>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>👷 Main d'œuvre → production ↑</span>
                <span className="font-bold text-blue-600">proportionnel</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>🍞 Nourriture consommée/tour</span>
                <span className="font-bold text-red-500">−{Math.round(state.population.total * 11.1)}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>💊 Médicaments consommés/tour</span>
                <span className="font-bold text-red-500">−{Math.round(state.population.total * 0.5)}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>⚡ Énergie (budget) /tour</span>
                <span className="font-bold text-red-500">−{Math.round(state.population.total * 8)}$</span>
              </div>
              <p className="text-[9px] text-slate-500 pt-1 border-t border-blue-200 dark:border-blue-800/30">↑ pop = ↑ production ET ↑ consommation. Croissance si bonheur + santé élevés.</p>
            </div>
          )}

          {/* Expandable — happiness */}
          {openSection === 'happiness' && (
            <div className={`mb-2 rounded-xl border px-3 py-2 space-y-1 text-[10px] ${
              state.happiness >= 70 ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20'
              : state.happiness >= 40 ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20'
              : 'border-red-200 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/20'
            }`}>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700 dark:text-slate-300">Productivité des travailleurs</span>
                <span className={happinessColor}>{happinessProd}%</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>→ Usines, mines, fermes produisent à</span>
                <span className="font-bold">{happinessProd}%</span>
              </div>
              {state.happiness < 90 && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 pt-1 border-t border-amber-200 dark:border-amber-800/30">
                  ⚠ En-dessous de 90%, chaque point de bonheur en moins réduit tous vos revenus. Investir en santé + infrastructure.
                </p>
              )}
              {state.happiness < 40 && (
                <p className="text-[9px] text-red-600 dark:text-red-400">
                  🔴 Bonheur critique → population en déclin, risque de révolte.
                </p>
              )}
            </div>
          )}

          {/* Research + Military + Infrastructure */}
          <div className="grid grid-cols-3 gap-2">
            <StatBadge icon="🔬" label="Recherche" value={state.research.globalLevel} />
            <StatBadge icon="⚔️" label="Militaire" value={militaryLabel} />
            <ExpandableBadge
              icon="🏗️" label="Infra." value={Math.round(infraAvg)}
              isOpen={openSection === 'infra'}
              onClick={() => toggle('infra')}
              hasDetail={true}
            />
          </div>

          {/* Expandable — infrastructure */}
          {openSection === 'infra' && (
            <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2 space-y-2 text-[10px]">
              {/* Electricity */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">⚡ Électricité {infra.electricity}/100</span>
                  <span className={`font-black ${elecMult >= 90 ? 'text-emerald-600' : elecMult >= 65 ? 'text-amber-600' : 'text-red-600'}`}>Mines à {elecMult}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${infra.electricity}%` }} />
                </div>
                <p className="text-slate-500 mt-0.5">Formule : 0.5 + 0.5 × (élec/100). À 0% → mines à 50%.</p>
              </div>
              {/* Telecom */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">📡 Télécom {infra.telecom}/100</span>
                  <span className="font-black text-blue-600">Recherche ×{researchMult}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${infra.telecom}%` }} />
                </div>
                <p className="text-slate-500 mt-0.5">Formule : 1 + télécom/200. À 100% → +50% points de recherche/tour.</p>
              </div>
              {/* Water */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">💧 Traitement eau {infra.waterTreatment}/100</span>
                  <span className={`font-black ${waterLivestockOk ? 'text-emerald-600' : 'text-red-600'}`}>
                    Élevage {waterLivestockOk ? '✓' : `⚠ ${Math.round(infra.waterTreatment / 40 * 100)}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${infra.waterTreatment}%` }} />
                </div>
                <p className="text-slate-500 mt-0.5">
                  Seuil élevage : 40 | Pêche : {waterMarineOk ? '✓' : `⚠ ${Math.round(infra.waterTreatment / 30 * 100)}%`} (seuil 30)
                </p>
              </div>
              {/* Factory overall */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">🏭 Multiplicateur usines (moy. {Math.round(infraAvg)}/100)</span>
                <span className={`font-black ${parseFloat(factoryMult) >= 1.0 ? 'text-emerald-600' : parseFloat(factoryMult) >= 0.75 ? 'text-amber-600' : 'text-red-600'}`}>×{factoryMult}</span>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

function StatBadge({ icon, label, value, color }: {
  icon: string
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 p-2 text-center">
      <span className="text-sm">{icon}</span>
      <p className={`text-xs font-black ${color ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      <p className="text-[8px] text-slate-500 dark:text-slate-500 uppercase">{label}</p>
    </div>
  )
}

function ExpandableBadge({ icon, label, value, isOpen, onClick, hasDetail, displayValue, valueColor }: {
  icon: string
  label: string
  value: number
  isOpen: boolean
  onClick: () => void
  hasDetail: boolean
  displayValue?: string
  valueColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-2 text-center transition-colors ${
        isOpen
          ? 'border-blue-400 dark:border-blue-600 bg-blue-50/80 dark:bg-blue-950/30'
          : 'border-slate-200/60 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <span className="text-sm">{icon}</span>
      <p className={`text-xs font-black ${valueColor ?? 'text-slate-900 dark:text-slate-100'}`}>
        {displayValue ?? Math.round(value)}
      </p>
      <p className="text-[8px] text-slate-500 dark:text-slate-500 uppercase flex items-center justify-center gap-0.5">
        {label}{hasDetail && <span className="text-[7px]">{isOpen ? ' ▲' : ' ▼'}</span>}
      </p>
    </button>
  )
}
