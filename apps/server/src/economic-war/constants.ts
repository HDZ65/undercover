/**
 * Empire du Commerce — Game Constants
 * All balance-critical numbers from the GDD in one place
 */

// ─── General ───────────────────────────────────────────────────

export const DISCONNECT_GRACE_MS = 90_000;       // 90s reconnection window
export const EMPTY_ROOM_CLEANUP_MS = 600_000;    // 10min empty room cleanup
export const PHASE_AUTO_ADVANCE_MS = 5_000;      // 5s between phases
export const RESOLUTION_STEP_DELAY_MS = 2_500;   // 2.5s per resolution step
export const MIN_ACTIVE_PLAYERS = 2;              // game ends when <= 1 active (supports 2-player games)

// ─── Score Weights ─────────────────────────────────────────────
// Economic war: PIB (45%) > Militaire (30%) > Bonheur (25%)
// Suppression de la composante population pour éviter le déséquilibre ×30

export const SCORE_WEIGHT_GDP = 0.45;
export const SCORE_WEIGHT_MILITARY = 0.30;
export const SCORE_WEIGHT_HAPPINESS = 0.25;
// Facteurs d'échelle : amènent force_effective et bonheur à la même magnitude que le PIB
export const SCORE_MILITARY_SCALE = 10;   // force_effective × 10 ≈ magnitude PIB
export const SCORE_HAPPINESS_SCALE = 20;  // bonheur (0-100) × 20 ≈ magnitude PIB

// ─── Population ────────────────────────────────────────────────

export const POP_BASE_GROWTH_MIN = 0.01;         // +1% min per turn
export const POP_BASE_GROWTH_MAX = 0.03;         // +3% max per turn
export const POP_REVOLT_THRESHOLD = 20;           // happiness < 20 → revolts
export const POP_MIGRATION_THRESHOLD = 70;        // happiness > 70 attracts migrants

// ─── Military ──────────────────────────────────────────────────

export const MILITARY_EXPONENTIAL_THRESHOLD = 50; // above 50 → exponential cost
export const MILITARY_MAX_LEVEL = 100;
export const MILITARY_LVL80_MAINTENANCE_RATE = 0.22; // 20-25% GDP at level 80
export const MILITARY_AUTHORITARIAN_CAP = -30;    // max -30% happiness compensated
export const MILITARY_RESEARCH_BONUS_PER_5 = 1;   // +1 effective force per 5 research levels
export const MILITARY_DEFENDER_BONUS = 0.25;       // +25% effectiveness

// ─── Weapons ───────────────────────────────────────────────────

export const WEAPON_TIERS = {
  1: { name: 'Conventionnel', researchRequired: 10, forceMin: 5, forceMax: 15, baseCost: 300 },
  2: { name: 'Avancé', researchRequired: 30, forceMin: 15, forceMax: 30, baseCost: 800 },
  3: { name: 'Haute technologie', researchRequired: 55, forceMin: 25, forceMax: 40, baseCost: 1500 },
  4: { name: 'Stratégique', researchRequired: 75, forceMin: 30, forceMax: 50, baseCost: 3000 },
} as const;

export const WEAPON_PROPRIETARY_MAINTENANCE_RATE = 0.03; // 2-4% value/turn
export const WEAPON_DEGRADATION_PER_TURN = 0.20;          // -20% efficacy/turn without maintenance
export const WEAPON_UNUSABLE_AFTER_TURNS = 5;

// ─── Nuclear ───────────────────────────────────────────────────

