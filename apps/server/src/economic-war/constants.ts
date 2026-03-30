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

// Hard gameplay thresholds (kept for revolt events only)
export const POP_REVOLT_THRESHOLD = 20;           // happiness < 20 → revolts (gameplay event)
// Removed POP_BASE_GROWTH_MIN/MAX and POP_MIGRATION_THRESHOLD — replaced by smooth formulas

// ─── Population smooth formula coefficients ─────────────────────
// All formulas are continuous power functions — no hard thresholds.

// Productivity: ≥70% bonheur → 100%, en dessous → baisse linéaire jusqu'à plancher 50%
export const POP_PRODUCTIVITY_FLOOR = 0.50;       // plancher : bonheur=0 → 50% productivité (jamais bloquant)
export const POP_PRODUCTIVITY_FULL_AT = 70;       // seuil : ≥70% bonheur → 100% productivité
export const POP_PRODUCTIVITY_MAX = 1.0;          // pas de bonus au-dessus de 70%

// Birth rate: [MAX - RANGE × (ID/100)^ID_EXP] × [HAPPY_BASE + HAPPY_RANGE × (B/100)]
export const POP_BIRTHRATE_MAX = 3.0;             // 3.0% natalité brute (pays pauvre)
export const POP_BIRTHRATE_RANGE = 2.2;           // variation max entre pauvre et riche
export const POP_BIRTHRATE_ID_EXP = 0.65;         // concave → dévpt ralentit fort la natalité
export const POP_BIRTHRATE_HAPPY_BASE = 0.70;     // multiplicateur bonheur minimum
export const POP_BIRTHRATE_HAPPY_RANGE = 0.60;    // amplitude bonheur → natalité

// Mortality: BASE + COEFF × (1−H/100)^H_EXP × (1−N/100)^N_EXP
export const POP_MORTALITY_BASE = 0.001;          // 0.1% mortalité incompressible
export const POP_MORTALITY_COEFF = 0.024;         // 2.4% malus max (si santé=0 ET besoins=0)
export const POP_MORTALITY_HEALTH_EXP = 1.3;      // convexe → crise sanitaire très punitive
export const POP_MORTALITY_NEEDS_EXP = 0.7;       // concave → effet même à besoins modérés

// Migration: rate = COEFF × tanh(delta / SCALE) — smooth sigmoid
export const POP_MIGRATION_COEFF = 0.006;         // ±0.6% max flux migratoire/tour
export const POP_MIGRATION_SCALE = 25;            // demi-amplitude de la sigmoïde

// Consumption multipliers by sector: A + B × (ID/100)^EXP
export const POP_CONSUMPTION_ENERGY_A   = 0.30;  export const POP_CONSUMPTION_ENERGY_B   = 1.40;  export const POP_CONSUMPTION_ENERGY_EXP = 0.85;
export const POP_CONSUMPTION_LUXURY_A   = 0.02;  export const POP_CONSUMPTION_LUXURY_B   = 1.50;  export const POP_CONSUMPTION_LUXURY_EXP = 2.00;  // très convexe
export const POP_CONSUMPTION_HEALTH_A   = 0.40;  export const POP_CONSUMPTION_HEALTH_B   = 0.90;  export const POP_CONSUMPTION_HEALTH_EXP = 0.65;

// ─── Military ──────────────────────────────────────────────────

export const MILITARY_EXPONENTIAL_THRESHOLD = 50; // above 50 → exponential cost
export const MILITARY_MAX_LEVEL = 100;
export const MILITARY_LVL80_MAINTENANCE_RATE = 0.22; // 20-25% GDP at level 80
export const MILITARY_AUTHORITARIAN_CAP = -30;    // max -30% happiness compensated
export const MILITARY_RESEARCH_BONUS_PER_5 = 1;   // +1 effective force per 5 research levels
export const MILITARY_DEFENDER_BONUS = 0.25;       // +25% effectiveness

// ─── Weapons ───────────────────────────────────────────────────

export const WEAPON_TIERS = {
  1: { name: 'Conventionnel', researchRequired: 10, forceMin: 8, forceMax: 12, baseCost: 300 },
  2: { name: 'Avancé', researchRequired: 30, forceMin: 18, forceMax: 27, baseCost: 800 },
  3: { name: 'Haute technologie', researchRequired: 55, forceMin: 28, forceMax: 38, baseCost: 1500 },
  4: { name: 'Stratégique', researchRequired: 75, forceMin: 35, forceMax: 47, baseCost: 3000 },
} as const;

export const WEAPON_PROPRIETARY_MAINTENANCE_RATE = 0.03; // 2-4% value/turn
export const WEAPON_DEGRADATION_PER_TURN = 0.20;          // -20% efficacy/turn without maintenance
export const WEAPON_UNUSABLE_AFTER_TURNS = 5;

// ─── Armament Auto-Production ──────────────────────────────────
// Steel consumed per weapon produced (by weapon tier)
export const WEAPON_PRODUCTION_STEEL_COST: Record<number, number> = {
  1: 3, 2: 8, 3: 18, 4: 40,
};
// Optional rareEarths for high tiers
export const WEAPON_PRODUCTION_RARE_EARTH_COST: Record<number, number> = {
  3: 3, 4: 8,
};
// Accumulation threshold: production units needed to build one weapon of each tier
export const WEAPON_BUILD_THRESHOLD: Record<number, number> = {
  1: 1.0, 2: 2.5, 3: 5.0, 4: 10.0,
};
// Money cost multiplier per weapon tier (× baseCost)
export const WEAPON_AUTO_COST_MULT = 0.5; // cheaper than manual purchase

// ─── Maintenance Workshop ──────────────────────────────────────
// Parts produced per factory per turn (× tier multiplier at runtime)
export const MAINTENANCE_PARTS_PER_FACTORY = 1.5;
// Max part tier per workshop tier: basic→T2, advanced→T3, robotized→T4
export const MAINTENANCE_WORKSHOP_MAX_PART_TIER: Record<string, number> = {
  basic: 2, advanced: 3, robotized: 4,
};
// Auto-maintenance threshold: apply parts when this many turns remain
export const MAINTENANCE_AUTO_APPLY_THRESHOLD = 3;

// ─── Nuclear ───────────────────────────────────────────────────

