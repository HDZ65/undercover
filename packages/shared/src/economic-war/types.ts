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

export type ResourceType = 'oil' | 'minerals' | 'agriculture' | 'water';

export interface ResourceState {
  oil: number;
  minerals: number;
  agriculture: number;
  water: number;
}

// ─── Sectors & Industries ──────────────────────────────────────

export type IndustrySector =
  | 'rawMaterials'
  | 'energy'
  | 'manufacturing'
  | 'electronics'
  | 'pharmaceutical'
  | 'armament'
  | 'luxury'
  | 'food';

export type InfrastructureType = 'electricity' | 'telecom' | 'waterTreatment';

export type FactoryTier = 'basic' | 'advanced' | 'robotized';

export interface Factory {
  id: string;
  sector: IndustrySector;
  tier: FactoryTier;
  health: number;         // 0-100, reduced by sabotage
  pollutionRate: number;
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
  | 'nuclear';

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
  productivityMultiplier: number; // derived from happiness, education, health
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

export interface MilitaryState {
  armedForces: number;          // 0-100
  intelligence: number;         // 0-100
  weapons: Weapon[];
  effectiveForce: number;       // derived: armedForces + weapons + research bonus
  nuclearBombs: number;
  nuclearDevelopmentProgress: number; // 0-100, needs 100 to build
  maintenanceCost: number;      // derived
  bombs: number;                // conventional bombs (consumable)
  planes: number;               // for bombardment (tier 2+)
}

// ─── Regions ───────────────────────────────────────────────────

export interface Region {
  id: string;
  name: string;
  population: number;
  productionCapacity: number;   // 0-100
  destroyed: boolean;           // nuclear strike
  destroyedUntilRound: number | null;
  occupiedBy: string | null;    // player ID if conquered
  resistanceRemaining: number;  // turns of -30% productivity
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
  regions: { name: string }[];  // 5-6 regions
  strengths: string[];          // display only
  weaknesses: string[];         // display only
  // Asymmetric starting bonuses
  bonuses: {
    researchBonus: number;      // 0-20
    militaryBonus: number;      // 0-20
    tradeBonus: number;         // 0-20
    agricultureBonus: number;   // 0-20
  };
}

// ─── Organizations ─────────────────────────────────────────────

export type OrganizationType = 'commercial' | 'military' | 'diplomatic';

export type VoteType =
  | 'tradeAgreement'
  | 'expelMember'
  | 'structuralChange'
  | 'jointInvestment'
  | 'militaryIntervention'
  | 'sanctions'
  | 'custom';

export interface OrgVote {
  id: string;
  type: VoteType;
  description: string;
  proposedBy: string;
  votes: Record<string, boolean | null>; // playerId → for/against/null(not voted)
  requiredMajority: number;     // 0.5 for simple, 0.8 for structural
  result: 'pending' | 'passed' | 'rejected';
  roundProposed: number;
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  memberIds: string[];
  cotisationRate: number;       // % of GDP per turn (0.5-2)
  treasury: number;
  transactionFeeReduction: number; // % reduction for members
  activeVotes: OrgVote[];
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

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  offer: { product: ProductCategory; quantity: number }[];
  moneyAmount: number;  // amount the buyer (toId) pays
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  roundProposed: number;
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

export interface War {
  id: string;
  attackerId: string;
  defenderId: string;
  startedAtRound: number;
  duration: number;             // turns elapsed
  attackerForce: number;        // effective force at start
  defenderForce: number;
  regionsConquered: string[];   // region IDs
  armisticeProposedBy: string | null;
  status: 'active' | 'armistice' | 'victory_attacker' | 'victory_defender';
}

// ─── Bombardment & Threats ─────────────────────────────────────

export type ThreatStatus = 'pending' | 'accepted' | 'refused' | 'executed' | 'withdrawn';

export interface Threat {
  id: string;
  attackerId: string;
  targetId: string;
  targetInfrastructure: string; // description of what's targeted
  demand: string;               // what the attacker wants
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
  | 'armistice'
  | 'bombardment'
  | 'nuclear'
  | 'buildMonument'
  | 'buildWeapon'
  | 'developNuclear';

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
    action: 'create' | 'vote' | 'leave' | 'proposeVote';
    vote?: boolean;
    voteId?: string;
    name?: string;
    type?: OrganizationType;
    invitedPlayerIds?: string[];
    proposal?: string;
  };
  weaponTier?: WeaponTier;
  threatData?: {
    targetInfrastructure: string;
    demand: string;
  };
  factoryTier?: FactoryTier;
  toolTier?: ToolTier;
  transportType?: 'roads' | 'ports' | 'airports';
  infrastructureTarget?: InfrastructureType;
  monumentName?: string;
  militaryUpgrade?: boolean; // investir dans les forces armées (+5 niveaux)
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
  demand: string;
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
  availableActions: number;
  submittedActions: PlayerAction[] | null;
  espionageResults: EspionageResult[];
  incomingTrades: TradeOffer[];
  notifications: GameNotification[];
  organizationMemberships: string[];
  activeSanctions: Sanction[];
  gdp: number;
  influence: number;
  score: number;
}
