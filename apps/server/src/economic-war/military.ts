/**
 * Empire du Commerce — Military, War, Bombardment, Nuclear
 * Handles armed forces, weapon tiers, war progression, bombardment threats
 */

import type { War, Weapon, WeaponTier, WeaponLicense, ResolutionEntry, Region, FrontAllocation, UnitCounts, WarAllocationSubmission, MilitaryUnits, AttackOrder } from '@undercover/shared';
import type { ServerPlayerState, TemporaryEffect, EcoWarGameContext } from './types';
import {
  WEAPON_TIERS,
  WEAPON_PROPRIETARY_MAINTENANCE_RATE,
  WEAPON_DEGRADATION_PER_TURN,
  WEAPON_PRODUCTION_STEEL_COST,
  WEAPON_PRODUCTION_RARE_EARTH_COST,
  WEAPON_BUILD_THRESHOLD,
  WEAPON_AUTO_COST_MULT,
  MILITARY_RESEARCH_BONUS_PER_5,
  WAR_MOBILIZATION_PROD_LOSS,
  WAR_ARMISTICE_MIN_TURNS,
  WAR_RESISTANCE_DURATION,
  WAR_RECONSTRUCTION_DURATION,
  WAR_RECONSTRUCTION_PENALTY,
  BOMBARDMENT_DAMAGE_MIN,
  BOMBARDMENT_DAMAGE_MAX,
  BOMBARDMENT_DURATION_MIN,
  BOMBARDMENT_DURATION_MAX,
  BOMBARDMENT_INTERCEPT_THRESHOLD,
  BOMBARDMENT_INTERCEPT_MIN,
  BOMBARDMENT_INTERCEPT_MAX,
  NUCLEAR_TARGET_POP_LOSS,
  NUCLEAR_TARGET_HAPPINESS_LOSS,
  NUCLEAR_TARGET_REGION_LOCKOUT,
  NUCLEAR_ATTACKER_INFLUENCE_LOSS,
  NUCLEAR_ATTACKER_HAPPINESS_LOSS,
  NUCLEAR_GLOBAL_POLLUTION,
  NUCLEAR_GLOBAL_HEALTH_LOSS,
  ORG_MILITARY_DETERRENCE_HAPPINESS,
  UNIT_POWER_INFANTRY,
  UNIT_POWER_TANKS,
  UNIT_POWER_PLANES,
  UNIT_POWER_WARSHIPS,
  TERRAIN_DEFENSE_MODIFIER,
  WAR_INTEGRITY_LOSS_PER_POWER,
  WAR_INTEGRITY_MIN_LOSS,
  WAR_INTEGRITY_RECOVERY_PER_POWER,
  COMBAT_KILL_MATRIX,
  COMBAT_TIER_POWER,
  UNIT_COMBAT_POWER,
  COMBAT_RATIO_EXPONENT,
  COMBAT_RANDOM_FACTOR,
  TERRAIN_COMBAT_MODIFIERS,
  FORTIFY_DEFENSE_MULT,
  INFANTRY_RECRUIT_COST,
  INFANTRY_TRAINING_COST,
  INFANTRY_BULK_DISCOUNT_RATE,
  INFANTRY_BULK_DISCOUNT_MAX,
  INFANTRY_UPKEEP,
  TANK_UPKEEP,
  PLANE_UPKEEP,
  WARSHIP_UPKEEP,
  TANK_BUILD_COST,
  TANK_BUILD_STEEL,
  TANK_BUILD_THRESHOLD,
  PLANE_BUILD_COST,
  PLANE_BUILD_STEEL,
  PLANE_BUILD_THRESHOLD,
  WARSHIP_BUILD_COST,
  WARSHIP_BUILD_STEEL,
  WARSHIP_BUILD_THRESHOLD,
  AMMO_NO_AMMO_POWER_MULT,
  AMMO_INFANTRY_CONSUMPTION,
  AMMO_TANK_CONSUMPTION,
  AMMO_PLANE_CONSUMPTION,
} from './constants';
import { randomUUID as uuid } from 'crypto';

// ─── Effective Force ───────────────────────────────────────────

export function calculateEffectiveForce(player: ServerPlayerState): number {
  let force = player.military.armedForces;

  // Weapon bonuses
  for (const weapon of player.military.weapons) {
    force += weapon.forceBonus * (weapon.efficacy / 100);
  }

  // Research bonus: +1 per 5 research levels
  force += Math.floor(player.research.globalLevel / 5) * MILITARY_RESEARCH_BONUS_PER_5;

  return Math.round(force);
}

// ─── Weapons ───────────────────────────────────────────────────

export function createWeapon(tier: WeaponTier, license: WeaponLicense, sellerId: string | null): Weapon {
  const tierData = WEAPON_TIERS[tier];
  const forceBonus = tierData.forceMin + Math.floor(Math.random() * (tierData.forceMax - tierData.forceMin + 1));
  const maintenanceCost = license === 'proprietary'
    ? Math.round(tierData.baseCost * WEAPON_PROPRIETARY_MAINTENANCE_RATE)
    : Math.round(tierData.baseCost * 0.01);

  return {
    id: uuid(),
    tier,
    name: `${tierData.name} Tier ${tier}`,
    forceBonus,
    license,
    sellerId,
    maintenanceCost,
    efficacy: 100,
  };
}

// ─── Armament Auto-Production ──────────────────────────────────

const ARMAMENT_FACTORY_TIER_MULT: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 };
const ARMAMENT_FACTORY_TIER_LEVEL: Record<string, number> = { basic: 1, advanced: 2, robotized: 3 };
// Max weapon tier by factory tier (basic→T1, advanced→T2, robotized→T3; T4 only with nuclear:35 via robotized)
const ARMAMENT_FACTORY_MAX_WEAPON_TIER: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