export const NUCLEAR_RESEARCH_REQUIRED = 85;       // hausse : arme nucléaire = endgame
export const NUCLEAR_MILITARY_REQUIRED = 50;       // branche military level requis
export const NUCLEAR_DEV_COST_RATE = 0.20;         // 20% GDP per turn during dev (augmenté)
export const NUCLEAR_DEV_TURNS = 6;                // 6 tours (augmenté, donne le temps de réagir)
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

// ─── Military Units ────────────────────────────────────────────
/** Combat power per unit [T1, T2, T3] */
export const UNIT_POWER_INFANTRY: [number, number, number] = [1,   2,    4  ];
export const UNIT_POWER_TANKS:    [number, number, number] = [4,   10,   20  ];
export const UNIT_POWER_PLANES:   [number, number, number] = [5,   12,   25  ];
export const UNIT_POWER_WARSHIPS: [number, number, number] = [6,   14,   30  ];

/** Terrain defense multiplier: terrain → unitType → multiplier (applied to defender's power) */
export const TERRAIN_DEFENSE_MODIFIER: Record<string, Record<string, number>> = {
  plains:   { infantry: 1.0, tanks: 1.1,  planes: 1.0,  warships: 1.0 },
  mountain: { infantry: 1.4, tanks: 0.6,  planes: 0.85, warships: 0.8 },
  urban:    { infantry: 1.6, tanks: 0.7,  planes: 0.7,  warships: 0.9 },
  coast:    { infantry: 1.0, tanks: 0.85, planes: 1.1,  warships: 1.6 },
};

/** Integrity lost per unit of attacker power advantage per front */
export const WAR_INTEGRITY_LOSS_PER_POWER = 0.4;
/** Minimum integrity change per turn when attacker wins a front */
export const WAR_INTEGRITY_MIN_LOSS = 5;
/** Integrity recovered per unit of defender power advantage per front */
export const WAR_INTEGRITY_RECOVERY_PER_POWER = 0.2;

// ─── Nouveau système de combat matriciel ────────────────────────

/**
 * Taux de kill : fraction du TYPE défenseur tué par unité EFFECTIVE attaquante par tour.
 * Unités effectives = sum(count[tier] * COMBAT_TIER_POWER[tier])
 * COMBAT_KILL_MATRIX[typeAttaquant][typeDéfenseur]
 */
export const COMBAT_KILL_MATRIX: Record<string, Record<string, number>> = {
  infantry: { infantry: 0.25,  tanks: 0.020, planes: 0.005, warships: 0.010 },
  tanks:    { infantry: 0.30,  tanks: 0.200, planes: 0.030, warships: 0.040 },
  planes:   { infantry: 0.28,  tanks: 0.450, planes: 0.200, warships: 0.080 },
  warships: { infantry: 0.20,  tanks: 0.100, planes: 0.060, warships: 0.150 },
};

/** Multiplicateurs de tier pour le calcul des kills : T1=1, T2=2, T3=4 */
export const COMBAT_TIER_POWER: [number, number, number] = [1, 2, 4];

/**
 * Puissance de combat par tier (pour le calcul du ratio numérique uniquement).
 * Représente la valeur globale d'une unité dans le calcul d'avantage.
 */
export const UNIT_COMBAT_POWER: Record<string, [number, number, number]> = {
  infantry: [1,  2,  4],
  tanks:    [8,  16, 32],
  planes:   [12, 24, 48],
  warships: [10, 20, 40],
};

/** Exposant appliqué au ratio de puissance : ratio^EXP → 0.75 */
export const COMBAT_RATIO_EXPONENT = 0.75;

/** Facteur aléatoire : dommages multipliés par (1 ± cette valeur) */
export const COMBAT_RANDOM_FACTOR = 0.12;

/**
 * Modificateurs de terrain : attackMult = multiplicateur sur les kills sortants,
 * defMult = multiplicateur sur les kills entrants (< 1.0 = plus dur à tuer).
 */
export const TERRAIN_COMBAT_MODIFIERS: Record<string, {
  attackMult: Record<string, number>;
  defMult:    Record<string, number>;
}> = {
  plains: {
    attackMult: { infantry: 1.0, tanks: 1.0,  planes: 1.0,  warships: 1.0 },
    defMult:    { infantry: 1.0, tanks: 1.0,  planes: 1.0,  warships: 1.0 },
  },
  mountain: {
    attackMult: { infantry: 1.3, tanks: 0.6,  planes: 0.85, warships: 0.5 },
    defMult:    { infantry: 0.6, tanks: 1.5,  planes: 1.2,  warships: 2.0 },
  },
  urban: {
    attackMult: { infantry: 1.2, tanks: 0.7,  planes: 0.7,  warships: 0.5 },
    defMult:    { infantry: 0.5, tanks: 1.6,  planes: 0.9,  warships: 2.0 },
  },
  coast: {
    attackMult: { infantry: 1.0, tanks: 0.9,  planes: 1.1,  warships: 1.3 },
    defMult:    { infantry: 1.0, tanks: 1.0,  planes: 1.0,  warships: 0.7 },
  },
  forest: {
    attackMult: { infantry: 1.2, tanks: 0.6,  planes: 1.0,  warships: 0.5 },
    defMult:    { infantry: 0.7, tanks: 1.4,  planes: 1.3,  warships: 2.0 },
  },
};

/** Coût de fortification en or */
export const FORTIFY_COST = 4000;
/** Multiplicateur défensif de la fortification (kills entrants × cette valeur) */
export const FORTIFY_DEFENSE_MULT = 0.45;

/** Infantry recruit cost (T1 only — T2/T3 obtained via training) */
export const INFANTRY_RECRUIT_COST: [number, number, number] = [50, 50, 50]; // only [0] used
/** Training cost per soldier (T1→T2, T2→T3). Total T2 = 50+25 = 75 = 1.5× T1, T3 = 75+37 = 112 ≈ 2.25× T1 */
export const INFANTRY_TRAINING_COST: [number, number] = [25, 37];
/** Bulk training discount: cost × (1 - min(MAX_DISCOUNT, count × RATE_PER_UNIT)) */
export const INFANTRY_BULK_DISCOUNT_RATE = 0.01;   // 1% per soldier
export const INFANTRY_BULK_DISCOUNT_MAX  = 0.20;   // max 20% off
/** Upkeep cost per unit per turn [T1, T2, T3] */
export const INFANTRY_UPKEEP: [number, number, number] = [2,  6,  15];
export const TANK_UPKEEP:     [number, number, number] = [8,  20, 40];
export const PLANE_UPKEEP:    [number, number, number] = [12, 28, 55];
export const WARSHIP_UPKEEP:  [number, number, number] = [15, 35, 50];

