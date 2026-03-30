/**
 * Empire du Commerce — Marine Resources (Pêche & Aquaculture)
 *
 * Single renewable logistic stock: "Produits de la Mer"
 * 3 equipment levels: basic (wild fishing), mechanized (semi-industrial), advanced (aquaculture)
 *
 * Production formula:
 *   productiveStock  = stockTotal × 0.60
 *   baseExtraction   = productiveStock × (exploitation/100) × yieldMult × alim
 *   extraction       = min(productiveStock × 0.80, baseExtraction)
 *   → resources.agriculture += Math.round(extraction)
 *
 * Alimentation (water-dominant):
 *   feedRatio  = clamp(resources.agriculture / feedDemand, 0, 1)
 *   waterRatio = clamp(waterTreatment / 30, 0, 1)
 *   alim       = feedRatio × 0.40 + waterRatio × 0.60
 *
 * Stock evolution (logistic renewable):
 *   exploitationRate = extraction / max(1, productiveStock)
 *   naturalGrowth    = 0.020 × (1 − stockTotal/stockMax)
 *   fishingDepletion = 0.022 × exploitationRate
 *   alimMortality    = max(0, 0.015 × (0.70 − alim) / 0.70)
 *   stockTotal       = max(stockMin, stockTotal + stockTotal × (growth − depletion − mortality))
 *
 * Feed consumed each turn from resources.agriculture.
 * Pollution added proportional to extraction volume.
 */

import type { ServerPlayerState } from './types.js';
import type { MarineState, ResolutionEntry } from '@undercover/shared';
import {
  MARINE_PRODUCTIVE_PCT,
  MARINE_EQUIP_BASIC_EXPLOITATION,
  MARINE_EQUIP_MECHANIZED_EXPLOITATION,
  MARINE_EQUIP_ADVANCED_EXPLOITATION,
  MARINE_EQUIP_BASIC_YIELD_MULT,
  MARINE_EQUIP_MECHANIZED_YIELD_MULT,
  MARINE_EQUIP_ADVANCED_YIELD_MULT,
  MARINE_NATURAL_GROWTH_RATE,
  MARINE_FISHING_DEPLETION_COEFF,
  MARINE_STOCK_MAX_MULT,
  MARINE_STOCK_FLOOR_PCT,
  MARINE_STOCK_SAFETY_CAP,
  MARINE_ALIM_FEED_WEIGHT,
  MARINE_ALIM_WATER_WEIGHT,
  MARINE_WATER_THRESHOLD,
  MARINE_FEED_RATE_BASIC,
  MARINE_FEED_RATE_MECHANIZED,
  MARINE_FEED_RATE_ADVANCED,
  MARINE_ALIM_MORTALITY_COEFF,
  MARINE_ALIM_MORTALITY_THRESHOLD,
  MARINE_UPGRADE_TO_MECHANIZED_COST,
  MARINE_UPGRADE_TO_ADVANCED_COST,
  MARINE_POLL_BASIC,
  MARINE_POLL_MECHANIZED,
  MARINE_POLL_ADVANCED,
  MARINE_STOCK_SCALE,
} from './constants.js';

// ─── Helpers ──────────────────────────────────────────────────

function equipExploitation(level: string): number {
  if (level === 'advanced')   return MARINE_EQUIP_ADVANCED_EXPLOITATION;
  if (level === 'mechanized') return MARINE_EQUIP_MECHANIZED_EXPLOITATION;
  return MARINE_EQUIP_BASIC_EXPLOITATION;
}

function equipYieldMult(level: string): number {
  if (level === 'advanced')   return MARINE_EQUIP_ADVANCED_YIELD_MULT;
  if (level === 'mechanized') return MARINE_EQUIP_MECHANIZED_YIELD_MULT;
  return MARINE_EQUIP_BASIC_YIELD_MULT;
}

function feedRateFor(level: string): number {
  if (level === 'advanced')   return MARINE_FEED_RATE_ADVANCED;
  if (level === 'mechanized') return MARINE_FEED_RATE_MECHANIZED;
  return MARINE_FEED_RATE_BASIC;
}

function pollRateFor(level: string): number {
  if (level === 'advanced')   return MARINE_POLL_ADVANCED;
  if (level === 'mechanized') return MARINE_POLL_MECHANIZED;
  return MARINE_POLL_BASIC;
}

// ─── Alimentation metrics (shared for UI preview) ─────────────

export interface MarineAlimMetrics {
  feedDemand:       number;
  feedRatio:        number;
  waterRatio:       number;
  alimentationRatio: number;
}