export function tickWeaponProduction(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    const armamentFactories = player.factories.filter(f => f.sector === 'armament');
    if (armamentFactories.length === 0) continue;

    const res = player.resources as unknown as Record<string, number>;

    // Best factory tier
    let bestTierLevel = 0;
    let bestTierStr = 'basic';
    let totalHealth = 0;
    for (const f of armamentFactories) {
      const lvl = ARMAMENT_FACTORY_TIER_LEVEL[f.tier] ?? 1;
      if (lvl > bestTierLevel) { bestTierLevel = lvl; bestTierStr = f.tier; }
      totalHealth += f.health;
    }
    const avgHealth = (totalHealth / armamentFactories.length) / 100;

    // Production choice (default: tier 1)
    const choice = player.productionChoices['armament'];
    const rawWeaponTier = choice?.weaponTier ?? 1;
    // Cap weapon tier by factory level; T4 additionally requires nuclear:35
    const maxTier = ARMAMENT_FACTORY_MAX_WEAPON_TIER[bestTierLevel] ?? 1;
    const nuclearLevel = player.research.branches['nuclear'] ?? 0;
    const absoluteMax = nuclearLevel >= 35 ? 4 : 3;
    const weaponTier = Math.min(rawWeaponTier, maxTier, absoluteMax) as WeaponTier;

    // Accumulate production
    const rate = armamentFactories.length * (ARMAMENT_FACTORY_TIER_MULT[bestTierStr] ?? 1.0) * avgHealth;
    const prev = player.vehicleProductionQueue['armament'] ?? 0;
    const next = prev + rate;
    const threshold = WEAPON_BUILD_THRESHOLD[weaponTier] ?? 1.0;

    if (next < threshold) {
      player.vehicleProductionQueue['armament'] = next;
      continue;
    }

    // Check costs
    const tierData = WEAPON_TIERS[weaponTier];
    const moneyCost = Math.round(tierData.baseCost * WEAPON_AUTO_COST_MULT);
    const steelCost = WEAPON_PRODUCTION_STEEL_COST[weaponTier] ?? 3;
    const rareCost  = WEAPON_PRODUCTION_RARE_EARTH_COST[weaponTier] ?? 0;

    if (player.money < moneyCost) continue;
    if ((res['steel'] ?? 0) < steelCost) continue;
    if (rareCost > 0 && (res['rareEarths'] ?? 0) < rareCost) continue;

    // Deduct costs
    player.money -= moneyCost;
    res['steel'] = Math.max(0, (res['steel'] ?? 0) - steelCost);
    if (rareCost > 0) res['rareEarths'] = Math.max(0, (res['rareEarths'] ?? 0) - rareCost);

    // Create weapon (proprietary, created by this player)
    const weapon = createWeapon(weaponTier, 'proprietary', player.id);
    player.military.weapons.push(weapon);

    // Reset queue with remainder
    player.vehicleProductionQueue['armament'] = next - threshold;

    entries.push({
      step: 'production',
      playerId: player.id,
      description: `⚔️ ${player.countryName} : Arme ${tierData.name} T${weaponTier} produite (${moneyCost}€ + ${steelCost} acier)`,
      icon: '⚔️',
      positive: true,
    });
  }

  return entries;
}

export function degradeUnmaintainedWeapons(player: ServerPlayerState, context: EcoWarGameContext): void {
  for (const weapon of player.military.weapons) {
    if (weapon.license !== 'proprietary' || !weapon.sellerId) continue;

    const seller = context.players.get(weapon.sellerId);

    // Dégradation si le vendeur est en guerre contre ce joueur
    const atWarWithSeller = context.activeWars.some(
      w => w.status === 'active' &&
        ((w.attackerId === player.id && w.defenderId === weapon.sellerId) ||
         (w.defenderId === player.id && w.attackerId === weapon.sellerId)),
    );

    // Dégradation si sanction totale du vendeur contre ce joueur
    const sellerFullySanctioned = player.activeSanctions.some(
      s => s.targetId === weapon.sellerId && s.type === 'full',
    );

    // Dégradation si le vendeur n'existe plus dans la partie
    if (atWarWithSeller || sellerFullySanctioned || !seller) {
      applyWeaponDegradation(weapon);
    }
  }
}

export function applyWeaponDegradation(weapon: Weapon): void {
  weapon.efficacy = Math.max(0, weapon.efficacy - WEAPON_DEGRADATION_PER_TURN * 100);
}

// ─── Combat Unit Production ────────────────────────────────────

const FACTORY_TIER_MULT: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 };

/** Auto-produce tanks, planes, warships from their respective factories. */
export function tickCombatUnitProduction(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  const CONFIGS = [
    {
      sector: 'tankFactory',
      unitKey: 'tanks' as const,
      buildCost:      TANK_BUILD_COST,
      buildSteel:     TANK_BUILD_STEEL,
      buildThreshold: TANK_BUILD_THRESHOLD,
      label:          'Char',
    },
    {
      sector: 'militaryAirbase',
      unitKey: 'planes' as const,
      buildCost:      PLANE_BUILD_COST,
      buildSteel:     PLANE_BUILD_STEEL,
      buildThreshold: PLANE_BUILD_THRESHOLD,
      label:          'Avion',
    },
    {
      sector: 'navalBase',
      unitKey: 'warships' as const,
      buildCost:      WARSHIP_BUILD_COST,
      buildSteel:     WARSHIP_BUILD_STEEL,
      buildThreshold: WARSHIP_BUILD_THRESHOLD,
      label:          'Navire',
    },
  ] as const;

  for (const [, player] of players) {
    if (player.abandoned) continue;
    const res = player.resources as unknown as Record<string, number>;

    for (const cfg of CONFIGS) {
      const factories = player.factories.filter(f => f.sector === cfg.sector);
      if (factories.length === 0) continue;

      // Best factory tier
      let bestTierStr = 'basic';
      let totalHealth = 0;
      for (const f of factories) {
        const lvl = f.tier === 'robotized' ? 3 : f.tier === 'advanced' ? 2 : 1;
        const bestLvl = bestTierStr === 'robotized' ? 3 : bestTierStr === 'advanced' ? 2 : 1;
        if (lvl > bestLvl) bestTierStr = f.tier;
        totalHealth += f.health;
      }
      const avgHealth = (totalHealth / factories.length) / 100;
      const maxUnitTier = bestTierStr === 'robotized' ? 3 : bestTierStr === 'advanced' ? 2 : 1;

      // Production choice (default T1, cap by factory tier)
      const rawTier = (player.productionChoices[cfg.sector as keyof typeof player.productionChoices] as { vehicleTier?: number } | undefined)?.vehicleTier ?? 1;
      const tier = (Math.min(rawTier, maxUnitTier) as 1 | 2 | 3);
      const tierIdx = tier - 1;

      // Accumulate
      const rate = factories.length * (FACTORY_TIER_MULT[bestTierStr] ?? 1.0) * avgHealth;
      const prev = player.vehicleProductionQueue[cfg.sector] ?? 0;
      const next = prev + rate;
      const threshold = cfg.buildThreshold[tierIdx];

      if (next < threshold) {
        player.vehicleProductionQueue[cfg.sector] = next;
        continue;
      }

      // Check costs
      const moneyCost = cfg.buildCost[tierIdx];
      const steelCost = cfg.buildSteel[tierIdx];
      if (player.money < moneyCost) continue;
      if ((res['steel'] ?? 0) < steelCost) continue;

      player.money -= moneyCost;
      res['steel'] = Math.max(0, (res['steel'] ?? 0) - steelCost);
      player.military.units[cfg.unitKey][tierIdx]++;
      player.vehicleProductionQueue[cfg.sector] = next - threshold;

      entries.push({
        step: 'production',
        playerId: player.id,
        description: `🪖 ${player.countryName} : ${cfg.label} T${tier} produit (${moneyCost}€ + ${steelCost} acier)`,
        icon: '🪖',
        positive: true,
      });
    }
  }

  return entries;
}