/** Money cost per factory-produced unit [T1, T2, T3] */
export const TANK_BUILD_COST:    [number, number, number] = [200,  550,  1300];
export const PLANE_BUILD_COST:   [number, number, number] = [350,  900,  2200];
export const WARSHIP_BUILD_COST: [number, number, number] = [400,  1000, 1800];
/** Steel cost per factory-produced unit [T1, T2, T3] */
export const TANK_BUILD_STEEL:    [number, number, number] = [5,  12, 25];
export const PLANE_BUILD_STEEL:   [number, number, number] = [8,  20, 40];
export const WARSHIP_BUILD_STEEL: [number, number, number] = [10, 25, 35];
/** Production queue accumulation threshold per tier [T1, T2, T3] */
export const TANK_BUILD_THRESHOLD:    [number, number, number] = [1.5, 3.5, 8.0 ];
export const PLANE_BUILD_THRESHOLD:   [number, number, number] = [2.0, 4.5, 10.0];
export const WARSHIP_BUILD_THRESHOLD: [number, number, number] = [2.5, 5.5, 12.0];

// ─── Ammunition ────────────────────────────────────────────────
/** Purchase cost per unit of ammo */
export const AMMO_COST_MUNITIONS = 5;    // bullets/ammo for infantry
export const AMMO_COST_OBUS = 20;        // shells for tanks
export const AMMO_COST_BOMBS = 40;       // bombs for planes (war:buyAmmo only; bombardment uses bombs field)
/** If a unit type has no ammo during combat, it fights at reduced effectiveness */
export const AMMO_NO_AMMO_POWER_MULT = 0.50;
/** Ammo consumed per total unit count per combat round [T1, T2, T3] (proportional to units used across all fronts) */
export const AMMO_INFANTRY_CONSUMPTION = 1;   // 1 munitions per infantry
export const AMMO_TANK_CONSUMPTION = 1;       // 1 obus per tank
export const AMMO_PLANE_CONSUMPTION = 1;      // 1 bomb per plane

// ─── War ───────────────────────────────────────────────────────

export const WAR_MOBILIZATION_PROD_LOSS = 0.20;   // -20% production (réduit pour garder viable)
export const WAR_MOBILIZATION_BUDGET = 0.18;       // 15-20% military budget
export const WAR_ARMISTICE_MIN_TURNS = 4;          // can propose after 4 turns
export const WAR_RESISTANCE_DURATION = 6;          // 6 turns resistance (plus dur à pacifier)
export const WAR_RESISTANCE_PENALTY = 0.35;        // -35% productivity in conquered regions
export const WAR_RECONSTRUCTION_DURATION = 5;      // 5 turns (la guerre coûte cher au vainqueur aussi)
export const WAR_RECONSTRUCTION_PENALTY = 0.20;    // -20% global productivity

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

export const ORG_MIN_MEMBERS                   = 3;
export const ORG_SIMPLE_MAJORITY               = 0.5;
export const ORG_STRUCTURAL_MAJORITY           = 0.80;
export const ORG_COMMERCIAL_COTISATION_RATE    = 0.025;  // 2.5% PIB/tour
export const ORG_MILITARY_COTISATION_RATE      = 0.04;   // 4% PIB tous les 3 tours
export const ORG_MILITARY_COTISATION_INTERVAL  = 3;
export const ORG_EMBARGO_DURATION              = 3;      // 3 tours
export const ORG_MILITARY_DETERRENCE_HAPPINESS = 10;     // -10 bonheur à l'attaquant
export const ORG_TRADE_TAX_MIN                 = 0.10;   // 10% taxe de base sur tous les échanges

// ─── Sanctions ─────────────────────────────────────────────────

export const SANCTION_TRADE_SURCHARGE = 0.30;      // +30% trade costs
export const SANCTION_REFUSE_DESPITE_PROOF_HAPPINESS = 20; // -20% happiness

// ─── Factories ─────────────────────────────────────────────────

export const FACTORY_TIERS = {
  basic:     { researchRequired: 0,  costMultiplier: 1.0, productionMultiplier: 1.0, maintenanceCost: 30 },
  advanced:  { researchRequired: 30, costMultiplier: 2.0, productionMultiplier: 1.8, maintenanceCost: 70 },
  robotized: { researchRequired: 60, costMultiplier: 4.0, productionMultiplier: 3.0, maintenanceCost: 130 },
} as const;

/**
 * Coût d'upgrade d'usine (multiplicateur du baseCost du secteur).
 * Upgrade < achat neuf au même tier, MAIS achat T1 + upgrade > achat direct T2.
 *   Ex manufacturing (base 500) : T1=500, T2=1000, upgrade 1→2 = 500×1.3 = 650 → total T1+upgrade = 1150 > 1000
 *   Upgrade seul (650) < achat neuf T2 (1000) → intéressant si on a déjà l'usine.
 */
export const FACTORY_UPGRADE_COST_MULT: Record<string, number> = {
  basic_to_advanced:     1.3,  // base × 1.3  (vs achat neuf T2 = base × 2.0)
  advanced_to_robotized: 2.5,  // base × 2.5  (vs achat neuf T3 = base × 4.0)
};

export const FACTORY_BASE_COSTS: Record<string, number> = {
  rawMaterials: 400,
  energy: 600,
  manufacturing: 500,
  electronics: 900,
  pharmaceutical: 800,
  armament: 1000,
  food: 350,
  // Nouveaux secteurs (produisent des biens, pas de PIB direct)
  chemicalPlant:       450,
  vehicleFactory:      700,
  shipyard:            900,
  aerospace:           1200,
  phonesFactory:       700,
  computersFactory:    900,
  maintenanceWorkshop: 600,
  // Military production facilities (produce combat units, not GDP)
  tankFactory:      1200,
  militaryAirbase:  1500,
  navalBase:        1800,
  // Ammunition factory
  ammunitionFactory: 600,
  // Power plants
  powerPlant:     500,
  nuclearPlant:   1500,
};