export const NUCLEAR_RESEARCH_REQUIRED = 75;
export const NUCLEAR_DEV_COST_RATE = 0.175;       // 15-20% GDP per turn during dev
export const NUCLEAR_DEV_TURNS = 4;               // 3-5 turns
export const NUCLEAR_BOMB_COST_RATE = 0.065;      // 5-8% GDP per bomb
export const NUCLEAR_MAINTENANCE_RATE = 0.01;     // 1% GDP per bomb per turn
export const NUCLEAR_TARGET_POP_LOSS = 0.70;      // -60 to -80% population in region
export const NUCLEAR_TARGET_HAPPINESS_LOSS = 40;  // -40% happiness
export const NUCLEAR_TARGET_REGION_LOCKOUT = 12;  // 10-15 turns unusable
export const NUCLEAR_ATTACKER_INFLUENCE_LOSS = 50; // -50% influence
export const NUCLEAR_ATTACKER_HAPPINESS_LOSS = 25; // -25% happiness
export const NUCLEAR_GLOBAL_POLLUTION = 17;       // +15-20% pollution worldwide
export const NUCLEAR_GLOBAL_HEALTH_LOSS = 5;      // -5% health all players, 3 turns

// ─── Bombardment ───────────────────────────────────────────────

export const BOMBARDMENT_DAMAGE_MIN = 0.20;       // -20% capacity
export const BOMBARDMENT_DAMAGE_MAX = 0.30;       // -30% capacity
export const BOMBARDMENT_DURATION_MIN = 3;        // 3 turns
export const BOMBARDMENT_DURATION_MAX = 5;        // 5 turns
export const BOMBARDMENT_INTERCEPT_THRESHOLD = 50; // armed forces > 50 intercepts
export const BOMBARDMENT_INTERCEPT_MIN = 0.20;    // 20% damage reduction
export const BOMBARDMENT_INTERCEPT_MAX = 0.40;    // 40% damage reduction
export const BLUFF_INFLUENCE_PENALTY = 10;         // -10% influence if caught bluffing

// ─── Sabotage ──────────────────────────────────────────────────

export const SABOTAGE_COST_RATE = 0.04;           // 3-5% GDP
export const SABOTAGE_DAMAGE_MIN = 10;             // -10% capacity
export const SABOTAGE_DAMAGE_MAX = 15;             // -15% capacity
export const SABOTAGE_DURATION_MIN = 2;
export const SABOTAGE_DURATION_MAX = 3;

// Success rates by intelligence differential
export const SABOTAGE_SUCCESS_RATES = [
  { diffMin: 30, rate: 0.90 },    // attacker +30 or more
  { diffMin: 10, rate: 0.75 },    // attacker +10 to +29
  { diffMin: -9, rate: 0.55 },    // levels equal (-9 to +9)
  { diffMin: -29, rate: 0.35 },   // defender +10 to +29
  { diffMin: -Infinity, rate: 0.20 }, // defender +30 or more
];

// Visibility rates: [invisible, suspicion, proof]
export const SABOTAGE_VISIBILITY = {
  attackerStrong:  [0.85, 0.12, 0.03], // att +30+
  equal:           [0.45, 0.35, 0.20], // equal
  defenderStrong:  [0.05, 0.50, 0.45], // def +30+
} as const;

// Failed sabotage detection rates
export const SABOTAGE_FAILED_DETECT_MIN = 0.30;
export const SABOTAGE_FAILED_DETECT_MAX = 0.60;

// ─── War ───────────────────────────────────────────────────────

export const WAR_MOBILIZATION_PROD_LOSS = 0.30;   // -30% production
export const WAR_MOBILIZATION_BUDGET = 0.18;       // 15-20% military budget
export const WAR_ARMISTICE_MIN_TURNS = 5;          // can propose after 5 turns
export const WAR_RESISTANCE_DURATION = 5;          // 5 turns resistance
export const WAR_RESISTANCE_PENALTY = 0.30;        // -30% productivity in conquered regions
export const WAR_RECONSTRUCTION_DURATION = 4;      // 3-5 turns
export const WAR_RECONSTRUCTION_PENALTY = 0.15;    // -15% global productivity

// Duration estimates by force differential
export const WAR_DURATION_ESTIMATES = [
  { diffMin: 30, minTurns: 6, maxTurns: 9 },
  { diffMin: 10, minTurns: 10, maxTurns: 14 },
  { diffMin: -9, minTurns: 15, maxTurns: 22 },
  { diffMin: -Infinity, minTurns: 18, maxTurns: 25 },
];

// ─── Tourism ───────────────────────────────────────────────────

