import type { Card, CardColor, HouseRules, Player, PlayerScore, PublicPlayer, UnoGamePhase } from './types';

// --- Client -> Server events ---
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void;
  'room:leave': () => void;

  'game:startGame': (data: { houseRules: HouseRules; targetScore: number; turnTimer: number }) => void;
  'game:playCard': (data: { cardId: string }) => void;
  'game:drawCard': () => void;
  'game:callUno': () => void;
  'game:catchUno': (data: { playerId: string }) => void;
  'game:chooseColor': (data: { color: CardColor }) => void;
  'game:challengeWD4': () => void;
  'game:acceptWD4': (data: { accepted: boolean }) => void;
  'game:setHouseRules': (data: { houseRules: HouseRules }) => void;
  'game:setTargetScore': (data: { targetScore: number }) => void;
  'game:setTurnTimer': (data: { turnTimer: number }) => void;
  'game:continueNextRound': () => void;
  'game:resetGame': () => void;
}

// --- Server -> Client events ---

/** Public game state broadcast to all players in room (NO secrets) */
export interface PublicGameState {
  phase: UnoGamePhase;
  players: PublicPlayer[];
  currentPlayerId: string;
  playDirection: 'clockwise' | 'counterclockwise';
  discardTop: Card | null;
  drawPileSize: number;
  turnTimeRemaining: number;
  houseRules: HouseRules;
  targetScore: number;
  turnTimer: number;
  scores: PlayerScore[];
  roomCode: string;
  hostId: string;
}

/** Private state sent only to specific player (contains secrets) */
export interface PrivatePlayerState {
  playerId: string;
  playerToken: string;
  hand: Card[];
  isHost: boolean;
  canPlayCards: Card[];
  canDraw: boolean;
  canCallUno: boolean;
  canCatchUno: boolean;
  mustChooseColor: boolean;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:joined': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'room:hostChanged': (data: { hostId: string }) => void;

  'game:state': (data: { publicState: PublicGameState; privateState: PrivatePlayerState }) => void;
  'game:roundOver': (data: { scores: PlayerScore[] }) => void;
  'game:gameOver': (data: { winner: string; scores: PlayerScore[] }) => void;
}
