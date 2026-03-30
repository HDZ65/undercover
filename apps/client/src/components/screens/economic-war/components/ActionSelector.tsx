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
  ThreatInfraTarget,
  ThreatDemandType,
  ResourceType,
  ResearchState,
} from '@undercover/shared'

// ─── Action Categories ───────────────────────────────────────

const ACTION_CATEGORIES: { type: ActionType; label: string; icon: string; description: string }[] = [
  { type: 'invest', label: 'Investir', icon: '🏭', description: 'Construire une usine' },
  { type: 'research', label: 'Recherche', icon: '🔬', description: 'Avancer une branche' },
  { type: 'buyRegion', label: 'Acheter région', icon: '🏴', description: 'Proposer d\'acheter une région à un autre pays' },
  { type: 'sabotage', label: 'Sabotage', icon: '🕵️', description: 'Saboter un rival' },
  { type: 'defend', label: 'Défense', icon: '🛡️', description: 'Protéger vos installations' },
  { type: 'war', label: 'Guerre', icon: '⚔️', description: 'Déclarer une guerre' },
  { type: 'threat', label: 'Menace', icon: '⚠️', description: 'Menacer une infrastructure adverse' },
  { type: 'bombardment', label: 'Bombarder', icon: '💣', description: 'Bombarder une cible' },
  { type: 'buildWeapon', label: 'Arme', icon: '🔫', description: 'Fabriquer une arme' },
  { type: 'buildMonument', label: 'Monument', icon: '🏛️', description: 'Construire un monument' },
  { type: 'developNuclear', label: 'Nucléaire', icon: '☢️', description: 'Développer la bombe nucléaire (4 tours, ~17% PIB/tour)' },
  { type: 'armistice', label: 'Armistice', icon: '🤝', description: 'Proposer la paix (après 5 tours de guerre)' },
]

// ─── Threat infrastructure options with concrete effects ─────

const THREAT_INFRA_OPTIONS: {
  value: ThreatInfraTarget
  label: string
  icon: string
  effect: string
}[] = [
  { value: 'electricity',        icon: '⚡', label: 'Réseau électrique',     effect: '−30% production industrielle pendant 4 tours' },
  { value: 'telecom',            icon: '📡', label: 'Télécom',               effect: '−25% PIB, −15% influence pendant 3 tours' },
  { value: 'waterTreatment',     icon: '🚰', label: 'Traitement de l\'eau',  effect: '−25% santé population pendant 4 tours' },
  { value: 'factories_food',     icon: '🌾', label: 'Agro-alimentaire',      effect: '−40% revenus alimentaires pendant 3 tours' },
  { value: 'factories_energy',   icon: '⛽', label: 'Énergie',               effect: '−40% revenus énergétiques pendant 3 tours' },
  { value: 'factories_armament', icon: '🔫', label: 'Arsenal militaire',     effect: '−40% revenus armement + −10 forces armées' },
  { value: 'military',           icon: '🪖', label: 'Forces armées',         effect: '−30 forces armées, −25% force effective pendant 2 tours' },
]

const THREAT_DEMAND_OPTIONS: { value: ThreatDemandType; label: string; icon: string }[] = [
  { value: 'money',                icon: '💰', label: 'Paiement (€)' },
  { value: 'resource',             icon: '📦', label: 'Livraison de ressources' },
  { value: 'military_withdrawal',  icon: '🏳️', label: 'Retrait militaire (−20 forces)' },
  { value: 'lift_sanctions',       icon: '🤝', label: 'Lever les sanctions' },
]

const TRADEABLE_RESOURCES: { value: ResourceType; label: string }[] = [
  { value: 'oil',                 label: '🛢️ Pétrole' },
  { value: 'iron',                label: '🔩 Fer' },
  { value: 'coal',                label: '🪨 Charbon' },
  { value: 'rareEarths',          label: '✨ Terres rares' },
  { value: 'precious',            label: '💛 M. précieux' },
  { value: 'cereals',             label: '🌾 Céréales' },
  { value: 'vegetables',          label: '🥦 Légumes' },
  { value: 'fodder',              label: '🌿 Fourrage' },
  { value: 'redMeat',             label: '🥩 Viande rouge' },
  { value: 'whiteMeat',           label: '🍗 Viande blanche' },
  { value: 'dairy',               label: '🥛 Lait & Œufs' },
  { value: 'fish',                label: '🐟 Poisson' },
  // Biens manufacturés
  { value: 'steel',               label: '⚙️ Acier' },
  { value: 'fuel',                label: '⛽ Carburant' },
  { value: 'electronicComponents',label: '🔌 Composants élec.' },
  { value: 'pharmaceuticals',     label: '💊 Médicaments' },
  { value: 'processedFood',       label: '🍞 Alim. transformés' },
  { value: 'fertilizer',          label: '🌱 Engrais' },
  { value: 'phones',              label: '📱 Téléphones' },
  { value: 'computers',           label: '💻 Ordinateurs' },
  { value: 'munitions',           label: '🔴 Munitions' },
  { value: 'obus',                label: '🟠 Obus' },
  { value: 'bombs',               label: '💣 Bombes' },
]

