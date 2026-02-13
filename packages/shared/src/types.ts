export type Role = 'civil' | 'undercover' | 'mrwhite';

export type WordCategory = 'facile' | 'expert' | 'adulte' | 'gastronomie' | 'voyage';

export interface WordPair {
  civil: string;
  undercover: string;
}

export interface Player {
  id: string;
  name: string;
  role?: Role;
  isEliminated?: boolean;
  avatar?: string;
}

export type GamePhase =
  | 'menu'
  | 'lobby'
  | 'roleDistribution'
  | 'discussion'
  | 'voting'
  | 'elimination'
  | 'mrWhiteGuess'
  | 'mrWhiteVote'
  | 'victory';
