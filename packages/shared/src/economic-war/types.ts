/**
 * Empire du Commerce — Shared Type Definitions
 * All types shared between client and server
 */

// ─── Game Phases ───────────────────────────────────────────────

export type EcoWarPhase =
  | 'lobby'
  | 'countrySelection'
  | 'preparation'
  | 'actionSelection'
  | 'resolution'
  | 'marketEvent'
  | 'roundSummary'
  | 'victory';

// ─── Resources ─────────────────────────────────────────────────

export type ResourceType =
  | 'oil' | 'iron' | 'coal' | 'rareEarths' | 'precious' | 'uranium' | 'water'
  // Produits agricoles (cultures)
  | 'cereals' | 'vegetables' | 'sugarOils' | 'fodder'
  // Produits de l'élevage & pêche
  | 'redMeat' | 'whiteMeat' | 'dairy' | 'fish'
  // Biens manufacturés (produits par les usines)
  | 'steel' | 'fuel' | 'electronicComponents' | 'pharmaceuticals'
  | 'processedFood' | 'fertilizer' | 'phones' | 'computers'
  // Munitions (produites par l'usine de munitions ou achetées aux autres joueurs)
  | 'munitions' | 'obus' | 'bombs';

export type MineralType = 'iron' | 'coal' | 'rareEarths' | 'precious' | 'uranium';
export type FoodResourceType = 'cereals' | 'vegetables' | 'sugarOils' | 'fodder' | 'redMeat' | 'whiteMeat' | 'dairy' | 'fish';
export type ManufacturedResourceType = 'steel' | 'fuel' | 'electronicComponents' | 'pharmaceuticals' | 'processedFood' | 'fertilizer' | 'phones' | 'computers' | 'munitions' | 'obus' | 'bombs';

export const MINERAL_TYPES: MineralType[] = ['iron', 'coal', 'rareEarths', 'precious', 'uranium'];
export const FOOD_RESOURCE_TYPES: FoodResourceType[] = ['cereals', 'vegetables', 'sugarOils', 'fodder', 'redMeat', 'whiteMeat', 'dairy', 'fish'];
export const MANUFACTURED_RESOURCE_TYPES: ManufacturedResourceType[] = ['steel', 'fuel', 'electronicComponents', 'pharmaceuticals', 'processedFood', 'fertilizer', 'phones', 'computers', 'munitions', 'obus', 'bombs'];

export interface ResourceState {
  oil:        number;
  iron:       number;
  coal:       number;
  rareEarths: number;
  precious:   number;
  uranium:    number;
  water:      number;
  // Produits agricoles
  cereals:    number;
  vegetables: number;
  sugarOils:  number;
  fodder:     number;
  // Produits de l'élevage & pêche
  redMeat:    number;
  whiteMeat:  number;
  dairy:      number;
  fish:       number;
  // Biens manufacturés
  steel:                number;
  fuel:                 number;
  electronicComponents: number;
  pharmaceuticals:      number;
  processedFood:        number;
  fertilizer:           number;
  phones:               number;
  computers:            number;
  // Munitions
  munitions:            number;
  obus:                 number;
  bombs:                number;
}

// ─── Mining ────────────────────────────────────────────────────

/** State of a single extractable mineral deposit */
export interface MineralDeposit {
  underground: number;  // total reserves still in the ground (recharges very slowly)
  machines: number;     // extraction machines owned (0–10); 0 = no extraction
  hasRefinery: boolean; // refinery enables +30% yield and −30% pollution
}

/** Mining state: oil + 5 distinct mineral deposits */
export interface MiningState {
  oil:        MineralDeposit;
  iron:       MineralDeposit;
  coal:       MineralDeposit;
  rareEarths: MineralDeposit;
  precious:   MineralDeposit;
  uranium:    MineralDeposit;
}

// ─── Agriculture ───────────────────────────────────────────────