const SECTOR_OPTIONS: { value: IndustrySector; label: string; icon: string; description?: string }[] = [
  { value: 'energy',          icon: '🔥',  label: 'Énergie',           description: '⛽ Carburant' },
  { value: 'manufacturing',   icon: '🏭',  label: 'Manufacture',       description: '⚙️ Acier' },
  { value: 'electronics',     icon: '💡',  label: 'Électronique',      description: '🔌 Composants' },
  { value: 'pharmaceutical',  icon: '💊',  label: 'Pharmaceutique',    description: '💊 Médicaments' },
  { value: 'food',            icon: '🍽️', label: 'Agroalimentaire',   description: '🍞 Alim. transf.' },
  { value: 'chemicalPlant',   icon: '⚗️', label: 'Usine Chimique',    description: '🌱 Engrais' },
  { value: 'vehicleFactory',  icon: '🚛',  label: 'Usine Véhicules',   description: '→ Camions' },
  { value: 'shipyard',        icon: '⚓',  label: 'Chantier Naval',    description: '→ Bateaux' },
  { value: 'aerospace',       icon: '✈️', label: 'Aérospatiale',      description: '→ Avions' },
  { value: 'phonesFactory',        icon: '📱',  label: 'Usine Téléphones',   description: '📱 Téléphones' },
  { value: 'computersFactory',     icon: '💻',  label: 'Usine Ordinateurs',  description: '💻 Ordinateurs' },
  { value: 'maintenanceWorkshop',  icon: '🔧',  label: 'Atelier Entretien',  description: '🔩 Pièces auto' },
  { value: 'powerPlant',          icon: '🔌',  label: 'Centrale Élec.',     description: '⚡ +Électricité' },
  { value: 'nuclearPlant',        icon: '☢️', label: 'Centrale Nucléaire', description: '⚡⚡ Électricité++' },
]

const MILITARY_SECTOR_OPTIONS: { value: IndustrySector; label: string; icon: string; description?: string }[] = [
  { value: 'armament',        icon: '🔫',  label: 'Armement',          description: '⚔️ Armes auto' },
  { value: 'tankFactory',     icon: '🪖',  label: 'Usine Blindés',     description: '→ Chars T1-T3' },
  { value: 'militaryAirbase', icon: '🛩️', label: 'Base Aérienne',     description: '→ Avions T1-T3' },
  { value: 'navalBase',       icon: '⚓',  label: 'Base Navale',       description: '→ Navires T1-T3' },
  { value: 'ammunitionFactory',icon: '🔴', label: 'Usine Munitions',   description: '🔴 Munitions/Obus/Bombes' },
]

// ─── Factory preview constants (mirrored from server) ─────────

const FACTORY_BASE_COSTS_UI: Record<IndustrySector, number> = {
  rawMaterials:        400,
  energy:              600,
  manufacturing:       500,
  electronics:         900,
  pharmaceutical:      800,
  armament:            1000,
  food:                350,
  chemicalPlant:       450,
  vehicleFactory:      700,
  shipyard:            900,
  aerospace:           1200,
  phonesFactory:       700,
  computersFactory:    900,
  maintenanceWorkshop: 600,
  tankFactory:         1200,
  militaryAirbase:     1500,
  navalBase:           1800,
  ammunitionFactory:   600,
  powerPlant:          500,
  nuclearPlant:        1500,
}

const FACTORY_BASE_INCOME_UI: Partial<Record<IndustrySector, number>> = {
  energy:        40,
  manufacturing: 35,
  electronics:   50,
  pharmaceutical:45,
  food:          25,
}

