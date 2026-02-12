/**
 * Core game type definitions for Undercover
 */

export type Role = 'civil' | 'undercover' | 'mrwhite';

export type GamePhase =
  | 'setup'
  | 'roleReveal'
  | 'discussion'
  | 'voting'
  | 'elimination'
  | 'gameOver';

export type WordCategory =
  | 'facile'
  | 'expert'
  | 'adulte'
  | 'gastronomie'
  | 'voyage';

export interface Player {
  id: string;
  name: string;
  role?: Role;
  isEliminated?: boolean;
  avatar?: string;
}

export interface WordPair {
  civil: string;
  undercover: string;
}

export interface GameContext {
  players: Player[];
  currentPhase: GamePhase;
  wordPair: WordPair;
  wordCategory: WordCategory;
  currentSpeaker?: string;
  votes: Record<string, string>; // playerId -> votedForPlayerId
  eliminatedPlayers: string[];
  roundNumber: number;
  gameStartTime?: number;
}

export type GameEvent =
  | { type: 'START_GAME'; players: Player[] }
  | { type: 'REVEAL_ROLES' }
  | { type: 'BEGIN_DISCUSSION' }
  | { type: 'NEXT_SPEAKER'; playerId: string }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'COMPLETE_VOTING' }
  | { type: 'ELIMINATE_PLAYER'; playerId: string }
  | { type: 'END_GAME'; winner: Role }
  | { type: 'RESET_GAME' };