export type CropCategory = 'cereals' | 'vegetables' | 'sugarOils' | 'fodder';
export type FarmEquipmentLevel = 'basic' | 'mechanized' | 'advanced';

export interface FarmPlot {
  category:  CropCategory;
  surface:   number;           // arbitrary units, derived from startingResources.agriculture
  fertility: number;           // 0–100
  equipment: FarmEquipmentLevel;
  inFallow:  boolean;          // force 30% exploitation for soil recovery
}

export interface AgricultureState {
  plots:          FarmPlot[];
  irrigationLevel: number;     // 0–100, upgradeable via invest action
}

// ─── Livestock ─────────────────────────────────────────────────

export type LivestockCategory = 'redMeat' | 'whiteMeat' | 'dairy';

/** State of a single livestock herd */
export interface HerdUnit {
  category:  LivestockCategory;
  total:     number;           // current herd size (float, rounded for display)
  equipment: FarmEquipmentLevel; // reuses basic/mechanized/advanced
}

/** Livestock state — 3 herd categories + shared alimentation metrics */
export interface LivestockState {
  herds: HerdUnit[];
}

// ─── Marine Resources ───────────────────────────────────────────

/** Fishing / aquaculture state — single renewable logistic stock */
export interface MarineState {
  stockTotal:   number;          // current harvestable stock (logistic renewable)
  initialStock: number;          // baseline at game start (for floor: 15%)
  equipment:    FarmEquipmentLevel; // reuses basic/mechanized/advanced
}

// ─── Sectors & Industries ──────────────────────────────────────

export type IndustrySector =
  | 'rawMaterials'
  | 'energy'
  | 'manufacturing'
  | 'electronics'
  | 'pharmaceutical'
  | 'armament'
  | 'food'
  // Nouveaux secteurs manufacturiers
  | 'chemicalPlant'
  | 'vehicleFactory'
  | 'shipyard'
  | 'aerospace'
  | 'phonesFactory'
  | 'computersFactory'
  | 'maintenanceWorkshop'
  | 'tankFactory'
  | 'militaryAirbase'
  | 'navalBase'
  | 'ammunitionFactory'
  | 'powerPlant'
  | 'nuclearPlant';

export type InfrastructureType = 'electricity' | 'telecom' | 'waterTreatment';

export type FactoryTier = 'basic' | 'advanced' | 'robotized';

export interface Factory {
  id: string;
  sector: IndustrySector;
  tier: FactoryTier;
  health: number;         // 0-100, reduced by sabotage
  pollutionRate: number;
  paused: boolean;        // paused factories skip production & maintenance
}

// ─── Research & Technology ─────────────────────────────────────

export type ResearchBranch =
  | 'agrotech'
  | 'nanotech'
  | 'cleanEnergy'
  | 'cybersecurity'
  | 'biotech'
  | 'military'
  | 'electronics'
  | 'nuclear'
  | 'counterIntelligence';

export interface ResearchState {
  globalLevel: number;          // 0-100 overall research level
  branches: Record<ResearchBranch, number>;  // 0-100 per branch
  educationLevel: number;       // 0-100
}

export interface Patent {
  id: string;
  branch: ResearchBranch;
  incomePerTurn: number;
  acquiredAtRound: number;
}

// ─── Tools ─────────────────────────────────────────────────────

export type ToolTier = 'basic' | 'advanced' | 'robotized';

export interface ToolsState {
  tier: ToolTier;
  durability: number;           // 0-100, degrades over time
  maintenanceCost: number;
}

// ─── Finance ───────────────────────────────────────────────────

export interface FinanceState {
  money: number;
  debt: number;
  inflation: number;            // 0-100
  currencyStrength: number;     // 0.5-2.0 multiplier
  creditRating: number;         // 0-100
}

// ─── Infrastructure ────────────────────────────────────────────

export interface InfrastructureState {
  electricity: number;          // 0-100 capacity
  telecom: number;
  waterTreatment: number;
}

// ─── Transport ─────────────────────────────────────────────────