const MFG_OUTPUT_UI: Partial<Record<IndustrySector, { qty: number; resource: string; icon: string }>> = {
  manufacturing:    { qty: 2.0, resource: 'Acier',      icon: '⚙️' },
  energy:           { qty: 3.0, resource: 'Carburant',   icon: '⛽' },
  electronics:      { qty: 1.0, resource: 'Composants',  icon: '🔌' },
  pharmaceutical:   { qty: 1.5, resource: 'Médicaments', icon: '💊' },
  food:             { qty: 2.0, resource: 'Alim. transf.',icon: '🍞' },
  chemicalPlant:    { qty: 2.0, resource: 'Engrais',     icon: '🌱' },
  phonesFactory:    { qty: 1.0, resource: 'Téléphones',  icon: '📱' },
  computersFactory: { qty: 0.5, resource: 'Ordinateurs', icon: '💻' },
  powerPlant:       { qty: 5.0, resource: 'Électricité (infra)', icon: '⚡' },
  nuclearPlant:     { qty: 12.0, resource: 'Électricité (infra)', icon: '☢️' },
}

const VEHICLE_ENABLES_UI: Partial<Record<IndustrySector, string>> = {
  vehicleFactory:  '🚛 Camions',
  shipyard:        '⚓ Bateaux',
  aerospace:       '✈️ Avions',
  tankFactory:      '🪖 Chars T1-T3',
  militaryAirbase:  '🛩️ Avions T1-T3',
  navalBase:        '⚓ Navires T1-T3',
  ammunitionFactory:'🔴 Munitions / Obus / Bombes',
}

const FACTORY_TIER_INFO = {
  basic:     { costMult: 1.0, prodMult: 1.0, research: 0,  label: 'Basique',   color: 'text-slate-600 dark:text-slate-400' },
  advanced:  { costMult: 2.0, prodMult: 1.8, research: 30, label: 'Avancée',   color: 'text-blue-600 dark:text-blue-400' },
  robotized: { costMult: 4.0, prodMult: 3.0, research: 60, label: 'Robotisée', color: 'text-purple-600 dark:text-purple-400' },
} as const

type ResearchReq = { branch: ResearchBranch; level: number }

