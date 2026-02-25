/**
 * Empire du Commerce — Military, War, Bombardment, Nuclear
 * Handles armed forces, weapon tiers, war progression, bombardment threats
 */

import type { War, Weapon, WeaponTier, WeaponLicense, ResolutionEntry } from '@undercover/shared';
import type { ServerPlayerState, TemporaryEffect, EcoWarGameContext } from './types';
import {
  WEAPON_TIERS,
  WEAPON_PROPRIETARY_MAINTENANCE_RATE,
  WEAPON_DEGRADATION_PER_TURN,
  MILITARY_DEFENDER_BONUS,
  MILITARY_RESEARCH_BONUS_PER_5,
  WAR_MOBILIZATION_PROD_LOSS,
  WAR_ARMISTICE_MIN_TURNS,
  WAR_RESISTANCE_DURATION,
  WAR_RESISTANCE_PENALTY,
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

export function degradeUnmaintainedWeapons(player: ServerPlayerState): void {
  for (const weapon of player.military.weapons) {
    if (weapon.license === 'proprietary' && weapon.sellerId) {
      // Check if seller relationship is active (not at war, not sanctioned)
      // For now, degrade if seller relationship is broken
      // This will be checked by the resolution orchestrator
    }
  }
}

export function applyWeaponDegradation(weapon: Weapon): void {
  weapon.efficacy = Math.max(0, weapon.efficacy - WEAPON_DEGRADATION_PER_TURN * 100);
}

// ─── War Resolution ────────────────────────────────────────────

export function resolveWars(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const war of context.activeWars) {
    if (war.status !== 'active') continue;

    war.duration++;

    const attacker = context.players.get(war.attackerId);
    const defender = context.players.get(war.defenderId);
    if (!attacker || !defender) continue;

    const attackerForce = calculateEffectiveForce(attacker);
    const defenderForce = calculateEffectiveForce(defender) * (1 + MILITARY_DEFENDER_BONUS);

    // Determine progress this turn
    const forceRatio = attackerForce / Math.max(1, defenderForce);

    if (forceRatio > 1.3) {
      // Attacker winning — try to conquer a region
      const unconquered = defender.regions.filter(
        r => !r.occupiedBy && !r.destroyed,
      );
      if (unconquered.length > 0) {
        const region = unconquered[Math.floor(Math.random() * unconquered.length)];
        region.occupiedBy = attacker.id;
        region.resistanceRemaining = WAR_RESISTANCE_DURATION;
        war.regionsConquered.push(region.id);

        entries.push({
          step: 'war',
          playerId: war.attackerId,
          targetId: war.defenderId,
          description: `${attacker.countryName} conquiert la région ${region.name} de ${defender.countryName} !`,
          icon: '⚔️',
          positive: false,
        });
      }

      // Check if all regions conquered → attacker wins
      const allConquered = defender.regions.every(r => r.occupiedBy || r.destroyed);
      if (allConquered) {
        war.status = 'victory_attacker';
        applyWarEnd(attacker, defender, war, entries);
      }
    } else if (forceRatio < 0.7) {
      // Defender pushing back — recapture a region
      if (war.regionsConquered.length > 0) {
        const regionId = war.regionsConquered.pop()!;
        const region = defender.regions.find(r => r.id === regionId);
        if (region) {
          region.occupiedBy = null;
          entries.push({
            step: 'war',
            playerId: war.defenderId,
            targetId: war.attackerId,
            description: `${defender.countryName} reprend la région ${region.name} !`,
            icon: '🛡️',
            positive: true,
          });
        }
      }
    }

    // Both sides suffer happiness loss
    attacker.population.happinessLevel = Math.max(0, attacker.population.happinessLevel - 3);
    defender.population.happinessLevel = Math.max(0, defender.population.happinessLevel - 2);

    // Military attrition
    attacker.military.armedForces = Math.max(0, attacker.military.armedForces - 1);
    defender.military.armedForces = Math.max(0, defender.military.armedForces - 1);

    entries.push({
      step: 'war',
      playerId: war.attackerId,
      targetId: war.defenderId,
      description: `Guerre ${attacker.countryName} vs ${defender.countryName} — Tour ${war.duration}. Ratio de force : ${forceRatio.toFixed(2)}`,
      icon: '⚔️',
      positive: false,
    });

    // Check armistice eligibility
    if (war.duration >= WAR_ARMISTICE_MIN_TURNS && war.armisticeProposedBy) {
      entries.push({
        step: 'war',
        description: `Proposition d'armistice en cours entre ${attacker.countryName} et ${defender.countryName}`,
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
  };

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
  return war;
}

// ─── Bombardment ───────────────────────────────────────────────

export function executeBombardment(
  attacker: ServerPlayerState,
  target: ServerPlayerState,
  targetDescription: string,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // Calculate damage
  let damage = BOMBARDMENT_DAMAGE_MIN + Math.random() * (BOMBARDMENT_DAMAGE_MAX - BOMBARDMENT_DAMAGE_MIN);
  const duration = Math.floor(BOMBARDMENT_DURATION_MIN + Math.random() * (BOMBARDMENT_DURATION_MAX - BOMBARDMENT_DURATION_MIN + 1));

  // Interception
  if (target.military.armedForces > BOMBARDMENT_INTERCEPT_THRESHOLD) {
    const interceptRate = BOMBARDMENT_INTERCEPT_MIN +
      ((target.military.armedForces - BOMBARDMENT_INTERCEPT_THRESHOLD) / 50) *
      (BOMBARDMENT_INTERCEPT_MAX - BOMBARDMENT_INTERCEPT_MIN);
    damage *= (1 - Math.min(BOMBARDMENT_INTERCEPT_MAX, interceptRate));

    entries.push({
      step: 'war',
      playerId: target.id,
      description: `Les défenses de ${target.countryName} interceptent partiellement le bombardement (-${(interceptRate * 100).toFixed(0)}% dégâts)`,
      icon: '🛡️',
      positive: true,
    });
  }

  // Apply damage
  target.activeEffects.push({
    id: uuid(),
    type: 'bombardment',
    description: `Bombardement : ${targetDescription}`,
    modifier: -damage,
    remainingTurns: duration,
  });

  // Consume bombs
  attacker.military.bombs = Math.max(0, attacker.military.bombs - 1);

  entries.push({
    step: 'war',
    playerId: attacker.id,
    targetId: target.id,
    description: `${attacker.countryName} bombarde ${target.countryName} ! ${targetDescription} endommagé(e) (-${(damage * 100).toFixed(0)}%, ${duration} tours)`,
    icon: '💣',
    positive: false,
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
