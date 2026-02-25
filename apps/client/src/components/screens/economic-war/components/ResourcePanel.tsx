import { motion } from 'motion/react'
import type { EcoWarPrivatePlayerState } from '@undercover/shared'

interface ResourcePanelProps {
  state: EcoWarPrivatePlayerState
  compact?: boolean
}

export function ResourcePanel({ state, compact }: ResourcePanelProps) {
  const militaryLabel =
    state.military.effectiveForce > 80 ? 'Superpuissance' :
    state.military.effectiveForce > 50 ? 'Fort' :
    state.military.effectiveForce > 25 ? 'Modéré' : 'Faible'

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
          {/* Resources */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBadge icon="🛢️" label="Pétrole" value={state.resources.oil} />
            <StatBadge icon="⛏️" label="Minerais" value={state.resources.minerals} />
            <StatBadge icon="🌾" label="Agri." value={state.resources.agriculture} />
            <StatBadge icon="💧" label="Eau" value={state.resources.water} />
          </div>

          {/* Population + Happiness */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatBadge icon="👥" label="Population" value={`${state.population.total.toFixed(1)}M`} />
            <StatBadge
              icon="😊"
              label="Bonheur"
              value={`${Math.round(state.happiness)}%`}
              color={state.happiness > 60 ? 'text-emerald-600 dark:text-emerald-400' : state.happiness > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
            />
            <StatBadge icon="🏭" label="Usines" value={state.factories.length} />
          </div>

          {/* Research + Military + Infrastructure */}
          <div className="grid grid-cols-3 gap-2">
            <StatBadge icon="🔬" label="Recherche" value={state.research.globalLevel} />
            <StatBadge icon="⚔️" label="Militaire" value={militaryLabel} />
            <StatBadge icon="🏗️" label="Infra." value={Math.round((state.infrastructure.electricity + state.infrastructure.telecom + state.infrastructure.waterTreatment) / 3)} />
          </div>
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