// Mirrored from server constants.ts SECTOR_RESEARCH_REQUIREMENTS
const SECTOR_RESEARCH_REQS: Record<string, ResearchReq[]> = {
  // ── Secteurs accessibles dès le début (basique gratuit) ──────
  'rawMaterials:basic':      [],
  'rawMaterials:advanced':   [{ branch: 'nanotech',     level: 25 }],
  'rawMaterials:robotized':  [{ branch: 'nanotech',     level: 50 }, { branch: 'nuclear',      level: 20 }],
  'energy:basic':            [],
  'energy:advanced':         [{ branch: 'cleanEnergy',  level: 25 }],
  'energy:robotized':        [{ branch: 'cleanEnergy',  level: 50 }, { branch: 'nuclear',      level: 25 }],
  'manufacturing:basic':     [],
  'manufacturing:advanced':  [{ branch: 'nanotech',     level: 25 }],
  'manufacturing:robotized': [{ branch: 'nanotech',     level: 50 }, { branch: 'cleanEnergy',  level: 20 }],
  'armament:basic':          [],
  'armament:advanced':       [{ branch: 'military',     level: 25 }],
  'armament:robotized':      [{ branch: 'military',     level: 50 }, { branch: 'nuclear',      level: 35 }],
  'food:basic':              [],
  'food:advanced':           [{ branch: 'agrotech',     level: 25 }],
  'food:robotized':          [{ branch: 'agrotech',     level: 50 }, { branch: 'cleanEnergy',  level: 15 }],
  'chemicalPlant:basic':     [],
  'chemicalPlant:advanced':  [{ branch: 'agrotech',     level: 30 }, { branch: 'cleanEnergy',  level: 15 }],
  'chemicalPlant:robotized': [{ branch: 'agrotech',     level: 50 }, { branch: 'biotech',      level: 25 }],
  // ── Secteurs techniques (petite barrière dès le basique) ─────
  'electronics:basic':       [{ branch: 'electronics',  level: 10 }],
  'electronics:advanced':    [{ branch: 'electronics',  level: 35 }, { branch: 'cybersecurity', level: 15 }],
  'electronics:robotized':   [{ branch: 'electronics',  level: 60 }, { branch: 'cybersecurity', level: 30 }, { branch: 'nanotech', level: 20 }],
  'pharmaceutical:basic':    [{ branch: 'biotech',      level: 10 }],
  'pharmaceutical:advanced': [{ branch: 'biotech',      level: 35 }, { branch: 'agrotech',     level: 20 }],
  'pharmaceutical:robotized':[{ branch: 'biotech',      level: 60 }, { branch: 'nanotech',     level: 25 }],
  'vehicleFactory:basic':    [{ branch: 'nanotech',     level: 20 }],
  'vehicleFactory:advanced': [{ branch: 'nanotech',     level: 40 }, { branch: 'cleanEnergy',  level: 20 }],
  'vehicleFactory:robotized':[{ branch: 'nanotech',     level: 60 }, { branch: 'electronics',  level: 20 }],
  'shipyard:basic':          [{ branch: 'nanotech',     level: 25 }],
  'shipyard:advanced':       [{ branch: 'nanotech',     level: 45 }, { branch: 'military',     level: 15 }],
  'shipyard:robotized':      [{ branch: 'nanotech',     level: 65 }, { branch: 'electronics',  level: 25 }, { branch: 'military', level: 20 }],
  'aerospace:basic':         [{ branch: 'nanotech',     level: 35 }, { branch: 'electronics',  level: 15 }],
  'aerospace:advanced':      [{ branch: 'nanotech',     level: 55 }, { branch: 'electronics',  level: 35 }, { branch: 'military', level: 20 }],
  'aerospace:robotized':     [{ branch: 'nanotech',     level: 70 }, { branch: 'electronics',  level: 50 }, { branch: 'nuclear',  level: 30 }],
  'phonesFactory:basic':     [{ branch: 'electronics',  level: 20 }],
  'phonesFactory:advanced':  [{ branch: 'electronics',  level: 40 }, { branch: 'cybersecurity', level: 20 }],
  'phonesFactory:robotized': [{ branch: 'electronics',  level: 60 }, { branch: 'cybersecurity', level: 35 }, { branch: 'nanotech', level: 20 }],
  'computersFactory:basic':  [{ branch: 'electronics',  level: 35 }, { branch: 'nanotech',     level: 20 }],
  'computersFactory:advanced':[{ branch: 'electronics', level: 50 }, { branch: 'nanotech',     level: 40 }, { branch: 'cybersecurity', level: 20 }],
  'computersFactory:robotized':[{ branch: 'electronics',level: 70 }, { branch: 'nanotech',     level: 55 }, { branch: 'cybersecurity', level: 35 }],
  'maintenanceWorkshop:basic':    [{ branch: 'nanotech', level: 15 }],
  'maintenanceWorkshop:advanced': [{ branch: 'nanotech', level: 35 }, { branch: 'electronics', level: 15 }],
  'maintenanceWorkshop:robotized':[{ branch: 'nanotech', level: 55 }, { branch: 'electronics', level: 30 }],
  'tankFactory:basic':     [{ branch: 'military', level: 20 }],
  'tankFactory:advanced':  [{ branch: 'military', level: 40 }, { branch: 'nanotech', level: 20 }],
  'tankFactory:robotized': [{ branch: 'military', level: 60 }, { branch: 'nanotech', level: 40 }],
  'militaryAirbase:basic':     [{ branch: 'military', level: 25 }, { branch: 'nanotech', level: 15 }],
  'militaryAirbase:advanced':  [{ branch: 'military', level: 45 }, { branch: 'nanotech', level: 35 }],
  'militaryAirbase:robotized': [{ branch: 'military', level: 65 }, { branch: 'electronics', level: 30 }],
  'navalBase:basic':     [{ branch: 'military', level: 20 }, { branch: 'nanotech', level: 20 }],
  'navalBase:advanced':  [{ branch: 'military', level: 40 }, { branch: 'nanotech', level: 35 }],
  'navalBase:robotized': [{ branch: 'military', level: 60 }, { branch: 'nanotech', level: 50 }],
  'ammunitionFactory:basic':     [{ branch: 'military',  level: 10 }],
  'ammunitionFactory:advanced':  [{ branch: 'military',  level: 30 }, { branch: 'nanotech', level: 15 }],
  'ammunitionFactory:robotized': [{ branch: 'military',  level: 50 }, { branch: 'nanotech', level: 30 }],
  'powerPlant:basic':     [{ branch: 'cleanEnergy', level: 10 }],
  'powerPlant:advanced':  [{ branch: 'cleanEnergy', level: 30 }, { branch: 'nanotech', level: 15 }],
  'powerPlant:robotized': [{ branch: 'cleanEnergy', level: 55 }, { branch: 'nanotech', level: 30 }],
  'nuclearPlant:basic':     [{ branch: 'nuclear', level: 30 }, { branch: 'cleanEnergy', level: 20 }],
  'nuclearPlant:advanced':  [{ branch: 'nuclear', level: 50 }, { branch: 'cleanEnergy', level: 40 }],
  'nuclearPlant:robotized': [{ branch: 'nuclear', level: 70 }, { branch: 'cleanEnergy', level: 55 }, { branch: 'nanotech', level: 25 }],
}

