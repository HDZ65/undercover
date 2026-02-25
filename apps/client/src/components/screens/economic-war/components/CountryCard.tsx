import { motion } from 'motion/react'
import type { CountryProfile } from '@undercover/shared'

interface CountryCardProps {
  country: CountryProfile
  selected?: boolean
  taken?: boolean
  onClick?: () => void
}

const RESOURCE_ICONS: Record<string, string> = {
  oil: '🛢️',
  minerals: '⛏️',
  agriculture: '🌾',
  water: '💧',
}

export function CountryCard({ country, selected, taken, onClick }: CountryCardProps) {
  return (
    <motion.button
      onClick={taken ? undefined : onClick}
      disabled={taken}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
        taken
          ? 'border-slate-300/40 dark:border-slate-700/40 bg-slate-100/50 dark:bg-slate-900/30 opacity-50 cursor-not-allowed'
          : selected
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 shadow-lg shadow-amber-200/30 dark:shadow-amber-900/20'
            : 'border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:border-amber-300 dark:hover:border-amber-600'
      }`}
      whileTap={taken ? undefined : { scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 dark:text-slate-100 truncate">{country.name}</h3>
            {taken && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                Pris
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{country.description}</p>

          {/* Starting resources */}
          <div className="flex flex-wrap gap-2 mt-2">
            {(Object.entries(country.startingResources) as [string, number][]).map(([key, val]) => (
              <span key={key} className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {RESOURCE_ICONS[key]} {val}
              </span>
            ))}
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              💰 {country.startingMoney.toLocaleString('fr-FR')}
            </span>
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
              👥 {country.startingPopulation}M
            </span>
          </div>

          {/* Bonuses */}
          <div className="flex flex-wrap gap-1 mt-2">
            {country.bonuses.researchBonus > 10 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                Recherche +{country.bonuses.researchBonus}
              </span>
            )}
            {country.bonuses.militaryBonus > 10 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                Militaire +{country.bonuses.militaryBonus}
              </span>
            )}
            {country.bonuses.tradeBonus > 10 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Commerce +{country.bonuses.tradeBonus}
              </span>
            )}
            {country.bonuses.agricultureBonus > 10 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                Agriculture +{country.bonuses.agricultureBonus}
              </span>
            )}
          </div>

          {/* Strengths / Weaknesses */}
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
              + {country.strengths.join(', ')}
            </p>
            <p className="text-[10px] text-red-500 dark:text-red-400">
              - {country.weaknesses.join(', ')}
            </p>
          </div>
        </div>
      </div>
    </motion.button>
  )
}