// ─── Unit Maintenance ──────────────────────────────────────────

/** Deduct upkeep for all military units; disband units player cannot pay for. */
export function tickUnitMaintenance(players: Map<string, ServerPlayerState>): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    const units = player.military.units;
    type UnitKey = 'infantry' | 'tanks' | 'planes' | 'warships';
    const UPKEEP: Record<UnitKey, [number, number, number]> = {
      infantry: INFANTRY_UPKEEP,
      tanks:    TANK_UPKEEP,
      planes:   PLANE_UPKEEP,
      warships: WARSHIP_UPKEEP,
    };

    // Compute total upkeep
    let totalUpkeep = 0;
    for (const key of ['infantry', 'tanks', 'planes', 'warships'] as UnitKey[]) {
      for (let t = 0; t < 3; t++) {
        totalUpkeep += units[key][t] * UPKEEP[key][t];
      }
    }

    if (totalUpkeep <= player.money) {
      player.money -= totalUpkeep;
    } else {
      // Disband starting with most expensive units first until affordable
      let shortfall = totalUpkeep - player.money;
      const order: { key: UnitKey; t: number; cost: number }[] = [];
      for (const key of ['warships', 'planes', 'tanks', 'infantry'] as UnitKey[]) {
        for (let t = 2; t >= 0; t--) {
          if (units[key][t] > 0) order.push({ key, t, cost: UPKEEP[key][t] });
        }
      }
      for (const { key, t, cost } of order) {
        if (shortfall <= 0) break;
        const toDrop = Math.ceil(shortfall / cost);
        const dropped = Math.min(units[key][t], toDrop);
        units[key][t] -= dropped;
        shortfall -= dropped * cost;
        entries.push({
          step: 'production',
          playerId: player.id,
          description: `⚠️ ${player.countryName} : ${dropped} unité(s) T${t+1} dissoute(s) (manque de fonds)`,
          icon: '⚠️',
          positive: false,
        });
      }
      player.money = Math.max(0, player.money - (totalUpkeep - shortfall));
    }
  }

  return entries;
}

// ─── Recruit Infantry ──────────────────────────────────────────

/**
 * Recruit T1 infantry and deploy them directly to a province.
 * T2/T3 are obtained via training only.
 */
export function recruitInfantry(
  player: ServerPlayerState,
  tier: 1 | 2 | 3,
  count: number,
  regionId?: string,
): string | null {
  if (tier !== 1) return 'Seuls les soldats de niveau 1 peuvent être recrutés — utilisez l\'entraînement pour monter de niveau';
  if (count <= 0) return 'Nombre invalide';
  if (!regionId) return 'Vous devez choisir une province de déploiement';

  // Validate region
  const region = player.regions.find(r => r.id === regionId && !r.occupiedBy && !r.destroyed);
  if (!region) return 'Province invalide ou inaccessible';

  const cost = INFANTRY_RECRUIT_COST[0] * count;
  if (player.money < cost) return `Fonds insuffisants (besoin: ${cost}€)`;

  player.money -= cost;

  // Deploy directly to region (not reserve)
  if (!player.troopsByRegion[regionId]) {
    player.troopsByRegion[regionId] = {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };
  }
  player.troopsByRegion[regionId].infantry[0] += count;
  return null;
}

/**
 * Train infantry to next tier (T1→T2, T2→T3).
 * Bulk discount: cost × (1 - min(20%, count × 1%)).
 * Troops must be deployed in a region — training happens in place.
 */
export function trainInfantry(
  player: ServerPlayerState,
  regionId: string,
  fromTier: 1 | 2,
  count: number,
): string | null {
  if (count <= 0) return 'Nombre invalide';

  const troops = player.troopsByRegion[regionId];
  if (!troops) return 'Aucune troupe dans cette province';

  const available = troops.infantry[fromTier - 1];
  if (available < count) return `Pas assez de soldats T${fromTier} dans cette province (${available} disponibles)`;

  const baseCost = INFANTRY_TRAINING_COST[fromTier - 1];
  const discount = Math.min(INFANTRY_BULK_DISCOUNT_MAX, count * INFANTRY_BULK_DISCOUNT_RATE);
  const totalCost = Math.round(baseCost * count * (1 - discount));

  if (player.money < totalCost) return `Fonds insuffisants (besoin: ${totalCost}€)`;

  player.money -= totalCost;
  troops.infantry[fromTier - 1] -= count;
  troops.infantry[fromTier] += count; // fromTier 1→index 1 (T2), fromTier 2→index 2 (T3)
  return null;
}

// ─── War Resolution ────────────────────────────────────────────

const ZERO_FORCES: FrontAllocation = {
  infantry: [0, 0, 0],
  tanks:    [0, 0, 0],
  planes:   [0, 0, 0],
  warships: [0, 0, 0],
};

type AmmoMults = { infantry: number; tanks: number; planes: number };
const FULL_AMMO: AmmoMults = { infantry: 1, tanks: 1, planes: 1 };

/** Compute combat power of a force allocation (no terrain modifier). */
function computeFrontPower(forces: FrontAllocation, ammo: AmmoMults = FULL_AMMO): number {
  let power = 0;
  for (let t = 0; t < 3; t++) {
    power += forces.infantry[t] * UNIT_POWER_INFANTRY[t] * ammo.infantry;
    power += forces.tanks[t]    * UNIT_POWER_TANKS[t]    * ammo.tanks;
    power += forces.planes[t]   * UNIT_POWER_PLANES[t]   * ammo.planes;
    power += forces.warships[t] * UNIT_POWER_WARSHIPS[t];
  }
  return power;
}