const RESEARCH_BRANCH_LABELS: Record<ResearchBranch, string> = {
  agrotech:            'Agrotech',
  nanotech:            'Nanotech',
  cleanEnergy:         'Énergie propre',
  cybersecurity:       'Cybersécurité',
  biotech:             'Biotech',
  military:            'Militaire',
  electronics:         'Électronique',
  nuclear:             'Nucléaire',
  counterIntelligence: 'Contre-espionnage',
}


const RESEARCH_OPTIONS: { value: ResearchBranch; label: string }[] = [
  { value: 'agrotech', label: 'Agrotech' },
  { value: 'nanotech', label: 'Nanotech' },
  { value: 'cleanEnergy', label: 'Énergie propre' },
  { value: 'cybersecurity', label: 'Cybersécurité' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'military', label: 'Militaire' },
  { value: 'electronics', label: 'Électronique' },
  { value: 'nuclear', label: 'Nucléaire' },
  { value: 'counterIntelligence', label: 'Contre-espionnage' },
]

const TIER_OPTIONS: { value: FactoryTier; label: string; costMult: string; prodMult: string; research: number }[] = [
  { value: 'basic',     label: 'Basique',   costMult: '×1',   prodMult: '×1.0', research: 0 },
  { value: 'advanced',  label: 'Avancée',   costMult: '×2',   prodMult: '×1.8', research: 30 },
  { value: 'robotized', label: 'Robotisée', costMult: '×4',   prodMult: '×3.0', research: 60 },
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
  researchBranches?: ResearchState['branches']
}

