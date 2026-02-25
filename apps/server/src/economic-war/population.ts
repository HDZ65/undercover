/**
 * Empire du Commerce — Population, Happiness, Health
 * Growth, migration, revolts, productivity
 */

import type { ServerPlayerState } from './types';
import type { ResolutionEntry } from '@undercover/shared';
import {
  POP_BASE_GROWTH_MIN,
  POP_BASE_GROWTH_MAX,
  POP_REVOLT_THRESHOLD,
  POP_MIGRATION_THRESHOLD,
  MILITARY_AUTHORITARIAN_CAP,
} from './constants';

export function updatePopulation(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    // Update happiness
    updateHappiness(player);

    // Update health
    updateHealth(player);

    // Update productivity
    updateProductivity(player);

    // Population growth
    const growth = calculateGrowth(player);
    const oldPop = player.population.total;
    player.population.total = Math.max(0.1, player.population.total * (1 + growth));
    player.population.growthRate = growth;

    if (Math.abs(growth) > 0.01) {
      entries.push({
        step: 'population',
        playerId: player.id,
        description: growth > 0
          ? `${player.countryName} : population +${(growth * 100).toFixed(1)}% (${oldPop.toFixed(1)}M → ${player.population.total.toFixed(1)}M)`
          : `${player.countryName} : population ${(growth * 100).toFixed(1)}% (${oldPop.toFixed(1)}M → ${player.population.total.toFixed(1)}M)`,
        icon: growth > 0 ? '👶' : '📉',
        positive: growth > 0,
      });
    }

    // Revolts if happiness < 20
    if (player.population.happinessLevel < POP_REVOLT_THRESHOLD) {
      const damage = resolveRevolts(player);
      entries.push({
        step: 'population',
        playerId: player.id,
        description: `RÉVOLTES en ${player.countryName} ! Bonheur critique (${player.population.happinessLevel}%). Infrastructures endommagées.`,
        icon: '🔥',
        positive: false,
        details: { damage },
      });
    }
  }

  // Migration between countries
  const migrationEntries = resolveMigration(players);
  entries.push(...migrationEntries);

  return entries;
}

function updateHappiness(player: ServerPlayerState): void {
  let happiness = 50; // base

  // Positive factors
  happiness += Math.min(20, player.population.healthLevel / 5);
  happiness += Math.min(15, player.tourism.attractiveness / 7);
  happiness += Math.min(10, player.infrastructure.electricity / 10);
  happiness += Math.min(10, player.infrastructure.waterTreatment / 10);

  // Negative factors
  happiness -= Math.min(20, player.pollution / 5);
  happiness -= player.activeEffects.filter(e => e.type === 'war_attacker').length * 15;
  happiness -= player.activeEffects.filter(e => e.type === 'war_defender').length * 10;

  // Sanctions impact
  happiness -= player.activeSanctions.length * 5;

  // Authoritarian compensation: military > 50 can compensate low happiness
  if (player.military.armedForces >= 60) {
    const compensationNeeded = Math.max(0, 50 - happiness);
    const maxCompensation = Math.abs(MILITARY_AUTHORITARIAN_CAP);
    const compensation = Math.min(compensationNeeded, maxCompensation);
    happiness += compensation * 0.5; // partial compensation
  }

  // Apply temporary effects
  for (const effect of player.activeEffects) {
    if (effect.type.includes('happiness')) {
      happiness += effect.modifier;
    }
  }

  player.population.happinessLevel = Math.max(0, Math.min(100, Math.round(happiness)));
}

function updateHealth(player: ServerPlayerState): void {
  let health = 50; // base

  // Positive
  health += Math.min(20, player.infrastructure.waterTreatment / 5);
  health += Math.min(15, player.research.branches.biotech / 7);

  // Negative
  health -= Math.min(25, player.pollution / 4);

  // Water scarcity
  if (player.resources.water < 20) {
    health -= 15;
  }

  // Apply temporary effects (e.g., nuclear fallout, pandemic)
  for (const effect of player.activeEffects) {
    if (effect.type.includes('health')) {
      health += effect.modifier;
    }
  }

  player.population.healthLevel = Math.max(0, Math.min(100, Math.round(health)));
}

