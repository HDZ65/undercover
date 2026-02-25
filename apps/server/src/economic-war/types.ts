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
  Region,
  PlayerAction,
  EspionageResult,
  TradeOffer,
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

  // ─── Private Info ───
  espionageResults: EspionageResult[];
  incomingTrades: TradeOffer[];
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
