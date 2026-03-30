/**
 * Empire du Commerce — Livestock & Animal Resources
 *
 * 3 herd categories: redMeat, whiteMeat, dairy
 * 3 equipment levels: basic (40%), mechanized (65%), advanced (85%)
 *
 * Production formula (per category):
 *   productive  = herd.total × (exploitation/100)
 *   production  = productive × baseYield × equipMult × alimentationRatio
 *
 * Alimentation (no hard thresholds):
 *   feedRatio  = clamp(resources.agriculture / feedDemand, 0, 1)
 *   waterRatio = clamp(waterTreatment / 40, 0, 1)
 *   alim       = feedRatio × 0.70 + waterRatio × 0.30
 *
 * Herd evolution (continuous, equilibrium at alim ≈ 0.67):
 *   reproRate  = −0.02 + 0.03 × alim
 *   → +1%/turn at alim=1.0 | 0% at alim=0.67 | −2%/turn at alim=0
 *
 * Feed consumed each turn from resources.agriculture.
 * Pollution added each turn proportional to herd size.
 */

import type { ServerPlayerState } from './types.js';
import type { LivestockCategory, LivestockState, ResolutionEntry } from '@undercover/shared';
import {
  LIVESTOCK_YIELD_RED_MEAT,
  LIVESTOCK_YIELD_WHITE_MEAT,
  LIVESTOCK_YIELD_DAIRY,
  LIVESTOCK_EQUIP_BASIC_EXPLOITATION,
  LIVESTOCK_EQUIP_MECHANIZED_EXPLOITATION,
  LIVESTOCK_EQUIP_ADVANCED_EXPLOITATION,
  LIVESTOCK_EQUIP_BASIC_YIELD_MULT,
  LIVESTOCK_EQUIP_MECHANIZED_YIELD_MULT,
  LIVESTOCK_EQUIP_ADVANCED_YIELD_MULT,
  LIVESTOCK_UPGRADE_TO_MECHANIZED_COST,
  LIVESTOCK_UPGRADE_TO_ADVANCED_RED,
  LIVESTOCK_UPGRADE_TO_ADVANCED_OTHER,
  LIVESTOCK_FEED_RED_MEAT,
  LIVESTOCK_FEED_WHITE_MEAT,
  LIVESTOCK_FEED_DAIRY,
  LIVESTOCK_ALIM_FEED_WEIGHT,
  LIVESTOCK_ALIM_WATER_WEIGHT,
  LIVESTOCK_WATER_THRESHOLD,
  LIVESTOCK_REPRO_BASE,
  LIVESTOCK_REPRO_COEFF,
  LIVESTOCK_HERD_MIN,
  LIVESTOCK_POLL_BASIC,
  LIVESTOCK_POLL_MECHANIZED,
  LIVESTOCK_POLL_ADVANCED,
  LIVESTOCK_HERD_SCALE,
  LIVESTOCK_DIST_RED,
  LIVESTOCK_DIST_WHITE,
  LIVESTOCK_DIST_DAIRY,
} from './constants.js';

// ─── Helpers ──────────────────────────────────────────────────

function baseYieldFor(category: LivestockCategory): number {
  switch (category) {
    case 'redMeat':   return LIVESTOCK_YIELD_RED_MEAT;
    case 'whiteMeat': return LIVESTOCK_YIELD_WHITE_MEAT;
    case 'dairy':     return LIVESTOCK_YIELD_DAIRY;
  }
}

function feedRateFor(category: LivestockCategory): number {
  switch (category) {
    case 'redMeat':   return LIVESTOCK_FEED_RED_MEAT;
    case 'whiteMeat': return LIVESTOCK_FEED_WHITE_MEAT;
    case 'dairy':     return LIVESTOCK_FEED_DAIRY;
  }
}

function equipExploitation(level: string): number {
  if (level === 'advanced')   return LIVESTOCK_EQUIP_ADVANCED_EXPLOITATION;
  if (level === 'mechanized') return LIVESTOCK_EQUIP_MECHANIZED_EXPLOITATION;
  return LIVESTOCK_EQUIP_BASIC_EXPLOITATION;
}

function equipYieldMult(level: string): number {
  if (level === 'advanced')   return LIVESTOCK_EQUIP_ADVANCED_YIELD_MULT;
  if (level === 'mechanized') return LIVESTOCK_EQUIP_MECHANIZED_YIELD_MULT;
  return LIVESTOCK_EQUIP_BASIC_YIELD_MULT;
}

function pollRateFor(level: string): number {
  if (level === 'advanced')   return LIVESTOCK_POLL_ADVANCED;
  if (level === 'mechanized') return LIVESTOCK_POLL_MECHANIZED;
  return LIVESTOCK_POLL_BASIC;
}

function herdLabel(category: LivestockCategory): string {
  switch (category) {
    case 'redMeat':   return 'Viande rouge';
    case 'whiteMeat': return 'Viande blanche';
    case 'dairy':     return 'Lait & Œufs';
  }
}

// ─── Alimentation (shared for UI preview) ────────────────────

export interface AlimMetrics {
  feedDemand:       number;  // total agriculture units demanded this turn
  feedRatio:        number;  // 0–1
  waterRatio:       number;  // 0–1
  alimentationRatio: number; // weighted combination
}

