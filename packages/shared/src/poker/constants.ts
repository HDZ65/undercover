/**
 * Poker Constants
 * All monetary values are in centimes (integers)
 */

import type { Suit, Rank, TableConfig } from './types';

/**
 * Card suits
 */
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/**
 * Card ranks in order
 */
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Standard deck size
 */
export const DECK_SIZE = 52;

/**
 * Default table configuration
 * Blinds: 5/10 centimes (0.05€ / 0.10€)
 * Buy-in: 10€ - 100€
 * Action timeout: 30 seconds
 */
export const DEFAULT_TABLE_CONFIG: TableConfig = {
  maxPlayers: 6,
  smallBlind: 5, // 0.05€ in centimes
  bigBlind: 10, // 0.10€ in centimes
  minBuyIn: 1000, // 10.00€ in centimes
  maxBuyIn: 10000, // 100.00€ in centimes
  actionTimeoutMs: 30_000, // 30 seconds
  straddleEnabled: false,
  runItTwiceEnabled: false,
};

/**
 * Action timeout in milliseconds
 * Player must act within this time or auto-fold
 */
export const ACTION_TIMEOUT_MS = 30_000;

/**
 * Reconnection grace period in milliseconds
 * Player has this long to reconnect before being sat out
 */
export const RECONNECT_GRACE_MS = 90_000;

/**
 * Minimum players required to start a game
 */
export const MIN_PLAYERS = 2;

/**
 * Maximum players at a table
 */
export const MAX_PLAYERS = 6;

/**
 * Starting chip stack for new players
 * 10000 centimes = 100.00€
 */
export const STARTING_CHIPS = 10_000;
