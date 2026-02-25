import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Organization, OrganizationType, PublicPlayerInfo } from '@undercover/shared'

const ORG_TYPE_LABELS: Record<OrganizationType, { label: string; icon: string; desc: string }> = {
  commercial: { label: 'Commerciale', icon: '📦', desc: 'Réduit les frais de transaction entre membres' },
  military: { label: 'Militaire', icon: '⚔️', desc: 'Défense mutuelle et intervention armée' },
  scientific: { label: 'Scientifique', icon: '🔬', desc: 'Partage de recherche et brevets' },
  political: { label: 'Politique', icon: '🏛️', desc: 'Sanctions collectives et diplomatie' },
}

interface OrganizationPanelProps {
  organizations: Organization[]
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  onCreate: (name: string, type: OrganizationType, invitedPlayerIds: string[]) => void
  onVote: (orgId: string, voteId: string, vote: boolean) => void
  onLeave: (orgId: string) => void
  onProposeVote: (orgId: string, type: string, description: string) => void
  onClose: () => void
}

export function OrganizationPanel({
  organizations,
  players,
  currentPlayerId,
  onCreate,
  onVote,
  onLeave,
  onProposeVote,
  onClose,
}: OrganizationPanelProps) {
  const [tab, setTab] = useState<'list' | 'create'>('list')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<OrganizationType>('commercial')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  const myOrgs = organizations.filter(o => currentPlayerId && o.memberIds.includes(currentPlayerId))
  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreate = () => {
    if (!newName.trim() || selectedMembers.length < 2) return
    onCreate(newName.trim(), newType, selectedMembers)
    setNewName('')
    setSelectedMembers([])
    setTab('list')
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
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">🏛️ Organisations</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab('list')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${
              tab === 'list'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Mes orgs ({myOrgs.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${
              tab === 'create'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Créer
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'list' ? (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {myOrgs.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Vous n'appartenez à aucune organisation.
                  </p>
                ) : (
                  myOrgs.map(org => {
                    const typeInfo = ORG_TYPE_LABELS[org.type]
                    const pendingVotes = org.activeVotes.filter(v => v.result === 'pending')
                    const myPendingVotes = pendingVotes.filter(v => currentPlayerId && v.votes[currentPlayerId] === null)

                    return (
                      <div key={org.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {typeInfo.icon} {org.name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {typeInfo.label} — {org.memberIds.length} membres — Trésor: {org.treasury.toLocaleString('fr-FR')}$
                            </p>
                          </div>
                          <button
                            onClick={() => onLeave(org.id)}
                            className="px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800/40"
                          >
                            Quitter
                          </button>
                        </div>

                        {/* Members */}
                        <div className="flex flex-wrap gap-1">
                          {org.memberIds.map(mId => {
                            const p = players.find(pl => pl.id === mId)
                            return (
                              <span key={mId} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {p?.countryFlag} {p?.name || mId.slice(0, 6)}
                              </span>
                            )
                          })}
                        </div>

                        {/* Pending votes */}
                        {myPendingVotes.map(vote => (
                          <div key={vote.id} className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Vote: {vote.description}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">
                              Majorité requise: {(vote.requiredMajority * 100).toFixed(0)}%
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onVote(org.id, vote.id, true)}
                                className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-emerald-500"
                              >
                                Pour
                              </button>
                              <button
                                onClick={() => onVote(org.id, vote.id, false)}
                                className="flex-1 py-1 rounded text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                              >
                                Contre
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
                )}
              </motion.div>
            ) : (
              <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nom</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Alliance Commerciale du Nord..."
                    maxLength={40}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(Object.entries(ORG_TYPE_LABELS) as [OrganizationType, typeof ORG_TYPE_LABELS[OrganizationType]][]).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setNewType(key)}
                        className={`p-2 rounded-lg text-left transition-colors border ${
                          newType === key
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{info.icon} {info.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{info.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Membres fondateurs (min. 2 autres)
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {otherPlayers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => toggleMember(p.id)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${
                          selectedMembers.includes(p.id)
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {p.countryFlag} {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || selectedMembers.length < 2}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  Créer l'organisation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
