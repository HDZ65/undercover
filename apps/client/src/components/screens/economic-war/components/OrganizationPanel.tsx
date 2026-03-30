import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Organization, OrganizationType, OrgVote, PublicPlayerInfo, PendingOrg } from '@undercover/shared'

const ORG_TYPE_LABELS: Record<OrganizationType, { label: string; icon: string; desc: string }> = {
  commercial: { label: 'Commerciale', icon: '📦', desc: '0% taxe entre membres, embargo collectif, fonds d\'aide' },
  military:   { label: 'Militaire',   icon: '⚔️', desc: 'Dissuasion (-10 bonheur à l\'attaquant), fonds de guerre' },
}

interface OrganizationPanelProps {
  organizations: Organization[]
  pendingOrgs: PendingOrg[]
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  onCreate: (name: string, type: OrganizationType, invitedPlayerIds: string[]) => void
  onVote: (orgId: string, voteId: string, vote: boolean) => void
  onLeave: (orgId: string) => void
  onProposeEmbargo: (orgId: string, targetId: string, rate: number) => void
  onProposeAidRequest: (orgId: string, motivationText: string) => void
  onCastAmountVote: (orgId: string, voteId: string, amount: number) => void
  onRespondInvite: (pendingOrgId: string, accepted: boolean) => void
  onRequestJoin: (orgId: string) => void
  onVoteJoinRequest: (orgId: string, requestId: string, vote: boolean) => void
  onProposeExpel: (orgId: string, targetId: string) => void
  onClose: () => void
}

type ActionMode = null | { orgId: string; mode: 'embargo' | 'aid' | 'expel' }