export interface TransportState {
  roads: number;                // 0-100
  ports: number;                // 0-100
  airports: number;             // 0-100
  tradeCostReduction: number;   // derived from above
}

// ─── Transport Fleet (véhicules de commerce) ───────────────────

export type VehicleType = 'truck' | 'ship' | 'plane';
export type VehicleTier = 1 | 2 | 3;

export interface MaintenancePart {
  tier: 1 | 2 | 3 | 4;
  manufacturerId: string;   // playerId of the workshop owner who produced these parts
  quantity: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  tier: VehicleTier;
  capacity: number;          // unités de cargo transportables
  ageInTurns: number;        // incrémenté chaque résolution
  maxLifespan: number;       // tours avant expiration automatique
  fuelType: 'oil' | 'electric';
  fuelConsumption: number;   // unités de pétrole (ou électricité) consommées par tour actif
  createdBy: string;         // playerId of the factory owner who built this vehicle
}

export interface FleetState {
  vehicles: Vehicle[];
  totalCapacity: number;    // somme des capacités (recalculée après chaque tick)
}

// ─── Tourism ───────────────────────────────────────────────────

export interface Monument {
  id: string;
  name: string;
  incomeMultiplier: number;
  builtAtRound: number;
}

export interface TourismState {
  attractiveness: number;       // 0-100
  monuments: Monument[];
  bannedCountries: string[];    // country IDs banned from tourism
  bannedBy: string[];           // countries that banned us
  income: number;               // derived, capped at 15-20% GDP
}

// ─── Population ────────────────────────────────────────────────

export interface PopulationState {
  total: number;                // in millions (float)
  growthRate: number;           // % per turn
  healthLevel: number;          // 0-100
  happinessLevel: number;       // 0-100
  productivityMultiplier: number; // derived from happiness, education, health — smooth formula
  developmentIndex: number;     // 0-100, composite HDI (santé×0.4 + bonheur×0.3 + éducation×0.2 + infra×0.1)
  needsSatisfaction: number;    // 0-100, ratio production vs besoins vitaux (santé + eau + nourriture)
  birthRate: number;            // % per turn, proportional to ID and happiness
  mortalityRate: number;        // % per turn, proportional to health and needsSatisfaction
  consumptionMultiplier: number; // ≥0, demand scale factor for energy/luxury/health (driven by ID)
}

// ─── Military ──────────────────────────────────────────────────

export type WeaponTier = 1 | 2 | 3 | 4;
export type WeaponLicense = 'open' | 'proprietary';

export interface Weapon {
  id: string;
  tier: WeaponTier;
  name: string;
  forceBonus: number;           // +5 to +50
  license: WeaponLicense;
  sellerId: string | null;      // null if self-produced
  maintenanceCost: number;      // per turn
  efficacy: number;             // 0-100, degrades if proprietary unpaid
}

// ─── Military Units ────────────────────────────────────────────

export type MilitaryUnitType = 'infantry' | 'tanks' | 'planes' | 'warships';

/** [T1 count, T2 count, T3 count] */
export type UnitCounts = [number, number, number];

export interface MilitaryUnits {
  infantry: UnitCounts;  // freely recruitable, 3 tiers
  tanks:    UnitCounts;  // produced by tankFactory
  planes:   UnitCounts;  // produced by militaryAirbase
  warships: UnitCounts;  // produced by navalBase
}

/** Forces allouées à un front (par type et tier) */
export interface FrontAllocation {
  infantry: UnitCounts;
  tanks:    UnitCounts;
  planes:   UnitCounts;
  warships: UnitCounts;
}

export interface MilitaryState {
  armedForces: number;          // 0-100 (legacy, kept for compat)
  intelligence: number;         // 0-100
  weapons: Weapon[];
  effectiveForce: number;       // derived: includes units
  nuclearBombs: number;
  nuclearDevelopmentProgress: number; // 0-100, needs 100 to build
  maintenanceCost: number;      // derived
  bombs: number;                // conventional bombs (legacy, use resources.bombs instead)
  planes: number;               // for bombardment (tier 2+, legacy)
  units: MilitaryUnits;         // reserve pool (undeployed)
}

