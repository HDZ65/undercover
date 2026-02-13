/**
 * Poker Socket.io Event Type Definitions
 * Extends the base event interfaces with poker-specific events
 * All monetary amounts are in centimes (integers)
 */

import type {
  Card,
  PokerAction,
  PokerPhase,
  PokerPublicState,
  PokerPrivateState,
  TableConfig,
  HandHistoryEntry,
} from './types';

/**
 * Client → Server Poker Events
 * These events are sent by the client to request actions on the server
 */
export interface PokerClientToServerEvents {
  /**
   * Create a new poker table
   * @param data.playerName - Name of the player creating the table
   * @param data.config - Optional custom table configuration
   */
  'poker:createTable': (data: { playerName: string; config?: Partial<TableConfig> }) => void;

  /**
   * Join an existing poker table
   * @param data.tableId - ID of the table to join
   * @param data.playerName - Name of the player joining
   * @param data.buyIn - Amount to buy in with (in centimes)
   * @param data.seatIndex - Optional preferred seat index
   * @param data.playerToken - Optional token for reconnection
   */
  'poker:joinTable': (data: {
    tableId: string;
    playerName: string;
    buyIn: number;
    seatIndex?: number;
    playerToken?: string;
  }) => void;

  /**
   * Leave the current table
   */
  'poker:leaveTable': () => void;

  /**
   * Fold the current hand
   */
  'poker:fold': () => void;

  /**
   * Check (pass action without betting)
   */
  'poker:check': () => void;

  /**
   * Call the current bet
   */
  'poker:call': () => void;

  /**
   * Raise the bet
   * @param data.amount - Total amount to bet (in centimes, not the raise amount)
   */
  'poker:raise': (data: { amount: number }) => void;

  /**
   * Go all-in with remaining chips
   */
  'poker:allIn': () => void;

  /**
   * Sit out (disconnect temporarily without leaving table)
   */
  'poker:sitOut': () => void;

  /**
   * Sit back in after sitting out
   */
  'poker:sitIn': () => void;

  /**
   * Add chips to the stack (rebuy)
   * @param data.amount - Amount to add (in centimes)
   */
  'poker:addChips': (data: { amount: number }) => void;

  /**
   * Toggle straddle variant
   * @param data.enabled - Whether to enable straddle
   */
  'poker:toggleStraddle': (data: { enabled: boolean }) => void;

  /**
   * Accept or decline run-it-twice variant
   * @param data.accepted - Whether to accept run-it-twice
   */
  'poker:acceptRunItTwice': (data: { accepted: boolean }) => void;
}

/**
 * Server → Client Poker Events
 * These events are sent by the server to update clients about game state
 */
export interface PokerServerToClientEvents {
  /**
   * Send complete game state to client
   * Public state is sent to all players, private state only to the recipient
   */
  'poker:state': (data: { publicState: PokerPublicState; privateState: PokerPrivateState }) => void;

  /**
   * Notify of a player action
   * @param data.playerId - ID of the player who acted
   * @param data.action - The action taken
   * @param data.amount - Optional amount (for raise/call/allIn)
   */
  'poker:action': (data: { playerId: string; action: PokerAction; amount?: number }) => void;

  /**
   * Notify that a new hand is starting
   * @param data.handNumber - Sequential hand number
   * @param data.dealerSeatIndex - Seat index of the dealer button
   */
  'poker:newHand': (data: { handNumber: number; dealerSeatIndex: number }) => void;

  /**
   * Deal hole cards to the player
   * IMPORTANT: This event is sent ONLY to the specific player receiving the cards
   * Server must NOT broadcast this to other players
   * @param data.holeCards - The two hole cards dealt to this player
   */
  'poker:dealCards': (data: { holeCards: Card[] }) => void;

  /**
   * Reveal community cards (flop, turn, or river)
   * @param data.cards - The community cards revealed
   * @param data.phase - The current phase (flop, turn, or river)
   */
  'poker:communityCards': (data: { cards: Card[]; phase: PokerPhase }) => void;

  /**
   * Notify of showdown (all remaining players reveal their hands)
   * @param data.playerHands - Array of player hands with descriptions
   */
  'poker:showdown': (data: {
    playerHands: Array<{
      playerId: string;
      cards: Card[];
      handDescription: string;
    }>;
  }) => void;

  /**
   * Notify of pot winners
   * @param data.winners - Array of winners with their winnings and hand descriptions
   */
  'poker:potWon': (data: {
    winners: Array<{
      playerId: string;
      amount: number; // In centimes
      potIndex: number;
      handDescription: string;
    }>;
  }) => void;

  /**
   * Send hand history entry after hand completes
   * @param data.entry - Complete hand history record
   */
  'poker:handHistory': (data: { entry: HandHistoryEntry }) => void;

  /**
   * Send list of available tables
   * @param data.tables - Array of table information
   */
  'poker:tableList': (data: {
    tables: Array<{
      id: string;
      playerCount: number;
      config: TableConfig;
    }>;
  }) => void;

  /**
   * Send error message to client
   * @param data.message - Human-readable error message
   * @param data.code - Machine-readable error code
   */
  'poker:error': (data: { message: string; code: string }) => void;

  /**
   * Send action timer countdown
   * @param data.playerId - ID of the player whose turn it is
   * @param data.remainingMs - Milliseconds remaining to act
   */
  'poker:timer': (data: { playerId: string; remainingMs: number }) => void;
}