function VoteAmountCard({
  vote,
  orgId,
  orgTreasury,
  currentPlayerId,
  onCastAmountVote,
  players,
}: {
  vote: OrgVote
  orgId: string
  orgTreasury: number
  currentPlayerId: string | null
  onCastAmountVote: (orgId: string, voteId: string, amount: number) => void
  players: PublicPlayerInfo[]
}) {
  const mySlot = currentPlayerId ? vote.amounts[currentPlayerId] : undefined
  const hasVoted = mySlot !== null && mySlot !== undefined
  const [inputVal, setInputVal] = useState('')

  const proposer = players.find(p => p.id === vote.proposedBy)

  if (hasVoted) {
    return (
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
          {vote.type === 'embargo' ? '🚫 Vote d\'embargo' : '🤝 Demande d\'aide'} — {vote.description}
        </p>
        {vote.motivationText && (
          <p className="text-[10px] text-slate-500 italic mt-0.5">« {vote.motivationText} »</p>
        )}
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
          ✓ Votre proposition : {mySlot}{vote.type === 'embargo' ? '%' : ' €'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
        {vote.type === 'embargo' ? '🚫' : '🤝'}{' '}
        {vote.description}
        {proposer && <span className="text-[10px] font-normal ml-1">(par {proposer.name})</span>}
      </p>
      {vote.motivationText && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">« {vote.motivationText} »</p>
      )}
      {vote.type === 'embargo' && vote.targetId && (
        <p className="text-[10px] text-red-600 dark:text-red-400">Cible : {vote.targetName ?? vote.targetId}</p>
      )}
      <div className="flex gap-1.5 items-center">
        <input
          type="number"
          min={0}
          max={vote.type === 'embargo' ? 300 : orgTreasury}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder={vote.type === 'embargo' ? 'Taux % (0=refus, max 300%)' : `Montant € (0=refus, max ${orgTreasury.toLocaleString('fr-FR')} €)`}
          className="flex-1 px-2 py-1 rounded text-[10px] border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        />
        <button
          onClick={() => {
            const v = parseFloat(inputVal)
            if (!isNaN(v) && v >= 0) {
              onCastAmountVote(orgId, vote.id, v)
            }
          }}
          disabled={inputVal === '' || isNaN(parseFloat(inputVal))}
          className="px-2 py-1 rounded text-[10px] font-bold text-white bg-amber-500 disabled:opacity-40"
        >
          Voter
        </button>
      </div>
    </div>
  )
}

export function OrganizationPanel({
  organizations,
  pendingOrgs,
  players,
  currentPlayerId,
  onCreate,
  onVote,
  onLeave,
  onProposeEmbargo,
  onProposeAidRequest,
  onCastAmountVote,
  onRespondInvite,
  onRequestJoin,
  onVoteJoinRequest,
  onProposeExpel,
  onClose,
}: OrganizationPanelProps) {
  const [tab, setTab] = useState<'myOrgs' | 'allOrgs' | 'create'>('myOrgs')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<OrganizationType>('commercial')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [confirmLeaveOrgId, setConfirmLeaveOrgId] = useState<string | null>(null)

  // States pour embargo
  const [embargoTarget, setEmbargoTarget] = useState('')
  const [embargoRate, setEmbargoRate] = useState('')

  // States pour demande d'aide
  const [aidText, setAidText] = useState('')

  // State pour expulsion
  const [expelTarget, setExpelTarget] = useState('')

  const myOrgs = organizations.filter(o => currentPlayerId && o.memberIds.includes(currentPlayerId))
  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)

  // Pending invites for current player
  const myInvites = pendingOrgs.filter(po => currentPlayerId && po.pendingIds.includes(currentPlayerId))

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreate = () => {
    if (!newName.trim() || selectedMembers.length < 2) return
    onCreate(newName.trim(), newType, selectedMembers)
    setNewName('')
    setSelectedMembers([])
    setTab('myOrgs')
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

        {/* Pending invites banner */}
        {myInvites.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
              Invitations en attente
            </p>
            {myInvites.map(po => (
              <div key={po.id} className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ORG_TYPE_LABELS[po.type].icon} {po.name}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">
                    par {po.creatorName} · {po.acceptedIds.length + po.pendingIds.length} membres
                  </span>
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button
                    onClick={() => onRespondInvite(po.id, true)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-emerald-500"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => onRespondInvite(po.id, false)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['myOrgs', 'allOrgs', 'create'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[11px] font-bold transition-colors ${
                tab === t
                  ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'myOrgs' ? `Mes orgs (${myOrgs.length})` : t === 'allOrgs' ? `Toutes (${organizations.length})` : 'Créer'}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'myOrgs' && (
              <motion.div key="myOrgs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {myOrgs.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Vous n'appartenez à aucune organisation.
                  </p>
                ) : (
                  myOrgs.map(org => {
                    const typeInfo = ORG_TYPE_LABELS[org.type]
                    const pendingAmountVotes = org.activeVotes.filter(
                      v => v.result === 'pending' &&
                        (v.type === 'embargo' || v.type === 'aidRequest' || v.type === 'embargoRenewal') &&
                        currentPlayerId &&
                        currentPlayerId in v.amounts &&
                        v.amounts[currentPlayerId] === null
                    )
                    const pendingBoolVotes = org.activeVotes.filter(
                      v => v.result === 'pending' &&
                        v.type === 'expelMember' &&
                        currentPlayerId &&
                        v.votes[currentPlayerId] === null
                    )

                    // Pending join requests (current player must vote)
                    const pendingJoinRequests = org.joinRequests.filter(
                      r => r.result === 'pending' && currentPlayerId && r.votes[currentPlayerId] === null
                    )

                    // Pays non membres (pour embargo)
                    const nonMembers = otherPlayers.filter(p => !org.memberIds.includes(p.id))

                    // Other members (for expel)
                    const otherMembers = org.memberIds.filter(id => id !== currentPlayerId)

                    const isActionOpen = actionMode?.orgId === org.id

                    return (
                      <div key={org.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        {/* Header org */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {typeInfo.icon} {org.name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {typeInfo.label} · {org.memberIds.length} membres · Trésor : {org.treasury.toLocaleString('fr-FR')} €
                            </p>
                          </div>
                          {confirmLeaveOrgId === org.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { onLeave(org.id); setConfirmLeaveOrgId(null); }}
                                className="px-2 py-1 text-[10px] font-bold text-white bg-red-500 rounded-lg"
                              >
                                Confirmer
                              </button>
                              <button
                                onClick={() => setConfirmLeaveOrgId(null)}
                                className="px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 rounded-lg"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmLeaveOrgId(org.id)}
                              className="px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800/40"
                            >
                              Quitter
                            </button>
                          )}
                        </div>

                        {/* Membres */}
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

                        {/* Embargos actifs (org commerciale) */}
                        {org.type === 'commercial' && org.activeEmbargos.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Embargos actifs</p>
                            {org.activeEmbargos.map(emb => (
                              <div key={emb.targetId} className="flex items-center justify-between px-2 py-1 rounded bg-red-50 dark:bg-red-950/30">
                                <span className="text-[10px] text-red-700 dark:text-red-300">
                                  🚫 {emb.targetName} — taxe {Math.round(emb.rate * 100)}%
                                </span>
                                <span className="text-[10px] text-red-500">{emb.turnsRemaining} tour{emb.turnsRemaining > 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Votes booléens (expelMember) */}
                        {pendingBoolVotes.map(vote => (
                          <div key={vote.id} className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2 space-y-1">
                            <p className="text-xs font-bold text-red-700 dark:text-red-300">🚨 {vote.description}</p>
                            <div className="flex gap-2">
                              <button onClick={() => onVote(org.id, vote.id, true)} className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-emerald-500">Pour</button>
                              <button onClick={() => onVote(org.id, vote.id, false)} className="flex-1 py-1 rounded text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40">Contre</button>
                            </div>
                          </div>
                        ))}

                        {/* Votes avec montants à compléter */}
                        {pendingAmountVotes.map(vote => (
                          <VoteAmountCard
                            key={vote.id}
                            vote={vote}
                            orgId={org.id}
                            orgTreasury={org.treasury}
                            currentPlayerId={currentPlayerId}
                            onCastAmountVote={onCastAmountVote}
                            players={players}
                          />
                        ))}

                        {/* Demandes d'adhésion à voter */}
                        {pendingJoinRequests.map(req => (
                          <div key={req.id} className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 space-y-1">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                              🙋 {req.requesterName} demande à rejoindre
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onVoteJoinRequest(org.id, req.id, true)}
                                className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-emerald-500"
                              >
                                Accepter
                              </button>
                              <button
                                onClick={() => onVoteJoinRequest(org.id, req.id, false)}
                                className="flex-1 py-1 rounded text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40"
                              >
                                Refuser
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Actions */}
                        {isActionOpen ? (
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 space-y-2">
                            {actionMode?.mode === 'embargo' && org.type === 'commercial' && (
                              <>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Proposer un embargo</p>
                                <select
                                  value={embargoTarget}
                                  onChange={e => setEmbargoTarget(e.target.value)}
                                  className="w-full px-2 py-1 rounded text-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                >
                                  <option value="">Choisir un pays cible...</option>
                                  {nonMembers.map(p => (
                                    <option key={p.id} value={p.id}>{p.countryFlag} {p.name}</option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={10}
                                    max={300}
                                    value={embargoRate}
                                    onChange={e => setEmbargoRate(e.target.value)}
                                    placeholder="Taux % (ex: 35, max 300%)"
                                    className="flex-1 px-2 py-1 rounded text-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                  />
                                  <span className="text-[10px] text-slate-500">%</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      const rate = parseFloat(embargoRate)
                                      if (embargoTarget && !isNaN(rate) && rate >= 0) {
                                        onProposeEmbargo(org.id, embargoTarget, rate)
                                        setActionMode(null)
                                        setEmbargoTarget('')
                                        setEmbargoRate('')
                                      }
                                    }}
                                    disabled={!embargoTarget || embargoRate === ''}
                                    className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-red-500 disabled:opacity-40"
                                  >
                                    Proposer
                                  </button>
                                  <button onClick={() => setActionMode(null)} className="flex-1 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700">Annuler</button>
                                </div>
                              </>
                            )}

                            {actionMode?.mode === 'aid' && (
                              <>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Demander de l'aide</p>
                                <textarea
                                  value={aidText}
                                  onChange={e => setAidText(e.target.value)}
                                  placeholder="Expliquez votre situation..."
                                  maxLength={200}
                                  rows={3}
                                  className="w-full px-2 py-1 rounded text-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      if (aidText.trim()) {
                                        onProposeAidRequest(org.id, aidText.trim())
                                        setActionMode(null)
                                        setAidText('')
                                      }
                                    }}
                                    disabled={!aidText.trim()}
                                    className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-emerald-500 disabled:opacity-40"
                                  >
                                    Envoyer
                                  </button>
                                  <button onClick={() => setActionMode(null)} className="flex-1 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700">Annuler</button>
                                </div>
                              </>
                            )}

                            {actionMode?.mode === 'expel' && (
                              <>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Proposer une expulsion</p>
                                <select
                                  value={expelTarget}
                                  onChange={e => setExpelTarget(e.target.value)}
                                  className="w-full px-2 py-1 rounded text-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                >
                                  <option value="">Choisir un membre...</option>
                                  {otherMembers.map(mId => {
                                    const p = players.find(pl => pl.id === mId)
                                    return (
                                      <option key={mId} value={mId}>{p?.countryFlag} {p?.name || mId.slice(0, 6)}</option>
                                    )
                                  })}
                                </select>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      if (expelTarget) {
                                        onProposeExpel(org.id, expelTarget)
                                        setActionMode(null)
                                        setExpelTarget('')
                                      }
                                    }}
                                    disabled={!expelTarget}
                                    className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-red-500 disabled:opacity-40"
                                  >
                                    Proposer
                                  </button>
                                  <button onClick={() => setActionMode(null)} className="flex-1 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700">Annuler</button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-1.5 flex-wrap">
                            {org.type === 'commercial' && (
                              <button
                                onClick={() => setActionMode({ orgId: org.id, mode: 'embargo' })}
                                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                              >
                                🚫 Embargo
                              </button>
                            )}
                            <button
                              onClick={() => setActionMode({ orgId: org.id, mode: 'aid' })}
                              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40"
                            >
                              🤝 Aide
                            </button>
                            {otherMembers.length > 0 && (
                              <button
                                onClick={() => setActionMode({ orgId: org.id, mode: 'expel' })}
                                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40"
                              >
                                🚫 Exclure
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </motion.div>
            )}

            {tab === 'allOrgs' && (
              <motion.div key="allOrgs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune organisation n'existe encore.
                  </p>
                ) : (
                  organizations.map(org => {
                    const typeInfo = ORG_TYPE_LABELS[org.type]
                    const isMember = currentPlayerId ? org.memberIds.includes(currentPlayerId) : false
                    const hasRequestPending = org.joinRequests.some(
                      r => r.requesterId === currentPlayerId && r.result === 'pending'
                    )

                    return (
                      <div key={org.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {typeInfo.icon} {org.name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {typeInfo.label} · {org.memberIds.length} membres · Trésor : {org.treasury.toLocaleString('fr-FR')} €
                            </p>
                          </div>
                          {isMember ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40">
                              Membre
                            </span>
                          ) : hasRequestPending ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40">
                              En attente
                            </span>
                          ) : (
                            <button
                              onClick={() => onRequestJoin(org.id)}
                              className="px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/40"
                            >
                              Demander
                            </button>
                          )}
                        </div>

                        {/* Membres */}
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

                        {/* Embargos actifs */}
                        {org.type === 'commercial' && org.activeEmbargos.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {org.activeEmbargos.map(emb => (
                              <span key={emb.targetId} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                                🚫 {emb.targetName} {Math.round(emb.rate * 100)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </motion.div>
            )}

            {tab === 'create' && (
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
                    Membres à inviter (min. 2 — ils devront accepter)
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

                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                  L'organisation sera créée une fois que tous les membres invités auront accepté.
                </p>

                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || selectedMembers.length < 2}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  Envoyer les invitations
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
