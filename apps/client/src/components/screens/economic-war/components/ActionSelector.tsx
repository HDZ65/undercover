import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  PlayerAction,
  ActionType,
  PublicPlayerInfo,
  PublicWarInfo,
  IndustrySector,
  ResearchBranch,
  InfrastructureType,
  FactoryTier,
  WeaponTier,
} from '@undercover/shared'

// ─── Action Categories ───────────────────────────────────────

const ACTION_CATEGORIES: { type: ActionType; label: string; icon: string; description: string }[] = [
  { type: 'invest', label: 'Investir', icon: '🏭', description: 'Construire une usine' },
  { type: 'research', label: 'Recherche', icon: '🔬', description: 'Avancer une branche' },
  { type: 'trade', label: 'Commerce', icon: '🤝', description: 'Proposer un échange' },
  { type: 'sabotage', label: 'Sabotage', icon: '🕵️', description: 'Saboter un rival' },
  { type: 'defend', label: 'Défense', icon: '🛡️', description: 'Protéger vos installations' },
  { type: 'war', label: 'Guerre', icon: '⚔️', description: 'Déclarer une guerre' },
  { type: 'bombardment', label: 'Bombarder', icon: '💣', description: 'Bombarder une cible' },
  { type: 'buildWeapon', label: 'Arme', icon: '🔫', description: 'Fabriquer une arme' },
  { type: 'buildMonument', label: 'Monument', icon: '🏛️', description: 'Construire un monument' },
  { type: 'developNuclear', label: 'Nucléaire', icon: '☢️', description: 'Programme nucléaire' },
  { type: 'diplomacy', label: 'Diplomatie', icon: '🕊️', description: 'Actions diplomatiques' },
  { type: 'armistice', label: 'Armistice', icon: '🤝', description: 'Proposer la paix (après 5 tours de guerre)' },
]

const SECTOR_OPTIONS: { value: IndustrySector; label: string }[] = [
  { value: 'rawMaterials', label: 'Matières premières' },
  { value: 'energy', label: 'Énergie' },
  { value: 'manufacturing', label: 'Manufacture' },
  { value: 'electronics', label: 'Électronique' },
  { value: 'pharmaceutical', label: 'Pharmaceutique' },
  { value: 'armament', label: 'Armement' },
  { value: 'luxury', label: 'Luxe' },
  { value: 'food', label: 'Agroalimentaire' },
]

const RESEARCH_OPTIONS: { value: ResearchBranch; label: string }[] = [
  { value: 'agrotech', label: 'Agrotech' },
  { value: 'nanotech', label: 'Nanotech' },
  { value: 'cleanEnergy', label: 'Énergie propre' },
  { value: 'cybersecurity', label: 'Cybersécurité' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'military', label: 'Militaire' },
  { value: 'electronics', label: 'Électronique' },
  { value: 'nuclear', label: 'Nucléaire' },
]

const TIER_OPTIONS: { value: FactoryTier; label: string }[] = [
  { value: 'basic', label: 'Basique' },
  { value: 'advanced', label: 'Avancée' },
  { value: 'robotized', label: 'Robotisée' },
]

const WEAPON_TIER_OPTIONS: { value: WeaponTier; label: string }[] = [
  { value: 1, label: 'Tier 1' },
  { value: 2, label: 'Tier 2' },
  { value: 3, label: 'Tier 3' },
  { value: 4, label: 'Tier 4' },
]

const INFRA_OPTIONS: { value: InfrastructureType; label: string }[] = [
  { value: 'electricity', label: 'Électricité' },
  { value: 'telecom', label: 'Télécom' },
  { value: 'waterTreatment', label: 'Traitement eau' },
]

// ─── Component ───────────────────────────────────────────────

interface ActionSelectorProps {
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  maxActions: number
  timeRemaining: number | null
  onSubmit: (actions: PlayerAction[]) => void
  hasSubmitted: boolean
  activeWars?: PublicWarInfo[]
}

