/**
 * Poker Type Definitions
 * All monetary values are in centimes (integers) to avoid floating-point errors
 */

// Card types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

/**
 * Bitmask representation for hand evaluator library
 * Used internally for efficient hand evaluation
 */
export type CardBitmask = number;

/**
 * Hand rankings from lowest to highest
 */
export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

/**
 * Evaluated hand with rank, value, and description
 */
export interface EvaluatedHand {
  rank: HandRank;
  value: number; // Numeric value for comparison
  cards: Card[]; // Best 5 cards
  description: string; // Human-readable (e.g., "Paire d'As")
}

/**
 * Poker actions a player can take
 */
export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allIn';

/**
 * Game phases in a poker hand
 */
export type PokerPhase = 'lobby' | 'preFlop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handComplete';

/**
 * Player status in the game
 */
export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sitOut' | 'disconnected';

/**
 * Full player state (server-side, includes hole cards)
 */
export interface PokerPlayer {
  id: string;
  name: string;
  chipStack: number; // In centimes
  status: PlayerStatus;
  seatIndex: number;
  holeCards: Card[] | null; // null if not dealt or folded
  currentBet: number; // In centimes, amount bet in current round
  avatar?: string;
}

/**
 * Public player state (sent to clients, NO hole cards)
 * Information hiding: clients never see opponent hole cards
 */
export interface PublicPokerPlayer {
  id: string;
  name: string;
  chipStack: number; // In centimes
  status: PlayerStatus;
  seatIndex: number;
  currentBet: number; // In centimes
  hasCards: boolean; // Indicates if player has hole cards (without revealing them)
  avatar?: string;
}

/**
 * Side pot for multi-way all-in scenarios
 */
export interface SidePot {
  amount: number; // In centimes
  eligiblePlayerIds: string[]; // Players who contributed to this pot
}

/**
 * Table configuration
 */
export interface TableConfig {
  maxPlayers: number; // 6-max for v1
  smallBlind: number; // In centimes
  bigBlind: number; // In centimes
  minBuyIn: number; // In centimes
  maxBuyIn: number; // In centimes
  actionTimeoutMs: number; // Milliseconds before auto-fold
  straddleEnabled: boolean; // Optional straddle variant
  runItTwiceEnabled: boolean; // Optional run-it-twice variant
}

/**
 * Public game state sent to all clients
 * Does NOT include opponent hole cards
 */
export interface PokerPublicState {
  phase: PokerPhase;
  communityCards: Card[]; // Flop, turn, river
  pots: SidePot[]; // Array of side pots
  currentBet: number; // Highest bet in current round (centimes)
  minRaise: number; // Minimum raise amount (centimes)
  dealerSeatIndex: number;
  activeSeatIndex: number; // Seat of player whose turn it is
  players: PublicPokerPlayer[]; // Public info only
  handNumber: number;
  tableConfig: TableConfig;
}

/**
 * Private game state sent only to the player
 * Includes their hole cards and available actions
 */
export interface PokerPrivateState {
  playerId: string;
  holeCards: Card[];
  handStrength?: string; // e.g., "Paire d'As", "Tirage couleur"
  availableActions: PokerAction[];
  minBetAmount: number; // In centimes
  maxBetAmount: number; // In centimes (usually their remaining stack)
}

/**
 * Hand history entry for persistence and replay
 */
export interface HandHistoryEntry {
  handNumber: number;
  timestamp: number; // Unix timestamp
  tableConfig: TableConfig;
  players: Array<{
    id: string;
    name: string;
    seatIndex: number;
    startingStack: number; // In centimes
  }>;
  actions: Array<{
    playerId: string;
    action: PokerAction;
    amount?: number; // In centimes
    phase: PokerPhase;
  }>;
  communityCards: Card[][]; // [flop, turn, river]
  pots: SidePot[];
  winners: Array<{
    playerId: string;
    amount: number; // In centimes
    potIndex: number;
    handDescription: string;
  }>;
}
