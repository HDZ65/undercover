/**
 * Empire du Commerce — Agriculture & Farming
 *
 * 4 crop categories: cereals, vegetables, sugarOils, fodder
 * 3 equipment levels: basic (50%), mechanized (75%), advanced (95%)
 *
 * Production formula:
 *   production = surface × (exploitation/100) × fertilityMult × equipMult × baseYield × irrigationBonus
 *
 *   fertilityMult  = 0.30 + 0.70 × (fertility/100)   →  [0.30, 1.00]
 *   irrigationBonus = 1.0 + irrigationLevel/200        →  [1.00, 1.50]
 *
 * Fertility evolves every turn based on exploitation rate:
 *   > 90% → erosion (−0.2/turn)
 *   70–90% → stable (+0.05/turn)
 *   < 70% → recovery (+0.17/turn)   ← fallow (30%) lands here
 */

import type { ServerPlayerState } from './types.js';
import type { CropCategory, AgricultureState, ResolutionEntry } from '@undercover/shared';
import {
  FARM_YIELD_CEREALS,
  FARM_YIELD_VEGETABLES,
  FARM_YIELD_SUGAROILS,
  FARM_YIELD_FODDER,
  FARM_EQUIP_BASIC_EXPLOITATION,
  FARM_EQUIP_MECHANIZED_EXPLOITATION,
  FARM_EQUIP_ADVANCED_EXPLOITATION,
  FARM_EQUIP_BASIC_YIELD_MULT,
  FARM_EQUIP_MECHANIZED_YIELD_MULT,
  FARM_EQUIP_ADVANCED_YIELD_MULT,
  FARM_UPGRADE_TO_MECHANIZED_COST,
  FARM_UPGRADE_TO_ADVANCED_COST,
  FARM_FERT_BASE,
  FARM_FERT_COEFF,
  FARM_FERT_EROSION_RATE,
  FARM_FERT_STABLE_RATE,
  FARM_FERT_RECOVERY_RATE,
  FARM_IRRIGATION_BONUS_DIVISOR,
  FARM_IRRIGATION_UPGRADE_COST,
  FARM_IRRIGATION_STEP,
  FARM_IRRIGATION_MAX,
  FARM_FALLOW_EXPLOITATION,
  FARM_SURFACE_SCALE,
  FARM_SURFACE_DIST,
} from './constants.js';

// ─── Helpers ──────────────────────────────────────────────────

function baseYieldForCategory(category: CropCategory): number {
  switch (category) {
    case 'cereals':    return FARM_YIELD_CEREALS;
    case 'vegetables': return FARM_YIELD_VEGETABLES;
    case 'sugarOils':  return FARM_YIELD_SUGAROILS;
    case 'fodder':     return FARM_YIELD_FODDER;
  }
}

function equipExploitation(level: string): number {
  if (level === 'advanced')   return FARM_EQUIP_ADVANCED_EXPLOITATION;
  if (level === 'mechanized') return FARM_EQUIP_MECHANIZED_EXPLOITATION;
  return FARM_EQUIP_BASIC_EXPLOITATION;
}

function equipYieldMult(level: string): number {
  if (level === 'advanced')   return FARM_EQUIP_ADVANCED_YIELD_MULT;
  if (level === 'mechanized') return FARM_EQUIP_MECHANIZED_YIELD_MULT;
  return FARM_EQUIP_BASIC_YIELD_MULT;
}

function cropLabel(category: CropCategory): string {
  switch (category) {
    case 'cereals':    return 'Céréales';
    case 'vegetables': return 'Légumes';
    case 'sugarOils':  return 'Sucre/Oléagineux';
    case 'fodder':     return 'Fourrage';
  }
}

// ─── Production preview (also used by UI) ────────────────────

/**
 * Units of agriculture produced this turn for one plot.
 * Can be called client-side with equivalent constants.
 */
export function computePlotProduction(
  plot: { surface: number; fertility: number; equipment: string; inFallow: boolean },
  irrigationLevel: number,
  category: CropCategory,
): number {
  const exploitation  = plot.inFallow ? FARM_FALLOW_EXPLOITATION : equipExploitation(plot.equipment);
  const fertilityMult = FARM_FERT_BASE + FARM_FERT_COEFF * (plot.fertility / 100);
  const equipMult     = equipYieldMult(plot.equipment);
  const irrigBonus    = 1.0 + irrigationLevel / FARM_IRRIGATION_BONUS_DIVISOR;
  const raw = plot.surface * (exploitation / 100) * fertilityMult * equipMult * baseYieldForCategory(category) * irrigBonus;
  return Math.round(raw);
}

