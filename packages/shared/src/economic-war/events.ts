/**
 * Empire du Commerce — Socket.io Event Type Definitions
 * Contract between client and server
 */

import type {
  GameConfig,
  EcoWarPublicGameState,
  EcoWarPrivatePlayerState,
  PlayerAction,
  TradeOffer,
  ProductCategory,
  OrganizationType,
  ResolutionEntry,
  MarketEvent,
  JournalHeadline,
  GameNotification,
  Organization,
  Threat,
  ThreatStatus,
  CountryProfile,
} from './types';

// ─── Client → Server Events ───────────────────────────────────

export interface EcoWarClientToServerEvents {
  // --- Room Management ---
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: {
    roomCode: string;
    playerName: string;
    playerToken?: string;
  }) => void;
  'room:leave': () => void;

  // --- Lobby ---
  'game:setConfig': (data: { config: Partial<GameConfig> }) => void;
  'game:startGame': () => void;

  // --- Country Selection ---
  'game:selectCountry': (data: { countryId: string }) => void;

  // --- Gameplay ---
  'game:submitActions': (data: { actions: PlayerAction[] }) => void;
  'game:ready': () => void;
  'game:abandon': () => void;

  // --- Trade ---
  'trade:propose': (data: {
    targetId: string;
    offer: { product: ProductCategory; quantity: number }[];
    moneyAmount: number;
  }) => void;
  'trade:respond': (data: { tradeId: string; accepted: boolean }) => void;

  // --- Organizations ---
  'org:create': (data: {
    name: string;
    type: OrganizationType;
    invitedPlayerIds: string[];
  }) => void;
  'org:vote': (data: { orgId: string; voteId: string; vote: boolean }) => void;
  'org:leave': (data: { orgId: string }) => void;
  'org:proposeVote': (data: {
    orgId: string;
    type: string;
    description: string;
  }) => void;

  // --- Sanctions ---
  'sanction:apply': (data: {
    targetId: string;
    type: 'trade' | 'tourism' | 'full';
  }) => void;
  'sanction:lift': (data: { sanctionId: string }) => void;

  // --- Threats & Bombardment ---
  'threat:declare': (data: {
    targetId: string;
    targetInfrastructure: string;
    demand: string;
  }) => void;
  'threat:respond': (data: { threatId: string; accepted: boolean }) => void;
  'threat:execute': (data: { threatId: string }) => void;
  'threat:withdraw': (data: { threatId: string }) => void;

  // --- Chat ---
  'chat:message': (data: {
    channel: 'public' | string;   // 'public' or playerId for DM
    message: string;
  }) => void;
}

// ─── Server → Client Events ───────────────────────────────────

export interface EcoWarServerToClientEvents {
  // --- Room ---
  'room:created': (data: {
    roomCode: string;
    playerId: string;
    playerToken: string;
  }) => void;
  'room:joined': (data: {
    playerId: string;
    playerToken: string;
  }) => void;
  'room:error': (data: { message: string }) => void;
  'room:hostChanged': (data: { hostId: string }) => void;

  // --- Game State ---
  'game:publicState': (data: EcoWarPublicGameState) => void;
  'game:privateState': (data: EcoWarPrivatePlayerState) => void;
  'game:phaseChanged': (data: { phase: string; timer?: number }) => void;
  'game:timerTick': (data: { remaining: number }) => void;
  'game:countryList': (data: { countries: CountryProfile[]; takenIds: string[] }) => void;

  // --- Resolution ---
  'resolution:step': (data: { step: string; entries: ResolutionEntry[] }) => void;
  'resolution:complete': (data: { roundSummary: ResolutionEntry[] }) => void;

  // --- Trade ---
  'trade:incoming': (data: { trade: TradeOffer }) => void;
  'trade:result': (data: { tradeId: string; accepted: boolean }) => void;

  // --- Organizations ---
  'org:updated': (data: { org: Organization }) => void;
  'org:voteStarted': (data: { orgId: string; voteId: string; description: string }) => void;

  // --- Threats ---
  'threat:received': (data: { threat: Threat }) => void;
  'threat:resolved': (data: { threatId: string; status: ThreatStatus }) => void;

  // --- Market & Journal ---
  'market:event': (data: { event: MarketEvent }) => void;
  'journal:headlines': (data: { headlines: JournalHeadline[] }) => void;

  // --- Notifications ---
  'notification:alert': (data: GameNotification) => void;

  // --- Chat ---
  'chat:message': (data: {
    from: string;
    fromName: string;
    channel: 'public' | string;
    message: string;
    timestamp: number;
  }) => void;
}
