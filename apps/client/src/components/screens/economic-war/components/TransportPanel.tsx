import { motion } from 'motion/react'
import type { EcoWarPrivatePlayerState, MaintenancePart, Vehicle, VehicleType, VehicleTier } from '@undercover/shared'

// ─── Vehicle metadata (mirrored from server constants) ────────

interface VehicleSpecUI {
  capacity: number
  fuelType: 'pétrole' | 'électrique'
  lifespan: number
  cost: number
  steelCost: number
  componentsCost?: number
  research?: string
  portRequired?: boolean
}

const VEHICLE_SPECS_UI: Record<VehicleType, Record<VehicleTier, VehicleSpecUI>> = {
  truck: {
    1: { capacity: 10,   fuelType: 'pétrole',    lifespan: 8,  cost: 300,  steelCost: 5  },
    2: { capacity: 25,   fuelType: 'pétrole',    lifespan: 12, cost: 700,  steelCost: 10, research: 'Nanotech 30' },
    3: { capacity: 50,   fuelType: 'électrique', lifespan: 16, cost: 1500, steelCost: 15, componentsCost: 3, research: 'Nanotech 60' },
  },
  ship: {
    1: { capacity: 50,   fuelType: 'pétrole',    lifespan: 10, cost: 600,  steelCost: 20, portRequired: true },
    2: { capacity: 120,  fuelType: 'pétrole',    lifespan: 14, cost: 1400, steelCost: 35, portRequired: true, research: 'Nanotech 30' },
    3: { capacity: 300,  fuelType: 'électrique', lifespan: 20, cost: 3000, steelCost: 60, componentsCost: 10, portRequired: true, research: 'Nanotech 60' },
  },
  plane: {
    1: { capacity: 30,   fuelType: 'pétrole',    lifespan: 6,  cost: 800,  steelCost: 12 },
    2: { capacity: 70,   fuelType: 'pétrole',    lifespan: 8,  cost: 1800, steelCost: 20, research: 'Nanotech 40' },
    3: { capacity: 150,  fuelType: 'électrique', lifespan: 12, cost: 3500, steelCost: 30, componentsCost: 15, research: 'Nanotech 70' },
  },
}

const VEHICLE_TYPE_ICON: Record<VehicleType, string> = {
  truck: '🚛',
  ship:  '⚓',
  plane: '✈️',
}

const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  truck: 'Camion',
  ship:  'Bateau',
  plane: 'Avion',
}

// ─── Vehicle Card ─────────────────────────────────────────────