// ─── Tick (called once per round in resolution) ───────────────

export function tickAgriculture(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    for (const plot of player.agriculture.plots) {
      const production = computePlotProduction(plot, player.agriculture.irrigationLevel, plot.category);
      // Chaque culture va dans son propre stock de ressource
      const res = player.resources as unknown as Record<string, number>
      res[plot.category] = (res[plot.category] ?? 0) + production;

      // Fertility evolution
      const exploitation = plot.inFallow ? FARM_FALLOW_EXPLOITATION : equipExploitation(plot.equipment);
      if (exploitation > 90) {
        plot.fertility = Math.max(0, plot.fertility - FARM_FERT_EROSION_RATE);
      } else if (exploitation < 70) {
        plot.fertility = Math.min(100, plot.fertility + FARM_FERT_RECOVERY_RATE);
      } else {
        plot.fertility = Math.min(100, plot.fertility + FARM_FERT_STABLE_RATE);
      }

      // Low fertility warning
      if (plot.fertility < 20) {
        entries.push({
          step: 'production',
          playerId: player.id,
          description: `⚠️ ${player.countryName} : fertilité ${cropLabel(plot.category)} critique (${Math.round(plot.fertility)}%) — mettez en jachère pour récupérer`,
          icon: '🌾',
          positive: false,
        });
      }
    }
  }

  return entries;
}

// ─── Investment actions ───────────────────────────────────────

/**
 * Upgrade farm equipment for a given crop category (basic → mechanized → advanced).
 * Returns cost paid (0 if failed or already max).
 */
export function upgradeEquipment(
  player: ServerPlayerState,
  category: CropCategory,
): number {
  const plot = player.agriculture.plots.find(p => p.category === category);
  if (!plot) return 0;

  let cost = 0;
  if (plot.equipment === 'basic')       cost = FARM_UPGRADE_TO_MECHANIZED_COST;
  else if (plot.equipment === 'mechanized') cost = FARM_UPGRADE_TO_ADVANCED_COST;
  else return 0; // already advanced

  if (player.money < cost) return 0;

  player.money -= cost;
  plot.equipment = plot.equipment === 'basic' ? 'mechanized' : 'advanced';
  return cost;
}

/**
 * Toggle fallow mode for a given crop category.
 * Fallow forces exploitation to 30%, enabling faster fertility recovery.
 */
export function toggleFallow(
  player: ServerPlayerState,
  category: CropCategory,
): void {
  const plot = player.agriculture.plots.find(p => p.category === category);
  if (plot) plot.inFallow = !plot.inFallow;
}

/**
 * Invest in irrigation (+10 levels, irrigationBonus += 0.05).
 * Returns cost paid (0 if failed or already max).
 */
export function investIrrigation(player: ServerPlayerState): number {
  if (player.agriculture.irrigationLevel >= FARM_IRRIGATION_MAX) return 0;
  if (player.money < FARM_IRRIGATION_UPGRADE_COST) return 0;

  player.money -= FARM_IRRIGATION_UPGRADE_COST;
  player.agriculture.irrigationLevel = Math.min(
    FARM_IRRIGATION_MAX,
    player.agriculture.irrigationLevel + FARM_IRRIGATION_STEP,
  );
  return FARM_IRRIGATION_UPGRADE_COST;
}

// ─── Initialisation ──────────────────────────────────────────

/**
 * Derive initial agriculture state from country's starting agriculture resource.
 * Total surface = startingAgriculture × 0.5, distributed 40/25/20/15% across crops.
 */
export function computeInitialAgriculture(startingAgriculture: number): AgricultureState {
  const totalSurface = Math.max(10, Math.round(startingAgriculture * FARM_SURFACE_SCALE));
  const categories: CropCategory[] = ['cereals', 'vegetables', 'sugarOils', 'fodder'];

  const plots = categories.map((category, i) => ({
    category,
    surface:   Math.round(totalSurface * FARM_SURFACE_DIST[i]),
    fertility: 70,
    equipment: 'basic' as const,
    inFallow:  false,
  }));

  return { plots, irrigationLevel: 0 };
}