// ─── Terrain ───────────────────────────────────────────────────

export type TerrainType = 'plains' | 'mountain' | 'urban' | 'coast' | 'forest';

// ─── Regions ───────────────────────────────────────────────────

export interface Region {
  id: string;
  name: string;
  population: number;
  productionCapacity: number;   // 0-100
  terrain: TerrainType;         // terrain type for combat modifiers
  destroyed: boolean;           // nuclear strike
  destroyedUntilRound: number | null;
  occupiedBy: string | null;    // player ID if conquered
  resistanceRemaining: number;  // turns of -30% productivity
  // War front tracking (when this region is actively contested)
  warIntegrity: number;         // 0-100, starts at 100; region captured when 0
  contestedByWarId: string | null; // ID of the war contesting this region
  fortified: boolean; // permanent fortification bonus (survives capture)
}

// ─── Countries ─────────────────────────────────────────────────

export interface CountryProfile {
  id: string;
  name: string;
  flag: string;                 // emoji flag
  description: string;
  startingResources: ResourceState;
  startingMoney: number;
  startingPopulation: number;
  regions: { name: string; terrain?: TerrainType }[];  // 5-6 regions
  strengths: string[];          // display only
  weaknesses: string[];         // display only
  // Asymmetric starting bonuses
  bonuses: {
    researchBonus: number;      // 0-20
    militaryBonus: number;      // 0-20
    tradeBonus: number;         // 0-20
    agricultureBonus: number;   // 0-20
  };
  // Factories pre-built for this country at game start
  startingFactories?: Array<{ sector: IndustrySector; tier: FactoryTier }>;
}

// ─── Organizations ─────────────────────────────────────────────

export type OrganizationType = 'commercial' | 'military';

export type VoteType = 'embargo' | 'embargoRenewal' | 'aidRequest' | 'expelMember';

export interface OrgVote {
  id: string;
  type: VoteType;
  description: string;
  proposedBy: string;
  votes: Record<string, boolean | null>;    // playerId → for/against/null (expelMember)
  amounts: Record<string, number | null>;   // playerId → amount/rate/null (embargo, aidRequest)
  requiredMajority: number;
  result: 'pending' | 'passed' | 'rejected';
  roundProposed: number;
  targetId?: string;         // embargo: playerId du pays cible
  targetName?: string;       // embargo: nom affiché
  motivationText?: string;   // aidRequest: texte de demande
  resolvedAmount?: number;   // taux ou montant final après résolution
}

export interface OrgEmbargo {
  targetId: string;
  targetName: string;
  rate: number;              // ex. 0.35 = 35% de taxe totale
  turnsRemaining: number;
  originVoteId: string;
}

export interface OrgJoinRequest {
  id: string;
  orgId: string;
  requesterId: string;
  requesterName: string;
  votes: Record<string, boolean | null>;  // memberId → vote (null = not yet voted)
  result: 'pending' | 'passed' | 'rejected';
  roundProposed: number;
}

export interface PendingOrg {
  id: string;
  name: string;
  type: OrganizationType;
  creatorId: string;
  creatorName: string;
  acceptedIds: string[];   // creator + those who accepted
  pendingIds: string[];    // invited but haven't responded yet
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  memberIds: string[];
  treasury: number;
  activeVotes: OrgVote[];
  activeEmbargos: OrgEmbargo[];
  joinRequests: OrgJoinRequest[];
  createdAtRound: number;
}

// ─── Trade ─────────────────────────────────────────────────────

export type ProductCategory =
  | 'rawAgricultural'
  | 'energy'
  | 'minerals'
  | 'manufactured'
  | 'electronics'
  | 'industrialEquipment'
  | 'pharmaceutical'
  | 'armament'
  | 'luxury'
  | 'financial'
  | 'infrastructure'
  | 'processedFood';

