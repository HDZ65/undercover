import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { EcoWarPrivatePlayerState, Factory, IndustrySector, FactoryTier, VehicleType, VehicleTier, ResourceState } from '@undercover/shared'

// ─── Constants (mirrored from server) ─────────────────────────

const SECTOR_LABEL: Record<IndustrySector, string> = {
  food:                '🌾 Agroalimentaire',
  energy:              '⚡ Énergie',
  rawMaterials:        '🔩 Matières Premières',
  manufacturing:       '🏭 Industrie Lourde',
  electronics:         '💻 Électronique',
  pharmaceutical:      '💊 Pharmaceutique',
  armament:            '🔫 Armement',
  chemicalPlant:       '🧪 Usine Chimique',
  vehicleFactory:      '🚛 Usine de Véhicules',
  shipyard:            '⚓ Chantier Naval',
  aerospace:           '✈️ Aérospatiale',
  phonesFactory:       '📱 Usine Téléphones',
  computersFactory:    '💻 Usine Ordinateurs',
  maintenanceWorkshop: '🔧 Atelier d\'Entretien',
  tankFactory:         '🪖 Usine de Blindés',
  militaryAirbase:     '🛩️ Base Aérienne Militaire',
  navalBase:           '⚓ Base Navale',
  ammunitionFactory:   '🔴 Usine de Munitions',
  powerPlant:          '🔌 Centrale Électrique',
  nuclearPlant:        '☢️ Centrale Nucléaire',
}

const SECTOR_BASE_INCOME: Record<IndustrySector, number> = {
  rawMaterials:        0,
  energy:              40,
  manufacturing:       35,
  electronics:         50,
  pharmaceutical:      45,
  armament:            0,
  food:                25,
  // Secteurs de biens manufacturés — pas de revenu direct, produisent des biens
  chemicalPlant:       0,
  vehicleFactory:      0,
  shipyard:            0,
  aerospace:           0,
  phonesFactory:       0,
  computersFactory:    0,
  maintenanceWorkshop: 0,
  tankFactory:         0,
  militaryAirbase:     0,
  navalBase:           0,
  ammunitionFactory:   0,
  powerPlant:          0,
  nuclearPlant:        0,
}