export function ActionSelector({
  players,
  currentPlayerId,
  maxActions,
  timeRemaining,
  onSubmit,
  hasSubmitted,
  activeWars = [],
  researchBranches,
}: ActionSelectorProps) {
  const [actions, setActions] = useState<PlayerAction[]>([])
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [draftAction, setDraftAction] = useState<Partial<PlayerAction>>({})

  const otherPlayers = players.filter((p) => p.id !== currentPlayerId && !p.abandoned)

  const addAction = (action: PlayerAction) => {
    if (actions.length >= maxActions) return
    setActions((prev) => [...prev, action])
    setDraftAction({})
    // Research and invest panels stay open — user closes them via cancel
    if (action.type !== 'research' && action.type !== 'invest') {
      setEditingSlot(null)
    }
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
            researchBranches={researchBranches}
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
  researchBranches,
  onConfirm,
  onCancel,
}: {
  actionType: ActionType
  draft: Partial<PlayerAction>
  setDraft: (d: Partial<PlayerAction>) => void
  otherPlayers: PublicPlayerInfo[]
  activeWars: PublicWarInfo[]
  currentPlayerId: string | null
  researchBranches?: ResearchState['branches']
  onConfirm: (a: PlayerAction) => void
  onCancel: () => void
}) {
  const meetsReqs = (sector: IndustrySector, tier: FactoryTier): { ok: boolean; missing: string } => {
    const reqs = SECTOR_RESEARCH_REQS[`${sector}:${tier}`] ?? []
    const missing = reqs.filter(r => (researchBranches?.[r.branch] ?? 0) < r.level)
    if (missing.length === 0) return { ok: true, missing: '' }
    const desc = missing.map(r => `${RESEARCH_BRANCH_LABELS[r.branch]} ≥${r.level}`).join(', ')
    return { ok: false, missing: desc }
  }
  const cat = ACTION_CATEGORIES.find((c) => c.type === actionType)

  const myWars = activeWars.filter(
    (w) => w.attackerId === currentPlayerId || w.defenderId === currentPlayerId,
  )

  const canConfirm = (() => {
    switch (actionType) {
      case 'defend':
      case 'developNuclear':
        return true
      case 'invest':
        if (draft.militaryUpgrade) return true
        if (draft.vehicleAction) return true
        return !!draft.sector && !!draft.factoryTier
      case 'research':
        return !!draft.researchBranch
      case 'sabotage':
      case 'war':
      case 'armistice':
      case 'bombardment':
      case 'nuclear':
      case 'trade':
        return !!draft.targetPlayerId
      case 'buyRegion':
        return !!draft.targetPlayerId && !!draft.regionId && (draft.regionPrice ?? 0) > 0
      case 'threat': {
        if (!draft.targetPlayerId || !draft.threatData?.infrastructureTarget) return false
        const dt = draft.threatData.demand?.type
        if (!dt) return false
        if (dt === 'money') return (draft.threatData.demand?.amount ?? 0) > 0
        if (dt === 'resource') return !!draft.threatData.demand?.resourceType && (draft.threatData.demand?.amount ?? 0) > 0
        return true
      }
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
          {/* Military upgrade toggle */}
          <button
            className={`w-full text-center px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors ${
              draft.militaryUpgrade
                ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-red-300'
            }`}
            onClick={() => setDraft({ ...draft, militaryUpgrade: !draft.militaryUpgrade, sector: undefined, factoryTier: undefined })}
          >
            ⚔️ Forces armées <span className="font-normal opacity-70">(+5 niveaux, coût croissant)</span>
          </button>

          {/* Factory building path */}
          {!draft.militaryUpgrade && (
            <>
              {(() => {
                const renderSectors = (sectors: typeof SECTOR_OPTIONS) => sectors.map((s) => {
                  const basicOk = meetsReqs(s.value, 'basic').ok
                  const locked = !basicOk
                  const basicMissing = meetsReqs(s.value, 'basic').missing
                  return (
                    <button
                      key={s.value}
                      disabled={locked}
                      onClick={() => setDraft({ ...draft, sector: s.value, militaryUpgrade: false, factoryTier: draft.factoryTier ?? 'basic' })}
                      title={locked ? `🔒 Requis : ${basicMissing}` : undefined}
                      className={`w-full rounded-lg px-2 py-2 border text-left transition-colors ${
                        locked
                          ? 'border-slate-200/40 dark:border-slate-700/40 bg-slate-100/40 dark:bg-slate-800/20 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                          : draft.sector === s.value
                            ? 'border-amber-400 dark:border-amber-500 bg-amber-100/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                            : 'border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-600'
                      }`}
                    >
                      <span className="text-sm">{locked ? '🔒' : s.icon}</span>
                      <span className="block text-[10px] font-semibold leading-tight mt-0.5">{s.label}</span>
                      {locked
                        ? <span className="block text-[9px] opacity-60 mt-0.5 truncate">{basicMissing}</span>
                        : s.description && <span className="block text-[9px] opacity-55 mt-0.5">{s.description}</span>
                      }
                    </button>
                  )
                })
                return (
                  <>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Usines civiles</p>
                    <div className="grid grid-cols-2 gap-1.5">{renderSectors(SECTOR_OPTIONS)}</div>
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mt-2">⚔️ Forces armées</p>
                    <div className="grid grid-cols-2 gap-1.5">{renderSectors(MILITARY_SECTOR_OPTIONS)}</div>
                  </>
                )
              })()}

              {/* Tier picker */}
              {draft.sector && (
                <>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mt-1">Niveau de l'usine</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIER_OPTIONS.map((t) => {
                      const { ok, missing } = meetsReqs(draft.sector!, t.value)
                      return (
                        <button
                          key={t.value}
                          disabled={!ok}
                          onClick={() => setDraft({ ...draft, factoryTier: t.value })}
                          title={!ok ? `🔒 Requis : ${missing}` : undefined}
                          className={`rounded-lg px-2 py-2 border text-center transition-colors ${
                            !ok
                              ? 'border-slate-200/40 dark:border-slate-700/40 bg-slate-100/40 dark:bg-slate-800/20 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                              : draft.factoryTier === t.value
                                ? 'border-amber-400 dark:border-amber-500 bg-amber-100/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                                : 'border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-600'
                          }`}
                        >
                          <span className="block text-[10px] font-bold">{!ok ? '🔒' : ''} {t.label}</span>
                          <span className="block text-[9px] opacity-60">{t.costMult} coût · {t.prodMult} prod.</span>
                          {!ok && <span className="block text-[9px] text-red-500 leading-tight truncate">{missing}</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Preview card */}
              {draft.sector && draft.factoryTier && (() => {
                const ti = FACTORY_TIER_INFO[draft.factoryTier]
                const baseCost = FACTORY_BASE_COSTS_UI[draft.sector]
                const cost = Math.round(baseCost * ti.costMult)
                const baseIncome = FACTORY_BASE_INCOME_UI[draft.sector] ?? 0
                const income = Math.round(baseIncome * ti.prodMult)
                const mfg = MFG_OUTPUT_UI[draft.sector]
                const vehicleEnables = VEHICLE_ENABLES_UI[draft.sector]
                const sectorInfo = [...SECTOR_OPTIONS, ...MILITARY_SECTOR_OPTIONS].find(s => s.value === draft.sector)
                const { ok: tierOk, missing: tierMissing } = meetsReqs(draft.sector, draft.factoryTier)
                return (
                  <div className={`rounded-lg border px-3 py-2 space-y-1 ${tierOk ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40' : 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'}`}>
                    <p className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase">
                      {sectorInfo?.icon} {sectorInfo?.label} — {ti.label}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                      <span>💰 Coût : <strong>{cost.toLocaleString('fr-FR')} $</strong></span>
                      {income > 0 && <span>📈 Revenu/tour : <strong>+{income.toLocaleString('fr-FR')} $</strong></span>}
                      {mfg && (
                        <span className="col-span-2">
                          {mfg.icon} Production : <strong>+{(mfg.qty * ti.prodMult).toFixed(1)} {mfg.resource}/tour</strong>
                        </span>
                      )}
                      {vehicleEnables && (
                        <span className="col-span-2">🏭 Permet : <strong>{vehicleEnables}</strong></span>
                      )}
                    </div>
                    {!tierOk && (
                      <p className="text-[10px] text-red-600 dark:text-red-400">🔒 Requis : {tierMissing}</p>
                    )}
                  </div>
                )
              })()}
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

      {/* Buy Region */}
      {actionType === 'buyRegion' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">1. Choisir le pays vendeur</p>
            <div className="space-y-1">
              {otherPlayers.map((p) => (
                <PickerButton key={p.id} label={`${p.countryFlag} ${p.name} (${p.regions.length} région${p.regions.length > 1 ? 's' : ''})`}
                  selected={draft.targetPlayerId === p.id}
                  onClick={() => setDraft({ ...draft, targetPlayerId: p.id, regionId: undefined })} />
              ))}
            </div>
          </div>

          {draft.targetPlayerId && (() => {
            const target = otherPlayers.find(p => p.id === draft.targetPlayerId)
            const availableRegions = target?.regions.filter(r => !r.occupiedBy && !r.destroyed) ?? []
            if (availableRegions.length === 0) return (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">Ce pays n'a aucune région disponible à la vente.</p>
            )
            return (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">2. Choisir la région</p>
                <div className="space-y-1">
                  {availableRegions.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => setDraft({ ...draft, regionId: r.id })}
                      className={`w-full rounded-lg px-3 py-2 border text-left transition-colors ${
                        draft.regionId === r.id
                          ? 'border-amber-400 dark:border-amber-500 bg-amber-100/60 dark:bg-amber-900/30'
                          : 'border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 hover:border-amber-300'
                      }`}>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">🗺️ {r.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        👥 {(r.population / 1_000_000).toFixed(1)}M hab · ⚙️ Capacité {r.productionCapacity}%
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {draft.targetPlayerId && draft.regionId && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">3. Prix proposé (€)</p>
              <input
                type="number"
                min={1}
                step={100}
                value={draft.regionPrice ?? ''}
                onChange={(e) => setDraft({ ...draft, regionPrice: Math.max(0, Number(e.target.value)) })}
                placeholder="Ex: 5000"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Le vendeur reçoit une notification. S'il accepte, la région vous appartient immédiatement avec sa population.
              </p>
            </div>
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

      {/* Threat form */}
      {actionType === 'threat' && (
        <div className="space-y-3">
          {/* Target */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Pays ciblé</p>
            <div className="space-y-1">
              {otherPlayers.map(p => (
                <PickerButton key={p.id} label={`${p.countryFlag} ${p.name}`}
                  selected={draft.targetPlayerId === p.id}
                  onClick={() => setDraft({ ...draft, targetPlayerId: p.id })} />
              ))}
            </div>
          </div>

          {/* Infrastructure */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Infrastructure visée</p>
            <div className="space-y-1">
              {THREAT_INFRA_OPTIONS.map(opt => {
                const selected = draft.threatData?.infrastructureTarget === opt.value
                return (
                  <button
                    key={opt.value}
                    title={opt.effect}
                    onClick={() => setDraft({
                      ...draft,
                      threatData: { ...draft.threatData, infrastructureTarget: opt.value, demand: draft.threatData?.demand ?? { type: 'money', amount: 0 } }
                    })}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${
                      selected
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200'
                        : 'border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-orange-300'
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{opt.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold block">{opt.label}</span>
                      <span className="text-[10px] opacity-65 block leading-tight">{opt.effect}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Demand type */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Exigence</p>
            <div className="grid grid-cols-2 gap-1">
              {THREAT_DEMAND_OPTIONS.map(opt => (
                <PickerButton key={opt.value}
                  label={`${opt.icon} ${opt.label}`}
                  selected={draft.threatData?.demand?.type === opt.value}
                  onClick={() => setDraft({
                    ...draft,
                    threatData: {
                      ...draft.threatData,
                      infrastructureTarget: draft.threatData?.infrastructureTarget ?? 'electricity',
                      demand: { type: opt.value }
                    }
                  })} />
              ))}
            </div>
          </div>

          {/* Demand amount (money or resource) */}
          {draft.threatData?.demand?.type === 'money' && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Montant (€)</p>
              <input
                type="range" min={100} max={5000} step={100}
                value={draft.threatData.demand.amount ?? 0}
                onChange={e => setDraft({ ...draft, threatData: { ...draft.threatData!, infrastructureTarget: draft.threatData!.infrastructureTarget, demand: { ...draft.threatData!.demand, amount: Number(e.target.value) } } })}
                className="w-full accent-orange-500"
              />
              <p className="text-xs text-center font-bold text-orange-600 dark:text-orange-400">
                💰 {draft.threatData.demand.amount ?? 0} €
              </p>
            </div>
          )}
          {draft.threatData?.demand?.type === 'resource' && (
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Ressource</p>
                <select
                  value={draft.threatData.demand.resourceType ?? ''}
                  onChange={e => setDraft({ ...draft, threatData: { ...draft.threatData!, infrastructureTarget: draft.threatData!.infrastructureTarget, demand: { ...draft.threatData!.demand, resourceType: e.target.value as ResourceType } } })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Choisir...</option>
                  {TRADEABLE_RESOURCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Quantité</p>
                <input
                  type="range" min={1} max={100} step={1}
                  value={draft.threatData.demand.amount ?? 1}
                  onChange={e => setDraft({ ...draft, threatData: { ...draft.threatData!, infrastructureTarget: draft.threatData!.infrastructureTarget, demand: { ...draft.threatData!.demand, amount: Number(e.target.value) } } })}
                  className="w-full accent-orange-500"
                />
                <p className="text-xs text-center font-bold text-orange-600 dark:text-orange-400">
                  📦 {draft.threatData.demand.amount ?? 1} unités
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simple actions */}
      {(actionType === 'defend' || actionType === 'developNuclear') && (
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          {actionType === 'defend' && <p>Protège toutes vos installations contre le sabotage ce tour.</p>}
          {actionType === 'developNuclear' && (
            <>
              <p>Avance le programme nucléaire de votre pays (4 tours, ~17% PIB/tour).</p>
              <p>Une fois terminé, vous pouvez fabriquer des bombes (6% PIB chacune, maintenance 1% PIB/tour).</p>
              <p className="text-red-500 dark:text-red-400 font-semibold">☢️ Utiliser une bombe : détruit une région ennemie 12 tours, −70% pop locale, −40% bonheur cible, −50% influence + −25% bonheur pour vous, +17% pollution mondiale.</p>
              <p className="text-amber-500 dark:text-amber-400">Requiert : recherche nucléaire ≥ 75.</p>
            </>
          )}
        </div>
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

// ─── Vehicle Picker ──────────────────────────────────────────


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