/** Apply terrain modifier to defender's power per unit type. */
function computeDefenderPower(forces: FrontAllocation, terrain: string, ammo: AmmoMults = FULL_AMMO): number {
  const mods = TERRAIN_DEFENSE_MODIFIER[terrain] ?? TERRAIN_DEFENSE_MODIFIER['plains'];
  let power = 0;
  for (let t = 0; t < 3; t++) {
    power += forces.infantry[t] * UNIT_POWER_INFANTRY[t] * (mods['infantry'] ?? 1) * ammo.infantry;
    power += forces.tanks[t]    * UNIT_POWER_TANKS[t]    * (mods['tanks']    ?? 1) * ammo.tanks;
    power += forces.planes[t]   * UNIT_POWER_PLANES[t]   * (mods['planes']   ?? 1) * ammo.planes;
    power += forces.warships[t] * UNIT_POWER_WARSHIPS[t] * (mods['warships'] ?? 1);
  }
  return power;
}

/**
 * Count total units (T1+T2+T3) across all fronts of an allocation for a given unit type.
 * Used to compute ammo consumption.
 */
function countAllocatedUnits(alloc: WarAllocationSubmission, unitKey: keyof FrontAllocation): number {
  let total = 0;
  for (const front of alloc.fronts) {
    for (let t = 0; t < 3; t++) {
      total += front.forces[unitKey][t];
    }
  }
  return total;
}

/**
 * Apply ammo consumption for a player's combat allocation.
 * Returns multipliers for each unit type (1.0 or AMMO_NO_AMMO_POWER_MULT).
 */
function consumeAmmoAndGetMultipliers(
  player: ServerPlayerState,
  alloc: WarAllocationSubmission,
): { infantry: number; tanks: number; planes: number } {
  const infantryUsed = countAllocatedUnits(alloc, 'infantry');
  const tanksUsed    = countAllocatedUnits(alloc, 'tanks');
  const planesUsed   = countAllocatedUnits(alloc, 'planes');

  const munitionsNeeded = infantryUsed * AMMO_INFANTRY_CONSUMPTION;
  const obusNeeded      = tanksUsed    * AMMO_TANK_CONSUMPTION;
  const bombsNeeded     = planesUsed   * AMMO_PLANE_CONSUMPTION;

  const res = player.resources as unknown as Record<string, number>;
  const infantryMult = (res['munitions'] ?? 0) >= munitionsNeeded ? 1.0 : AMMO_NO_AMMO_POWER_MULT;
  const tanksMult    = (res['obus']      ?? 0) >= obusNeeded      ? 1.0 : AMMO_NO_AMMO_POWER_MULT;
  const planesMult   = (res['bombs']     ?? 0) >= bombsNeeded     ? 1.0 : AMMO_NO_AMMO_POWER_MULT;

  // Consume ammo from resources
  res['munitions'] = Math.max(0, (res['munitions'] ?? 0) - munitionsNeeded);
  res['obus']      = Math.max(0, (res['obus']      ?? 0) - obusNeeded);
  res['bombs']     = Math.max(0, (res['bombs']     ?? 0) - bombsNeeded);

  return { infantry: infantryMult, tanks: tanksMult, planes: planesMult };
}

/** Create a default allocation: distribute all units evenly across the given regions. */
function createDefaultAllocation(warId: string, regionIds: string[], player: ServerPlayerState): WarAllocationSubmission {
  const n = Math.max(1, regionIds.length);
  const u = player.military.units;
  return {
    warId,
    fronts: regionIds.map(regionId => ({
      regionId,
      forces: {
        infantry: [Math.floor(u.infantry[0]/n), Math.floor(u.infantry[1]/n), Math.floor(u.infantry[2]/n)] as UnitCounts,
        tanks:    [Math.floor(u.tanks[0]/n),    Math.floor(u.tanks[1]/n),    Math.floor(u.tanks[2]/n)]    as UnitCounts,
        planes:   [Math.floor(u.planes[0]/n),   Math.floor(u.planes[1]/n),   Math.floor(u.planes[2]/n)]   as UnitCounts,
        warships: [Math.floor(u.warships[0]/n), Math.floor(u.warships[1]/n), Math.floor(u.warships[2]/n)] as UnitCounts,
      },
    })),
  };
}

/** Apply fractional losses to a player's units based on opponent's effective power. */
function applyLossesFromPower(player: ServerPlayerState, opponentPower: number): void {
  const lossFraction = Math.min(0.85, opponentPower * COMBAT_RATIO_EXPONENT * 0.01);
  if (lossFraction <= 0) return;
  const u = player.military.units;
  for (let t = 0; t < 3; t++) {
    u.infantry[t] = Math.max(0, u.infantry[t] - Math.round(u.infantry[t] * lossFraction));
    u.tanks[t]    = Math.max(0, u.tanks[t]    - Math.round(u.tanks[t]    * lossFraction));
    u.planes[t]   = Math.max(0, u.planes[t]   - Math.round(u.planes[t]   * lossFraction));
    u.warships[t] = Math.max(0, u.warships[t] - Math.round(u.warships[t] * lossFraction));
  }
}

// ─── Region Conquest Effects ───────────────────────────────────
// Called whenever a region changes hands. Transfers population and partial
// infrastructure from the losing player to the conqueror.
// The absorbed population is unhappy (wartime fear), dragging down the
// attacker's average happiness significantly.

function applyRegionConquest(
  attacker: ServerPlayerState,
  defender: ServerPlayerState,
  region: Region,
  warDuration: number,
): void {
  const conqueredMillion = region.population / 1_000_000; // region pop is raw, pop.total is millions
  if (conqueredMillion <= 0) return;

  const attackerPop   = attacker.population.total;
  const attackerHappy = attacker.population.happinessLevel;

  // Bonheur de la population conquise : décroît avec la durée de guerre
  // 1 tour → 20%, 5 tours → 12%, 10 tours → 5% (min 5)
  const conqueredHappy = Math.max(5, Math.round(20 - warDuration * 1.5));

  // Weighted happiness average
  const newHappy = Math.round(
    (attackerPop * attackerHappy + conqueredMillion * conqueredHappy) /
    Math.max(1, attackerPop + conqueredMillion),
  );

  attacker.population.total += conqueredMillion;
  attacker.population.happinessLevel = Math.max(5, newHappy);

  // Defender loses population
  defender.population.total = Math.max(0, defender.population.total - conqueredMillion);

  // Infrastructure spoils : taux réduit avec la durée de guerre
  // 1 tour → 15%, 5 tours → 9.5%, 10 tours → 3% (min 3%)
  const infraTransfer = Math.max(0.03, 0.15 - (warDuration - 1) * 0.012);
  attacker.infrastructure.electricity    = Math.min(100, attacker.infrastructure.electricity    + Math.round(defender.infrastructure.electricity    * infraTransfer));
  attacker.infrastructure.telecom        = Math.min(100, attacker.infrastructure.telecom        + Math.round(defender.infrastructure.telecom        * infraTransfer));
  attacker.infrastructure.waterTreatment = Math.min(100, attacker.infrastructure.waterTreatment + Math.round(defender.infrastructure.waterTreatment * infraTransfer));

  // Capacité de production de la région : dégradée par la durée du conflit
  // 1 tour → 85%, 5 tours → 57%, 10 tours → 22% (min 15%)
  const capacityRetained = Math.max(15, 90 - warDuration * 7.5);
  region.productionCapacity = Math.round(region.productionCapacity * capacityRetained / 100);
}