export function computeAlimMetrics(
  player: ServerPlayerState,
): AlimMetrics {
  const feedDemand = player.livestock.herds.reduce(
    (sum, h) => sum + h.total * feedRateFor(h.category), 0
  );
  // L'élevage consomme du fourrage (fodder), pas un agrégat "agriculture"
  const feedRatio  = Math.min(1.0, feedDemand <= 0 ? 1 : player.resources.fodder / feedDemand);
  const waterRatio = Math.min(1.0, player.infrastructure.waterTreatment / LIVESTOCK_WATER_THRESHOLD);
  const alimentationRatio = feedRatio * LIVESTOCK_ALIM_FEED_WEIGHT + waterRatio * LIVESTOCK_ALIM_WATER_WEIGHT;
  return { feedDemand, feedRatio, waterRatio, alimentationRatio };
}

// ─── Production preview (also used by UI) ────────────────────

export function computeHerdProduction(
  herd: { total: number; equipment: string; category: LivestockCategory },
  alimentationRatio: number,
): number {
  const productive = herd.total * (equipExploitation(herd.equipment) / 100);
  const raw = productive * baseYieldFor(herd.category) * equipYieldMult(herd.equipment) * alimentationRatio;
  return Math.round(raw);
}

// ─── Tick (called once per round) ────────────────────────────

export function tickLivestock(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;
    if (player.livestock.herds.length === 0) continue;

    const { feedDemand, alimentationRatio } = computeAlimMetrics(player);

    // 1. Consume fodder from the fodder stockpile
    player.resources.fodder = Math.max(0, player.resources.fodder - feedDemand * alimentationRatio);

    // 2. Add livestock production to each category's resource stockpile
    let totalPollution = 0;

    for (const herd of player.livestock.herds) {
      const production = computeHerdProduction(herd, alimentationRatio);
      // redMeat → resources.redMeat, whiteMeat → resources.whiteMeat, dairy → resources.dairy
      const res = player.resources as unknown as Record<string, number>
      res[herd.category] = (res[herd.category] ?? 0) + production;
      totalPollution += herd.total * pollRateFor(herd.equipment);
    }

    // 3. Pollution (modified by cleanEnergy research)
    const cleanMod = Math.max(0.60, 1 - player.research.branches.cleanEnergy / 200);
    player.pollution = Math.min(100, player.pollution + Math.round(totalPollution * cleanMod * 10) / 10);

    // 4. Herd evolution (continuous reproduction/mortality)
    const reproRate = LIVESTOCK_REPRO_BASE + LIVESTOCK_REPRO_COEFF * alimentationRatio;

    for (const herd of player.livestock.herds) {
      herd.total = Math.max(LIVESTOCK_HERD_MIN, herd.total + herd.total * reproRate);
    }

    // 5. Alerts
    if (alimentationRatio < 0.50) {
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `⚠️ ${player.countryName} : cheptel sous-alimenté (alim. ${Math.round(alimentationRatio * 100)}%) — mortalité animale en cours`,
        icon: '🐄',
        positive: false,
      });
    }
  }

  return entries;
}

// ─── Investment action ────────────────────────────────────────

/**
 * Upgrade herd equipment for a given livestock category.
 * Returns cost paid (0 if failed or already max).
 */
export function upgradeHerdEquipment(
  player: ServerPlayerState,
  category: LivestockCategory,
): number {
  const herd = player.livestock.herds.find(h => h.category === category);
  if (!herd) return 0;

  let cost = 0;
  if (herd.equipment === 'basic') {
    cost = LIVESTOCK_UPGRADE_TO_MECHANIZED_COST;
  } else if (herd.equipment === 'mechanized') {
    cost = category === 'redMeat' ? LIVESTOCK_UPGRADE_TO_ADVANCED_RED : LIVESTOCK_UPGRADE_TO_ADVANCED_OTHER;
  } else {
    return 0; // already advanced
  }

  if (player.money < cost) return 0;

  player.money -= cost;
  herd.equipment = herd.equipment === 'basic' ? 'mechanized' : 'advanced';
  return cost;
}

// ─── Initialisation ──────────────────────────────────────────

/**
 * Derive initial herd sizes from country's starting agriculture resource.
 * Total herd = agriculture × 0.6, distributed 30/45/25% across categories.
 */
export function computeInitialLivestock(startingAgriculture: number): LivestockState {
  const totalHerd = Math.max(15, Math.round(startingAgriculture * LIVESTOCK_HERD_SCALE));

  return {
    herds: [
      { category: 'redMeat',   total: Math.round(totalHerd * LIVESTOCK_DIST_RED),   equipment: 'basic' },
      { category: 'whiteMeat', total: Math.round(totalHerd * LIVESTOCK_DIST_WHITE), equipment: 'basic' },
      { category: 'dairy',     total: Math.round(totalHerd * LIVESTOCK_DIST_DAIRY), equipment: 'basic' },
    ],
  };
}

// ─── Cost preview (for UI) ────────────────────────────────────

export function nextUpgradeCost(herd: { equipment: string; category: LivestockCategory }): number {
  if (herd.equipment === 'basic')       return LIVESTOCK_UPGRADE_TO_MECHANIZED_COST;
  if (herd.equipment === 'mechanized')  return herd.category === 'redMeat' ? LIVESTOCK_UPGRADE_TO_ADVANCED_RED : LIVESTOCK_UPGRADE_TO_ADVANCED_OTHER;
  return 0;
}
