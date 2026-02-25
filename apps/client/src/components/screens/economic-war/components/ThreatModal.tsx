import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Threat, PublicPlayerInfo, PublicThreatInfo } from '@undercover/shared'

const INFRA_TARGETS = [
  { id: 'electricity', label: 'Réseau électrique', icon: '⚡' },
  { id: 'telecom', label: 'Télécommunications', icon: '📡' },
  { id: 'waterTreatment', label: 'Traitement de l\'eau', icon: '💧' },
  { id: 'roads', label: 'Routes', icon: '🛣️' },
  { id: 'ports', label: 'Ports', icon: '🚢' },
  { id: 'airports', label: 'Aéroports', icon: '✈️' },
  { id: 'factories', label: 'Usines', icon: '🏭' },
]

interface ThreatModalProps {
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  incomingThreats: Threat[]
  pendingThreats: PublicThreatInfo[]
  onDeclare: (targetId: string, targetInfrastructure: string, demand: string) => void
  onRespond: (threatId: string, accepted: boolean) => void
  onExecute: (threatId: string) => void
  onWithdraw: (threatId: string) => void
  onClose: () => void
}

export function ThreatModal({
  players,
  currentPlayerId,
  incomingThreats,
  pendingThreats,
  onDeclare,
  onRespond,
  onExecute,
  onWithdraw,
  onClose,
}: ThreatModalProps) {
  const [tab, setTab] = useState<'incoming' | 'outgoing' | 'declare'>('incoming')
  const [targetId, setTargetId] = useState('')
  const [targetInfra, setTargetInfra] = useState('electricity')
  const [demand, setDemand] = useState('')

  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)
  const myOutgoingThreats = pendingThreats.filter(t => t.attackerId === currentPlayerId)

  const handleDeclare = () => {
    if (!targetId || !demand.trim()) return
    onDeclare(targetId, targetInfra, demand.trim())
    setTargetId('')
    setDemand('')
    setTab('outgoing')
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">💣 Menaces</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab('incoming')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'incoming' ? 'text-red-600 dark:text-red-400 border-b-2 border-red-500' : 'text-slate-500'
            }`}
          >
            Reçues ({incomingThreats.length})
          </button>
          <button
            onClick={() => setTab('outgoing')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'outgoing' ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500' : 'text-slate-500'
            }`}
          >
            Envoyées ({myOutgoingThreats.length})
          </button>
          <button
            onClick={() => setTab('declare')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'declare' ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500' : 'text-slate-500'
            }`}
          >
            Déclarer
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'incoming' ? (
              <motion.div key="incoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {incomingThreats.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune menace reçue.
                  </p>
                ) : (
                  incomingThreats.map(threat => {
                    const attacker = players.find(p => p.id === threat.attackerId)
                    return (
                      <div key={threat.id} className="rounded-xl border border-red-200/60 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/20 p-3 space-y-2">
                        <p className="text-sm font-bold text-red-800 dark:text-red-200">
                          {attacker?.countryFlag} {attacker?.name || 'Inconnu'} vous menace !
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Cible : {INFRA_TARGETS.find(t => t.id === threat.targetInfrastructure)?.icon || '🎯'} {threat.targetInfrastructure}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Exigence : {threat.demand}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Deadline : manche {threat.deadlineRound}
                        </p>
                        {threat.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => onRespond(threat.id, true)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500"
                            >
                              Accepter
                            </button>
                            <button
                              onClick={() => onRespond(threat.id, false)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                            >
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </motion.div>
            ) : tab === 'outgoing' ? (
              <motion.div key="outgoing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {myOutgoingThreats.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune menace en cours.
                  </p>
                ) : (
                  myOutgoingThreats.map(threat => (
                    <div key={threat.id} className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/20 p-3 space-y-2">
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                        Menace contre {threat.targetName}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        Exigence : {threat.demand}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Statut : {threat.status} — Deadline : manche {threat.deadlineRound}
                      </p>
                      {threat.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => onExecute(threat.id)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500"
                          >
                            Exécuter
                          </button>
                          <button
                            onClick={() => onWithdraw(threat.id)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
                          >
                            Retirer
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div key="declare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cible</label>
                  <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Choisir un pays...</option>
                    {otherPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.countryFlag} {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Infrastructure visée</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {INFRA_TARGETS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTargetInfra(t.id)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          targetInfra === t.id
                            ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Exigence</label>
                  <textarea
                    value={demand}
                    onChange={e => setDemand(e.target.value)}
                    placeholder="Livrez 50 unités de pétrole ou subissez le bombardement..."
                    maxLength={200}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 resize-none"
                  />
                </div>

                <button
                  onClick={handleDeclare}
                  disabled={!targetId || !demand.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-red-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  Déclarer la menace
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
