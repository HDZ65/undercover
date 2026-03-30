/**
 * Empire du Commerce — Production & Income
 * Handles factory production, resource extraction, income collection
 */

import type { Factory, IndustrySector, FactoryTier, InfrastructureType } from '@undercover/shared';
import type { ServerPlayerState } from './types';
import type { FactoryProductionInfo, AlertInfo } from '@undercover/shared';
import {
  FACTORY_TIERS,
  FACTORY_BASE_COSTS,
  FACTORY_BASE_INCOME,
  FACTORY_RECONVERSION_COST_RATE,
  FACTORY_UPGRADE_COST_MULT,
  TOOL_TIERS,
  INFRA_UPGRADE_COST,
  TRANSPORT_UPGRADE_COST,
  TOURISM_GDP_CAP,
  MONUMENT_DIMINISHING_FACTOR,
  MFG_OUTPUT_PER_FACTORY,
  MFG_OUTPUT_RESOURCE,
  POP_PRODUCTIVITY_FULL_AT,
} from './constants';
import { randomUUID as uuid } from 'crypto';

export function collectIncome(player: ServerPlayerState): number {
  let totalIncome = 0;

  // Factory production — apply sector-specific active effects
  for (const factory of player.factories) {
    let factoryIncome = calculateFactoryIncome(factory, player);

    for (const effect of player.activeEffects) {
      if (effect.affectedSector && sectorMatch(effect.affectedSector, factory.sector)) {
        factoryIncome = Math.max(0, factoryIncome * (1 + effect.modifier));
      }
    }

    totalIncome += factoryIncome;
  }

  // Apply general active effects (war mobilization, pandemic, crash, etc.)
  let generalMult = 1.0;
  for (const effect of player.activeEffects) {
    if (!effect.affectedSector) {
      generalMult *= (1 + effect.modifier);
    }
  }
  totalIncome = Math.max(0, totalIncome * generalMult);

  // Patent royalties
  for (const patent of player.patents) {
    totalIncome += patent.incomePerTurn;
  }

  // Tourism income (capped at 15-20% of GDP)
  const tourismIncome = calculateTourismIncome(player);
  const tourismCap = player.gdp * TOURISM_GDP_CAP;
  player.tourism.income = Math.min(tourismIncome, tourismCap);
  totalIncome += player.tourism.income;

  return Math.round(totalIncome);
}

/** Maps event sector names to factory sector names */
function sectorMatch(effectSector: string, factorySector: string): boolean {
  if (effectSector === factorySector) return true;
  // Market events use 'agriculture', factories use 'food'
  if (effectSector === 'agriculture' && factorySector === 'food') return true;
  return false;
}

export function calculateFactoryIncome(factory: Factory, player: ServerPlayerState): number {
  const baseIncome = FACTORY_BASE_INCOME[factory.sector] || 100;
  const healthMult = factory.health / 100;
  const tierData = FACTORY_TIERS[factory.tier];
  const toolData = TOOL_TIERS[player.tools.tier];
  const infraMult = getInfrastructureMultiplier(player);
  const productivityMult = player.population.productivityMultiplier;

  return baseIncome * healthMult * tierData.productionMultiplier * toolData.multiplier * infraMult * productivityMult;
}

export function calculateTourismIncome(player: ServerPlayerState): number {
  let income = 0;
  const attractiveness = player.tourism.attractiveness;

  // Base tourism from attractiveness (quadratic — high happiness pays off)
  income += attractiveness * 3 + Math.pow(attractiveness / 10, 2) * 5;

  // Monuments with diminishing returns
  let monumentMult = 1.0;
  for (const monument of player.tourism.monuments) {
    income += monument.incomeMultiplier * 100 * monumentMult;
    monumentMult *= MONUMENT_DIMINISHING_FACTOR;
  }

  // Happiness multiplier: 0.3× at happiness=0, 1.5× at happiness=100
  income *= (0.3 + 1.2 * (player.population.happinessLevel / 100));

  return Math.round(income);
}

