/**
 * Empire du Commerce — Population, Happiness, Health
 * Growth, migration, revolts, productivity
 *
 * Toutes les formules sont continues (fonctions puissance / tanh).
 * Aucun seuil brutal — chaque métrique varie de façon fluide et proportionnelle.
 */

import type { ServerPlayerState } from './types';
import type { ResolutionEntry } from '@undercover/shared';
import {
  POP_REVOLT_THRESHOLD,
  MILITARY_AUTHORITARIAN_CAP,
  // Smooth formula coefficients
  POP_PRODUCTIVITY_FLOOR,
  POP_PRODUCTIVITY_FULL_AT,
  POP_PRODUCTIVITY_MAX,
  POP_BIRTHRATE_MAX,
  POP_BIRTHRATE_RANGE,
  POP_BIRTHRATE_ID_EXP,
  POP_BIRTHRATE_HAPPY_BASE,
  POP_BIRTHRATE_HAPPY_RANGE,
  POP_MORTALITY_BASE,
  POP_MORTALITY_COEFF,
  POP_MORTALITY_HEALTH_EXP,
  POP_MORTALITY_NEEDS_EXP,
  POP_MIGRATION_COEFF,
  POP_MIGRATION_SCALE,
  POP_CONSUMPTION_ENERGY_A,   POP_CONSUMPTION_ENERGY_B,   POP_CONSUMPTION_ENERGY_EXP,
  POP_CONSUMPTION_LUXURY_A,   POP_CONSUMPTION_LUXURY_B,   POP_CONSUMPTION_LUXURY_EXP,
  POP_CONSUMPTION_HEALTH_A,   POP_CONSUMPTION_HEALTH_B,   POP_CONSUMPTION_HEALTH_EXP,
} from './constants';

// ─── Public entry point ──────────────────────────────────────────

