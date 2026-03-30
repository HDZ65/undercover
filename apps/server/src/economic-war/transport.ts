/**
 * Empire du Commerce — Transport Fleet
 *
 * Gestion de la flotte de véhicules de transport (camions, bateaux, avions).
 *
 * Chaque tour :
 *   1. Les véhicules vieillissent (ageInTurns++)
 *   2. Les véhicules ayant atteint maxLifespan sont retirés automatiquement
 *   3. Les véhicules oil-powered consomment du carburant (fuel)
 *      - Si fuel < besoin, la capacité est réduite proportionnellement
 *   4. Les véhicules electric consomment de l'électricité via infra
 *      - Si electricity < 40, capacité réduite proportionnellement
 *   5. totalCapacity est recalculée
 *
 * Construction de véhicule (action immédiate) :
 *   - buildVehicle() : vérifie prérequis (usine, recherche, port), déduit coût
 */

import type { ServerPlayerState } from './types.js';
import type { IndustrySector, VehicleType, VehicleTier, Vehicle, ResolutionEntry } from '@undercover/shared';
import {
  VEHICLE_SPECS,
  VEHICLE_SPEC_MAP,
  VEHICLE_REQUIRED_SECTOR,
  MAINTENANCE_AUTO_APPLY_THRESHOLD,
} from './constants.js';
import { randomUUID as uuid } from 'crypto';

// Production accumulation threshold per vehicle tier (units needed to build one vehicle)
const VEHICLE_BUILD_THRESHOLD: Record<number, number> = { 1: 1.0, 2: 2.5, 3: 5.0 };
// Production rate multiplier per factory tier
const FACTORY_TIER_MULT: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 };
// Max factory tier number per FactoryTier string (basic=1, advanced=2, robotized=3)
const FACTORY_TIER_LEVEL: Record<string, number> = { basic: 1, advanced: 2, robotized: 3 };
// Default vehicle type per sector
const SECTOR_DEFAULT_VEHICLE: Partial<Record<IndustrySector, { vehicleType: VehicleType; vehicleTier: VehicleTier }>> = {
  vehicleFactory: { vehicleType: 'truck', vehicleTier: 1 },
  shipyard:       { vehicleType: 'ship',  vehicleTier: 1 },
  aerospace:      { vehicleType: 'plane', vehicleTier: 1 },
};

// ─── Production automatique de véhicules ───────────────────────