export function calculateMaintenanceCosts(player: ServerPlayerState): number {
  let costs = 0;

  // Factory maintenance (paused factories don't cost maintenance)
  for (const factory of player.factories) {
    if (factory.paused) continue;
    costs += FACTORY_TIERS[factory.tier].maintenanceCost;
  }

  // Tool maintenance
  costs += TOOL_TIERS[player.tools.tier].maintenanceCost;

  // Military maintenance (exponential above 50)
  costs += calculateMilitaryMaintenance(player);

  // Weapon maintenance
  for (const weapon of player.military.weapons) {
    costs += weapon.maintenanceCost;
  }

  // Nuclear bomb maintenance
  costs += player.military.nuclearBombs * player.gdp * 0.01;

  // Organization cotisations
  // (handled separately in organizations.ts)

  return Math.round(costs);
}

export function calculateMilitaryMaintenance(player: ServerPlayerState): number {
  const level = player.military.armedForces;
  if (level <= 50) {
    return level * 10; // linear below 50
  }
  // Exponential above 50
  const base = 50 * 10;
  const excess = level - 50;
  return base + Math.pow(excess, 1.4) * 2;
}

export function getFactoryCost(sector: IndustrySector, tier: FactoryTier, existingCount: number): number {
  const baseCost = FACTORY_BASE_COSTS[sector] || 500;
  const tierMult = FACTORY_TIERS[tier].costMultiplier;
  const scalingFactor = 1 + existingCount * 0.3;
  return Math.round(baseCost * tierMult * scalingFactor);
}

export function createFactory(sector: IndustrySector, tier: FactoryTier): Factory {
  return {
    id: uuid(),
    sector,
    tier,
    health: 100,
    pollutionRate: tier === 'robotized' ? 2 : tier === 'advanced' ? 4 : 6,
    paused: false,
  };
}

/**
 * Reconvert an existing factory to a new sector.
 * Cost = FACTORY_RECONVERSION_COST_RATE × baseCost(newSector, sameTier, 0 existing).
 * Preserves tier and health. Returns cost paid, or 0 if failed.
 */
export function reconvertFactory(
  player: ServerPlayerState,
  factoryId: string,
  newSector: IndustrySector,
): number {
  const factory = player.factories.find(f => f.id === factoryId);
  if (!factory) return 0;
  if (factory.sector === newSector) return 0;

  const cost = Math.round(
    (FACTORY_BASE_COSTS[newSector] || 500)
    * FACTORY_TIERS[factory.tier].costMultiplier
    * FACTORY_RECONVERSION_COST_RATE,
  );

  if (player.money < cost) return 0;

  player.money -= cost;
  factory.sector = newSector;
  return cost;
}

const NEXT_TIER: Record<string, FactoryTier | null> = {
  basic: 'advanced',
  advanced: 'robotized',
  robotized: null,
};

export function getFactoryUpgradeCost(factory: Factory): number {
  const nextTier = NEXT_TIER[factory.tier];
  if (!nextTier) return 0;
  const key = `${factory.tier}_to_${nextTier}`;
  const mult = FACTORY_UPGRADE_COST_MULT[key] ?? 0;
  const baseCost = FACTORY_BASE_COSTS[factory.sector] || 500;
  return Math.round(baseCost * mult);
}

export function upgradeFactory(
  player: ServerPlayerState,
  factoryId: string,
): { cost: number; error?: string } {
  const factory = player.factories.find(f => f.id === factoryId);
  if (!factory) return { cost: 0, error: 'Usine introuvable' };

  const nextTier = NEXT_TIER[factory.tier];
  if (!nextTier) return { cost: 0, error: 'Usine déjà au niveau maximum' };

  const researchReq = FACTORY_TIERS[nextTier].researchRequired;
  const playerResearch = Math.max(
    ...Object.values(player.research.branches).map(v => v ?? 0),
  );
  if (playerResearch < researchReq) {
    return { cost: 0, error: `Recherche insuffisante (besoin: ${researchReq})` };
  }

  const cost = getFactoryUpgradeCost(factory);
  if (player.money < cost) return { cost, error: `Fonds insuffisants (besoin: ${cost}€)` };

  player.money -= cost;
  factory.tier = nextTier;
  factory.pollutionRate = nextTier === 'robotized' ? 2 : nextTier === 'advanced' ? 4 : 6;
  return { cost };
}

export function getInfrastructureCost(currentLevel: number): number {
  return Math.round(INFRA_UPGRADE_COST * (1 + currentLevel / 50));
}

export function upgradeInfrastructure(player: ServerPlayerState, type: InfrastructureType, amount: number): void {
  const newLevel = Math.min(100, player.infrastructure[type] + amount);
  player.infrastructure[type] = newLevel;
}