export interface VehicleTradeItem {
  vehicleType: VehicleType;
  tier: VehicleTier;
  quantity: number;
}

export interface MilitaryUnitTradeItem {
  unitType: 'tanks' | 'planes' | 'warships';
  tier: 1 | 2 | 3;
  quantity: number;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  offer: { resource: ResourceType; quantity: number }[];  // concrete resources (oil, iron, etc.)
  vehicles?: VehicleTradeItem[];                          // vehicles included in the offer
  maintenanceParts?: { tier: 1 | 2 | 3 | 4; quantity: number }[];  // spare parts (branded to seller)
  militaryUnits?: MilitaryUnitTradeItem[];                // combat units (tanks/planes/warships)
  moneyAmount: number;  // amount the buyer (toId) pays
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'completed' | 'auctioning';
  roundProposed: number;
}

// ─── Region Purchase ────────────────────────────────────────────

export interface RegionPurchaseOffer {
  id: string;
  fromId: string;      // buyer
  toId: string;        // seller (current region owner)
  regionId: string;
  regionName: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  roundProposed: number;
}

// ─── Trade Auction ──────────────────────────────────────────────
export interface TradeAuction {
  id: string;
  tradeId: string;
  fromId: string;       // seller (cannot bid)
  fromName: string;
  offer: { resource: ResourceType; quantity: number }[];
  vehicles?: VehicleTradeItem[];
  basePrice: number;    // original ask price
  currentPrice: number; // current winning bid
  currentWinnerId: string;
  currentWinnerName: string;
  expiresAt: number;    // Unix ms timestamp
}

// ─── Sanctions ─────────────────────────────────────────────────

export interface Sanction {
  id: string;
  targetId: string;
  imposedBy: string;            // playerId or orgId
  type: 'trade' | 'tourism' | 'full';
  tradeSurcharge: number;       // +30% if unilateral
  roundImposed: number;
  evidence: 'proof' | 'suspicion' | 'none';
}

// ─── War ───────────────────────────────────────────────────────

/** Ordre d'attaque province → province (soumis pendant actionSelection) */
export interface AttackOrder {
  fromRegionId: string;   // province source (appartient à l'attaquant)
  toRegionId:   string;   // province cible (doit être adjacente)
  units:        MilitaryUnits; // unités engagées dans cette attaque
}

/** Allocation de forces soumise par un joueur pour un tour de guerre */
export interface WarAllocationSubmission {
  warId: string;
  fronts: {
    regionId: string;
    forces: FrontAllocation;
  }[];
}

export interface War {
  id: string;
  attackerId: string;
  defenderId: string;
  startedAtRound: number;
  duration: number;             // turns elapsed
  attackerForce: number;        // effective force at start (legacy)
  defenderForce: number;
  regionsConquered: string[];   // region IDs (fully captured)
  armisticeProposedBy: string | null;
  status: 'active' | 'armistice' | 'victory_attacker' | 'victory_defender';
  // New: allocation submitted by attacker/defender for this turn
  attackerAllocation: WarAllocationSubmission | null;
  defenderAllocation: WarAllocationSubmission | null;
}

// ─── Bombardment & Threats ─────────────────────────────────────

export type ThreatStatus = 'pending' | 'accepted' | 'refused' | 'executed' | 'withdrawn';

/** Infrastructures réelles du jeu pouvant être ciblées par une menace */
export type ThreatInfraTarget =
  | 'electricity'          // −30% production industrielle, 4 tours
  | 'telecom'              // −25% PIB, −15% influence, 3 tours
  | 'waterTreatment'       // −25% santé population, 4 tours
  | 'factories_food'       // −40% revenus agroalimentaires, 3 tours
  | 'factories_energy'     // −40% revenus énergie, 3 tours
  | 'factories_armament'   // −40% revenus armement + −10 forces armées
  | 'military';            // −30 forces armées, −25% force effective, 2 tours

