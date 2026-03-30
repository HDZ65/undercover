/**
 * Empire du Commerce — Scoring & Leaderboard
 * Score = 45% PIB + 30% (Force militaire × 10) + 25% (Bonheur × 20)
 * Suppression de la composante population×bonheur qui créait un déséquilibre ×30 entre pays.
 */

import type { LeaderboardEntry, WealthTier } from '@undercover/shared';
import {
  SCORE_WEIGHT_GDP,
  SCORE_WEIGHT_MILITARY,
  SCORE_WEIGHT_HAPPINESS,
  SCORE_MILITARY_SCALE,
  SCORE_HAPPINESS_SCALE,
  FACTORY_BASE_INCOME,
} from './constants';
import type { ServerPlayerState } from './types';
import { calculateEffectiveForce } from './military.js';

export function calculateScore(player: ServerPlayerState): number {
  const gdpComponent      = player.gdp * SCORE_WEIGHT_GDP;
  const militaryComponent = calculateEffectiveForce(player) * SCORE_MILITARY_SCALE * SCORE_WEIGHT_MILITARY;
  const happinessComponent = player.population.happinessLevel * SCORE_HAPPINESS_SCALE * SCORE_WEIGHT_HAPPINESS;
  return Math.round(gdpComponent + militaryComponent + happinessComponent);
}

export function calculateGDP(player: ServerPlayerState): number {
  let gdp = 0;

  // Factory production (uses centralized FACTORY_BASE_INCOME)
  for (const factory of player.factories) {
    const healthMult = factory.health / 100;
    const tierMult = getTierMultiplier(factory.tier);
    const toolMult = getToolMultiplier(player.tools.tier);
    const infraMult = getInfraMultiplier(player.infrastructure);
    const productivityMult = player.population.productivityMultiplier;
    const baseIncome = FACTORY_BASE_INCOME[factory.sector] ?? 0;

    gdp += baseIncome * healthMult * tierMult * toolMult * infraMult * productivityMult;
  }

  // All factories contribute to GDP via their count × tier (even sectors with 0 base income)
  // This reflects industrial capacity: a player with 5 military factories is still a major economy
  for (const factory of player.factories) {
    const tierMult = getTierMultiplier(factory.tier);
    const healthMult = factory.health / 100;
    gdp += 20 * tierMult * healthMult; // base industrial contribution per factory
  }

  // Manufactured goods stock contributes to GDP (wealth from production)
  const res = player.resources as unknown as Record<string, number>;
  const valuableGoods: Record<string, number> = {
    steel: 3, fuel: 2, electronicComponents: 8, pharmaceuticals: 6,
    processedFood: 2, fertilizer: 2, phones: 12, computers: 18,
    munitions: 1, obus: 3, bombs: 5,
  };
  for (const [good, value] of Object.entries(valuableGoods)) {
    gdp += (res[good] ?? 0) * value * 0.1; // 10% of stock value per turn
  }

  // Patent royalties
  for (const patent of player.patents) {
    gdp += patent.incomePerTurn;
  }

  // Tourism income (capped)
  gdp += player.tourism.income;

  // Population contributes to GDP (larger economies produce more)
  gdp += player.population.total * 15 * player.population.productivityMultiplier;

  return Math.round(gdp);
}

export function calculateInfluence(player: ServerPlayerState, organizationCount: number): number {
  let influence = 0;

  // Organization memberships
  influence += organizationCount * 100;

  // Patents
  influence += player.patents.length * 30;

  // Tourism attractiveness
  influence += player.tourism.attractiveness * 2;

  // Military reputation (if strong but not aggressive)
  if (player.military.armedForces > 50) {
    influence += (player.military.armedForces - 50) * 3;
  }

  // Happiness bonus (happy countries are admired)
  if (player.population.happinessLevel > 60) {
    influence += (player.population.happinessLevel - 60) * 2;
  }

  // GDD §9: accumulated influence penalty from tourism bans imposed (-5% per ban)
  influence -= player.accumulatedBanPenalty || 0;

  return Math.max(0, Math.round(influence));
}

export function getWealthTier(score: number): WealthTier {
  // Seuils recalibrés pour la nouvelle formule (mi-partie ~2000-4000, fin ~6000-12000)
  if (score >= 15000) return 'hegemon';
  if (score >= 8000)  return 'superpower';
  if (score >= 4000)  return 'developed';
  if (score >= 1500)  return 'emerging';
  return 'startup';
}

export function buildLeaderboard(
  players: Map<string, ServerPlayerState>,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (const [playerId, player] of players) {
    entries.push({
      playerId,
      playerName: player.name,
      countryName: player.countryName,
      countryFlag: player.countryFlag,
      score: player.score,
      gdp: player.gdp,
      happinessPopulation: player.population.happinessLevel, // bonheur brut pour l'affichage
      influence: player.influence,
      wealthTier: getWealthTier(player.score),
      rank: 0, // set below
      abandoned: player.abandoned,
    });
  }

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);

  // Assign ranks
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return entries;
}

// ─── Helpers ───────────────────────────────────────────────────

function getTierMultiplier(tier: string): number {
  switch (tier) {
    case 'robotized': return 3.0;
    case 'advanced': return 1.8;
    default: return 1.0;
  }
}

function getToolMultiplier(tier: string): number {
  switch (tier) {
    case 'robotized': return 2.0;
    case 'advanced': return 1.5;
    default: return 1.2;
  }
}

function getInfraMultiplier(infra: { electricity: number; telecom: number; waterTreatment: number }): number {
  // Average of infrastructure levels as a multiplier (50% = 1.0, 100% = 1.5)
  const avg = (infra.electricity + infra.telecom + infra.waterTreatment) / 3;
  return 0.5 + (avg / 100);
}

// getFactoryBaseIncome removed — uses FACTORY_BASE_INCOME constant directly