export function computeMarineAlimMetrics(player: ServerPlayerState): MarineAlimMetrics {
  const { marine } = player;
  const feedDemand = marine.stockTotal * feedRateFor(marine.equipment);
  const feedRatio  = Math.min(1.0, feedDemand <= 0 ? 1 : player.resources.fodder / feedDemand);
  const waterRatio = Math.min(1.0, player.infrastructure.waterTreatment / MARINE_WATER_THRESHOLD);
  const alimentationRatio = feedRatio * MARINE_ALIM_FEED_WEIGHT + waterRatio * MARINE_ALIM_WATER_WEIGHT;
  return { feedDemand, feedRatio, waterRatio, alimentationRatio };
}

// ─── Production preview (also used by UI) ────────────────────

export function computeMarineProduction(
  marine: { stockTotal: number; equipment: string },
  alimentationRatio: number,
): number {
  const productiveStock = marine.stockTotal * MARINE_PRODUCTIVE_PCT;
  const baseExtraction  = productiveStock * (equipExploitation(marine.equipment) / 100)
                         * equipYieldMult(marine.equipment) * alimentationRatio;
  const extraction = Math.min(productiveStock * MARINE_STOCK_SAFETY_CAP, baseExtraction);
  return Math.round(extraction);
}

// ─── Tick (called once per round in resolution) ───────────────

export function tickMarine(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;
    if (player.marine.stockTotal <= 0) continue;

    const { feedDemand, alimentationRatio } = computeMarineAlimMetrics(player);
    const { marine } = player;

    const stockMax = marine.initialStock * MARINE_STOCK_MAX_MULT;
    const stockMin = marine.initialStock * MARINE_STOCK_FLOOR_PCT;

    // 1. Consume fodder from the fodder stockpile
    player.resources.fodder = Math.max(0, player.resources.fodder - feedDemand * alimentationRatio);

    // 2. Extract production → add to fish resource stockpile
    const extraction = computeMarineProduction(marine, alimentationRatio);
    player.resources.fish = (player.resources.fish ?? 0) + extraction;

    // 3. Pollution (modified by cleanEnergy research)
    const pollution = extraction * pollRateFor(marine.equipment);
    const cleanMod  = Math.max(0.60, 1 - player.research.branches.cleanEnergy / 200);
    player.pollution = Math.min(100, player.pollution + Math.round(pollution * cleanMod * 10) / 10);

    // 4. Stock evolution (logistic)
    const productiveStock  = marine.stockTotal * MARINE_PRODUCTIVE_PCT;
    const exploitationRate = extraction / Math.max(1, productiveStock);
    const naturalGrowth    = MARINE_NATURAL_GROWTH_RATE * (1 - marine.stockTotal / stockMax);
    const fishingDepletion = MARINE_FISHING_DEPLETION_COEFF * exploitationRate;
    const alimMortality    = Math.max(
      0,
      MARINE_ALIM_MORTALITY_COEFF * (MARINE_ALIM_MORTALITY_THRESHOLD - alimentationRatio) / MARINE_ALIM_MORTALITY_THRESHOLD,
    );
    const stockChangeRate = naturalGrowth - fishingDepletion - alimMortality;
    marine.stockTotal = Math.max(stockMin, marine.stockTotal + marine.stockTotal * stockChangeRate);

    // 5. Alerts
    if (marine.stockTotal < marine.initialStock * 0.30) {
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `⚠️ ${player.countryName} : stocks maritimes critiques (${Math.round(marine.stockTotal)} u.) — surpêche ou mauvaise alimentation`,
        icon: '🎣',
        positive: false,
      });
    }
  }

  return entries;
}

// ─── Investment action ────────────────────────────────────────

/**
 * Upgrade marine equipment (basic → mechanized → advanced).
 * Returns cost paid (0 if failed or already max).
 */
export function upgradeMarineEquipment(player: ServerPlayerState): number {
  const { marine } = player;

  let cost = 0;
  if (marine.equipment === 'basic')       cost = MARINE_UPGRADE_TO_MECHANIZED_COST;
  else if (marine.equipment === 'mechanized') cost = MARINE_UPGRADE_TO_ADVANCED_COST;
  else return 0; // already advanced

  if (player.money < cost) return 0;

  player.money -= cost;
  marine.equipment = marine.equipment === 'basic' ? 'mechanized' : 'advanced';
  return cost;
}

// ─── Initialisation ──────────────────────────────────────────

/**
 * Derive initial marine state from country's starting water resource.
 * initialStock = max(20, startingResources.water × 2)
 */
export function computeInitialMarine(startingWater: number): MarineState {
  const initialStock = Math.max(20, Math.round(startingWater * MARINE_STOCK_SCALE));
  return {
    stockTotal:   initialStock,
    initialStock,
    equipment:    'basic',
  };
}

// ─── Cost preview (for UI) ────────────────────────────────────

export function nextMarineUpgradeCost(equipment: string): number {
  if (equipment === 'basic')       return MARINE_UPGRADE_TO_MECHANIZED_COST;
  if (equipment === 'mechanized')  return MARINE_UPGRADE_TO_ADVANCED_COST;
  return 0;
}
