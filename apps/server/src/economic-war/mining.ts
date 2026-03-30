/**
 * Empire du Commerce — Mining & Extraction
 *
 * 3-layer model: underground reserves → extraction → stock
 * Resource types: oil | iron | coal | rareEarths | precious | uranium
 *
 * Formules continues, aucun seuil brutal :
 *   recharge    = max × rate × (1 − u/max)          [logistique, accélère quand épuisé]
 *   extraction  = machines × BASE × infraFactor × refineryBonus
 *   pollution   = extraction × POLL_RATE × refineryMod × cleanEnergyMod
 */

import type { ServerPlayerState } from './types.js';
import type { MineralType, ResolutionEntry } from '@undercover/shared';
import { MINERAL_TYPES } from '@undercover/shared';
import {
  MINING_REFINERY_YIELD_BONUS,
  MINING_REFINERY_POLLUTION_MOD,
  MINING_COST_SCALE_PER_MACHINE,
  MINING_MAX_MACHINES,
  MINING_OIL_RECHARGE_RATE,
  MINING_OIL_BASE_RATE,
  MINING_OIL_POLLUTION_RATE,
  MINING_OIL_MACHINE_BASE_COST,
  MINING_OIL_REFINERY_COST,
  MINING_OIL_RESERVE_SCALE,
  MINING_IRON_RECHARGE_RATE,
  MINING_IRON_BASE_RATE,
  MINING_IRON_POLLUTION_RATE,
  MINING_IRON_MACHINE_BASE_COST,
  MINING_IRON_REFINERY_COST,
  MINING_IRON_RESERVE_SCALE,
  MINING_COAL_RECHARGE_RATE,
  MINING_COAL_BASE_RATE,
  MINING_COAL_POLLUTION_RATE,
  MINING_COAL_MACHINE_BASE_COST,
  MINING_COAL_REFINERY_COST,
  MINING_COAL_RESERVE_SCALE,
  MINING_RARE_RECHARGE_RATE,
  MINING_RARE_BASE_RATE,
  MINING_RARE_POLLUTION_RATE,
  MINING_RARE_MACHINE_BASE_COST,
  MINING_RARE_REFINERY_COST,
  MINING_RARE_RESERVE_SCALE,
  MINING_PREC_RECHARGE_RATE,
  MINING_PREC_BASE_RATE,
  MINING_PREC_POLLUTION_RATE,
  MINING_PREC_MACHINE_BASE_COST,
  MINING_PREC_REFINERY_COST,
  MINING_PREC_RESERVE_SCALE,
  MINING_URAN_RECHARGE_RATE,
  MINING_URAN_BASE_RATE,
  MINING_URAN_POLLUTION_RATE,
  MINING_URAN_MACHINE_BASE_COST,
  MINING_URAN_REFINERY_COST,
  MINING_URAN_RESERVE_SCALE,
} from './constants.js';

// ─── Types locaux ─────────────────────────────────────────────

type MiningResource = 'oil' | MineralType;

// ─── Lookup tables per resource ───────────────────────────────

const RECHARGE_RATE: Record<MiningResource, number> = {
  oil:        MINING_OIL_RECHARGE_RATE,
  iron:       MINING_IRON_RECHARGE_RATE,
  coal:       MINING_COAL_RECHARGE_RATE,
  rareEarths: MINING_RARE_RECHARGE_RATE,
  precious:   MINING_PREC_RECHARGE_RATE,
  uranium:    MINING_URAN_RECHARGE_RATE,
};

const BASE_RATE: Record<MiningResource, number> = {
  oil:        MINING_OIL_BASE_RATE,
  iron:       MINING_IRON_BASE_RATE,
  coal:       MINING_COAL_BASE_RATE,
  rareEarths: MINING_RARE_BASE_RATE,
  precious:   MINING_PREC_BASE_RATE,
  uranium:    MINING_URAN_BASE_RATE,
};