export function tickVehicleProduction(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    const res = player.resources as unknown as Record<string, number>;

    for (const sector of ['vehicleFactory', 'shipyard', 'aerospace'] as IndustrySector[]) {
      const sectorFactories = player.factories.filter(f => f.sector === sector);
      if (sectorFactories.length === 0) continue;
      // Determine best factory tier and average health
      let bestTierLevel = 0;
      let bestTierStr = 'basic';
      let totalHealth = 0;
      for (const f of sectorFactories) {
        const lvl = FACTORY_TIER_LEVEL[f.tier] ?? 1;
        if (lvl > bestTierLevel) { bestTierLevel = lvl; bestTierStr = f.tier; }
        totalHealth += f.health;
      }
      const avgHealth = (totalHealth / sectorFactories.length) / 100;

      // Get production choice, capped by factory tier
      const rawChoice = player.productionChoices[sector] ?? SECTOR_DEFAULT_VEHICLE[sector];
      if (!rawChoice) continue;
      const vehicleType = rawChoice.vehicleType ?? SECTOR_DEFAULT_VEHICLE[sector]?.vehicleType;
      if (!vehicleType) continue;
      const rawVehicleTier = rawChoice.vehicleTier ?? SECTOR_DEFAULT_VEHICLE[sector]?.vehicleTier ?? 1;
      const vehicleTier = Math.min(rawVehicleTier, bestTierLevel) as VehicleTier;

      // Accumulate production progress
      const queueKey = sector;
      const rate = sectorFactories.length * (FACTORY_TIER_MULT[bestTierStr] ?? 1.0) * avgHealth;
      const prev = player.vehicleProductionQueue[queueKey] ?? 0;
      const next = prev + rate;

      const threshold = VEHICLE_BUILD_THRESHOLD[vehicleTier] ?? 1.0;

      if (next < threshold) {
        player.vehicleProductionQueue[queueKey] = next;
        continue;
      }

      // Enough progress — try to build one vehicle
      const spec = VEHICLE_SPEC_MAP[vehicleType]?.[vehicleTier];
      if (!spec) continue;

      // Check port for ships
      if (spec.portRequirement && player.transport.ports < spec.portRequirement) {
        player.vehicleProductionQueue[queueKey] = next; // keep progress
        entries.push({
          step: 'production', playerId: player.id,
          description: `⚠️ ${player.countryName} : ${vehicleLabel(vehicleType, vehicleTier)} prêt mais ports insuffisants (${player.transport.ports}/${spec.portRequirement})`,
          icon: '🚢', positive: false,
        });
        continue;
      }

      // Check if player can afford
      if (player.money < spec.buildCost) {
        player.vehicleProductionQueue[queueKey] = next;
        entries.push({
          step: 'production', playerId: player.id,
          description: `⚠️ ${player.countryName} : ${vehicleLabel(vehicleType, vehicleTier)} prêt mais fonds insuffisants (${Math.floor(player.money)}/${spec.buildCost}€)`,
          icon: '💸', positive: false,
        });
        continue;
      }
      if ((res['steel'] ?? 0) < spec.steelCost) {
        player.vehicleProductionQueue[queueKey] = next;
        entries.push({
          step: 'production', playerId: player.id,
          description: `⚠️ ${player.countryName} : ${vehicleLabel(vehicleType, vehicleTier)} prêt mais acier insuffisant (${Math.floor(res['steel'] ?? 0)}/${spec.steelCost})`,
          icon: '🔩', positive: false,
        });
        continue;
      }
      if (spec.componentsCost && (res['electronicComponents'] ?? 0) < spec.componentsCost) {
        player.vehicleProductionQueue[queueKey] = next;
        entries.push({
          step: 'production', playerId: player.id,
          description: `⚠️ ${player.countryName} : ${vehicleLabel(vehicleType, vehicleTier)} prêt mais composants insuffisants`,
          icon: '🔧', positive: false,
        });
        continue;
      }

      // Deduct costs
      player.money -= spec.buildCost;
      res['steel'] = Math.max(0, (res['steel'] ?? 0) - spec.steelCost);
      if (spec.componentsCost) {
        res['electronicComponents'] = Math.max(0, (res['electronicComponents'] ?? 0) - spec.componentsCost);
      }

      // Build the vehicle
      const vehicle: Vehicle = {
        id:              uuid(),
        type:            vehicleType,
        tier:            vehicleTier,
        capacity:        getBaseCapacity(vehicleType, vehicleTier),
        ageInTurns:      0,
        maxLifespan:     spec.maxLifespan,
        fuelType:        spec.fuelType,
        fuelConsumption: spec.fuelConsumption,
        createdBy:       player.id,
      };
      player.fleet.vehicles.push(vehicle);
      player.fleet.totalCapacity = player.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);

      // Reset progress (carry over remainder)
      player.vehicleProductionQueue[queueKey] = next - threshold;

      entries.push({
        step: 'production',
        playerId: player.id,
        description: `🚛 ${player.countryName} : ${vehicleLabel(vehicleType, vehicleTier)} construit (${spec.buildCost}€ + ${spec.steelCost} acier)`,
        icon: vehicleType === 'truck' ? '🚛' : vehicleType === 'ship' ? '🚢' : '✈️',
        positive: true,
      });
    }
  }

  return entries;
}

// ─── Tick principal ────────────────────────────────────────────

export function tickTransport(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;
    if (player.fleet.vehicles.length === 0) continue;

    const res = player.resources as unknown as Record<string, number>;

    // 1. Vieillissement + suppression des véhicules expirés
    const expired: Vehicle[] = [];
    const alive:   Vehicle[] = [];

    for (const v of player.fleet.vehicles) {
      v.ageInTurns++;
      if (v.ageInTurns >= v.maxLifespan) {
        expired.push(v);
      } else {
        alive.push(v);
      }
    }

    for (const v of expired) {
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `🔧 ${player.countryName} : ${vehicleLabel(v.type, v.tier)} retiré (fin de vie après ${v.maxLifespan} tours)`,
        icon: '🔧',
        positive: false,
      });
    }

    player.fleet.vehicles = alive;

    // 2. Consommation de carburant / électricité
    for (const v of player.fleet.vehicles) {
      if (v.fuelType === 'oil') {
        // Consomme du carburant raffiné (fuel), pas du pétrole brut directement
        const fuelAvail = res['fuel'] ?? 0;
        const consumed  = Math.min(v.fuelConsumption, fuelAvail);
        res['fuel'] = Math.max(0, fuelAvail - consumed);
        // Capacité réduite si fuel insuffisant
        const ratio = v.fuelConsumption > 0 ? consumed / v.fuelConsumption : 1.0;
        v.capacity = Math.round(getBaseCapacity(v.type, v.tier) * ratio);
      } else {
        // Véhicule électrique — besoin minimum d'infra électrique
        const elecRatio = Math.min(1.0, player.infrastructure.electricity / 40);
        v.capacity = Math.round(getBaseCapacity(v.type, v.tier) * elecRatio);
      }
    }

    // 3. Recalculer totalCapacity
    player.fleet.totalCapacity = player.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);

    // Alerte si flotte fortement réduite
    if (expired.length > 0) {
      const newTotal = player.fleet.totalCapacity;
      if (newTotal < 200) {
        entries.push({
          step: 'production',
          playerId: player.id,
          description: `⚠️ ${player.countryName} : capacité de transport critique (${newTotal} u.) — construisez de nouveaux véhicules`,
          icon: '🚛',
          positive: false,
        });
      }
    }
  }

  return entries;
}

