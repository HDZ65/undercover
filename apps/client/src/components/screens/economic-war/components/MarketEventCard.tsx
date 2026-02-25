import { motion } from 'motion/react'
import type { MarketEvent, MarketEventType } from '@undercover/shared'

const EVENT_STYLES: Partial<Record<MarketEventType, { icon: string; bg: string }>> & { fallback: { icon: string; bg: string } } = {
  drought: { icon: '🏜️', bg: 'from-orange-500 to-red-600' },
  techBoom: { icon: '🚀', bg: 'from-blue-500 to-cyan-500' },
  pandemic: { icon: '🦠', bg: 'from-red-600 to-rose-700' },
  stockCrash: { icon: '📉', bg: 'from-red-500 to-orange-600' },
  corruption: { icon: '🏴‍☠️', bg: 'from-slate-600 to-slate-800' },
  mineDiscovery: { icon: '💎', bg: 'from-emerald-500 to-green-600' },
  oilSpill: { icon: '🛢️', bg: 'from-slate-700 to-slate-900' },
  tradeAgreement: { icon: '🤝', bg: 'from-blue-500 to-indigo-600' },
  earthquake: { icon: '🌋', bg: 'from-amber-600 to-red-700' },
  greenRevolution: { icon: '🌱', bg: 'from-emerald-400 to-green-600' },
  dataLeak: { icon: '🔓', bg: 'from-purple-500 to-violet-700' },
  housingBubble: { icon: '🏠', bg: 'from-yellow-500 to-amber-600' },
  migration: { icon: '🚶', bg: 'from-sky-500 to-blue-600' },
  oilEmbargo: { icon: '⛽', bg: 'from-slate-600 to-red-700' },
  innovation: { icon: '💡', bg: 'from-cyan-400 to-blue-500' },
  none: { icon: '📊', bg: 'from-slate-400 to-slate-500' },
  fallback: { icon: '📊', bg: 'from-slate-400 to-slate-500' },
}

interface MarketEventCardProps {
  event: MarketEvent
}

export function MarketEventCard({ event }: MarketEventCardProps) {
  const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.fallback

  return (
    <motion.div
      className="rounded-2xl overflow-hidden shadow-2xl"
      initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      <div className={`bg-gradient-to-br ${style.bg} p-6 text-center text-white`}>
        <motion.span
          className="text-5xl block mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          {style.icon}
        </motion.span>
        <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">
          {event.scope === 'global' ? 'Événement Mondial' : 'Événement Local'}
        </p>
        <h3 className="text-xl font-black uppercase tracking-wider mb-2">
          {event.title}
        </h3>
        <p className="text-sm font-medium opacity-95 leading-relaxed mb-2">
          {event.description}
        </p>
        <p className="text-xs opacity-80 italic">
          {event.effects}
        </p>
        {event.duration > 1 && (
          <p className="text-[10px] mt-2 opacity-70">
            Durée: {event.duration} tours
          </p>
        )}
      </div>
    </motion.div>
  )
}