export function updatePopulation(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // First pass: update all individual metrics
  for (const [, player] of players) {
    if (player.abandoned) continue;

    updateHappiness(player);
    updateHealth(player);

    // Development Index depends on happiness + health → must come after their updates
    player.population.developmentIndex = computeDevelopmentIndex(player);
    player.population.needsSatisfaction = computeNeedsSatisfaction(player);
    player.population.consumptionMultiplier = computeConsumptionMultiplier(player.population.developmentIndex);

    updateProductivity(player);

    // Birth/mortality (smooth, no hard thresholds except the war-death bonus)
    const birth    = computeBirthRate(player);
    const mortality = computeMortalityRate(player);
    player.population.birthRate    = birth;
    player.population.mortalityRate = mortality;

    const netGrowth = birth - mortality;
    const oldPop = player.population.total;
    player.population.total     = Math.max(0.1, oldPop * (1 + netGrowth));
    player.population.growthRate = netGrowth;

    if (Math.abs(netGrowth) > 0.002) {
      entries.push({
        step: 'population',
        playerId: player.id,
        description: netGrowth > 0
          ? `${player.countryName} : population +${(netGrowth * 100).toFixed(2)}% (${oldPop.toFixed(1)}M → ${player.population.total.toFixed(1)}M)`
          : `${player.countryName} : population ${(netGrowth * 100).toFixed(2)}% (${oldPop.toFixed(1)}M → ${player.population.total.toFixed(1)}M)`,
        icon: netGrowth > 0 ? '👶' : '📉',
        positive: netGrowth > 0,
      });
    }

    // Revolt events (bonheur < 20 remains a gameplay threshold — c'est une crise, pas une formule)
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

  // Second pass: migration (needs world-average, so all players must be updated first)
  const migrationEntries = resolveMigration(players);
  entries.push(...migrationEntries);

  return entries;
}

// ─── Development Index ───────────────────────────────────────────

/**
 * HDI composite : santé×0.40 + bonheur×0.30 + éducation×0.20 + infra_moy×0.10
 * Plage 0–100, continu.
 */
export function computeDevelopmentIndex(player: ServerPlayerState): number {
  const infraAvg = (
    player.infrastructure.electricity +
    player.infrastructure.telecom +
    player.infrastructure.waterTreatment
  ) / 3;

  const id =
    player.population.healthLevel  * 0.40 +
    player.population.happinessLevel * 0.30 +
    player.research.educationLevel   * 0.20 +
    infraAvg                         * 0.10;

  return clamp01(id / 100) * 100; // stays 0-100
}

// ─── Needs Satisfaction ──────────────────────────────────────────

/**
 * Ratio 0–100 de la satisfaction des besoins vitaux.
 * Composantes : santé (40%) + eau (35%) + environnement (25%).
 * Toutes continues — pas de seuil brutal.
 */
function computeNeedsSatisfaction(player: ServerPlayerState): number {
  const id = player.population.developmentIndex;

  // Healthcare (health level acts as proxy for medical infrastructure quality)
  const healthSat = player.population.healthLevel / 100;

  // Water: need grows with development (richer populations need more treated water)
  const waterNeed = Math.max(5, 10 + id * 0.30); // 10 (pauvre) → 40 (hégémon)
  const waterSat  = Math.min(1.0, player.resources.water / waterNeed);

  // Clean environment (pollution penalises satisfaction continuously)
  const envSat = 1.0 - Math.pow(player.pollution / 100, 0.8);

  const raw = healthSat * 0.40 + waterSat * 0.35 + envSat * 0.25;
  return Math.round(clamp01(raw) * 100);
}

// ─── Consumption Multiplier ──────────────────────────────────────

/**
 * Facteur de demande en énergie, luxe, santé par rapport à la base.
 * consumptionMultiplier = moyenne des trois besoins sectoriels.
 * Exposé dans l'UI pour montrer le niveau d'exigence de la population.
 */
function computeConsumptionMultiplier(id: number): number {
  const t = id / 100;
  const energy = POP_CONSUMPTION_ENERGY_A + POP_CONSUMPTION_ENERGY_B * Math.pow(t, POP_CONSUMPTION_ENERGY_EXP);
  const food   = 0.30 + 1.20 * Math.pow(t, 0.70);
  const health = POP_CONSUMPTION_HEALTH_A + POP_CONSUMPTION_HEALTH_B * Math.pow(t, POP_CONSUMPTION_HEALTH_EXP);
  return Math.round(((energy + food + health) / 3) * 100) / 100;
}

/**
 * Multiplicateurs individuels par secteur (pour affichage dans le StatsPanel).
 */
export function computeSectorConsumption(id: number): {
  energy: number; food: number; health: number;
} {
  const t = id / 100;
  return {
    energy: Math.round((POP_CONSUMPTION_ENERGY_A + POP_CONSUMPTION_ENERGY_B * Math.pow(t, POP_CONSUMPTION_ENERGY_EXP)) * 100) / 100,
    food:   Math.round((0.30 + 1.20 * Math.pow(t, 0.70)) * 100) / 100,
    health: Math.round((POP_CONSUMPTION_HEALTH_A + POP_CONSUMPTION_HEALTH_B * Math.pow(t, POP_CONSUMPTION_HEALTH_EXP)) * 100) / 100,
  };
}

// ─── Happiness ───────────────────────────────────────────────────
// 3 catégories de besoins dont la demande scale avec population × niveau de vie :
//   - Primaires : faible bonus si satisfaits (+5), gros malus si absents (-20)
//   - Confort   : bonus/malus modérés (+8 / -10)
//   - Luxe      : gros bonus si satisfaits (+12), faible malus si absents (-3)

interface NeedDef {
  resource: string;
  baseDemandPerMillion: number;  // demande de base par million de pop
  devScaling: number;            // multiplicateur à devIndex=100 (1.0 = pas de scaling)
  satisfiedBonus: number;        // bonus bonheur à satisfaction=100%
  unsatisfiedPenalty: number;    // malus bonheur à satisfaction=0%
  consumeRate: number;           // fraction consommée par tour
}

const PRIMARY_NEEDS: NeedDef[] = [
  { resource: 'processedFood',   baseDemandPerMillion: 1.0,  devScaling: 1.2,  satisfiedBonus: 5,  unsatisfiedPenalty: 20, consumeRate: 0.20 },
  { resource: 'cereals',         baseDemandPerMillion: 2.0,  devScaling: 0.8,  satisfiedBonus: 3,  unsatisfiedPenalty: 15, consumeRate: 0.20 },
];

const COMFORT_NEEDS: NeedDef[] = [
  { resource: 'phones',          baseDemandPerMillion: 0.5,  devScaling: 1.8,  satisfiedBonus: 8,  unsatisfiedPenalty: 8,  consumeRate: 0.12 },
  { resource: 'fuel',            baseDemandPerMillion: 1.5,  devScaling: 1.5,  satisfiedBonus: 6,  unsatisfiedPenalty: 8,  consumeRate: 0.15 },
];

const LUXURY_NEEDS: NeedDef[] = [
  { resource: 'computers',       baseDemandPerMillion: 0.3,  devScaling: 2.5,  satisfiedBonus: 10, unsatisfiedPenalty: 2,  consumeRate: 0.10 },
  { resource: 'pharmaceuticals', baseDemandPerMillion: 0.4,  devScaling: 2.0,  satisfiedBonus: 8,  unsatisfiedPenalty: 3,  consumeRate: 0.10 },
  { resource: 'redMeat',         baseDemandPerMillion: 0.3,  devScaling: 2.0,  satisfiedBonus: 6,  unsatisfiedPenalty: 1,  consumeRate: 0.10 },
];

function computeNeedHappiness(
  needs: NeedDef[],
  res: Record<string, number>,
  pop: number,
  devIndex: number,
): number {
  let happiness = 0;
  const devFactor = devIndex / 100; // 0-1

  for (const need of needs) {
    const demand = pop * need.baseDemandPerMillion * (1 + (need.devScaling - 1) * devFactor);
    if (demand <= 0) continue;

    const available = res[need.resource] ?? 0;
    const satisfaction = Math.min(1, available / demand);

    // Bonus/malus : interpolation entre -penalty (sat=0) et +bonus (sat=1)
    // Point neutre à ~60% satisfaction (pas de bonus, pas de malus)
    const neutralPoint = 0.6;
    if (satisfaction >= neutralPoint) {
      const t = (satisfaction - neutralPoint) / (1 - neutralPoint);
      happiness += need.satisfiedBonus * t;
    } else {
      const t = 1 - satisfaction / neutralPoint;
      happiness -= need.unsatisfiedPenalty * t;
    }

    // Consommer les ressources
    const consumed = demand * need.consumeRate;
    res[need.resource] = Math.max(0, available - consumed);
  }

  return happiness;
}

function updateHappiness(player: ServerPlayerState): void {
  let happiness = 40; // base

  const res = player.resources as unknown as Record<string, number>;
  const pop = Math.max(0.5, player.population.total); // millions
  const devIndex = player.population.developmentIndex ?? 50;

  // Infrastructure
  happiness += Math.min(8, player.infrastructure.electricity / 13);
  happiness += Math.min(6, player.infrastructure.waterTreatment / 17);
  happiness += Math.min(5, player.population.healthLevel / 20);

  // Besoins par catégorie (scale avec pop × niveau de vie)
  happiness += computeNeedHappiness(PRIMARY_NEEDS, res, pop, devIndex);
  happiness += computeNeedHappiness(COMFORT_NEEDS, res, pop, devIndex);
  happiness += computeNeedHappiness(LUXURY_NEEDS,  res, pop, devIndex);

  // Tourisme
  happiness += Math.min(8, player.tourism.attractiveness / 12);

  // Negative factors
  happiness -= Math.min(20, player.pollution / 5);
  happiness -= player.activeEffects.filter(e => e.type === 'war_attacker').length * 15;
  happiness -= player.activeEffects.filter(e => e.type === 'war_defender').length * 10;

  // Sanctions impact
  happiness -= player.activeSanctions.length * 5;

  // Authoritarian compensation
  const authStrength = Math.max(0, (player.military.armedForces - 40) / 60);
  if (authStrength > 0) {
    const compensationNeeded = Math.max(0, 50 - happiness);
    const maxCompensation = Math.abs(MILITARY_AUTHORITARIAN_CAP);
    const compensation = Math.min(compensationNeeded, maxCompensation * authStrength);
    happiness += compensation * 0.5;
  }

  // Temporary effects
  for (const effect of player.activeEffects) {
    if (effect.type.includes('happiness')) {
      happiness += effect.modifier;
    }
  }

  player.population.happinessLevel = Math.round(clamp(happiness, 0, 100));
}

// ─── Health ──────────────────────────────────────────────────────

function updateHealth(player: ServerPlayerState): void {
  let health = 50; // base

  // Positive
  health += Math.min(20, player.infrastructure.waterTreatment / 5);
  health += Math.min(15, player.research.branches.biotech / 7);

  // Negative — pollution continuous penalty
  health -= Math.min(25, player.pollution / 4);

  // Water scarcity: smooth penalty proportional to deficit (no hard threshold)
  // At water=20: -0 penalty. At water=10: -7.5. At water=0: -15.
  const waterTarget = 20;
  if (player.resources.water < waterTarget) {
    const deficit = (waterTarget - player.resources.water) / waterTarget; // 0→1
    health -= 15 * Math.pow(deficit, 0.8); // concave: penalise dès le début du déficit
  }

  // Temporary effects
  for (const effect of player.activeEffects) {
    if (effect.type.includes('health')) {
      health += effect.modifier;
    }
  }

  player.population.healthLevel = Math.round(clamp(health, 0, 100));
}

// ─── Productivity ────────────────────────────────────────────────

/**
 * Bonheur ≥ 70% → productivité = 100%
 * Bonheur < 70% → baisse linéaire jusqu'au plancher (50%)
 * Jamais bloquant : même à 0% bonheur, les usines tournent à 50%.
 */
function updateProductivity(player: ServerPlayerState): void {
  const happiness = player.population.happinessLevel;
  let productivity: number;

  if (happiness >= POP_PRODUCTIVITY_FULL_AT) {
    productivity = POP_PRODUCTIVITY_MAX;
  } else {
    // Linéaire : de FLOOR (bonheur=0) à MAX (bonheur=FULL_AT)
    const ratio = happiness / POP_PRODUCTIVITY_FULL_AT;
    productivity = POP_PRODUCTIVITY_FLOOR + (POP_PRODUCTIVITY_MAX - POP_PRODUCTIVITY_FLOOR) * ratio;
  }

  // Education bonus
  productivity += player.research.educationLevel / 200;

  // War penalties
  for (const effect of player.activeEffects) {
    if (effect.type === 'war_mobilization' || effect.type === 'war_reconstruction') {
      productivity *= (1 + effect.modifier);
    }
  }

  player.population.productivityMultiplier = clamp(productivity, POP_PRODUCTIVITY_FLOOR, 2.0);
}

// ─── Birth Rate ──────────────────────────────────────────────────

/**
 * natalité(ID, B) = [MAX − RANGE × (ID/100)^ID_EXP] × [HAPPY_BASE + HAPPY_RANGE × (B/100)]
 * Pauvre (ID=35, B=50) ≈ 1.88% | Riche (ID=90, B=80) ≈ 1.10%
 */
function computeBirthRate(player: ServerPlayerState): number {
  const id = player.population.developmentIndex / 100;
  const b  = player.population.happinessLevel  / 100;

  const baseNatality = POP_BIRTHRATE_MAX - POP_BIRTHRATE_RANGE * Math.pow(id, POP_BIRTHRATE_ID_EXP);
  const happinessMod = POP_BIRTHRATE_HAPPY_BASE + POP_BIRTHRATE_HAPPY_RANGE * b;

  return Math.max(0, (baseNatality * happinessMod) / 100); // convert % to decimal
}

// ─── Mortality Rate ──────────────────────────────────────────────

/**
 * mortalité(H, N) = BASE + COEFF × (1−H/100)^H_EXP × (1−N/100)^N_EXP
 * Parfait (H=100, N=100) : 0.1% | Crise (H=20, N=20) : ~1.6%
 */
function computeMortalityRate(player: ServerPlayerState): number {
  const h = player.population.healthLevel    / 100;
  const n = player.population.needsSatisfaction / 100;

  let mortality =
    POP_MORTALITY_BASE +
    POP_MORTALITY_COEFF *
    Math.pow(1 - h, POP_MORTALITY_HEALTH_EXP) *
    Math.pow(1 - n, POP_MORTALITY_NEEDS_EXP);

  // War bonus mortality (+0.8%/tour — kept as a discrete event modifier)
  const atWar = player.activeEffects.some(e => e.type === 'war_attacker' || e.type === 'war_defender');
  if (atWar) mortality += 0.008;

  return Math.max(POP_MORTALITY_BASE, mortality);
}

// ─── Revolts ─────────────────────────────────────────────────────

function resolveRevolts(player: ServerPlayerState): number {
  // Damage proportional to how far below the threshold
  const severity = Math.max(0, POP_REVOLT_THRESHOLD - player.population.happinessLevel) / POP_REVOLT_THRESHOLD;

  if (player.factories.length > 0) {
    const idx = Math.floor(Math.random() * player.factories.length);
    player.factories[idx].health = Math.max(0, player.factories[idx].health - Math.round(20 + severity * 20));
  }

  player.infrastructure.electricity = Math.max(0, player.infrastructure.electricity - Math.round(5 + severity * 10));
  player.infrastructure.telecom     = Math.max(0, player.infrastructure.telecom     - Math.round(3 + severity * 5));

  const loss = player.population.total * (0.005 + severity * 0.01);
  player.population.total -= loss;
  return loss;
}

// ─── Migration ───────────────────────────────────────────────────

/**
 * Attractivité = (bonheur + 0.8 × ID) / 1.8     (plage 0–100)
 * taux_migration = COEFF × tanh(delta / SCALE)   (continu, aucun seuil)
 * Plage : −0.6% à +0.6% de la population par tour.
 */
function resolveMigration(players: Map<string, ServerPlayerState>): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];
  const playerList = Array.from(players.values()).filter(p => !p.abandoned);
  if (playerList.length < 2) return entries;

  // Compute attractiveness for each player
  const attractiveness = new Map<string, number>();
  let totalAttr = 0;
  for (const p of playerList) {
    const attr = (p.population.happinessLevel + 0.8 * p.population.developmentIndex) / 1.8;
    attractiveness.set(p.id, attr);
    totalAttr += attr;
  }
  const worldAvg = totalAttr / playerList.length;

  for (const p of playerList) {
    const attr  = attractiveness.get(p.id)!;
    const delta = attr - worldAvg;
    const rate  = POP_MIGRATION_COEFF * Math.tanh(delta / POP_MIGRATION_SCALE);
    if (Math.abs(rate) < 0.0001) continue;

    const migrants = p.population.total * Math.abs(rate);
    if (migrants < 0.005) continue;

    if (rate > 0) {
      // Immigration: pick a random country below average to draw from
      const sources = playerList.filter(s => s.id !== p.id && (attractiveness.get(s.id)! < worldAvg));
      if (sources.length === 0) continue;
      const source = sources[Math.floor(Math.random() * sources.length)];
      source.population.total = Math.max(0.1, source.population.total - migrants);
      p.population.total += migrants;
      entries.push({
        step: 'population',
        description: `Migration : ${(migrants * 1000).toFixed(0)}k habitants quittent ${source.countryName} pour ${p.countryName} (attractivité +${delta.toFixed(1)})`,
        icon: '✈️',
        positive: false,
        playerId: source.id,
        targetId: p.id,
      });
    }
    // Emigration: symmetric — handled from the receiving side above
  }

  return entries;
}

// ─── Pollution ───────────────────────────────────────────────────

export function updatePollution(player: ServerPlayerState): void {
  let pollution = 0;

  for (const factory of player.factories) {
    if (factory.paused) continue;
    pollution += factory.pollutionRate * (factory.health / 100);
  }

  // Clean energy research reduces pollution
  pollution *= Math.max(0.3, 1 - player.research.branches.cleanEnergy / 150);

  // Water treatment helps
  pollution *= Math.max(0.5, 1 - player.infrastructure.waterTreatment / 200);

  player.pollution = Math.round(clamp(pollution, 0, 100));
}

// ─── Helpers ─────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