export function resolveWars(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const war of context.activeWars) {
    if (war.status !== 'active') continue;

    war.duration++;

    const attacker = context.players.get(war.attackerId);
    const defender = context.players.get(war.defenderId);
    if (!attacker || !defender) continue;

    // Contested regions: defender's regions with warIntegrity > 0 and not already occupied
    const contestedRegions = defender.regions.filter(
      r => r.contestedByWarId === war.id && !r.occupiedBy && !r.destroyed,
    );

    if (contestedRegions.length === 0) {
      // No fronts — check if all regions captured
      const allTaken = defender.regions.every(r => r.occupiedBy === attacker.id || r.destroyed);
      if (allTaken) {
        war.status = 'victory_attacker';
        applyWarEnd(attacker, defender, war, entries);
      }
      continue;
    }

    const regionIds = contestedRegions.map(r => r.id);

    // Get allocations (from pendingWarAllocations) or generate defaults
    const attackerSubmitted = attacker.pendingWarAllocations.find(a => a.warId === war.id);
    const defenderSubmitted = defender.pendingWarAllocations.find(a => a.warId === war.id);
    const attackerAlloc = attackerSubmitted ?? createDefaultAllocation(war.id, regionIds, attacker);
    const defenderAlloc = defenderSubmitted ?? createDefaultAllocation(war.id, regionIds, defender);

    // Consume ammo and get per-unit-type effectiveness multipliers
    const attackerAmmo = consumeAmmoAndGetMultipliers(attacker, attackerAlloc);
    const defenderAmmo = consumeAmmoAndGetMultipliers(defender, defenderAlloc);

    // Process each contested region
    for (const region of contestedRegions) {
      const attackFront = attackerAlloc.fronts.find(f => f.regionId === region.id);
      const defendFront = defenderAlloc.fronts.find(f => f.regionId === region.id);

      const rawAttack = computeFrontPower(attackFront?.forces ?? ZERO_FORCES, attackerAmmo);
      const rawDefend = computeDefenderPower(defendFront?.forces ?? ZERO_FORCES, region.terrain, defenderAmmo);

      // Random factor ±COMBAT_RANDOM_FACTOR
      const attackRand = 1 - COMBAT_RANDOM_FACTOR + Math.random() * 2 * COMBAT_RANDOM_FACTOR;
      const defendRand = 1 - COMBAT_RANDOM_FACTOR + Math.random() * 2 * COMBAT_RANDOM_FACTOR;
      const effectiveAttack = rawAttack * attackRand;
      const effectiveDefend = rawDefend * defendRand;

      // Apply casualties to each side (proportional to opponent's effective power)
      applyLossesFromPower(attacker, effectiveDefend);
      applyLossesFromPower(defender, effectiveAttack);

      // Update integrity
      const advantage = effectiveAttack - effectiveDefend;
      if (advantage > 0) {
        const loss = Math.max(WAR_INTEGRITY_MIN_LOSS, Math.ceil(advantage * WAR_INTEGRITY_LOSS_PER_POWER));
        region.warIntegrity = Math.max(0, region.warIntegrity - loss);
        entries.push({
          step: 'war',
          playerId: war.attackerId,
          targetId: war.defenderId,
          description: `⚔️ Assaut sur ${region.name} (${region.terrain}) — Attaque ${effectiveAttack.toFixed(0)} vs Défense ${effectiveDefend.toFixed(0)} → Intégrité −${loss} (${region.warIntegrity}%)`,
          icon: '⚔️',
          positive: false,
        });
      } else {
        const recovery = Math.min(10, Math.ceil(-advantage * WAR_INTEGRITY_RECOVERY_PER_POWER));
        region.warIntegrity = Math.min(100, region.warIntegrity + recovery);
        entries.push({
          step: 'war',
          playerId: war.defenderId,
          targetId: war.attackerId,
          description: `🛡️ ${region.name} tient ! Défense ${effectiveDefend.toFixed(0)} vs Attaque ${effectiveAttack.toFixed(0)} → Intégrité +${recovery} (${region.warIntegrity}%)`,
          icon: '🛡️',
          positive: true,
        });
      }

      // Region captured when integrity reaches 0
      if (region.warIntegrity <= 0) {
        region.occupiedBy = attacker.id;
        region.contestedByWarId = null;
        region.resistanceRemaining = WAR_RESISTANCE_DURATION;
        war.regionsConquered.push(region.id);

        applyRegionConquest(attacker, defender, region, war.duration);

        entries.push({
          step: 'war',
          playerId: war.attackerId,
          targetId: war.defenderId,
          description: `🏴 ${attacker.countryName} conquiert ${region.name} ! Pop. absorbée : ${(region.population / 1_000_000).toFixed(1)}M`,
          icon: '🏴',
          positive: false,
        });
      }
    }

    // Clear pending allocations for next turn
    attacker.pendingWarAllocations = attacker.pendingWarAllocations.filter(a => a.warId !== war.id);
    defender.pendingWarAllocations = defender.pendingWarAllocations.filter(a => a.warId !== war.id);

    // Happiness losses (war fatigue)
    attacker.population.happinessLevel = Math.max(0, attacker.population.happinessLevel - 2);
    defender.population.happinessLevel = Math.max(0, defender.population.happinessLevel - 1);

    // Check if all regions captured
    const allTaken = defender.regions.every(r => r.occupiedBy === attacker.id || r.destroyed);
    if (allTaken) {
      war.status = 'victory_attacker';
      applyWarEnd(attacker, defender, war, entries);
    }

    // Armistice notification
    if (war.duration >= WAR_ARMISTICE_MIN_TURNS && war.armisticeProposedBy) {
      entries.push({
        step: 'war',
        description: `🕊️ Proposition d'armistice en cours entre ${attacker.countryName} et ${defender.countryName}`,
        icon: '🕊️',
        positive: true,
      });
    }
  }

  return entries;
}