const POLLUTION_RATE: Record<MiningResource, number> = {
  oil:        MINING_OIL_POLLUTION_RATE,
  iron:       MINING_IRON_POLLUTION_RATE,
  coal:       MINING_COAL_POLLUTION_RATE,
  rareEarths: MINING_RARE_POLLUTION_RATE,
  precious:   MINING_PREC_POLLUTION_RATE,
  uranium:    MINING_URAN_POLLUTION_RATE,
};

const MACHINE_BASE_COST: Record<MiningResource, number> = {
  oil:        MINING_OIL_MACHINE_BASE_COST,
  iron:       MINING_IRON_MACHINE_BASE_COST,
  coal:       MINING_COAL_MACHINE_BASE_COST,
  rareEarths: MINING_RARE_MACHINE_BASE_COST,
  precious:   MINING_PREC_MACHINE_BASE_COST,
  uranium:    MINING_URAN_MACHINE_BASE_COST,
};

const REFINERY_COST_TABLE: Record<MiningResource, number> = {
  oil:        MINING_OIL_REFINERY_COST,
  iron:       MINING_IRON_REFINERY_COST,
  coal:       MINING_COAL_REFINERY_COST,
  rareEarths: MINING_RARE_REFINERY_COST,
  precious:   MINING_PREC_REFINERY_COST,
  uranium:    MINING_URAN_REFINERY_COST,
};

const RESERVE_SCALE: Record<MiningResource, number> = {
  oil:        MINING_OIL_RESERVE_SCALE,
  iron:       MINING_IRON_RESERVE_SCALE,
  coal:       MINING_COAL_RESERVE_SCALE,
  rareEarths: MINING_RARE_RESERVE_SCALE,
  precious:   MINING_PREC_RESERVE_SCALE,
  uranium:    MINING_URAN_RESERVE_SCALE,
};

const RESOURCE_LABEL: Record<MiningResource, string> = {
  oil:        'Pétrole',
  iron:       'Fer',
  coal:       'Charbon',
  rareEarths: 'Terres rares',
  precious:   'Métaux précieux',
  uranium:    'Uranium',
};

const ALL_RESOURCES: MiningResource[] = ['oil', ...MINERAL_TYPES];

// ─── Tick mensuel (appelé une fois par tour dans resolveRound) ──

/**
 * Pour chaque joueur actif :
 * 1. Recharge naturelle des réserves souterraines (logistique, très lente)
 * 2. Extraction vers le stock
 * 3. Ajout de pollution proportionnel à l'extraction
 */
export function tickMining(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    let totalPollutionAdded = 0;

    for (const res of ALL_RESOURCES) {
      const deposit    = player.mining[res];
      const maxReserve = computeMaxReserve(res);

      // 1. Recharge naturelle (très lente, logistique)
      const recharge = maxReserve * RECHARGE_RATE[res] * (1 - deposit.underground / maxReserve);
      deposit.underground = Math.min(maxReserve, deposit.underground + recharge);

      // 2. Extraction
      if (deposit.machines > 0 && deposit.underground > 0) {
        const extracted = computeExtraction(player, res);

        // Transfer from underground to stock
        deposit.underground = Math.max(0, deposit.underground - extracted);
        if (res === 'oil') {
          player.resources.oil += extracted;
        } else {
          player.resources[res] += extracted;
        }

        // 3. Pollution from extraction
        const cleanMod  = Math.max(0.5, 1 - player.research.branches.cleanEnergy / 200);
        const refinMod  = deposit.hasRefinery ? MINING_REFINERY_POLLUTION_MOD : 1.0;
        const pollAdded = extracted * POLLUTION_RATE[res] * cleanMod * refinMod;
        totalPollutionAdded += pollAdded;

        // Low-reserve warning entry
        const reservePct = deposit.underground / maxReserve;
        if (reservePct < 0.15 && extractionPct(extracted, maxReserve) > 0.005) {
          entries.push({
            step: 'production',
            playerId: player.id,
            description: `⚠️ ${player.countryName} : réserves de ${RESOURCE_LABEL[res]} critiques (${Math.round(reservePct * 100)}% restant)`,
            icon: '⛏️',
            positive: false,
          });
        }
      }
    }

    // Add accumulated pollution (capped per turn to avoid spikes)
    player.pollution = Math.min(100, player.pollution + Math.round(totalPollutionAdded * 10) / 10);
  }

  return entries;
}