/** Type de demande dans une menace diplomatique */
export type ThreatDemandType =
  | 'money'                // payer X millions
  | 'resource'             // livrer X unités d'une ressource
  | 'military_withdrawal'  // réduire les forces armées de 20
  | 'lift_sanctions';      // lever les sanctions actives

export interface ThreatDemand {
  type:          ThreatDemandType;
  amount?:       number;       // pour 'money' (en €) ou 'resource' (quantité)
  resourceType?: ResourceType; // pour 'resource'
}

export interface Threat {
  id: string;
  attackerId: string;
  targetId: string;
  targetInfrastructure: ThreatInfraTarget;
  demand:               ThreatDemand;
  status: ThreatStatus;
  roundDeclared: number;
  deadlineRound: number;
}

// ─── Espionage ─────────────────────────────────────────────────

export type SabotageOutcome =
  | 'success_invisible'
  | 'success_suspicion'
  | 'success_proof'
  | 'failed_undetected'
  | 'failed_detected';

export interface EspionageResult {
  id: string;
  attackerId: string;
  targetId: string;
  targetDescription: string;    // what was targeted
  outcome: SabotageOutcome;
  damagePercent: number;        // 0 if failed, 10-15 if success
  damageDuration: number;       // turns
  roundExecuted: number;
}

// ─── Market Events ─────────────────────────────────────────────

export type MarketEventType =
  | 'drought'
  | 'techBoom'
  | 'pandemic'
  | 'stockCrash'
  | 'corruption'
  | 'mineDiscovery'
  | 'oilSpill'
  | 'tradeAgreement'
  | 'earthquake'
  | 'greenRevolution'
  | 'dataLeak'
  | 'housingBubble'
  | 'migration'
  | 'oilEmbargo'
  | 'innovation'
  | 'none';

export interface MarketEvent {
  type: MarketEventType;
  title: string;
  description: string;
  scope: 'global' | 'local';
  targetPlayerId: string | null;  // for local events
  effects: string;                // human-readable effect description
  duration: number;               // turns
}

// ─── Player Actions ────────────────────────────────────────────

export type ActionType =
  | 'invest'
  | 'research'
  | 'trade'
  | 'diplomacy'
  | 'sabotage'
  | 'defend'
  | 'war'
  | 'threat'
  | 'armistice'
  | 'bombardment'
  | 'nuclear'
  | 'buildMonument'
  | 'buildWeapon'
  | 'developNuclear'
  | 'buyRegion';

export interface PlayerAction {
  type: ActionType;
  // Contextual data depending on type
  targetPlayerId?: string;
  sector?: IndustrySector;
  infrastructureType?: InfrastructureType;
  researchBranch?: ResearchBranch;
  tradeOffer?: Omit<TradeOffer, 'id' | 'status' | 'roundProposed'>;
  orgAction?: {
    orgId?: string;
    action: 'create' | 'vote' | 'leave' | 'proposeEmbargo' | 'proposeAidRequest' | 'castAmountVote';
    vote?: boolean;          // expelMember : pour/contre
    amount?: number;         // embargo : taux proposé (0–1) | aidRequest : montant proposé
    voteId?: string;
    name?: string;
    type?: OrganizationType;
    invitedPlayerIds?: string[];
    targetId?: string;       // embargo : playerId du pays cible
    motivationText?: string; // aidRequest : texte de motivation
  };
  weaponTier?: WeaponTier;
  regionId?: string;
  regionPrice?: number;
  threatData?: {
    infrastructureTarget: ThreatInfraTarget;
    demand: ThreatDemand;
  };
  factoryTier?: FactoryTier;
  toolTier?: ToolTier;
  transportType?: 'roads' | 'ports' | 'airports';
  infrastructureTarget?: InfrastructureType;
  monumentName?: string;
  militaryUpgrade?: boolean; // investir dans les forces armées (+5 niveaux)
  miningAction?: {           // acheter machine ou raffinerie
    resource: 'oil' | MineralType;
    type: 'machine' | 'refinery';
  };
  farmAction?: {             // actions agricoles
    plotCategory?: CropCategory;  // undefined for global (irrigation)
    type: 'upgradeEquipment' | 'toggleFallow' | 'investIrrigation';
  };
  livestockAction?: {        // actions élevage
    herdCategory: LivestockCategory;
    type: 'upgradeEquipment';
  };
  marineAction?: {           // actions pêche/aquaculture
    type: 'upgradeEquipment';
  };
  factoryReconversion?: {    // reconvertir une usine existante (gratuit en slots d'action)
    factoryId: string;
    newSector: IndustrySector;
  };
  vehicleAction?: {          // acheter un véhicule de transport
    vehicleType: VehicleType;
    tier: VehicleTier;
  };
  isFreeAction?: boolean;    // si true : ne consomme pas de slot d'action
}