export function ActionSelector({
  players,
  currentPlayerId,
  maxActions,
  timeRemaining,
  onSubmit,
  hasSubmitted,
  activeWars = [],
}: ActionSelectorProps) {
  const [actions, setActions] = useState<PlayerAction[]>([])
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [draftAction, setDraftAction] = useState<Partial<PlayerAction>>({})

  const otherPlayers = players.filter((p) => p.id !== currentPlayerId && !p.abandoned)

  const addAction = (action: PlayerAction) => {
    if (actions.length >= maxActions) return
    setActions((prev) => [...prev, action])
    setDraftAction({})
    setEditingSlot(null)
  }

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (actions.length === 0) return
    onSubmit(actions)
  }

  if (hasSubmitted) {
    return (
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <p className="text-4xl mb-3">✅</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Actions soumises</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">En attente des autres joueurs...</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Timer */}
      {timeRemaining !== null && (
        <div className="text-center">
          <span className={`text-3xl font-black tabular-nums ${timeRemaining <= 15 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-slate-100'}`}>
            {timeRemaining}s
          </span>
        </div>
      )}

      {/* Action Queue */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Actions ({actions.length}/{maxActions})
          </p>
          {actions.length > 0 && (
            <button
              onClick={() => setActions([])}
              className="text-[10px] font-bold text-red-500 hover:text-red-600"
            >
              Tout effacer
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action, i) => (
            <motion.button
              key={i}
              onClick={() => removeAction(i)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300/60 dark:border-amber-700/60 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              title="Cliquer pour retirer"
            >
              {ACTION_CATEGORIES.find((c) => c.type === action.type)?.icon ?? '❓'}
              <span>{ACTION_CATEGORIES.find((c) => c.type === action.type)?.label ?? action.type}</span>
              <span className="text-red-500 ml-0.5">×</span>
            </motion.button>
          ))}
          {Array.from({ length: maxActions - actions.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-16 h-7 rounded-lg border border-dashed border-slate-300 dark:border-slate-600" />
          ))}
        </div>
      </div>

      {/* Category Picker */}
      {editingSlot === null && actions.length < maxActions && (
        <div className="grid grid-cols-3 gap-1.5">
          {ACTION_CATEGORIES.map((cat) => (
            <motion.button
              key={cat.type}
              onClick={() => {
                setEditingSlot(actions.length)
                setDraftAction({ type: cat.type })
              }}
              className="rounded-xl p-2 border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:border-amber-300 dark:hover:border-amber-600 transition-colors text-center"
              whileTap={{ scale: 0.96 }}
            >
              <span className="text-lg block">{cat.icon}</span>
              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 mt-0.5">{cat.label}</p>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail Form */}
      <AnimatePresence>
        {editingSlot !== null && draftAction.type && (
          <ActionDetailForm
            actionType={draftAction.type}
            draft={draftAction}
            setDraft={setDraftAction}
            otherPlayers={otherPlayers}
            activeWars={activeWars}
            currentPlayerId={currentPlayerId}
            onConfirm={addAction}
            onCancel={() => { setEditingSlot(null); setDraftAction({}) }}
          />
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={actions.length === 0}
        className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
      >
        Soumettre {actions.length} action{actions.length > 1 ? 's' : ''}
      </button>
    </div>
  )
}

// ─── Detail Form ─────────────────────────────────────────────

function ActionDetailForm({
  actionType,
  draft,
  setDraft,
  otherPlayers,
  activeWars,
  currentPlayerId,
  onConfirm,
  onCancel,
}: {
  actionType: ActionType
  draft: Partial<PlayerAction>
  setDraft: (d: Partial<PlayerAction>) => void
  otherPlayers: PublicPlayerInfo[]
  activeWars: PublicWarInfo[]
  currentPlayerId: string | null
  onConfirm: (a: PlayerAction) => void
  onCancel: () => void
}) {
  const cat = ACTION_CATEGORIES.find((c) => c.type === actionType)

  const myWars = activeWars.filter(
    (w) => w.attackerId === currentPlayerId || w.defenderId === currentPlayerId,
  )

  const canConfirm = (() => {
    switch (actionType) {
      case 'defend':
      case 'developNuclear':
      case 'diplomacy':
        return true
      case 'invest':
        return !!draft.sector || !!draft.militaryUpgrade
      case 'research':
        return !!draft.researchBranch
      case 'sabotage':
      case 'war':
      case 'armistice':
      case 'bombardment':
      case 'nuclear':
      case 'trade':
        return !!draft.targetPlayerId
      case 'buildWeapon':
        return !!draft.weaponTier
      case 'buildMonument':
        return !!draft.monumentName
      default:
        return false
    }
  })()

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({ type: actionType, ...draft } as PlayerAction)
  }

  return (
    <motion.div
      className="rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {cat?.icon} {cat?.label}
        </p>
        <button onClick={onCancel} className="text-xs font-bold text-slate-500 hover:text-red-500">
          Annuler
        </button>
      </div>

      {/* Sector picker for invest */}
      {actionType === 'invest' && (
        <div className="space-y-2">
          {/* Option : Forces armées */}
          <button
            className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              draft.militaryUpgrade
                ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-red-300'
            }`}
            onClick={() => setDraft({ ...draft, militaryUpgrade: !draft.militaryUpgrade, sector: undefined, factoryTier: undefined })}
          >
            ⚔️ Forces armées <span className="text-slate-500 font-normal">(+5 niveaux, coût croissant)</span>
          </button>

          {/* Option : Usine */}
          {!draft.militaryUpgrade && (
            <>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Secteur usine</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SECTOR_OPTIONS.map((s) => (
                  <PickerButton key={s.value} label={s.label} selected={draft.sector === s.value}
                    onClick={() => setDraft({ ...draft, sector: s.value, militaryUpgrade: false })} />
                ))}
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mt-2">Tier usine</p>
              <div className="flex gap-1.5">
                {TIER_OPTIONS.map((t) => (
                  <PickerButton key={t.value} label={t.label} selected={draft.factoryTier === t.value}
                    onClick={() => setDraft({ ...draft, factoryTier: t.value })} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Research branch */}
      {actionType === 'research' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Branche</p>
          <div className="grid grid-cols-2 gap-1.5">
            {RESEARCH_OPTIONS.map((r) => (
              <PickerButton key={r.value} label={r.label} selected={draft.researchBranch === r.value}
                onClick={() => setDraft({ ...draft, researchBranch: r.value })} />
            ))}
          </div>
        </div>
      )}

      {/* Target player */}
      {(actionType === 'sabotage' || actionType === 'war' || actionType === 'bombardment' || actionType === 'nuclear' || actionType === 'trade') && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Cible</p>
          <div className="space-y-1">
            {otherPlayers.map((p) => (
              <PickerButton key={p.id} label={`${p.countryFlag} ${p.name}`}
                selected={draft.targetPlayerId === p.id}
                onClick={() => setDraft({ ...draft, targetPlayerId: p.id })} />
            ))}
          </div>
          {actionType === 'sabotage' && (
            <>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mt-2">Infrastructure ciblée</p>
              <div className="flex gap-1.5">
                {INFRA_OPTIONS.map((inf) => (
                  <PickerButton key={inf.value} label={inf.label}
                    selected={draft.infrastructureTarget === inf.value}
                    onClick={() => setDraft({ ...draft, infrastructureTarget: inf.value })} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Weapon tier */}
      {actionType === 'buildWeapon' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Tier</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WEAPON_TIER_OPTIONS.map((w) => (
              <PickerButton key={w.value} label={w.label}
                selected={draft.weaponTier === w.value}
                onClick={() => setDraft({ ...draft, weaponTier: w.value })} />
            ))}
          </div>
        </div>
      )}

      {/* Monument name */}
      {actionType === 'buildMonument' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Nom du monument</p>
          <input
            type="text"
            value={draft.monumentName ?? ''}
            onChange={(e) => setDraft({ ...draft, monumentName: e.target.value })}
            placeholder="Ex: Tour de la Liberté"
            maxLength={40}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}

      {/* Armistice target */}
      {actionType === 'armistice' && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Proposez la paix à un adversaire. Si l'adversaire soumet la même action ce tour, la guerre prend fin immédiatement.
          </p>
          {myWars.length === 0 ? (
            <p className="text-xs text-red-500">Vous n'êtes en guerre avec personne.</p>
          ) : (
            <div className="space-y-1">
              {myWars.map((w) => {
                const opponentId = w.attackerId === currentPlayerId ? w.defenderId : w.attackerId
                const opponentName = w.attackerId === currentPlayerId ? w.defenderName : w.attackerName
                const alreadyProposed = w.armisticeProposedBy === currentPlayerId
                return (
                  <PickerButton
                    key={w.id}
                    label={`${opponentName}${alreadyProposed ? ' (proposé ✓)' : ''} — tour ${w.duration}`}
                    selected={draft.targetPlayerId === opponentId}
                    onClick={() => setDraft({ ...draft, targetPlayerId: opponentId })}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Simple actions */}
      {(actionType === 'defend' || actionType === 'developNuclear' || actionType === 'diplomacy') && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {actionType === 'defend' && 'Protège toutes vos installations contre le sabotage ce tour.'}
          {actionType === 'developNuclear' && 'Avance le programme nucléaire de votre pays.'}
          {actionType === 'diplomacy' && 'Action diplomatique (organisation, vote, etc.)'}
        </p>
      )}

      {/* Confirm */}
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-2 rounded-lg font-bold text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
          Annuler
        </button>
        <button onClick={handleConfirm} disabled={!canConfirm}
          className="flex-1 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
          Ajouter
        </button>
      </div>
    </motion.div>
  )
}

function PickerButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-lg px-2 py-1.5 border text-left text-xs font-medium transition-colors ${
        selected
          ? 'border-amber-400 dark:border-amber-500 bg-amber-100/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
          : 'border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-600'
      }`}>
      {label}
    </button>
  )
}