export function upgradeTransport(player: ServerPlayerState, type: 'roads' | 'ports' | 'airports', amount: number): void {
  const newLevel = Math.min(100, player.transport[type] + amount);
  player.transport[type] = newLevel;
  // Recalculate trade cost reduction
  const avg = (player.transport.roads + player.transport.ports + player.transport.airports) / 3;
  player.transport.tradeCostReduction = Math.min(0.30, avg / 100 * 0.30);
}

function getInfrastructureMultiplier(player: ServerPlayerState): number {
  const avg = (player.infrastructure.electricity + player.infrastructure.telecom + player.infrastructure.waterTreatment) / 3;
  return 0.5 + (avg / 100);
}

// ─── Sector display names ────────────────────────────────────────
const SECTOR_LABELS: Record<string, string> = {
  rawMaterials: 'Matières premières', energy: 'Énergie', manufacturing: 'Sidérurgie',
  electronics: 'Électronique', pharmaceutical: 'Pharmaceutique', armament: 'Armement',
  food: 'Agroalimentaire', chemicalPlant: 'Chimie', vehicleFactory: 'Usine Véhicules',
  shipyard: 'Chantier Naval', aerospace: 'Aérospatiale', phonesFactory: 'Usine Téléphones',
  computersFactory: 'Usine Ordinateurs', maintenanceWorkshop: 'Atelier Entretien',
  tankFactory: 'Usine Chars', militaryAirbase: 'Base Aérienne', navalBase: 'Base Navale',
  ammunitionFactory: 'Usine Munitions',
  powerPlant: 'Centrale Électrique', nuclearPlant: 'Centrale Nucléaire',
};

const RESOURCE_LABELS: Record<string, string> = {
  steel: 'acier', fuel: 'carburant', electronicComponents: 'composants',
  pharmaceuticals: 'médicaments', processedFood: 'nourriture', fertilizer: 'engrais',
  phones: 'téléphones', computers: 'ordinateurs', electricity: 'électricité (infra)',
};

const TIER_LABELS: Record<string, string> = { basic: 'Basique', advanced: 'Avancée', robotized: 'Robotisée' };

// ─── Factory production info for UI ──────────────────────────────

export function buildFactoryProductionInfo(player: ServerPlayerState): FactoryProductionInfo[] {
  const productivityPct = Math.round(player.population.productivityMultiplier * 100);
  const infraMult = getInfrastructureMultiplier(player);
  const toolMult = TOOL_TIERS[player.tools.tier].multiplier;

  return player.factories.map(f => {
    const tierData = FACTORY_TIERS[f.tier];
    const healthMult = f.health / 100;
    // Efficiency = santé × infra × productivité (0-100%, sans tier ni outils)
    const efficiency = Math.min(100, Math.round(healthMult * infraMult * player.population.productivityMultiplier * 100));

    // Income-generating factories
    const baseIncome = FACTORY_BASE_INCOME[f.sector] || 0;
    // Manufacturing output
    const mfgBase = MFG_OUTPUT_PER_FACTORY[f.sector];
    const resourceKey = MFG_OUTPUT_RESOURCE[f.sector];

    let output: string;
    if (mfgBase && resourceKey) {
      const qty = Math.ceil(mfgBase * tierData.productionMultiplier * healthMult * toolMult * infraMult * player.population.productivityMultiplier);
      const resLabel = RESOURCE_LABELS[resourceKey] ?? resourceKey;
      output = `${qty} ${resLabel}/tour`;
      if (baseIncome > 0) {
        const income = Math.round(baseIncome * healthMult * tierData.productionMultiplier * toolMult * infraMult * player.population.productivityMultiplier);
        output += ` + ${income}€`;
      }
    } else if (baseIncome > 0) {
      const income = Math.round(baseIncome * healthMult * tierData.productionMultiplier * toolMult * infraMult * player.population.productivityMultiplier);
      output = `${income}€/tour`;
    } else if (['vehicleFactory', 'shipyard', 'aerospace'].includes(f.sector)) {
      output = 'Véhicules de transport';
    } else if (['tankFactory', 'militaryAirbase', 'navalBase'].includes(f.sector)) {
      output = 'Unités militaires';
    } else if (f.sector === 'maintenanceWorkshop') {
      output = 'Pièces d\'entretien';
    } else if (f.sector === 'ammunitionFactory') {
      output = 'Munitions';
    } else {
      output = `${efficiency}% capacité`;
    }

    return {
      factoryId: f.id,
      sector: SECTOR_LABELS[f.sector] ?? f.sector,
      tier: TIER_LABELS[f.tier] ?? f.tier,
      output,
      productionRate: efficiency,
    };
  });
}