function applyWarEnd(
  attacker: ServerPlayerState,
  defender: ServerPlayerState,
  war: War,
  entries: ResolutionEntry[],
): void {
  // Reconstruction penalty for attacker
  attacker.activeEffects.push({
    id: uuid(),
    type: 'war_reconstruction',
    description: 'Reconstruction post-guerre',
    modifier: -WAR_RECONSTRUCTION_PENALTY,
    remainingTurns: WAR_RECONSTRUCTION_DURATION,
  });

  entries.push({
    step: 'war',
    playerId: war.attackerId,
    targetId: war.defenderId,
    description: `${attacker.countryName} remporte la guerre contre ${defender.countryName} après ${war.duration} tours !`,
    icon: '🏆',
    positive: false,
  });
}

// ─── Province-Level Attack Order Resolution ────────────────────

/** Applique des pertes fractionnaires aux troupes déployées dans une région spécifique. */
// ─── Nouveau moteur de combat matriciel ────────────────────────

const UNIT_TYPES_COMBAT = ['infantry', 'tanks', 'planes', 'warships'] as const;
type CombatUnitType = typeof UNIT_TYPES_COMBAT[number];

/** Calcule la puissance totale d'une force (pour le ratio numérique) */
function computeTotalPower(troops: MilitaryUnits): number {
  let power = 0;
  for (const type of UNIT_TYPES_COMBAT) {
    const powers = UNIT_COMBAT_POWER[type];
    for (let t = 0; t < 3; t++) power += troops[type][t] * powers[t];
  }
  return power;
}

/**
 * Applique les kills de 'attacker' sur 'defender' dans une province.
 * Retourne le nombre total de tués (pour les logs).
 */
function applyMatrixKills(
  attacker:    MilitaryUnits,
  defender:    MilitaryUnits,
  ratioMult:   number,
  rand:        number,
  terrainMods: { attackMult: Record<string, number>; defMult: Record<string, number> },
  isFortified: boolean,
): number {
  let totalKilled = 0;
  const fortMult = isFortified ? FORTIFY_DEFENSE_MULT : 1.0;

  for (const defType of UNIT_TYPES_COMBAT) {
    const defMult = (terrainMods.defMult[defType] ?? 1.0) * fortMult;
    // Accumulate kills from all attacker types
    let rawKills = 0;
    for (const atkType of UNIT_TYPES_COMBAT) {
      const atkMult = terrainMods.attackMult[atkType] ?? 1.0;
      const killRate = COMBAT_KILL_MATRIX[atkType]?.[defType] ?? 0;
      // Effective attacker units (weighted by tier power)
      let atkEff = 0;
      for (let t = 0; t < 3; t++) atkEff += attacker[atkType][t] * COMBAT_TIER_POWER[t];
      rawKills += atkEff * killRate * atkMult;
    }
    rawKills *= ratioMult * rand * defMult;

    if (rawKills <= 0) continue;
    // Minimum 1 kill quand il y a bien des dommages (évite les armées résiduelles indestructibles)
    if (rawKills < 1) rawKills = 1;
    // Distribute kills across tiers T1 → T2 → T3
    let remaining = rawKills;
    for (let t = 0; t < 3; t++) {
      const killed = Math.min(defender[defType][t], Math.round(remaining));
      defender[defType][t] -= killed;
      totalKilled += killed;
      remaining -= killed;
      if (remaining <= 0) break;
    }
  }
  return totalKilled;
}

/** Calcule le ratio de puissance et retourne le multiplicateur d'avantage */
function ratioMultiplier(myPower: number, opponentPower: number): number {
  if (opponentPower <= 0) return Math.pow(10, COMBAT_RATIO_EXPONENT); // écrasant
  return Math.pow(Math.max(0.05, myPower / opponentPower), COMBAT_RATIO_EXPONENT);
}

/** Supprime une entrée troopsByRegion si toutes les unités sont à 0 */
function cleanupEmptyTroops(player: ServerPlayerState, regionId: string): void {
  const t = player.troopsByRegion[regionId];
  if (!t) return;
  const empty = UNIT_TYPES_COMBAT.every(type => t[type].every((v: number) => v === 0));
  if (empty) delete player.troopsByRegion[regionId];
}


/**
 * Résout les ordres d'attaque province-à-province soumis pendant actionSelection.
 * Remplace la résolution abstraite par front pour les combats dirigés.
 */
