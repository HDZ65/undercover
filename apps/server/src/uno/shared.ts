// Types
export type CardColor = 'red' | 'blue' | 'green' | 'yellow';
export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2';
export type WildCardValue = 'wild' | 'wild-draw4';

export interface Card {
  id: string;
  color: CardColor | null;
  value: CardValue | WildCardValue;
}

export type PlayDirection = 'clockwise' | 'counterclockwise';
export type UnoGamePhase = 'lobby' | 'dealing' | 'playerTurn' | 'colorChoice' | 'challengeWD4' | 'roundOver' | 'gameOver';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  handSize: number;
  hasCalledUno: boolean;
}

export interface HouseRules {
  stackDrawTwo: boolean;
  stackDrawFour: boolean;
  bluffChallenge: boolean;
  forcePlay: boolean;
}

export interface PlayerScore {
  playerId: string;
  roundScore: number;
  totalScore: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar?: string;
  handSize: number;
  hasCalledUno: boolean;
  isConnected: boolean;
}

// Events
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void;
  'room:leave': () => void;
  'game:startGame': (data: { houseRules: HouseRules; targetScore: number; turnTimer: number }) => void;
  'game:playCard': (data: { cardId: string }) => void;
  'game:playCards': (data: { cardIds: string[] }) => void;
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


/** Animation type for game events visible to all players */
export type GameAnimationType = 'draw2' | 'wildDraw4' | 'skip' | 'reverse' | 'uno' | 'multiCard';

export interface GameAnimationEvent {
  type: GameAnimationType;
  sourcePlayerId: string;
  sourcePlayerName: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  card?: Card;
  cards?: Card[];
  cardsDrawn?: number;
}
export interface ServerToClientEvents {
  'room:created': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:joined': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'room:hostChanged': (data: { hostId: string }) => void;
  'game:state': (data: { publicState: PublicGameState; privateState: PrivatePlayerState }) => void;
  'game:roundOver': (data: { scores: PlayerScore[] }) => void;
  'game:gameOver': (data: { winner: string; scores: PlayerScore[] }) => void;
  'game:animation': (data: GameAnimationEvent) => void;
}

// Constants
export const CARD_POINTS: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'skip': 20, 'reverse': 20, 'draw2': 20, 'wild': 50, 'wild-draw4': 50,
};
export const DEFAULT_TARGET_SCORE = 500;
export const DEFAULT_TURN_TIMER = 30;
export const INITIAL_HAND_SIZE = 7;
export const UNO_CATCH_WINDOW_MS = 5000;
export const UNO_PENALTY_CARDS = 2;
export const DISCONNECT_GRACE_MS = 90_000;
export const BOT_PLAY_DELAY_MS = 1000;
export const DECK_SIZE = 108;