// ─── Alerts for UI ───────────────────────────────────────────────

export function buildAlerts(player: ServerPlayerState): AlertInfo[] {
  const alerts: AlertInfo[] = [];
  const happiness = player.population.happinessLevel;
  const prodMult = player.population.productivityMultiplier;
  const prodPct = Math.round(prodMult * 100);

  // Happiness penalty
  if (happiness < POP_PRODUCTIVITY_FULL_AT) {
    const severity = happiness < 40 ? 'critical' : 'warning';
    alerts.push({
      icon: '😟',
      label: 'Bonheur bas',
      detail: `${Math.round(happiness)}% bonheur → productivité à ${prodPct}% (−${100 - prodPct}%)`,
      severity,
    });
  }

  // Infrastructure
  const infraAvg = (player.infrastructure.electricity + player.infrastructure.telecom + player.infrastructure.waterTreatment) / 3;
  const infraMult = 0.5 + (infraAvg / 100);
  if (infraMult < 0.85) {
    const pct = Math.round(infraMult * 100);
    alerts.push({
      icon: '🏗️',
      label: 'Infrastructure faible',
      detail: `Production à ${pct}% (moy. infra: ${Math.round(infraAvg)}%)`,
      severity: infraMult < 0.65 ? 'critical' : 'warning',
    });
  }

  // Pollution
  if (player.pollution > 60) {
    alerts.push({
      icon: '🏭',
      label: 'Pollution élevée',
      detail: `${Math.round(player.pollution)}% — baisse du bonheur`,
      severity: player.pollution > 80 ? 'critical' : 'warning',
    });
  }

  // Factory health
  const damagedFactories = player.factories.filter(f => f.health < 70);
  if (damagedFactories.length > 0) {
    const worst = Math.min(...damagedFactories.map(f => f.health));
    alerts.push({
      icon: '🔧',
      label: `${damagedFactories.length} usine(s) endommagée(s)`,
      detail: `Pire état : ${worst}% santé → production réduite`,
      severity: worst < 40 ? 'critical' : 'warning',
    });
  }

  // Fleet empty (can't trade resources)
  if (player.fleet.vehicles.length === 0) {
    alerts.push({
      icon: '🚛',
      label: 'Pas de véhicules',
      detail: 'Commerce de ressources impossible — construisez des véhicules',
      severity: 'warning',
    });
  }

  // Fuel shortage
  const fuelVehicles = player.fleet.vehicles.filter(v => v.fuelType === 'oil');
  const fuelNeeded = fuelVehicles.reduce((s, v) => s + v.fuelConsumption, 0);
  if (fuelNeeded > 0 && (player.resources.fuel ?? 0) < fuelNeeded) {
    alerts.push({
      icon: '⛽',
      label: 'Carburant insuffisant',
      detail: `${Math.floor(player.resources.fuel ?? 0)}/${fuelNeeded} — capacité de transport réduite`,
      severity: 'warning',
    });
  }

  // Steel shortage (for vehicle/military production)
  const steelConsumers = player.factories.filter(f => ['vehicleFactory', 'shipyard', 'aerospace', 'tankFactory', 'militaryAirbase', 'navalBase', 'computersFactory'].includes(f.sector));
  if (steelConsumers.length > 0 && (player.resources.steel ?? 0) < 5) {
    alerts.push({
      icon: '🔩',
      label: 'Acier bas',
      detail: `${Math.floor(player.resources.steel ?? 0)} acier — un camion T1 coûte 5, un char T1 coûte 5. Production ralentie.`,
      severity: (player.resources.steel ?? 0) < 2 ? 'critical' : 'warning',
    });
  }

  // Port too low for shipyard
  const hasShipyard = player.factories.some(f => f.sector === 'shipyard');
  if (hasShipyard && player.transport.ports < 40) {
    alerts.push({
      icon: '⚓',
      label: 'Ports insuffisants',
      detail: `Niveau ${player.transport.ports}/40 requis — chantier naval bloqué`,
      severity: 'critical',
    });
  }

  return alerts;
}