export function resolveAttackOrders(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];
  // Éviter de traiter la même province deux fois (symétrie A→B / B→A)
  const processed = new Set<string>();

  for (const [, attackerState] of context.players) {
    for (const [regionId, attackerTroops] of Object.entries(attackerState.troopsByRegion)) {
      const key = `${attackerState.id}:${regionId}`;
      if (processed.has(key)) continue;

      // Vérifier qu'il y a des troupes
      const atkPower = computeTotalPower(attackerTroops);
      if (atkPower === 0) continue;

      // Chercher si cette province appartient à un autre joueur (conflit)
      let defenderState: ServerPlayerState | undefined;
      let targetRegion: Region | undefined;
      for (const [, p] of context.players) {
        if (p.id === attackerState.id) continue;
        const r = p.regions.find(r => r.id === regionId && !r.destroyed);
        if (r) { defenderState = p; targetRegion = r; break; }
      }
      if (!defenderState || !targetRegion) continue;

      // Vérifier la guerre active
      const war = context.activeWars.find(w =>
        w.status === 'active' &&
        ((w.attackerId === attackerState.id && w.defenderId === defenderState!.id) ||
         (w.defenderId === attackerState.id && w.attackerId === defenderState!.id))
      );
      if (!war) continue;
      processed.add(key);
      if (!targetRegion.contestedByWarId) targetRegion.contestedByWarId = war.id;

      const terrain = targetRegion.terrain ?? 'plains';
      const terrainMods = TERRAIN_COMBAT_MODIFIERS[terrain] ?? TERRAIN_COMBAT_MODIFIERS['plains'];
      const isFortified = !!targetRegion.fortified;

      const defTroops = defenderState.troopsByRegion[regionId];
      const defPower  = defTroops ? computeTotalPower(defTroops) : 0;

      // Capture immédiate si le défenseur n'a aucune troupe dans la province
      if (defPower === 0) {
        defenderState.regions = defenderState.regions.filter(r => r.id !== regionId);
        targetRegion.occupiedBy = null;
        targetRegion.contestedByWarId = null;
        targetRegion.resistanceRemaining = WAR_RESISTANCE_DURATION;
        targetRegion.warIntegrity = 100;
        attackerState.regions.push(targetRegion);
        war.regionsConquered.push(regionId);
        applyRegionConquest(attackerState, defenderState, targetRegion, war.duration);
        entries.push({
          step: 'war', playerId: attackerState.id, targetId: defenderState.id,
          description: `🏴 ${attackerState.countryName} occupe ${targetRegion.name} sans résistance !`,
          icon: '🏴', positive: false,
        });
        continue;
      }

      // Ratio multiplicateurs (chaque côté a son propre mult d'avantage)
      const atkRatioMult = ratioMultiplier(atkPower, defPower);
      const defRatioMult = ratioMultiplier(defPower, atkPower);
      const atkRand = 1 - COMBAT_RANDOM_FACTOR + Math.random() * 2 * COMBAT_RANDOM_FACTOR;
      const defRand = 1 - COMBAT_RANDOM_FACTOR + Math.random() * 2 * COMBAT_RANDOM_FACTOR;

      // Snapshot défenseur avant les kills (pour ne pas modifier pendant la lecture)
      const defTroopsSnapshot: MilitaryUnits = defTroops
        ? { infantry: [...defTroops.infantry] as [number,number,number], tanks: [...defTroops.tanks] as [number,number,number],
            planes: [...defTroops.planes] as [number,number,number], warships: [...defTroops.warships] as [number,number,number] }
        : { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] };
      const atkTroopsSnapshot: MilitaryUnits = {
        infantry: [...attackerTroops.infantry] as [number,number,number], tanks: [...attackerTroops.tanks] as [number,number,number],
        planes: [...attackerTroops.planes] as [number,number,number], warships: [...attackerTroops.warships] as [number,number,number],
      };

      // Appliquer les kills sur les troupes réelles
      const atkKills = applyMatrixKills(atkTroopsSnapshot, attackerTroops, defRatioMult, defRand, terrainMods, isFortified);
      const defKills = defTroops
        ? applyMatrixKills(defTroopsSnapshot, defTroops, atkRatioMult, atkRand, terrainMods, false)
        : 0;

      cleanupEmptyTroops(attackerState, regionId);
      if (defTroops) cleanupEmptyTroops(defenderState, regionId);

      // Intégrité : basée sur le ratio de puissance (les kills sur le défenseur réduisent l'intégrité)
      const integrityLoss = defKills > 0
        ? Math.max(WAR_INTEGRITY_MIN_LOSS, Math.round(defKills * 2))
        : 0;
      const integrityGain = atkKills > 0
        ? Math.min(8, Math.round(atkKills * 1.5))
        : 0;

      if (defKills > 0) {
        targetRegion.warIntegrity = Math.max(0, targetRegion.warIntegrity - integrityLoss);
        entries.push({
          step: 'war', playerId: attackerState.id, targetId: defenderState.id,
          description: `⚔️ ${attackerState.countryName} → ${targetRegion.name} : ${defKills} tués (def) / ${atkKills} tués (atq) — Intégrité −${integrityLoss} (${targetRegion.warIntegrity}%)`,
          icon: '⚔️', positive: false,
        });
      } else if (atkKills > 0) {
        targetRegion.warIntegrity = Math.min(100, targetRegion.warIntegrity + integrityGain);
        entries.push({
          step: 'war', playerId: defenderState.id, targetId: attackerState.id,
          description: `🛡️ ${targetRegion.name} résiste ! ${atkKills} attaquants tués — Intégrité +${integrityGain} (${targetRegion.warIntegrity}%)`,
          icon: '🛡️', positive: true,
        });
      }

      // Capture : région transférée si intégrité nulle
      if (targetRegion.warIntegrity <= 0) {
        defenderState.regions = defenderState.regions.filter(r => r.id !== regionId);
        targetRegion.occupiedBy = null;
        targetRegion.contestedByWarId = null;
        // fortification remains on the region (permanent — survives capture)
        targetRegion.resistanceRemaining = WAR_RESISTANCE_DURATION;
        targetRegion.warIntegrity = 100;
        attackerState.regions.push(targetRegion);
        war.regionsConquered.push(regionId);
        delete defenderState.troopsByRegion[regionId]; // troupes du défenseur détruites
        applyRegionConquest(attackerState, defenderState, targetRegion, war.duration);
        entries.push({
          step: 'war', playerId: attackerState.id, targetId: defenderState.id,
          description: `🏴 ${attackerState.countryName} conquiert ${targetRegion.name} !`,
          icon: '🏴', positive: false,
        });
      }
    }
    // Nettoyer les ordres en attente (compatibilité)
    attackerState.pendingAttackOrders = [];
  }

  return entries;
}

// ─── War Declaration ───────────────────────────────────────────

export function declareWar(
  attacker: ServerPlayerState,
  defender: ServerPlayerState,
  context: EcoWarGameContext,
): War {
  const war: War = {
    id: uuid(),
    attackerId: attacker.id,
    defenderId: defender.id,
    startedAtRound: context.currentRound,
    duration: 0,
    attackerForce: calculateEffectiveForce(attacker),
    defenderForce: calculateEffectiveForce(defender),
    regionsConquered: [],
    armisticeProposedBy: null,
    status: 'active',
    attackerAllocation: null,
    defenderAllocation: null,
  };

  // All defender's unoccupied, undestroyed regions become contested
  for (const region of defender.regions) {
    if (!region.occupiedBy && !region.destroyed) {
      region.contestedByWarId = war.id;
      region.warIntegrity = 100;
    }
  }

  // Apply mobilization penalty
  attacker.activeEffects.push({
    id: uuid(),
    type: 'war_mobilization',
    description: 'Mobilisation militaire',
    modifier: -WAR_MOBILIZATION_PROD_LOSS,
    remainingTurns: 999, // lasts until war ends
  });

  attacker.activeEffects.push({
    id: uuid(),
    type: 'war_attacker',
    description: 'En guerre (attaquant)',
    modifier: 0,
    remainingTurns: 999,
  });

  defender.activeEffects.push({
    id: uuid(),
    type: 'war_defender',
    description: 'En guerre (défenseur)',
    modifier: 0,
    remainingTurns: 999,
  });

  context.activeWars.push(war);

  // Pénalité de dissuasion si le défenseur est dans une org militaire
  const defenderInMilitaryOrg = context.organizations.some(
    o => o.type === 'military' && o.memberIds.includes(defender.id),
  );
  if (defenderInMilitaryOrg) {
    attacker.population.happinessLevel = Math.max(
      0,
      Math.floor(attacker.population.happinessLevel - ORG_MILITARY_DETERRENCE_HAPPINESS),
    );
  }

  return war;
}