function updateProductivity(player: ServerPlayerState): void {
  const happiness = player.population.happinessLevel;
  const education = player.research.educationLevel;
  const health = player.population.healthLevel;

  // Base productivity from happiness, education, health
  let productivity = 0.5 + (happiness / 200) + (education / 200) + (health / 400);

  // War penalties
  for (const effect of player.activeEffects) {
    if (effect.type === 'war_mobilization') {
      productivity *= (1 + effect.modifier); // modifier is negative, e.g., -0.30
    }
    if (effect.type === 'war_reconstruction') {
      productivity *= (1 + effect.modifier);
    }
  }

  player.population.productivityMultiplier = Math.max(0.1, Math.min(2.0, productivity));
}

function calculateGrowth(player: ServerPlayerState): number {
  const happiness = player.population.happinessLevel;
  const health = player.population.healthLevel;

  // Base growth scaled by happiness and health
  const factor = (happiness + health) / 200; // 0-1
  const growth = POP_BASE_GROWTH_MIN + (POP_BASE_GROWTH_MAX - POP_BASE_GROWTH_MIN) * factor;

  // War causes population loss
  const atWar = player.activeEffects.some(e => e.type === 'war_attacker' || e.type === 'war_defender');
  if (atWar) {
    return growth - 0.02; // -2% during war
  }

  return growth;
}

function resolveRevolts(player: ServerPlayerState): number {
  // Destroy a random factory
  if (player.factories.length > 0) {
    const idx = Math.floor(Math.random() * player.factories.length);
    player.factories[idx].health = Math.max(0, player.factories[idx].health - 30);
  }

  // Damage infrastructure
  player.infrastructure.electricity = Math.max(0, player.infrastructure.electricity - 10);
  player.infrastructure.telecom = Math.max(0, player.infrastructure.telecom - 5);

  // Population loss
  const loss = player.population.total * 0.01;
  player.population.total -= loss;

  return loss;
}

function resolveMigration(players: Map<string, ServerPlayerState>): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];
  const playerList = Array.from(players.values()).filter(p => !p.abandoned);

  // Find countries with high happiness (attract migrants)
  const attractors = playerList.filter(p => p.population.happinessLevel > POP_MIGRATION_THRESHOLD);
  // Find countries with low happiness (lose migrants)
  const repellors = playerList.filter(p => p.population.happinessLevel < 30);

  for (const repellor of repellors) {
    if (attractors.length === 0) break;

    const migrationRate = 0.005; // 0.5% of population
    const migrants = repellor.population.total * migrationRate;

    if (migrants < 0.01) continue;

    // Pick random attractor
    const attractor = attractors[Math.floor(Math.random() * attractors.length)];

    repellor.population.total -= migrants;
    attractor.population.total += migrants;

    entries.push({
      step: 'population',
      description: `Migration : ${(migrants * 1000).toFixed(0)}k habitants quittent ${repellor.countryName} pour ${attractor.countryName}`,
      icon: '✈️',
      positive: false,
      playerId: repellor.id,
      targetId: attractor.id,
    });
  }

  return entries;
}

// ─── Pollution ─────────────────────────────────────────────────

export function updatePollution(player: ServerPlayerState): void {
  let pollution = 0;

  // Factory pollution
  for (const factory of player.factories) {
    pollution += factory.pollutionRate * (factory.health / 100);
  }

  // Clean energy research reduces pollution
  pollution *= Math.max(0.3, 1 - player.research.branches.cleanEnergy / 150);

  // Water treatment helps
  pollution *= Math.max(0.5, 1 - player.infrastructure.waterTreatment / 200);

  player.pollution = Math.max(0, Math.min(100, Math.round(pollution)));
}
