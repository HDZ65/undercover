/**
 * Empire du Commerce — Server-only Types
 * Internal state not exposed to clients
 */

import type {
  ResourceState,
  PopulationState,
  Factory,
  ResearchState,
  Patent,
  ToolsState,
  FinanceState,
  InfrastructureState,
  TransportState,
  TourismState,
  MilitaryState,
  MilitaryUnits,
  MiningState,
  AgricultureState,
  LivestockState,
  MarineState,
  FleetState,
  MaintenancePart,
  Region,
  PlayerAction,
  EspionageResult,
  TradeOffer,
  RegionPurchaseOffer,
  Sanction,
  GameNotification,
  GameConfig,
  Organization,
  War,
  Threat,
  MarketEvent,
  JournalHeadline,
  ResolutionEntry,
  LeaderboardEntry,
  EcoWarPhase,
  IndustrySector,
  VehicleType,
  VehicleTier,
  WarAllocationSubmission,
} from '@undercover/shared';

/** Full player state — server only, never sent to clients directly */
export interface ServerPlayerState {
  id: string;
  name: string;
  token: string;
  socketId: string | null;
  countryId: string;
  countryName: string;
  countryFlag: string;
  connected: boolean;
  disconnectedAt: number | null;
  abandoned: boolean;
  ready: boolean;
  actionsSubmitted: boolean;

  // ─── Economy ───
  money: number;
  resources: ResourceState;
  factories: Factory[];
  tools: ToolsState;
  finance: FinanceState;
  infrastructure: InfrastructureState;
  transport: TransportState;
  tourism: TourismState;

  // ─── Population & Social ───
  population: PopulationState;
  pollution: number;

  // ─── Research ───
  research: ResearchState;
  patents: Patent[];

  // ─── Military ───
  military: MilitaryState;

  // ─── Mining (geological resources) ───
  mining: MiningState;

  // ─── Agriculture ───
  agriculture: AgricultureState;

  // ─── Livestock ───
  livestock: LivestockState;

  // ─── Marine ───
  marine: MarineState;

  // ─── Transport Fleet ───
  fleet: FleetState;
  maintenanceParts: MaintenancePart[];
  /** Accumulateur de production fractionnaire de véhicules/armes/unités (server-only) */
  vehicleProductionQueue: Record<string, number>; // e.g. { 'vehicleFactory': 0.75, 'armament': 1.2 }
  /** War allocations submitted by this player for the current turn */
  pendingWarAllocations: WarAllocationSubmission[];
  /** Province-level attack orders submitted this turn (résolus en résolution) */
  pendingAttackOrders: import('@undercover/shared').AttackOrder[];
  /** Per-region troop deployment (troops moved out of reserve to specific regions) */
  troopsByRegion: Record<string, MilitaryUnits>;
  /** Troops that already moved this turn (can't move again) — cleared at resolution */
  exhaustedTroopsByRegion: Record<string, MilitaryUnits>;
  /** Choix de production par secteur pour ce tour */
  productionChoices: Partial<Record<IndustrySector, {
    vehicleType?: VehicleType;
    vehicleTier?: VehicleTier;
    weaponTier?: 1 | 2 | 3 | 4;
    partTier?: 1 | 2 | 3 | 4;
    ammoType?: 'munitions' | 'obus' | 'bombs';
  }>>;

  // ─── Regions ───
  regions: Region[];

  // ─── Diplomacy ───
  organizationMemberships: string[];
  activeSanctions: Sanction[];

  // ─── Turn State ───
  submittedActions: PlayerAction[];
  availableActions: number;

  // ─── Derived / Cached ───
  gdp: number;
  influence: number;
  score: number;
  accumulatedBanPenalty: number;  // GDD: -5% influence per tourism ban imposed

  // ─── Private Info ───
  espionageResults: EspionageResult[];
  incomingTrades: TradeOffer[];
  incomingRegionPurchases: RegionPurchaseOffer[];
  notifications: GameNotification[];

  // ─── Temporary Effects ───
  activeEffects: TemporaryEffect[];
}

export interface TemporaryEffect {
  id: string;
  type: string;            // e.g., 'sabotage_damage', 'war_reconstruction', 'bombardment'
  description: string;
  affectedSector?: string;
  modifier: number;        // e.g., -0.15 for -15%
  remainingTurns: number;
}

/** Full game context — lives inside XState machine */
export interface EcoWarGameContext {
  roomCode: string;
  hostId: string;
  config: GameConfig;
  phase: EcoWarPhase;
  currentRound: number;

  players: Map<string, ServerPlayerState>;
  turnOrder: string[];       // player IDs in draft order

  // ─── Diplomacy & Conflict ───
  organizations: Organization[];
  activeWars: War[];
  activeThreats: Threat[];
  activeTrades: TradeOffer[];

  // ─── Resolution ───
  resolutionLog: ResolutionEntry[];
  marketEvents: MarketEvent[];
  journalHeadlines: JournalHeadline[];

  // ─── Leaderboard ───
  leaderboard: LeaderboardEntry[];

  // ─── Country Selection ───
  availableCountries: string[];
  currentDraftIndex: number;
}