const SECTOR_BASE_COST: Record<IndustrySector, number> = {
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

// ─── Goods output metadata (sectors that produce physical goods) ──

const MFG_GOODS_OUTPUT: Partial<Record<IndustrySector, { icon: string; label: string; perFactory: number }>> = {
  manufacturing:    { icon: '⚙️', label: 'Acier',               perFactory: 2.0 },
  energy:           { icon: '⛽', label: 'Carburant',            perFactory: 3.0 },
  electronics:      { icon: '🔌', label: 'Composants élec.',     perFactory: 1.0 },
  pharmaceutical:   { icon: '💊', label: 'Médicaments',          perFactory: 1.5 },
  food:             { icon: '🍞', label: 'Alim. transformés',    perFactory: 2.0 },
  chemicalPlant:    { icon: '🌱', label: 'Engrais',              perFactory: 2.0 },
  phonesFactory:    { icon: '📱', label: 'Téléphones',           perFactory: 1.0 },
  computersFactory: { icon: '💻', label: 'Ordinateurs',          perFactory: 0.5 },
  powerPlant:       { icon: '⚡', label: 'Électricité (infra)',  perFactory: 5.0 },
  nuclearPlant:     { icon: '☢️', label: 'Électricité (infra)',  perFactory: 12.0 },
}

// Consommation de matières premières par unité produite (miroir du serveur)
const MFG_INPUTS: Record<string, { resource: keyof ResourceState; amountPerUnit: number }[]> = {
  manufacturing:    [{ resource: 'iron',                amountPerUnit: 1.5 }, { resource: 'coal', amountPerUnit: 0.8 }],
  energy:           [{ resource: 'oil',                 amountPerUnit: 2.0 }],
  electronics:      [{ resource: 'rareEarths',          amountPerUnit: 0.8 }, { resource: 'coal', amountPerUnit: 0.3 }],
  pharmaceutical:   [{ resource: 'vegetables',          amountPerUnit: 0.5 }, { resource: 'water', amountPerUnit: 0.4 }],
  food:             [{ resource: 'cereals',             amountPerUnit: 1.0 }, { resource: 'water', amountPerUnit: 0.3 }],
  chemicalPlant:    [{ resource: 'coal',                amountPerUnit: 0.8 }, { resource: 'water', amountPerUnit: 0.6 }, { resource: 'oil', amountPerUnit: 0.3 }],
  phonesFactory:    [{ resource: 'electronicComponents', amountPerUnit: 0.8 }, { resource: 'rareEarths', amountPerUnit: 0.2 }],
  computersFactory: [{ resource: 'electronicComponents', amountPerUnit: 1.2 }, { resource: 'steel', amountPerUnit: 0.5 }, { resource: 'rareEarths', amountPerUnit: 0.3 }],
  powerPlant:       [{ resource: 'coal', amountPerUnit: 1.5 }],
  nuclearPlant:     [{ resource: 'uranium', amountPerUnit: 0.5 }],
}

const RESOURCE_LABEL: Record<string, string> = {
  oil: 'Pétrole', iron: 'Fer', coal: 'Charbon', rareEarths: 'Terres rares', uranium: 'Uranium',
  water: 'Eau', cereals: 'Céréales', vegetables: 'Légumes',
  steel: 'Acier', fuel: 'Carburant', electronicComponents: 'Composants élec.',
  pharmaceuticals: 'Médicaments', processedFood: 'Alim. transf.', fertilizer: 'Engrais',
  phones: 'Téléphones', computers: 'Ordinateurs',
}

// Vehicle sector metadata for production choice UI
const VEHICLE_SECTOR_META: Partial<Record<IndustrySector, { vehicleType: VehicleType; vehicleLabel: string; icon: string }>> = {
  vehicleFactory: { vehicleType: 'truck', vehicleLabel: 'Camion', icon: '🚛' },
  shipyard:       { vehicleType: 'ship',  vehicleLabel: 'Bateau', icon: '⚓' },
  aerospace:      { vehicleType: 'plane', vehicleLabel: 'Avion',  icon: '✈️' },
}

// Military unit sector metadata for production choice UI
const MILITARY_UNIT_SECTOR_META: Partial<Record<IndustrySector, { unitLabel: string; icon: string }>> = {
  tankFactory:     { unitLabel: 'Char',   icon: '🪖' },
  militaryAirbase: { unitLabel: 'Avion militaire', icon: '🛩️' },
  navalBase:       { unitLabel: 'Navire de guerre', icon: '⚓' },
}

const FACTORY_TIER_LEVEL: Record<FactoryTier, number> = { basic: 1, advanced: 2, robotized: 3 }



const TIER_MULT: Record<FactoryTier, number> = {
  basic:     1.0,
  advanced:  1.8,
  robotized: 3.0,
}

const TIER_COST_MULT: Record<FactoryTier, number> = {
  basic:     1.0,
  advanced:  2.0,
  robotized: 4.0,
}

const TIER_LABEL: Record<FactoryTier, string> = {
  basic:     'Basique',
  advanced:  'Avancé',
  robotized: 'Robotisé',
}

const TIER_COLOR: Record<FactoryTier, string> = {
  basic:     'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  advanced:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  robotized: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
}

const RECONVERSION_RATE = 0.15

const ALL_SECTORS = Object.keys(SECTOR_LABEL) as IndustrySector[]

function computeFactoryIncome(factory: Factory, infraAvg: number, productivityMult: number): number {
  const base         = SECTOR_BASE_INCOME[factory.sector] ?? 100
  const healthMult   = factory.health / 100
  const tierMult     = TIER_MULT[factory.tier] ?? 1.0
  const infraMult    = 0.5 + infraAvg / 100
  return Math.round(base * healthMult * tierMult * infraMult * productivityMult)
}

function reconversionCost(factory: Factory, newSector: IndustrySector): number {
  const base     = SECTOR_BASE_COST[newSector] ?? 500
  const tierCost = TIER_COST_MULT[factory.tier] ?? 1.0
  return Math.round(base * tierCost * RECONVERSION_RATE)
}

// ─── Factory card ─────────────────────────────────────────────

type ProductionChoiceOpts = {
  vehicleType?: VehicleType
  vehicleTier?: VehicleTier
  weaponTier?: 1 | 2 | 3 | 4
  partTier?: 1 | 2 | 3 | 4
  ammoType?: 'munitions' | 'obus' | 'bombs'
}

const NEXT_TIER: Record<FactoryTier, FactoryTier | null> = { basic: 'advanced', advanced: 'robotized', robotized: null }
const UPGRADE_COST_MULT: Record<string, number> = { basic_to_advanced: 1.3, advanced_to_robotized: 2.5 }

function upgradeCost(factory: Factory): number {
  const next = NEXT_TIER[factory.tier]
  if (!next) return 0
  const key = `${factory.tier}_to_${next}`
  const mult = UPGRADE_COST_MULT[key] ?? 0
  const base = SECTOR_BASE_COST[factory.sector] ?? 500
  return Math.round(base * mult)
}

interface FactoryCardProps {
  factory: Factory
  income: number
  money: number
  resources: ResourceState
  isActionPhase: boolean
  onReconvert: (factoryId: string, newSector: IndustrySector) => void
  onUpgrade: (factoryId: string) => void
  currentChoice?: ProductionChoiceOpts
  onSetProductionChoice?: (sector: IndustrySector, opts: ProductionChoiceOpts) => void
  bestTierLevel?: number
  nuclearLevel?: number
}

function FactoryCard({ factory, income, money, resources, isActionPhase, onReconvert, onUpgrade, currentChoice, onSetProductionChoice, bestTierLevel, nuclearLevel }: FactoryCardProps) {
  const [showReconvert, setShowReconvert] = useState(false)

  const healthColor = factory.health > 60
    ? 'bg-emerald-500'
    : factory.health > 30
      ? 'bg-amber-500'
      : 'bg-red-500'

  const otherSectors = ALL_SECTORS.filter(s => s !== factory.sector)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
          {SECTOR_LABEL[factory.sector]}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_COLOR[factory.tier]}`}>
          {TIER_LABEL[factory.tier]}
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Health + income/goods output */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-center">
            {MFG_GOODS_OUTPUT[factory.sector] ? (
              <>
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {MFG_GOODS_OUTPUT[factory.sector]!.icon} {Math.round(MFG_GOODS_OUTPUT[factory.sector]!.perFactory * (TIER_MULT[factory.tier] ?? 1.0))}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{MFG_GOODS_OUTPUT[factory.sector]!.label}/tour</div>
              </>
            ) : VEHICLE_SECTOR_META[factory.sector] ? (
              (() => {
                const meta = VEHICLE_SECTOR_META[factory.sector]!
                const currentTier = currentChoice?.vehicleTier ?? 1
                return (
                  <>
                    <div className="text-[10px] font-black text-blue-700 dark:text-blue-300 leading-tight">
                      {meta.icon} Production auto
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {meta.vehicleLabel} N{currentTier}
                    </div>
                  </>
                )
              })()
            ) : factory.sector === 'armament' ? (
              <>
                <div className="text-[10px] font-black text-red-700 dark:text-red-300 leading-tight">
                  ⚔️ Production auto
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Arme T{currentChoice?.weaponTier ?? 1}
                </div>
              </>
            ) : MILITARY_UNIT_SECTOR_META[factory.sector] ? (
              (() => {
                const meta = MILITARY_UNIT_SECTOR_META[factory.sector]!
                const currentTier = currentChoice?.vehicleTier ?? 1
                return (
                  <>
                    <div className="text-[10px] font-black text-red-700 dark:text-red-300 leading-tight">
                      {meta.icon} Production auto
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {meta.unitLabel} T{currentTier}
                    </div>
                  </>
                )
              })()
            ) : factory.sector === 'maintenanceWorkshop' ? (
              <>
                <div className="text-[10px] font-black text-amber-700 dark:text-amber-300 leading-tight">
                  🔩 Pièces T{currentChoice?.partTier ?? 1}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  /tour (identifiées à vous)
                </div>
              </>
            ) : factory.sector === 'ammunitionFactory' ? (
              <>
                <div className="text-[10px] font-black text-red-700 dark:text-red-300 leading-tight">
                  🔴 {currentChoice?.ammoType ?? 'munitions'}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  /tour · produit via usine
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  +{income} $
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">revenu/tour</div>
              </>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Santé</span>
              <span className={factory.health < 40 ? 'text-red-500 font-bold' : 'text-slate-500'}>
                {factory.health}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${healthColor}`}
                style={{ width: `${factory.health}%` }}
              />
            </div>
          </div>
        </div>

        {/* Health warning */}
        {factory.health < 40 && (
          <p className="text-[10px] text-red-500 font-semibold">
            ⚠️ Entretien critique — production réduite de {100 - factory.health}%
          </p>
        )}

        {/* Consumption & stock per factory */}
        {MFG_INPUTS[factory.sector] && (() => {
          const inputs = MFG_INPUTS[factory.sector]
          const outputPerFactory = MFG_GOODS_OUTPUT[factory.sector]?.perFactory ?? 0
          const tierMult = TIER_MULT[factory.tier] ?? 1.0
          const production = Math.ceil(outputPerFactory * tierMult)
          return (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-2 py-1 bg-slate-50 dark:bg-slate-800/60 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Consommation / tour → {production} unités
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {inputs.map(({ resource, amountPerUnit }) => {
                  const consumed = Math.ceil(amountPerUnit * production)
                  const stock = Math.floor(resources[resource] ?? 0)
                  const insufficient = stock < consumed
                  return (
                    <div key={resource} className="flex items-center justify-between px-2 py-1 text-[10px]">
                      <span className="text-slate-600 dark:text-slate-300">{RESOURCE_LABEL[resource] ?? resource}</span>
                      <span className={`font-bold ${insufficient ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                        -{consumed}/tour · stock {stock}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Vehicle production choice */}
        {VEHICLE_SECTOR_META[factory.sector] && isActionPhase && (() => {
          const meta = VEHICLE_SECTOR_META[factory.sector]!
          const maxTier = bestTierLevel ?? 1
          const currentTier = currentChoice?.vehicleTier ?? 1
          const tiers: VehicleTier[] = [1, 2, 3]
          return (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  {meta.icon} Choisir ce que l'usine produit ce tour
                </p>
              </div>
              <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
                {tiers.map(tier => {
                  const enabled = tier <= maxTier
                  const active = currentTier === tier
                  return (
                    <button
                      key={tier}
                      disabled={!enabled}
                      onClick={() => onSetProductionChoice?.(factory.sector, { vehicleType: meta.vehicleType, vehicleTier: tier })}
                      className={`flex-1 py-2 text-[10px] font-bold transition-colors ${
                        !enabled
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                          : active
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      }`}
                    >
                      {meta.vehicleLabel} N{tier}
                      {!enabled && <span className="block text-[8px] opacity-60">usine {tier === 2 ? 'avancée' : 'robotisée'} requise</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Armament production choice */}
        {factory.sector === 'armament' && isActionPhase && (() => {
          const maxTier = Math.min(bestTierLevel ?? 1, (nuclearLevel ?? 0) >= 35 ? 4 : 3)
          const currentTier = currentChoice?.weaponTier ?? 1
          const tierLabels: Record<number, string> = { 1: 'Conventionnel', 2: 'Avancé', 3: 'Haute Tech', 4: 'Stratégique' }
          return (
            <div className="rounded-xl border border-red-200 dark:border-red-800/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30">
                <p className="text-[10px] font-bold text-red-700 dark:text-red-300">
                  ⚔️ Choisir le tier d'arme à produire
                </p>
              </div>
              <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
                {([1, 2, 3, 4] as const).map(tier => {
                  const enabled = tier <= maxTier
                  const active = currentTier === tier
                  return (
                    <button
                      key={tier}
                      disabled={!enabled}
                      onClick={() => onSetProductionChoice?.(factory.sector, { weaponTier: tier })}
                      className={`flex-1 py-1.5 text-[9px] font-bold transition-colors leading-tight ${
                        !enabled
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                          : active
                            ? 'bg-red-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                      }`}
                    >
                      T{tier}
                      <span className="block text-[8px] opacity-70">{tierLabels[tier]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Military unit production choice (tankFactory / militaryAirbase / navalBase) */}
        {MILITARY_UNIT_SECTOR_META[factory.sector] && isActionPhase && (() => {
          const meta = MILITARY_UNIT_SECTOR_META[factory.sector]!
          const maxTier = bestTierLevel ?? 1
          const currentTier = currentChoice?.vehicleTier ?? 1
          const tiers: VehicleTier[] = [1, 2, 3]
          return (
            <div className="rounded-xl border border-red-200 dark:border-red-800/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30">
                <p className="text-[10px] font-bold text-red-700 dark:text-red-300">
                  {meta.icon} Choisir le tier d'unité à produire
                </p>
              </div>
              <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
                {tiers.map(tier => {
                  const enabled = tier <= maxTier
                  const active = currentTier === tier
                  return (
                    <button
                      key={tier}
                      disabled={!enabled}
                      onClick={() => onSetProductionChoice?.(factory.sector, { vehicleTier: tier })}
                      className={`flex-1 py-2 text-[10px] font-bold transition-colors leading-tight ${
                        !enabled
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                          : active
                            ? 'bg-red-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                      }`}
                    >
                      {meta.unitLabel} T{tier}
                      {!enabled && <span className="block text-[8px] opacity-60">{tier === 2 ? 'base avancée' : 'base robotisée'} requise</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Maintenance Workshop part tier choice */}
        {factory.sector === 'maintenanceWorkshop' && isActionPhase && (() => {
          const workshopMaxPartTier: Record<number, number> = { 1: 2, 2: 3, 3: 4 }
          const maxPartTier = workshopMaxPartTier[bestTierLevel ?? 1] ?? 2
          const currentTier = currentChoice?.partTier ?? 1
          return (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  🔩 Choisir le tier de pièces à produire
                </p>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Pièces identifiées à votre pays — seul vous pouvez les fournir
                </p>
              </div>
              <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
                {([1, 2, 3, 4] as const).map(tier => {
                  const enabled = tier <= maxPartTier
                  const active = currentTier === tier
                  return (
                    <button
                      key={tier}
                      disabled={!enabled}
                      onClick={() => onSetProductionChoice?.(factory.sector, { partTier: tier })}
                      className={`flex-1 py-2 text-[10px] font-bold transition-colors ${
                        !enabled
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                          : active
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      Pièces T{tier}
                      {!enabled && <span className="block text-[8px] opacity-60">atelier {tier <= 3 ? 'avancé' : 'robotisé'} requis</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── AMMUNITION FACTORY: ammo type picker ── */}
        {factory.sector === 'ammunitionFactory' && isActionPhase && (() => {
          const currentAmmo = currentChoice?.ammoType ?? 'munitions'
          const AMMO_OPTIONS: { type: 'munitions' | 'obus' | 'bombs'; icon: string; label: string; desc: string }[] = [
            { type: 'munitions', icon: '🔴', label: 'Munitions', desc: '8/usine — Infanterie' },
            { type: 'obus',      icon: '🟠', label: 'Obus',      desc: '3/usine — Chars' },
            { type: 'bombs',     icon: '💣', label: 'Bombes',    desc: '1/usine — Avions' },
          ]
          return (
            <div className="rounded-xl border border-red-200 dark:border-red-800/60 overflow-hidden">
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30">
                <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">Type de munition</p>
              </div>
              <div className="flex divide-x divide-red-100 dark:divide-red-900/40">
                {AMMO_OPTIONS.map(({ type, icon, label, desc }) => (
                  <button
                    key={type}
                    onClick={() => onSetProductionChoice?.(factory.sector, { ammoType: type })}
                    className={`flex-1 py-2 text-[10px] font-bold transition-colors ${
                      currentAmmo === type
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                    }`}
                  >
                    {icon} {label}
                    <span className="block text-[8px] opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Upgrade tier */}
        {isActionPhase && NEXT_TIER[factory.tier] && (
          <button
            onClick={() => onUpgrade(factory.id)}
            disabled={money < upgradeCost(factory)}
            className={`w-full py-2 rounded-lg text-[10px] font-bold text-center transition-colors ${
              money >= upgradeCost(factory)
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            ⬆ Améliorer → {TIER_LABEL[NEXT_TIER[factory.tier]!]} ({upgradeCost(factory).toLocaleString('fr-FR')} $)
          </button>
        )}

        {/* Reconversion */}
        {isActionPhase && (
          <>
            <button
              onClick={() => setShowReconvert(v => !v)}
              className="w-full py-2 rounded-lg text-[10px] font-bold text-center transition-colors bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {showReconvert ? '✕ Annuler' : '↺ Reconvertir (gratuit en actions)'}
            </button>

            {showReconvert && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-[10px] text-slate-500">
                    Niveau conservé · Effet immédiat · Coût 15% du neuf
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {otherSectors.map(sector => {
                    const cost    = reconversionCost(factory, sector)
                    const canAfford = money >= cost
                    return (
                      <button
                        key={sector}
                        disabled={!canAfford}
                        onClick={() => {
                          onReconvert(factory.id, sector)
                          setShowReconvert(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors ${
                          canAfford
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <span>{SECTOR_LABEL[sector]}</span>
                        <span className={`font-bold ${canAfford ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'}`}>
                          {cost.toLocaleString('fr-FR')} $
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

interface FactoryPanelProps {
  state: EcoWarPrivatePlayerState
  isActionPhase: boolean
  onClose: () => void
  onReconvertFactory?: (factoryId: string, newSector: IndustrySector) => void
  onUpgradeFactory?: (factoryId: string) => void
  onSetProductionChoice?: (sector: IndustrySector, opts: ProductionChoiceOpts) => void
}

// ─── Reference guide data ─────────────────────────────────────

type SectorGuide = {
  label: string
  costBasic: number
  costAdvanced: number
  costRobotized: number
  outputBasic: string
  outputAdvanced: string
  outputRobotized: string
}

function buildGuide(): SectorGuide[] {
  const mults = { basic: 1.0, advanced: 1.8, robotized: 3.0 }
  const costMults = { basic: 1.0, advanced: 2.0, robotized: 4.0 }

  return (Object.keys(SECTOR_LABEL) as IndustrySector[]).map(sector => {
    const baseCost = SECTOR_BASE_COST[sector]
    const goods = MFG_GOODS_OUTPUT[sector]
    const baseIncome = SECTOR_BASE_INCOME[sector]
    const vehicleMeta = VEHICLE_SECTOR_META[sector]

    const outputFor = (tier: FactoryTier): string => {
      const m = mults[tier]
      if (goods) return `${Math.round(goods.perFactory * m)} ${goods.label}`
      if (vehicleMeta) return `${vehicleMeta.icon} ${vehicleMeta.vehicleLabel}s`
      if (baseIncome > 0) return `+${Math.round(baseIncome * m)} $`
      return '—'
    }

    return {
      label: SECTOR_LABEL[sector],
      costBasic:    Math.round(baseCost * costMults.basic),
      costAdvanced: Math.round(baseCost * costMults.advanced),
      costRobotized:Math.round(baseCost * costMults.robotized),
      outputBasic:    outputFor('basic'),
      outputAdvanced: outputFor('advanced'),
      outputRobotized:outputFor('robotized'),
    }
  })
}

const SECTOR_GUIDE = buildGuide()

export function FactoryPanel({ state, isActionPhase, onClose, onReconvertFactory, onUpgradeFactory, onSetProductionChoice }: FactoryPanelProps) {
  const [showGuide, setShowGuide] = useState(false)
  const infraAvg = (
    state.infrastructure.electricity +
    state.infrastructure.telecom +
    state.infrastructure.waterTreatment
  ) / 3

  const productivityMult = state.population.productivityMultiplier

  const incomes = state.factories.map(f => computeFactoryIncome(f, infraAvg, productivityMult))
  const totalIncome = incomes.reduce((s, v) => s + v, 0)

  // Group counts by sector for summary
  const sectorCounts: Partial<Record<IndustrySector, number>> = {}
  for (const f of state.factories) {
    sectorCounts[f.sector] = (sectorCounts[f.sector] ?? 0) + 1
  }

  // Compute best factory tier level per sector (for production choice constraints)
  const sectorBestTierLevel: Partial<Record<IndustrySector, number>> = {}
  for (const f of state.factories) {
    const lvl = FACTORY_TIER_LEVEL[f.tier] ?? 1
    if ((sectorBestTierLevel[f.sector] ?? 0) < lvl) {
      sectorBestTierLevel[f.sector] = lvl
    }
  }

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
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">🏭 Usines & Production</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {state.factories.length} usine{state.factories.length !== 1 ? 's' : ''} · +{totalIncome} $/tour
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">

          {/* Summary badges */}
          {Object.entries(sectorCounts).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(sectorCounts) as [IndustrySector, number][]).map(([sector, count]) => (
                <span
                  key={sector}
                  className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium"
                >
                  {SECTOR_LABEL[sector]} ×{count}
                </span>
              ))}
            </div>
          )}

          {/* Empty state */}
          {state.factories.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucune usine construite</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Utilisez l'action <strong>Investir</strong> pendant la phase d'actions pour construire une usine.
              </p>
            </div>
          )}

          {/* Factory cards */}
          {state.factories.map((factory, i) => (
            <FactoryCard
              key={factory.id}
              factory={factory}
              income={incomes[i]}
              money={state.money}
              resources={state.resources}
              isActionPhase={isActionPhase}
              onReconvert={(id, sector) => onReconvertFactory?.(id, sector)}
              onUpgrade={(id) => onUpgradeFactory?.(id)}
              currentChoice={state.productionChoices?.[factory.sector]}
              onSetProductionChoice={onSetProductionChoice}
              bestTierLevel={sectorBestTierLevel[factory.sector] ?? 1}
              nuclearLevel={state.research.branches.nuclear ?? 0}
            />
          ))}

          {/* Reconversion info note */}
          {isActionPhase && state.factories.length > 0 && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 px-3 py-2">
              <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">
                ↺ La reconversion ne consomme pas de slot d'action — changer de type est gratuit en actions.
              </p>
            </div>
          )}

          {/* Reference guide toggle */}
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full py-2 rounded-xl text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {showGuide ? '✕ Fermer le guide' : '📋 Guide : coûts & production par palier'}
          </button>

          <AnimatePresence>
            {showGuide && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-[10px]">
                  {/* Header row */}
                  <div className="grid grid-cols-4 gap-0 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 font-bold text-slate-600 dark:text-slate-300">
                    <span>Secteur</span>
                    <span className="text-center">Basique</span>
                    <span className="text-center">Avancé</span>
                    <span className="text-center">Robotisé</span>
                  </div>
                  {/* Cost rows */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {SECTOR_GUIDE.map(g => (
                      <div key={g.label} className="grid grid-cols-4 gap-0 px-2 py-1.5 even:bg-slate-50 dark:even:bg-slate-800/20">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{g.label}</span>
                        <div className="text-center">
                          <p className="text-slate-500 dark:text-slate-400">{g.costBasic.toLocaleString('fr-FR')} $</p>
                          <p className="text-emerald-600 dark:text-emerald-400">{g.outputBasic}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-blue-500 dark:text-blue-400">{g.costAdvanced.toLocaleString('fr-FR')} $</p>
                          <p className="text-emerald-600 dark:text-emerald-400">{g.outputAdvanced}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-purple-500 dark:text-purple-400">{g.costRobotized.toLocaleString('fr-FR')} $</p>
                          <p className="text-emerald-600 dark:text-emerald-400">{g.outputRobotized}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500">
                    Coût = prix de construction · Production = par usine/tour (×1.0 / ×1.8 / ×3.0)
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
            <span>
              Infrastructures : ×{(0.5 + infraAvg / 100).toFixed(2)} · Productivité : ×{productivityMult.toFixed(2)}
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Total : +{totalIncome} $/tour
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
