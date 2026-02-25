/**
 * Empire du Commerce — Production & Income
 * Handles factory production, resource extraction, income collection
 */

import type { Factory, IndustrySector, FactoryTier, InfrastructureType } from '@undercover/shared';
import type { ServerPlayerState } from './types';
import {
  FACTORY_TIERS,
  FACTORY_BASE_COSTS,
  FACTORY_BASE_INCOME,
  TOOL_TIERS,
  INFRA_UPGRADE_COST,
  TRANSPORT_UPGRADE_COST,
  TOURISM_GDP_CAP,
  MONUMENT_DIMINISHING_FACTOR,
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

  // Base tourism from attractiveness
  income += attractiveness * 5;

  // Monuments with diminishing returns
  let monumentMult = 1.0;
  for (const monument of player.tourism.monuments) {
    income += monument.incomeMultiplier * 100 * monumentMult;
    monumentMult *= MONUMENT_DIMINISHING_FACTOR;
  }

  // Happiness bonus
  income *= (0.5 + (player.population.happinessLevel / 200));

  return Math.round(income);
}

export function calculateMaintenanceCosts(player: ServerPlayerState): number {
  let costs = 0;

  // Factory maintenance
  for (const factory of player.factories) {
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
  return base + Math.pow(excess, 1.8) * 2;
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
  };
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
