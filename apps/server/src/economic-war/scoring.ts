/**
 * Empire du Commerce — Scoring & Leaderboard
 * Score = 50% GDP + 30% (Happiness × Population) + 20% Influence
 */

import type { LeaderboardEntry, WealthTier } from '@undercover/shared';
import { SCORE_WEIGHT_GDP, SCORE_WEIGHT_HAPPINESS_POP, SCORE_WEIGHT_INFLUENCE } from './constants';
import type { ServerPlayerState } from './types';

export function calculateScore(player: ServerPlayerState): number {
  const gdpComponent = player.gdp * SCORE_WEIGHT_GDP;
  const hapPopComponent = (player.population.happinessLevel / 100) * player.population.total * 100 * SCORE_WEIGHT_HAPPINESS_POP;
  const influenceComponent = player.influence * SCORE_WEIGHT_INFLUENCE;
  return Math.round(gdpComponent + hapPopComponent + influenceComponent);
}

export function calculateGDP(player: ServerPlayerState): number {
  let gdp = 0;

  // Factory production
  for (const factory of player.factories) {
    const healthMult = factory.health / 100;
    const tierMult = getTierMultiplier(factory.tier);
    const toolMult = getToolMultiplier(player.tools.tier);
    const infraMult = getInfraMultiplier(player.infrastructure);
    const productivityMult = player.population.productivityMultiplier;
    const baseIncome = getFactoryBaseIncome(factory.sector);

    gdp += baseIncome * healthMult * tierMult * toolMult * infraMult * productivityMult;
  }

  // Patent royalties
  for (const patent of player.patents) {
    gdp += patent.incomePerTurn;
  }

  // Tourism income (capped)
  gdp += player.tourism.income;

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

  return Math.round(influence);
}

export function getWealthTier(score: number): WealthTier {
  if (score >= 50000) return 'hegemon';
  if (score >= 30000) return 'superpower';
  if (score >= 15000) return 'developed';
  if (score >= 5000) return 'emerging';
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
      happinessPopulation: Math.round(
        (player.population.happinessLevel / 100) * player.population.total * 100,
      ),
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

function getFactoryBaseIncome(sector: string): number {
  const incomes: Record<string, number> = {
    rawMaterials: 80,
    energy: 120,
    manufacturing: 100,
    electronics: 180,
    pharmaceutical: 160,
    armament: 200,
    luxury: 140,
    food: 70,
  };
  return incomes[sector] || 100;
}