export const FACTORY_BASE_INCOME: Record<string, number> = {
  // Revenus directs fortement réduits : l'argent doit venir du commerce, pas juste d'avoir des usines
  rawMaterials: 0,
  energy: 40,
  manufacturing: 35,
  electronics: 50,
  pharmaceutical: 45,
  armament: 0,
  food: 25,
  // Nouveaux secteurs : revenu direct = 0, la valeur vient des biens produits + commerce
  chemicalPlant:  0,
  vehicleFactory: 0,
  shipyard:       0,
  aerospace:      0,
  phonesFactory:       0,
  computersFactory:    0,
  maintenanceWorkshop: 0,
  tankFactory:      0,
  militaryAirbase:  0,
  navalBase:        0,
  ammunitionFactory: 0,
  powerPlant:     0,
  nuclearPlant:   0,
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

export const RESEARCH_BASE_COST = 100;              // coût du premier niveau
export const RESEARCH_COST_SCALING = 1.08;          // coût = base × scaling^level (progressif)
export const RESEARCH_COST_PER_LEVEL = 100;         // kept for compat
export const RESEARCH_EDUCATION_BOOST = 0.02;       // +2% research speed per education level
export const PATENT_INCOME_BASE = 50;               // base income per patent per turn

// ─── Transport ─────────────────────────────────────────────────

export const TRANSPORT_UPGRADE_COST = 250;
export const TRANSPORT_TRADE_REDUCTION_MAX = 0.30; // max 30% trade cost reduction

// ─── Random Events ─────────────────────────────────────────────

export const EVENTS_PER_TURN_MIN = 1;
export const EVENTS_PER_TURN_MAX = 2;

// ─── Mining ────────────────────────────────────────────────────
// Ressources minières : pétrole + 5 types de minerais (géologiques, peu renouvelables)

// Shared constants
export const MINING_REFINERY_YIELD_BONUS   = 0.30; // +30% extraction with refinery
export const MINING_REFINERY_POLLUTION_MOD = 0.70; // ×0.70 pollution with refinery (−30%)
export const MINING_COST_SCALE_PER_MACHINE = 0.6;  // +60% per additional machine
export const MINING_MAX_MACHINES           = 10;

// Infrastructure factor: 0.5 + 0.5 × (electricity / 100)

// ── Pétrole ──
export const MINING_OIL_RECHARGE_RATE      = 0.0003; // très lent (géologique)
export const MINING_OIL_BASE_RATE          = 20;
export const MINING_OIL_POLLUTION_RATE     = 0.06;
export const MINING_OIL_MACHINE_BASE_COST  = 500;
export const MINING_OIL_REFINERY_COST      = 1500;
export const MINING_OIL_RESERVE_SCALE      = 50;   // oil=100 → 5000 underground

// ── Fer ──
export const MINING_IRON_RECHARGE_RATE     = 0.0010;
export const MINING_IRON_BASE_RATE         = 35;
export const MINING_IRON_POLLUTION_RATE    = 0.025;
export const MINING_IRON_MACHINE_BASE_COST = 300;
export const MINING_IRON_REFINERY_COST     = 1000;
export const MINING_IRON_RESERVE_SCALE     = 45;

// ── Charbon ──
export const MINING_COAL_RECHARGE_RATE     = 0.0008;
export const MINING_COAL_BASE_RATE         = 40;
export const MINING_COAL_POLLUTION_RATE    = 0.055;
export const MINING_COAL_MACHINE_BASE_COST = 280;
export const MINING_COAL_REFINERY_COST     = 900;
export const MINING_COAL_RESERVE_SCALE     = 50;

// ── Terres rares ──
export const MINING_RARE_RECHARGE_RATE     = 0.0004;
export const MINING_RARE_BASE_RATE         = 15;
export const MINING_RARE_POLLUTION_RATE    = 0.020;
export const MINING_RARE_MACHINE_BASE_COST = 500;
export const MINING_RARE_REFINERY_COST     = 1500;
export const MINING_RARE_RESERVE_SCALE     = 25;

// ── Métaux précieux ──
export const MINING_PREC_RECHARGE_RATE     = 0.0003;
export const MINING_PREC_BASE_RATE         = 10;
export const MINING_PREC_POLLUTION_RATE    = 0.030;
export const MINING_PREC_MACHINE_BASE_COST = 450;
export const MINING_PREC_REFINERY_COST     = 1400;
export const MINING_PREC_RESERVE_SCALE     = 20;

// ── Uranium ──
export const MINING_URAN_RECHARGE_RATE     = 0.0001;
export const MINING_URAN_BASE_RATE         = 8;
export const MINING_URAN_POLLUTION_RATE    = 0.100;
export const MINING_URAN_MACHINE_BASE_COST = 700;
export const MINING_URAN_REFINERY_COST     = 2000;
export const MINING_URAN_RESERVE_SCALE     = 15;

// ─── Agriculture ────────────────────────────────────────────────

// Base yield per surface unit per turn (→ resources.agriculture)
export const FARM_YIELD_CEREALS    = 8;
export const FARM_YIELD_VEGETABLES = 6;
export const FARM_YIELD_SUGAROILS  = 5;
export const FARM_YIELD_FODDER     = 7;

// Equipment — max exploitation cap (%)
export const FARM_EQUIP_BASIC_EXPLOITATION      = 50;
export const FARM_EQUIP_MECHANIZED_EXPLOITATION = 75;
export const FARM_EQUIP_ADVANCED_EXPLOITATION   = 95;

// Equipment — yield multipliers
export const FARM_EQUIP_BASIC_YIELD_MULT      = 0.70;
export const FARM_EQUIP_MECHANIZED_YIELD_MULT = 1.15;
export const FARM_EQUIP_ADVANCED_YIELD_MULT   = 1.80;

// Equipment upgrade costs
export const FARM_UPGRADE_TO_MECHANIZED_COST = 800;
export const FARM_UPGRADE_TO_ADVANCED_COST   = 2000;

// Fertility: fertilityMult = BASE + COEFF × (fertility/100)  →  [0.30, 1.00]
export const FARM_FERT_BASE  = 0.30;
export const FARM_FERT_COEFF = 0.70;

// Fertility evolution rates per turn
export const FARM_FERT_EROSION_RATE  = 0.2;   // exploitation > 90% → −0.2/turn
export const FARM_FERT_STABLE_RATE   = 0.05;  // exploitation 70–90% → +0.05/turn
export const FARM_FERT_RECOVERY_RATE = 0.17;  // exploitation < 70% → +0.17/turn

// Irrigation: bonus = 1.0 + irrigationLevel / DIVISOR  →  max 1.50 at level 100
export const FARM_IRRIGATION_BONUS_DIVISOR = 200;
export const FARM_IRRIGATION_UPGRADE_COST  = 400;  // cost per +10 levels
export const FARM_IRRIGATION_STEP          = 10;   // levels per action
export const FARM_IRRIGATION_MAX           = 100;

// Fallow forces exploitation to 30% (soil recovery mode)
export const FARM_FALLOW_EXPLOITATION = 30;

// Surface init: startingAgriculture × FARM_SURFACE_SCALE = total surface
export const FARM_SURFACE_SCALE = 0.5;

// Surface distribution across categories [cereals, vegetables, sugarOils, fodder]
export const FARM_SURFACE_DIST = [0.40, 0.25, 0.20, 0.15] as const;

// ─── Livestock (Élevage) ─────────────────────────────────────────

// Base yield per productive animal per turn (→ resources.agriculture)
export const LIVESTOCK_YIELD_RED_MEAT  = 4;   // haute valeur, faible volume
export const LIVESTOCK_YIELD_WHITE_MEAT = 3;  // volume rapide
export const LIVESTOCK_YIELD_DAIRY     = 3.5; // intermédiaire

// Equipment — exploitation caps (% of herd that is productive)
export const LIVESTOCK_EQUIP_BASIC_EXPLOITATION      = 40;
export const LIVESTOCK_EQUIP_MECHANIZED_EXPLOITATION = 65;
export const LIVESTOCK_EQUIP_ADVANCED_EXPLOITATION   = 85;

// Equipment — yield multipliers
export const LIVESTOCK_EQUIP_BASIC_YIELD_MULT      = 1.0;
export const LIVESTOCK_EQUIP_MECHANIZED_YIELD_MULT = 1.50;
export const LIVESTOCK_EQUIP_ADVANCED_YIELD_MULT   = 2.20;

// Equipment upgrade costs
export const LIVESTOCK_UPGRADE_TO_MECHANIZED_COST = 1000;
export const LIVESTOCK_UPGRADE_TO_ADVANCED_RED    = 3000; // bovins = infra plus lourde
export const LIVESTOCK_UPGRADE_TO_ADVANCED_OTHER  = 2500;

// Feed demand per animal per turn (consumed from resources.agriculture)
export const LIVESTOCK_FEED_RED_MEAT   = 2.0;
export const LIVESTOCK_FEED_WHITE_MEAT = 0.8;
export const LIVESTOCK_FEED_DAIRY      = 1.2;

// Alimentation weights (feedRatio × FEED_W + waterRatio × WATER_W)
export const LIVESTOCK_ALIM_FEED_WEIGHT  = 0.70;
export const LIVESTOCK_ALIM_WATER_WEIGHT = 0.30;
export const LIVESTOCK_WATER_THRESHOLD   = 40;  // waterTreatment level needed for full water supply

// Herd evolution: reproRate = REPRO_BASE + REPRO_COEFF × alimentationRatio
//   → 0% at alim=0.67, +1%/turn at alim=1.0, −2%/turn at alim=0
export const LIVESTOCK_REPRO_BASE  = -0.02;
export const LIVESTOCK_REPRO_COEFF =  0.03;
export const LIVESTOCK_HERD_MIN    =  5;   // floor to prevent extinction

// Pollution per animal per turn
export const LIVESTOCK_POLL_BASIC      = 0.003;
export const LIVESTOCK_POLL_MECHANIZED = 0.005;
export const LIVESTOCK_POLL_ADVANCED   = 0.009;

// Initial herd: startingAgriculture × scale, distributed 30/45/25%
export const LIVESTOCK_HERD_SCALE = 0.6;
export const LIVESTOCK_DIST_RED   = 0.30;
export const LIVESTOCK_DIST_WHITE = 0.45;
export const LIVESTOCK_DIST_DAIRY = 0.25;

// ─── Marine Resources (Pêche & Aquaculture) ──────────────────────
// Single renewable logistic stock: "Produits de la Mer"
// Stock evolves via: naturalGrowth − fishingDepletion − alimMortality

// Fraction of stockTotal that is accessible for fishing
export const MARINE_PRODUCTIVE_PCT = 0.60;

// Equipment — exploitation caps (% of productive stock fished per turn)
export const MARINE_EQUIP_BASIC_EXPLOITATION      = 20;
export const MARINE_EQUIP_MECHANIZED_EXPLOITATION = 35;
export const MARINE_EQUIP_ADVANCED_EXPLOITATION   = 50;

// Equipment — yield multipliers (food output per unit of productive stock)
export const MARINE_EQUIP_BASIC_YIELD_MULT      = 1.00;
export const MARINE_EQUIP_MECHANIZED_YIELD_MULT = 1.50;
export const MARINE_EQUIP_ADVANCED_YIELD_MULT   = 2.00;

// Logistic stock growth: naturalGrowth = RATE × (1 − stock/stockMax)
export const MARINE_NATURAL_GROWTH_RATE = 0.012;

// Fishing depletion coefficient: fishingDepletion = COEFF × exploitationRate
// Equilibrium at exploitationRate ≈ 0.91 (advanced equipment approaches this)
export const MARINE_FISHING_DEPLETION_COEFF = 0.022;

// stockMax = initialStock × STOCK_MAX_MULT
export const MARINE_STOCK_MAX_MULT  = 1.5;
// stockMin = initialStock × STOCK_FLOOR_PCT
export const MARINE_STOCK_FLOOR_PCT = 0.15;

// Max extraction per turn: SAFETY_CAP × productive stock
export const MARINE_STOCK_SAFETY_CAP = 0.60;

// Alimentation weights (feedRatio × FEED_W + waterRatio × WATER_W)
// Water dominates for marine (clean water critical for fish survival)
export const MARINE_ALIM_FEED_WEIGHT  = 0.40;
export const MARINE_ALIM_WATER_WEIGHT = 0.60;
export const MARINE_WATER_THRESHOLD   = 30;  // waterTreatment for full water supply

// Feed demand per unit of stock per turn (consumed from resources.agriculture)
// basic = wild fishing (low feed), advanced = aquaculture (higher feed)
export const MARINE_FEED_RATE_BASIC      = 0.01;
export const MARINE_FEED_RATE_MECHANIZED = 0.03;
export const MARINE_FEED_RATE_ADVANCED   = 0.06;

// Alim mortality: extra stock loss when alim < THRESHOLD
// stockLoss = max(0, COEFF × (THRESHOLD − alim) / THRESHOLD)
export const MARINE_ALIM_MORTALITY_COEFF     = 0.015;
export const MARINE_ALIM_MORTALITY_THRESHOLD = 0.70;

// Equipment upgrade costs
export const MARINE_UPGRADE_TO_MECHANIZED_COST = 1200;
export const MARINE_UPGRADE_TO_ADVANCED_COST   = 3000;

// Pollution per unit of stock exploited per turn
export const MARINE_POLL_BASIC      = 0.001;
export const MARINE_POLL_MECHANIZED = 0.003;
export const MARINE_POLL_ADVANCED   = 0.006;

// Initial stock: startingResources.water × STOCK_SCALE
export const MARINE_STOCK_SCALE = 2;

// ─── Factory Reconversion ──────────────────────────────────────
// Reconverting an existing factory costs RATE × baseCost(newSector, sameTier, 0 existing).
// Free in terms of action slots — only costs money.
export const FACTORY_RECONVERSION_COST_RATE = 0.15;

// ─── Finance ───────────────────────────────────────────────────

export const INFLATION_DEBT_REDUCTION = 0.05;      // 5% debt reduction per 10% inflation
export const CURRENCY_STRENGTH_MIN = 0.5;
export const CURRENCY_STRENGTH_MAX = 2.0;

// ─── New Factory Sectors ────────────────────────────────────────
// Secteurs qui produisent des biens physiques (pas de PIB direct)

export const NEW_SECTOR_BASE_COSTS: Record<string, number> = {
  chemicalPlant:  450,
  vehicleFactory: 700,
  shipyard:       900,
  aerospace:      1200,
};

// Base income for new goods-producing sectors = 0 (revenue comes from selling goods)
// Existing sectors keep their FACTORY_BASE_INCOME values.

// ─── Manufacturing — Production de biens par les usines ─────────
// Quantité produite par usine par tour (× tier multiplicateur au runtime)

export const MFG_OUTPUT_PER_FACTORY: Record<string, number> = {
  manufacturing:    2.0,   // acier/tour
  energy:           3.0,   // carburant/tour (à partir du pétrole)
  electronics:      1.0,   // composants électroniques/tour
  pharmaceutical:   1.5,   // médicaments/tour
  food:             2.0,   // aliments transformés/tour
  chemicalPlant:    2.0,   // engrais/tour
  phonesFactory:    1.0,   // téléphones/tour
  computersFactory: 0.8,   // ordinateurs/tour
  powerPlant:       5.0,   // points d'électricité/tour (boost infra)
  nuclearPlant:     12.0,  // points d'électricité/tour (boost infra, plus efficace)
};

// Ressource produite par secteur
export const MFG_OUTPUT_RESOURCE: Record<string, string> = {
  manufacturing:    'steel',
  energy:           'fuel',
  electronics:      'electronicComponents',
  pharmaceutical:   'pharmaceuticals',
  food:             'processedFood',
  chemicalPlant:    'fertilizer',
  phonesFactory:    'phones',
  computersFactory: 'computers',
  powerPlant:       'electricity',
  nuclearPlant:     'electricity',
};

// Consommation de matières premières par unité produite
export interface MfgInput { resource: string; amountPerUnit: number }

export const MFG_INPUTS: Record<string, MfgInput[]> = {
  manufacturing:    [{ resource: 'iron',                amountPerUnit: 1.5 },
                     { resource: 'coal',                amountPerUnit: 0.8 }],
  energy:           [{ resource: 'oil',                 amountPerUnit: 2.0 }],
  electronics:      [{ resource: 'rareEarths',          amountPerUnit: 0.8 },
                     { resource: 'coal',                amountPerUnit: 0.3 }],
  pharmaceutical:   [{ resource: 'vegetables',          amountPerUnit: 0.5 },
                     { resource: 'water',               amountPerUnit: 0.4 }],
  food:             [{ resource: 'cereals',             amountPerUnit: 1.0 },
                     { resource: 'water',               amountPerUnit: 0.3 }],
  chemicalPlant:    [{ resource: 'coal',                amountPerUnit: 0.8 },
                     { resource: 'water',               amountPerUnit: 0.6 },
                     { resource: 'oil',                 amountPerUnit: 0.3 }],
  phonesFactory:    [{ resource: 'electronicComponents', amountPerUnit: 0.8 },
                     { resource: 'rareEarths',          amountPerUnit: 0.2 }],
  computersFactory: [{ resource: 'electronicComponents', amountPerUnit: 1.2 },
                     { resource: 'rareEarths',          amountPerUnit: 0.3 }],
  powerPlant:       [{ resource: 'coal',                amountPerUnit: 1.5 }],
  nuclearPlant:     [{ resource: 'uranium',             amountPerUnit: 0.5 }],
};

// Téléphones et ordinateurs sont maintenant produits par leurs propres usines dédiées
// (phonesFactory et computersFactory) — voir MFG_OUTPUT_RESOURCE et MFG_INPUTS ci-dessus.

// Bonus engrais sur fertilité agricole (par unité en stock)
export const FERTILIZER_AGRI_BONUS_PER_UNIT = 0.002;
export const FERTILIZER_AGRI_BONUS_CAP      = 0.20;  // +20% max

// Substitutions de charbon : si le charbon manque, on peut utiliser ces alternatives
// ratio = quantité d'alternative nécessaire pour remplacer 1 unité de charbon
export const COAL_SUBSTITUTES: { resource: string; ratio: number }[] = [
  { resource: 'electricity', ratio: 0.5 },  // 0.5 électricité remplace 1 charbon
  { resource: 'fuel',        ratio: 1.2 },  // 1.2 fuel remplace 1 charbon (moins efficace)
];

// ─── Ammunition Factory ─────────────────────────────────────────
// Quantité produite par usine par tour selon le type de munition
export const AMMO_OUTPUT_PER_FACTORY: Record<'munitions' | 'obus' | 'bombs', number> = {
  munitions: 8,   // balles/munitions (consommation élevée, production rapide)
  obus:      3,   // obus pour chars (plus lourds, production plus lente)
  bombs:     1,   // bombes conventionnelles (production très lente)
};
// Consommation de matières premières par unité de munitions produite
export const AMMO_INPUTS: Record<'munitions' | 'obus' | 'bombs', { resource: string; amountPerUnit: number }[]> = {
  munitions: [{ resource: 'steel', amountPerUnit: 0.3 }],
  obus:      [{ resource: 'steel', amountPerUnit: 1.0 }],
  bombs:     [{ resource: 'steel', amountPerUnit: 2.0 }, { resource: 'fuel', amountPerUnit: 0.5 }],
};

// ─── Véhicules de Transport ─────────────────────────────────────

export interface VehicleSpec {
  type:       'truck' | 'ship' | 'plane';
  tier:       1 | 2 | 3;
  capacity:   number;         // unités de cargo
  fuelType:   'oil' | 'electric';
  fuelConsumption: number;    // par tour
  maxLifespan: number;        // en tours
  buildCost:  number;         // argent
  steelCost:  number;         // acier consommé à la construction
  componentsCost?: number;    // electronicComponents pour tier 3
  portRequirement?: number;   // min transport.ports
  researchBranch?: string;    // branche R&D requise
  researchLevel?: number;     // niveau min
}

export const VEHICLE_SPECS: VehicleSpec[] = [
  // ── Camions ──
  { type: 'truck', tier: 1, capacity: 10,   fuelType: 'oil',      fuelConsumption: 2,  maxLifespan: 8,  buildCost: 300,  steelCost: 5 },
  { type: 'truck', tier: 2, capacity: 25,   fuelType: 'oil',      fuelConsumption: 3,  maxLifespan: 12, buildCost: 700,  steelCost: 10, researchBranch: 'nanotech', researchLevel: 30 },
  { type: 'truck', tier: 3, capacity: 50,   fuelType: 'electric', fuelConsumption: 5,  maxLifespan: 16, buildCost: 1500, steelCost: 15, componentsCost: 3,  researchBranch: 'nanotech', researchLevel: 60 },
  // ── Bateaux ──
  { type: 'ship',  tier: 1, capacity: 50,   fuelType: 'oil',      fuelConsumption: 5,  maxLifespan: 10, buildCost: 600,  steelCost: 20, portRequirement: 40 },
  { type: 'ship',  tier: 2, capacity: 120,  fuelType: 'oil',      fuelConsumption: 8,  maxLifespan: 14, buildCost: 1400, steelCost: 35, portRequirement: 40, researchBranch: 'nanotech', researchLevel: 30 },
  { type: 'ship',  tier: 3, capacity: 300,  fuelType: 'electric', fuelConsumption: 15, maxLifespan: 20, buildCost: 3000, steelCost: 60, componentsCost: 10, portRequirement: 40, researchBranch: 'nanotech', researchLevel: 60 },
  // ── Avions ──
  { type: 'plane', tier: 1, capacity: 30,   fuelType: 'oil',      fuelConsumption: 10, maxLifespan: 6,  buildCost: 800,  steelCost: 12 },
  { type: 'plane', tier: 2, capacity: 70,   fuelType: 'oil',      fuelConsumption: 15, maxLifespan: 8,  buildCost: 1800, steelCost: 20, researchBranch: 'nanotech', researchLevel: 40 },
  { type: 'plane', tier: 3, capacity: 150,  fuelType: 'electric', fuelConsumption: 25, maxLifespan: 12, buildCost: 3500, steelCost: 30, componentsCost: 15, researchBranch: 'nanotech', researchLevel: 70 },
];

// Lookup rapide: VEHICLE_SPEC_MAP['truck'][1] → VehicleSpec
export const VEHICLE_SPEC_MAP: Partial<Record<string, Partial<Record<number, VehicleSpec>>>> = {};
for (const spec of VEHICLE_SPECS) {
  if (!VEHICLE_SPEC_MAP[spec.type]) VEHICLE_SPEC_MAP[spec.type] = {};
  VEHICLE_SPEC_MAP[spec.type]![spec.tier] = spec;
}

// Usines requises pour construire chaque type de véhicule
export const VEHICLE_REQUIRED_SECTOR: Record<string, string> = {
  truck: 'vehicleFactory',
  ship:  'shipyard',
  plane: 'aerospace',
};

// ─── Factory Research Requirements ────────────────────────────
// Per sector × tier. All 8 research branches are covered.
// Key format: `${sector}:${tier}`

export type ResearchReq = { branch: string; level: number };

export const SECTOR_RESEARCH_REQUIREMENTS: Record<string, ResearchReq[]> = {
  // ── Secteurs accessibles dès le début (basique gratuit) ──────
  // rawMaterials
  'rawMaterials:basic':      [],
  'rawMaterials:advanced':   [{ branch: 'nanotech',     level: 25 }],
  'rawMaterials:robotized':  [{ branch: 'nanotech',     level: 50 }, { branch: 'nuclear',      level: 20 }],
  // energy — cleanEnergy pour améliorer
  'energy:basic':            [],
  'energy:advanced':         [{ branch: 'cleanEnergy',  level: 25 }],
  'energy:robotized':        [{ branch: 'cleanEnergy',  level: 50 }, { branch: 'nuclear',      level: 25 }],
  // manufacturing — nanotech pour améliorer
  'manufacturing:basic':     [],
  'manufacturing:advanced':  [{ branch: 'nanotech',     level: 25 }],
  'manufacturing:robotized': [{ branch: 'nanotech',     level: 50 }, { branch: 'cleanEnergy',  level: 20 }],
  // armament — military pour améliorer, nuclear pour robotisé
  'armament:basic':          [],
  'armament:advanced':       [{ branch: 'military',     level: 25 }],
  'armament:robotized':      [{ branch: 'military',     level: 50 }, { branch: 'nuclear',      level: 35 }],
  // food — agrotech pour améliorer
  'food:basic':              [],
  'food:advanced':           [{ branch: 'agrotech',     level: 25 }],
  'food:robotized':          [{ branch: 'agrotech',     level: 50 }, { branch: 'cleanEnergy',  level: 15 }],
  // chemicalPlant — agrotech + cleanEnergy (avancé), + biotech (robotisé)
  'chemicalPlant:basic':     [],
  'chemicalPlant:advanced':  [{ branch: 'agrotech',     level: 30 }, { branch: 'cleanEnergy',  level: 15 }],
  'chemicalPlant:robotized': [{ branch: 'agrotech',     level: 50 }, { branch: 'biotech',      level: 25 }],

  // ── Secteurs techniques (petite barrière dès le basique) ─────
  // electronics — electronics + cybersecurity (avancé+)
  'electronics:basic':       [{ branch: 'electronics',  level: 10 }],
  'electronics:advanced':    [{ branch: 'electronics',  level: 35 }, { branch: 'cybersecurity', level: 15 }],
  'electronics:robotized':   [{ branch: 'electronics',  level: 60 }, { branch: 'cybersecurity', level: 30 }, { branch: 'nanotech', level: 20 }],
  // pharmaceutical — biotech + agrotech (avancé), + nanotech (robotisé)
  'pharmaceutical:basic':    [{ branch: 'biotech',      level: 10 }],
  'pharmaceutical:advanced': [{ branch: 'biotech',      level: 35 }, { branch: 'agrotech',     level: 20 }],
  'pharmaceutical:robotized':[{ branch: 'biotech',      level: 60 }, { branch: 'nanotech',     level: 25 }],
  // vehicleFactory — nanotech + cleanEnergy (avancé+)
  'vehicleFactory:basic':    [{ branch: 'nanotech',     level: 20 }],
  'vehicleFactory:advanced': [{ branch: 'nanotech',     level: 40 }, { branch: 'cleanEnergy',  level: 20 }],
  'vehicleFactory:robotized':[{ branch: 'nanotech',     level: 60 }, { branch: 'electronics',  level: 20 }],
  // shipyard — nanotech + military (avancé+)
  'shipyard:basic':          [{ branch: 'nanotech',     level: 25 }],
  'shipyard:advanced':       [{ branch: 'nanotech',     level: 45 }, { branch: 'military',     level: 15 }],
  'shipyard:robotized':      [{ branch: 'nanotech',     level: 65 }, { branch: 'electronics',  level: 25 }, { branch: 'military', level: 20 }],
  // aerospace — nanotech + electronics + military (robotisé) + nuclear (robotisé)
  'aerospace:basic':         [{ branch: 'nanotech',     level: 35 }, { branch: 'electronics',  level: 15 }],
  'aerospace:advanced':      [{ branch: 'nanotech',     level: 55 }, { branch: 'electronics',  level: 35 }, { branch: 'military', level: 20 }],
  'aerospace:robotized':     [{ branch: 'nanotech',     level: 70 }, { branch: 'electronics',  level: 50 }, { branch: 'nuclear',  level: 30 }],
  // phonesFactory — electronics + cybersecurity (avancé+)
  'phonesFactory:basic':     [{ branch: 'electronics',  level: 20 }],
  'phonesFactory:advanced':  [{ branch: 'electronics',  level: 40 }, { branch: 'cybersecurity', level: 20 }],
  'phonesFactory:robotized': [{ branch: 'electronics',  level: 60 }, { branch: 'cybersecurity', level: 35 }, { branch: 'nanotech', level: 20 }],
  // computersFactory — electronics + nanotech + cybersecurity
  'computersFactory:basic':  [{ branch: 'electronics',  level: 35 }, { branch: 'nanotech',     level: 20 }],
  'computersFactory:advanced':[{ branch: 'electronics', level: 50 }, { branch: 'nanotech',     level: 40 }, { branch: 'cybersecurity', level: 20 }],
  'computersFactory:robotized':[{ branch: 'electronics',level: 70 }, { branch: 'nanotech',     level: 55 }, { branch: 'cybersecurity', level: 35 }],
  // maintenanceWorkshop — nanotech (accès facile, stratégique pour tous)
  'maintenanceWorkshop:basic':    [{ branch: 'nanotech', level: 15 }],
  'maintenanceWorkshop:advanced': [{ branch: 'nanotech', level: 35 }, { branch: 'electronics', level: 15 }],
  'maintenanceWorkshop:robotized':[{ branch: 'nanotech', level: 55 }, { branch: 'electronics', level: 30 }],
  // tankFactory — military + nanotech
  'tankFactory:basic':     [{ branch: 'military', level: 20 }],
  'tankFactory:advanced':  [{ branch: 'military', level: 40 }, { branch: 'nanotech', level: 20 }],
  'tankFactory:robotized': [{ branch: 'military', level: 60 }, { branch: 'nanotech', level: 40 }],
  // militaryAirbase — military + nanotech + electronics (avancé+)
  'militaryAirbase:basic':     [{ branch: 'military', level: 25 }, { branch: 'nanotech', level: 15 }],
  'militaryAirbase:advanced':  [{ branch: 'military', level: 45 }, { branch: 'nanotech', level: 35 }],
  'militaryAirbase:robotized': [{ branch: 'military', level: 65 }, { branch: 'electronics', level: 30 }],
  // navalBase — military + nanotech
  'navalBase:basic':     [{ branch: 'military', level: 20 }, { branch: 'nanotech', level: 20 }],
  'navalBase:advanced':  [{ branch: 'military', level: 40 }, { branch: 'nanotech', level: 35 }],
  'navalBase:robotized': [{ branch: 'military', level: 60 }, { branch: 'nanotech', level: 50 }],
  // ammunitionFactory — military (accessible dès le départ pour tout le monde)
  'ammunitionFactory:basic':     [{ branch: 'military', level: 10 }],
  'ammunitionFactory:advanced':  [{ branch: 'military', level: 30 }, { branch: 'nanotech', level: 15 }],
  'ammunitionFactory:robotized': [{ branch: 'military', level: 50 }, { branch: 'nanotech', level: 30 }],
  // powerPlant — cleanEnergy pour construire
  'powerPlant:basic':     [{ branch: 'cleanEnergy', level: 10 }],
  'powerPlant:advanced':  [{ branch: 'cleanEnergy', level: 30 }, { branch: 'nanotech', level: 15 }],
  'powerPlant:robotized': [{ branch: 'cleanEnergy', level: 55 }, { branch: 'nanotech', level: 30 }],
  // nuclearPlant — nuclear + cleanEnergy (barrière élevée, production très forte)
  'nuclearPlant:basic':     [{ branch: 'nuclear', level: 30 }, { branch: 'cleanEnergy', level: 20 }],
  'nuclearPlant:advanced':  [{ branch: 'nuclear', level: 50 }, { branch: 'cleanEnergy', level: 40 }],
  'nuclearPlant:robotized': [{ branch: 'nuclear', level: 70 }, { branch: 'cleanEnergy', level: 55 }, { branch: 'nanotech', level: 25 }],
};