// ─── Resolution Log ────────────────────────────────────────────

export type ResolutionStep =
  | 'defense'
  | 'sabotage'
  | 'war'
  | 'production'
  | 'commerce'
  | 'events'
  | 'population'
  | 'score';

export interface ResolutionEntry {
  step: ResolutionStep;
  playerId?: string;
  targetId?: string;
  description: string;          // human-readable (French)
  icon: string;                 // emoji
  positive: boolean;            // green or red in UI
  details?: Record<string, unknown>;
}

// ─── Game Configuration ────────────────────────────────────────

export interface GameConfig {
  actionTimerSeconds: number;   // default 90
  actionsPerTurn: number;       // default 6
  startingCapital: number;      // default 5000
  earlyVictoryEnabled: boolean; // default false
  earlyVictoryThreshold: number; // score threshold if enabled
  countryDraftMode: 'draft' | 'random'; // default 'draft'
  draftTimerSeconds: number;    // default 30
  minPlayers: number;           // default 4
  maxPlayers: number;           // default 12
}

export const DEFAULT_CONFIG: GameConfig = {
  actionTimerSeconds: 90,
  actionsPerTurn: 6,
  startingCapital: 5000,
  earlyVictoryEnabled: false,
  earlyVictoryThreshold: 50000,
  countryDraftMode: 'draft',
  draftTimerSeconds: 30,
  minPlayers: 2,
  maxPlayers: 12,
};

// ─── Score & Leaderboard ───────────────────────────────────────

export type WealthTier =
  | 'startup'         // < 5000
  | 'emerging'        // 5000 - 15000
  | 'developed'       // 15000 - 30000
  | 'superpower'      // 30000 - 50000
  | 'hegemon';        // > 50000

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  countryName: string;
  countryFlag: string;
  score: number;
  gdp: number;
  happinessPopulation: number;
  influence: number;
  wealthTier: WealthTier;
  rank: number;
  abandoned: boolean;
}

// ─── Journal ───────────────────────────────────────────────────

export interface JournalHeadline {
  text: string;
  tone: 'satirical' | 'dramatic' | 'mocking';
  relatedPlayerIds: string[];
}

// ─── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | 'sabotage_suffered'
  | 'sabotage_failed'
  | 'sabotage_detected'
  | 'war_declared'
  | 'war_ended'
  | 'armistice_offer'
  | 'armistice_concluded'
  | 'threat_received'
  | 'threat_resolved'
  | 'trade_received'
  | 'trade_completed'
  | 'org_vote_started'
  | 'org_expelled'
  | 'sanction_imposed'
  | 'weapon_degraded'
  | 'nuclear_alert'
  | 'player_abandoned'
  | 'event_local';

export interface GameNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  round: number;
  read: boolean;
}

// ─── Public State (broadcast to all) ───────────────────────────