function VehicleCard({
  vehicle,
  creatorName,
  hasParts,
}: { vehicle: Vehicle; creatorName?: string; hasParts?: boolean }) {
  const agePct  = Math.min(100, (vehicle.ageInTurns / vehicle.maxLifespan) * 100)
  const turnsLeft = Math.max(0, vehicle.maxLifespan - vehicle.ageInTurns)
  const ageColor = turnsLeft <= 2 ? 'bg-red-500' : turnsLeft <= 4 ? 'bg-amber-500' : 'bg-emerald-500'
  const expiringSoon = turnsLeft <= 3

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${expiringSoon ? (hasParts ? 'border-amber-300 dark:border-amber-700' : 'border-red-300 dark:border-red-700') : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{VEHICLE_TYPE_ICON[vehicle.type]}</span>
          <div>
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">
              {VEHICLE_TYPE_LABEL[vehicle.type]} <span className="text-slate-500 font-normal">T{vehicle.tier}</span>
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {vehicle.fuelType === 'oil' ? '⛽ Pétrole' : '⚡ Électrique'} · {vehicle.fuelConsumption} u./tour
            </p>
            {creatorName && (
              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                🏭 Constructeur : <span className="font-semibold">{creatorName}</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-blue-600 dark:text-blue-400">{vehicle.capacity}</p>
          <p className="text-[9px] text-slate-400">cargo/tour</p>
        </div>
      </div>

      {/* Lifespan bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Durée de vie</span>
          <span className={turnsLeft <= 2 ? 'text-red-500 font-bold' : ''}>
            {turnsLeft} tour{turnsLeft !== 1 ? 's' : ''} restant{turnsLeft !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${ageColor}`}
            style={{ width: `${agePct}%` }}
          />
        </div>
      </div>

      {expiringSoon && (
        <p className={`text-[9px] font-semibold ${hasParts ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
          {hasParts ? '🔩 Pièces disponibles — entretien auto ce tour' : '⚠️ Bientôt hors service — aucune pièce compatible'}
        </p>
      )}
    </div>
  )
}

// ─── Build Guide ──────────────────────────────────────────────

function BuildGuide() {
  const rows: { type: VehicleType; tier: VehicleTier }[] = [
    { type: 'truck', tier: 1 }, { type: 'truck', tier: 2 }, { type: 'truck', tier: 3 },
    { type: 'ship',  tier: 1 }, { type: 'ship',  tier: 2 }, { type: 'ship',  tier: 3 },
    { type: 'plane', tier: 1 }, { type: 'plane', tier: 2 }, { type: 'plane', tier: 3 },
  ]

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
        Pour construire un véhicule, utilisez l'action <strong>Investir → Véhicule</strong> pendant la phase d'actions.
        Chaque achat consomme un slot d'action.
      </p>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 grid grid-cols-5 gap-1 text-[9px] font-black text-slate-500 uppercase">
          <span className="col-span-2">Véhicule</span>
          <span className="text-center">Cargo</span>
          <span className="text-center">Coût</span>
          <span className="text-center">Acier</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ type, tier }) => {
            const spec = VEHICLE_SPECS_UI[type]?.[tier]
            if (!spec) return null
            return (
              <div key={`${type}-${tier}`} className="px-3 py-1.5 grid grid-cols-5 gap-1 text-[10px] items-center">
                <span className="col-span-2 font-semibold text-slate-700 dark:text-slate-300">
                  {VEHICLE_TYPE_ICON[type]} {VEHICLE_TYPE_LABEL[type]} T{tier}
                  {spec.research && <span className="block text-[9px] opacity-50">{spec.research}</span>}
                </span>
                <span className="text-center font-bold text-blue-600 dark:text-blue-400">{spec.capacity}</span>
                <span className="text-center text-slate-600 dark:text-slate-400">{spec.cost.toLocaleString('fr-FR')} $</span>
                <span className="text-center text-slate-600 dark:text-slate-400">{spec.steelCost}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

interface TransportPanelProps {
  state: EcoWarPrivatePlayerState
  playerNames?: Record<string, string>   // playerId → countryName
  onClose: () => void
}

export function TransportPanel({ state, playerNames = {}, onClose }: TransportPanelProps) {
  const { fleet } = state
  const vehicles = fleet?.vehicles ?? []
  const totalCapacity = fleet?.totalCapacity ?? 0
  const maintenanceParts: MaintenancePart[] = state.maintenanceParts ?? []

  // Group by type
  const byType = vehicles.reduce<Record<string, Vehicle[]>>((acc, v) => {
    (acc[v.type] ??= []).push(v)
    return acc
  }, {})

  // Fuel consumption summary
  const oilFuel  = vehicles.filter(v => v.fuelType === 'oil').reduce((s, v) => s + v.fuelConsumption, 0)
  const elecFuel = vehicles.filter(v => v.fuelType === 'electric').reduce((s, v) => s + v.fuelConsumption, 0)

  // Parts lookup helper
  const hasPartsForVehicle = (v: Vehicle) =>
    maintenanceParts.some(p => p.tier === v.tier && p.manufacturerId === v.createdBy && p.quantity >= 1)

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
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">🚛 Flotte de Transport</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {vehicles.length} véhicule{vehicles.length !== 1 ? 's' : ''} · Capacité totale : <strong className="text-blue-600 dark:text-blue-400">{totalCapacity}</strong> u./tour
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Capacity summary */}
          {totalCapacity > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 px-3 py-2 text-center">
                <p className="text-lg font-black text-blue-700 dark:text-blue-300">{totalCapacity}</p>
                <p className="text-[10px] text-slate-500">cap. totale</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-3 py-2 text-center">
                <p className="text-lg font-black text-amber-700 dark:text-amber-300">{oilFuel}</p>
                <p className="text-[10px] text-slate-500">⛽ carburant/tour</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2 text-center">
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{elecFuel}</p>
                <p className="text-[10px] text-slate-500">⚡ électr./tour</p>
              </div>
            </div>
          )}

          {/* Empty fleet state */}
          {vehicles.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center">
              <p className="text-2xl mb-2">🚛</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucun véhicule dans la flotte</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Sans flotte, vos ventes commerciales ne sont pas limitées par la capacité.
              </p>
            </div>
          )}

          {/* Vehicles by type */}
          {(['truck', 'ship', 'plane'] as VehicleType[]).map(type => {
            const list = byType[type]
            if (!list?.length) return null
            const typeCapacity = list.reduce((s, v) => s + v.capacity, 0)
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {VEHICLE_TYPE_ICON[type]} {VEHICLE_TYPE_LABEL[type]}s ({list.length})
                  </p>
                  <span className="text-[10px] text-blue-500 font-bold">{typeCapacity} u.</span>
                </div>
                {list.map(v => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    creatorName={playerNames[v.createdBy] ?? (v.createdBy ? '?' : undefined)}
                    hasParts={hasPartsForVehicle(v)}
                  />
                ))}
              </div>
            )
          })}

          {/* Maintenance parts inventory */}
          {maintenanceParts.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                🔩 Pièces d'Entretien
              </p>
              <div className="space-y-1.5">
                {maintenanceParts.filter(p => p.quantity > 0).map((p, i) => {
                  const mfgName = playerNames[p.manufacturerId] ?? p.manufacturerId
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          Pièces T{p.tier}
                        </span>
                        <span className="text-[9px] text-slate-500 ml-2">
                          Fabriquées par <span className="font-semibold">{mfgName}</span>
                        </span>
                      </div>
                      <span className="text-sm font-black text-amber-700 dark:text-amber-300">×{p.quantity}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[9px] text-slate-400 mt-2">
                Les pièces s'appliquent automatiquement aux véhicules du même constructeur avec ≤3 tours restants.
              </p>
            </div>
          )}

          {/* Build guide */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              📋 Guide de Construction
            </p>
            <BuildGuide />
          </div>

        </div>
      </motion.div>
    </motion.div>
  )
}