// ─── Construction d'un véhicule (action immédiate) ─────────────

export function buildVehicle(
  player: ServerPlayerState,
  vehicleType: VehicleType,
  tier: VehicleTier,
): boolean {
  const spec = VEHICLE_SPEC_MAP[vehicleType]?.[tier];
  if (!spec) return false;

  // Vérifier que l'usine correspondante existe
  const requiredSector = VEHICLE_REQUIRED_SECTOR[vehicleType];
  const hasFactory = player.factories.some(f => f.sector === requiredSector);
  if (!hasFactory) return false;

  // Vérifier les prérequis de recherche
  if (spec.researchBranch && spec.researchLevel) {
    const branchLevel = player.research.branches[spec.researchBranch as keyof typeof player.research.branches] ?? 0;
    if (branchLevel < spec.researchLevel) return false;
  }

  // Vérifier le niveau de port pour les bateaux
  if (spec.portRequirement && player.transport.ports < spec.portRequirement) return false;

  // Vérifier les ressources : argent + acier + composants optionnels
  const res = player.resources as unknown as Record<string, number>;
  if (player.money < spec.buildCost) return false;
  if ((res['steel'] ?? 0) < spec.steelCost) return false;
  if (spec.componentsCost && (res['electronicComponents'] ?? 0) < spec.componentsCost) return false;

  // Déduire les coûts
  player.money       -= spec.buildCost;
  res['steel']        = (res['steel'] ?? 0) - spec.steelCost;
  if (spec.componentsCost) {
    res['electronicComponents'] = (res['electronicComponents'] ?? 0) - spec.componentsCost;
  }

  // Créer et ajouter le véhicule
  const vehicle: Vehicle = {
    id:              uuid(),
    type:            spec.type,
    tier:            spec.tier,
    capacity:        getBaseCapacity(spec.type, spec.tier),
    ageInTurns:      0,
    maxLifespan:     spec.maxLifespan,
    fuelType:        spec.fuelType,
    fuelConsumption: spec.fuelConsumption,
    createdBy:       player.id,
  };

  player.fleet.vehicles.push(vehicle);
  player.fleet.totalCapacity = player.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────

function getBaseCapacity(type: string, tier: number): number {
  const spec = VEHICLE_SPEC_MAP[type]?.[tier];
  return spec?.capacity ?? 0;
}

function vehicleLabel(type: string, tier: number): string {
  const names: Record<string, string> = { truck: 'Camion', ship: 'Bateau', plane: 'Avion' };
  return `${names[type] ?? type} N${tier}`;
}

// ─── Auto-Maintenance ─────────────────────────────────────────

export function tickAutoMaintenance(
  players: Map<string, ServerPlayerState>,
  playerNames: Map<string, string>,  // playerId → countryName
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    // ── Véhicules ──
    for (const vehicle of player.fleet.vehicles) {
      if (vehicle.ageInTurns < vehicle.maxLifespan - MAINTENANCE_AUTO_APPLY_THRESHOLD) continue;

      const partEntry = player.maintenanceParts.find(
        p => p.tier === vehicle.tier && p.manufacturerId === vehicle.createdBy && p.quantity >= 1,
      );
      if (!partEntry) continue;

      partEntry.quantity--;
      vehicle.ageInTurns = 0;

      const builderName = playerNames.get(vehicle.createdBy) ?? vehicle.createdBy;
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `🔧 ${player.countryName} : ${vehicleLabel(vehicle.type, vehicle.tier)} remis à neuf (pièces de ${builderName})`,
        icon: '🔧',
        positive: true,
      });
    }

    // ── Armes (proprietary) ──
    for (const weapon of player.military.weapons) {
      if (weapon.license !== 'proprietary' || !weapon.sellerId) continue;
      if (weapon.efficacy >= 70) continue;

      const partEntry = player.maintenanceParts.find(
        p => p.tier === weapon.tier && p.manufacturerId === weapon.sellerId && p.quantity >= 1,
      );
      if (!partEntry) continue;

      partEntry.quantity--;
      weapon.efficacy = 100;

      const builderName = playerNames.get(weapon.sellerId) ?? weapon.sellerId;
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `🔧 ${player.countryName} : Arme T${weapon.tier} restaurée à 100% (pièces de ${builderName})`,
        icon: '🔧',
        positive: true,
      });
    }
  }

  return entries;
}

// ─── Lookup des specs (pour UI et validation) ─────────────────

export { VEHICLE_SPECS };