export interface PublicPlayerInfo {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  countryFlag: string;
  score: number;
  wealthTier: WealthTier;
  gdp: number;
  connected: boolean;
  abandoned: boolean;
  ready: boolean;
  actionsSubmitted: boolean;
  // Visible military info (approximate)
  militaryPower: 'weak' | 'moderate' | 'strong' | 'superpower';
  atWar: boolean;
  organizationIds: string[];
  // Territory — visible to all players
  regions: Region[];
  population: number;         // total in millions (display only)
}

export interface PublicWarInfo {
  id: string;
  attackerName: string;
  attackerId: string;
  defenderName: string;
  defenderId: string;
  duration: number;
  status: War['status'];
  armisticeProposedBy: string | null;
}

export interface PublicThreatInfo {
  id: string;
  attackerName: string;
  attackerId: string;
  targetName: string;
  targetId: string;
  demand: ThreatDemand;
  status: ThreatStatus;
  deadlineRound: number;
}

export interface EcoWarPublicGameState {
  phase: EcoWarPhase;
  currentRound: number;
  config: GameConfig;
  timer: number | null;           // remaining seconds
  hostId: string;
  players: PublicPlayerInfo[];
  leaderboard: LeaderboardEntry[];
  activeWars: PublicWarInfo[];
  organizations: Organization[];   // orgs are public info
  marketEvent: MarketEvent | null;
  journalHeadlines: JournalHeadline[];
  pendingThreats: PublicThreatInfo[];
  activeSanctions: Array<{ targetId: string; imposedBy: string; type: Sanction['type'] }>;
  activeAuctions: TradeAuction[];
  pendingOrgs: PendingOrg[];
}

// ─── Private State (sent to individual player) ─────────────────

export interface EcoWarPrivatePlayerState {
  playerId: string;
  money: number;
  resources: ResourceState;
  population: PopulationState;
  happiness: number;
  health: number;
  pollution: number;
  regions: Region[];
  factories: Factory[];
  research: ResearchState;
  patents: Patent[];
  tools: ToolsState;
  finance: FinanceState;
  infrastructure: InfrastructureState;
  transport: TransportState;
  tourism: TourismState;
  military: MilitaryState;
  mining: MiningState;
  agriculture: AgricultureState;
  livestock: LivestockState;
  marine: MarineState;
  fleet: FleetState;
  maintenanceParts: MaintenancePart[];
  troopsByRegion: Record<string, MilitaryUnits>;           // regionId → deployed units (from reserve)
  exhaustedTroopsByRegion: Record<string, MilitaryUnits>;  // regionId → troops that already moved this turn
  enemyTroopsByRegion: Record<string, { playerId: string; playerName: string; units: MilitaryUnits }[]>; // regionId → enemy troops (all enemies in same province)
  productionChoices: Partial<Record<IndustrySector, {
    vehicleType?: VehicleType;
    vehicleTier?: VehicleTier;
    weaponTier?: 1 | 2 | 3 | 4;
    partTier?: 1 | 2 | 3 | 4;
    ammoType?: 'munitions' | 'obus' | 'bombs';
  }>>;
  availableActions: number;
  submittedActions: PlayerAction[] | null;
  espionageResults: EspionageResult[];
  incomingTrades: TradeOffer[];
  incomingRegionPurchases: RegionPurchaseOffer[];
  notifications: GameNotification[];
  organizationMemberships: string[];
  activeSanctions: Sanction[];
  gdp: number;
  influence: number;
  score: number;
  // Production summary per factory (what it produces this turn)
  factoryProduction: FactoryProductionInfo[];
  // Alerts: clear penalties with precise numbers
  alerts: AlertInfo[];
}

export interface FactoryProductionInfo {
  factoryId: string;
  sector: string;
  tier: string;
  output: string;          // e.g. "12 acier/tour", "Camion T1 (73%)"
  productionRate: number;  // 0-100%, actual effective rate
}

export interface AlertInfo {
  icon: string;
  label: string;           // e.g. "Bonheur bas"
  detail: string;          // e.g. "Productivité réduite à 65%"
  severity: 'warning' | 'critical';
}