// ─── Extraction calculation (also used by UI to show preview) ──

/**
 * Units extracted this turn for a given resource.
 * extraction = min(underground, machines × BASE × infraFactor × refineryBonus)
 * infraFactor = 0.5 + 0.5 × (electricity / 100)
 */
export function computeExtraction(
  player: ServerPlayerState,
  res: MiningResource,
): number {
  const deposit = player.mining[res];
  if (deposit.machines === 0) return 0;

  const infraFactor   = 0.5 + 0.5 * (player.infrastructure.electricity / 100);
  const refineryBonus = deposit.hasRefinery ? 1 + MINING_REFINERY_YIELD_BONUS : 1.0;

  const maxExtraction = deposit.machines * BASE_RATE[res] * infraFactor * refineryBonus;
  return Math.min(deposit.underground, Math.round(maxExtraction));
}

/**
 * Pollution added per turn for a given resource.
 */
export function computeExtractionPollution(
  player: ServerPlayerState,
  res: MiningResource,
): number {
  const extraction = computeExtraction(player, res);
  if (extraction === 0) return 0;
  const cleanMod = Math.max(0.5, 1 - player.research.branches.cleanEnergy / 200);
  const refinMod = player.mining[res].hasRefinery ? MINING_REFINERY_POLLUTION_MOD : 1.0;
  return Math.round(extraction * POLLUTION_RATE[res] * cleanMod * refinMod * 10) / 10;
}

// ─── Machine / Refinery investment ──────────────────────────────

/**
 * Buy one additional extraction machine for the given resource.
 * Returns cost paid (0 if purchase failed).
 */
export function buyMiningMachine(
  player: ServerPlayerState,
  res: MiningResource,
): number {
  const deposit = player.mining[res];
  if (deposit.machines >= MINING_MAX_MACHINES) return 0;

  const cost = Math.round(MACHINE_BASE_COST[res] * (1 + deposit.machines * MINING_COST_SCALE_PER_MACHINE));
  if (player.money < cost) return 0;

  player.money     -= cost;
  deposit.machines += 1;
  return cost;
}

/**
 * Build a refinery for the given resource (one-time, enables +30% yield, −30% pollution).
 * Returns cost paid (0 if purchase failed).
 */
export function buyRefinery(
  player: ServerPlayerState,
  res: MiningResource,
): number {
  if (player.mining[res].hasRefinery) return 0;

  const cost = REFINERY_COST_TABLE[res];
  if (player.money < cost) return 0;

  player.money -= cost;
  player.mining[res].hasRefinery = true;
  return cost;
}

// ─── Machine cost preview (for UI) ──────────────────────────────

export function nextMachineCost(
  player: ServerPlayerState,
  res: MiningResource,
): number {
  return Math.round(MACHINE_BASE_COST[res] * (1 + player.mining[res].machines * MINING_COST_SCALE_PER_MACHINE));
}

export function refineryCost(res: MiningResource): number {
  return REFINERY_COST_TABLE[res];
}

// ─── Initial reserves from country profile ───────────────────────

/**
 * Derive initial underground reserve from starting stock value.
 * Preserves country asymmetry: resource-rich countries have proportionally deeper reserves.
 */
export function computeInitialUnderground(
  startingStock: number,
  res: MiningResource,
): number {
  return Math.max(100, startingStock * RESERVE_SCALE[res]);
}

// ─── Helpers ──────────────────────────────────────────────────

function computeMaxReserve(res: MiningResource): number {
  const stockMax = 100; // max startingResources value
  return stockMax * RESERVE_SCALE[res];
}

function extractionPct(extraction: number, maxReserve: number): number {
  return extraction / Math.max(1, maxReserve);
}