export const TOURISM_GDP_CAP = 0.20;              // 15-20% GDP max
export const TOURISM_BAN_INFLUENCE_COST = 5;      // -5% influence for banning
export const MONUMENT_DIMINISHING_FACTOR = 0.85;  // each monument yields 85% of previous

// ─── Organizations ─────────────────────────────────────────────

export const ORG_MIN_MEMBERS = 3;
export const ORG_COTISATION_MIN = 0.005;           // 0.5% GDP
export const ORG_COTISATION_MAX = 0.02;            // 2% GDP
export const ORG_SIMPLE_MAJORITY = 0.5;
export const ORG_STRUCTURAL_MAJORITY = 0.80;       // 80% for structural changes
export const ORG_LEAVE_PENALTY_TURNS = 1;          // 1 turn cotisation
export const ORG_MILITARY_INTERVENTION_BONUS = 0.125; // +10-15% effectiveness
export const ORG_MILITARY_INTERVENTION_COST = 0.05;   // 5% GDP
export const ORG_NON_INTERVENTION_HAPPINESS_LOSS = 10; // -10% happiness

// ─── Sanctions ─────────────────────────────────────────────────

export const SANCTION_TRADE_SURCHARGE = 0.30;      // +30% trade costs
export const SANCTION_REFUSE_DESPITE_PROOF_HAPPINESS = 20; // -20% happiness

// ─── Factories ─────────────────────────────────────────────────

export const FACTORY_TIERS = {
  basic:     { researchRequired: 0,  costMultiplier: 1.0, productionMultiplier: 1.0, maintenanceCost: 20 },
  advanced:  { researchRequired: 30, costMultiplier: 2.0, productionMultiplier: 1.8, maintenanceCost: 50 },
  robotized: { researchRequired: 60, costMultiplier: 4.0, productionMultiplier: 3.0, maintenanceCost: 100 },
} as const;

export const FACTORY_BASE_COSTS: Record<string, number> = {
  rawMaterials: 400,
  energy: 600,
  manufacturing: 500,
  electronics: 900,
  pharmaceutical: 800,
  armament: 1000,
  luxury: 700,
  food: 350,
};

export const FACTORY_BASE_INCOME: Record<string, number> = {
  rawMaterials: 80,
  energy: 120,
  manufacturing: 100,
  electronics: 180,
  pharmaceutical: 160,
  armament: 200,
  luxury: 140,
  food: 70,
};

// ─── Tools ─────────────────────────────────────────────────────

export const TOOL_TIERS = {
  basic:     { researchRequired: 0,  multiplier: 1.2, cost: 200, maintenanceCost: 10 },
  advanced:  { researchRequired: 25, multiplier: 1.5, cost: 500, maintenanceCost: 30 },
  robotized: { researchRequired: 50, multiplier: 2.0, cost: 1000, maintenanceCost: 60 },
} as const;

// ─── Infrastructure ────────────────────────────────────────────

export const INFRA_UPGRADE_COST = 300;
export const INFRA_SABOTAGE_LOSS = 12;             // -10 to -15% per sabotage
export const INFRA_SABOTAGE_DURATION = 2;          // 2-3 turns

// ─── Research ──────────────────────────────────────────────────

export const RESEARCH_COST_PER_LEVEL = 100;        // base cost, scales with level
export const RESEARCH_EDUCATION_BOOST = 0.02;      // +2% research speed per education level
export const PATENT_INCOME_BASE = 50;              // base income per patent per turn

// ─── Transport ─────────────────────────────────────────────────

export const TRANSPORT_UPGRADE_COST = 250;
export const TRANSPORT_TRADE_REDUCTION_MAX = 0.30; // max 30% trade cost reduction

// ─── Random Events ─────────────────────────────────────────────

export const EVENTS_PER_TURN_MIN = 1;
export const EVENTS_PER_TURN_MAX = 2;

// ─── Finance ───────────────────────────────────────────────────

export const INFLATION_DEBT_REDUCTION = 0.05;      // 5% debt reduction per 10% inflation
export const CURRENCY_STRENGTH_MIN = 0.5;
export const CURRENCY_STRENGTH_MAX = 2.0;