// ─── Bombardment ───────────────────────────────────────────────
// Basé sur les avions militaires + bombes du joueur.
// Dégâts proportionnels au nombre d'avions engagés.
// Les troupes du défenseur abattent une fraction des avions.

export function executeBombardment(
  attacker: ServerPlayerState,
  target: ServerPlayerState,
  targetDescription: string,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // Count attacker's planes
  const planes = attacker.military.units.planes;
  const totalPlanes = planes[0] + planes[1] + planes[2];
  const planePower = planes[0] * 1 + planes[1] * 2 + planes[2] * 4;

  // Check bombs
  const attackerRes = attacker.resources as unknown as Record<string, number>;
  const availableBombs = attackerRes['bombs'] ?? 0;

  if (totalPlanes === 0 || availableBombs === 0) {
    entries.push({
      step: 'war', playerId: attacker.id,
      description: `${attacker.countryName} n'a pas les moyens de bombarder (avions: ${totalPlanes}, bombes: ${availableBombs})`,
      icon: '❌', positive: false,
    });
    return entries;
  }

  // Consume bombs (1 per plane, capped by available)
  const bombsUsed = Math.min(totalPlanes, availableBombs);
  attackerRes['bombs'] = Math.max(0, availableBombs - bombsUsed);

  // Damage scales with plane power × bombs ratio
  const effectiveness = bombsUsed / totalPlanes;
  const baseDamage = BOMBARDMENT_DAMAGE_MIN + (BOMBARDMENT_DAMAGE_MAX - BOMBARDMENT_DAMAGE_MIN) * (planePower / 50);
  let damage = Math.min(BOMBARDMENT_DAMAGE_MAX * 1.5, baseDamage * effectiveness);
  const duration = Math.floor(BOMBARDMENT_DURATION_MIN + Math.random() * (BOMBARDMENT_DURATION_MAX - BOMBARDMENT_DURATION_MIN + 1));

  // Anti-air defense: defender's planes shoot down attacker's planes
  const defPlanes = target.military.units.planes;
  const defPlanePower = defPlanes[0] * 1 + defPlanes[1] * 2 + defPlanes[2] * 4;
  const defInfantry = target.military.units.infantry;
  const defAAPower = defInfantry[0] * 0.05 + defInfantry[1] * 0.1 + defInfantry[2] * 0.2;
  const totalDefense = defPlanePower + defAAPower;

  // Losses: attacker loses planes proportional to defense/attack ratio
  let planesLost = 0;
  if (totalDefense > 0) {
    const lossRatio = Math.min(0.5, totalDefense / (planePower + totalDefense) * 0.6);
    damage *= (1 - lossRatio * 0.7); // defense reduces damage

    // Actually remove planes (highest tier first preserved, lowest tier lost)
    let remaining = Math.round(totalPlanes * lossRatio);
    for (let t = 0; t < 3 && remaining > 0; t++) {
      const lost = Math.min(planes[t], remaining);
      attacker.military.units.planes[t] -= lost;
      remaining -= lost;
      planesLost += lost;
    }

    if (planesLost > 0) {
      entries.push({
        step: 'war', playerId: target.id,
        description: `Les défenses anti-aériennes de ${target.countryName} abattent ${planesLost} avion(s)`,
        icon: '🛡️', positive: true,
      });
    }
  }

  // Apply damage
  target.activeEffects.push({
    id: uuid(),
    type: 'bombardment',
    description: `Bombardement : ${targetDescription}`,
    modifier: -damage,
    remainingTurns: duration,
  });

  entries.push({
    step: 'war', playerId: attacker.id, targetId: target.id,
    description: `${attacker.countryName} bombarde ${target.countryName} avec ${totalPlanes} avion(s) et ${bombsUsed} bombe(s) ! -${(damage * 100).toFixed(0)}% pendant ${duration} tours. Pertes : ${planesLost} avion(s)`,
    icon: '💣', positive: false,
  });

  return entries;
}

// ─── Nuclear Strike ────────────────────────────────────────────

export function executeNuclearStrike(
  attacker: ServerPlayerState,
  target: ServerPlayerState,
  allPlayers: Map<string, ServerPlayerState>,
  currentRound: number,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // Pick a target region
  const targetRegions = target.regions.filter(r => !r.destroyed);
  if (targetRegions.length === 0) return entries;
  const region = targetRegions[Math.floor(Math.random() * targetRegions.length)];

  // Destroy region
  region.destroyed = true;
  region.destroyedUntilRound = currentRound + NUCLEAR_TARGET_REGION_LOCKOUT;
  region.productionCapacity = 0;

  // Population loss in region
  const popLoss = region.population * NUCLEAR_TARGET_POP_LOSS;
  target.population.total -= popLoss / 1_000_000;
  region.population = Math.round(region.population * (1 - NUCLEAR_TARGET_POP_LOSS));

  // Happiness loss for target
  target.population.happinessLevel = Math.max(0, target.population.happinessLevel - NUCLEAR_TARGET_HAPPINESS_LOSS);

  // Attacker penalties
  attacker.influence = Math.max(0, attacker.influence - Math.round(attacker.influence * NUCLEAR_ATTACKER_INFLUENCE_LOSS / 100));
  attacker.population.happinessLevel = Math.max(0, attacker.population.happinessLevel - NUCLEAR_ATTACKER_HAPPINESS_LOSS);
  attacker.military.nuclearBombs--;

  // Expel attacker from all organizations
  attacker.organizationMemberships = [];

  // Global effects
  for (const [, player] of allPlayers) {
    player.pollution = Math.min(100, player.pollution + NUCLEAR_GLOBAL_POLLUTION);
    player.activeEffects.push({
      id: uuid(),
      type: 'nuclear_health',
      description: 'Retombées nucléaires mondiales',
      modifier: -NUCLEAR_GLOBAL_HEALTH_LOSS,
      remainingTurns: 3,
    });
  }

  entries.push({
    step: 'war',
    playerId: attacker.id,
    targetId: target.id,
    description: `☢️ FRAPPE NUCLÉAIRE ! ${attacker.countryName} lance une bombe nucléaire sur ${region.name} (${target.countryName}) ! Région détruite pour ${NUCLEAR_TARGET_REGION_LOCKOUT} tours.`,
    icon: '☢️',
    positive: false,
  });

  entries.push({
    step: 'war',
    description: `Retombées nucléaires mondiales : +${NUCLEAR_GLOBAL_POLLUTION}% pollution, -${NUCLEAR_GLOBAL_HEALTH_LOSS}% santé pour tous pendant 3 tours.`,
    icon: '☢️',
    positive: false,
  });

  return entries;
}
