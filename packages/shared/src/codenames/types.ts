// ── Codenames shared types ──

export type CodenamesTeam = 'red' | 'blue'

export type CardColor = 'red' | 'blue' | 'neutral' | 'assassin'

export type CodenamesPhase =
  | 'lobby'
  | 'clueGiving'
  | 'guessing'
  | 'victory'

export interface CodenamesClue {
  word: string
  count: number
  team: CodenamesTeam
}

export interface CodenamesCard {
  word: string
  color: CardColor
  revealed: boolean
  revealedBy?: CodenamesTeam
}

export interface CodenamesPublicPlayer {
  id: string
  name: string
  team: CodenamesTeam | null
  isSpymaster: boolean
  connected: boolean
}

export interface CodenamesPublicState {
  phase: CodenamesPhase
  roomCode: string
  hostId: string
  players: CodenamesPublicPlayer[]
  /** Cards with color hidden unless revealed (for agents) */
  cards: CodenamesPublicCard[]
  currentTeam: CodenamesTeam
  currentClue: CodenamesClue | null
  remainingGuesses: number
  scores: Record<CodenamesTeam, number>
  /** Total words each team needs to find */
  targets: Record<CodenamesTeam, number>
  winner: CodenamesTeam | null
  winReason: 'all_found' | 'assassin' | null
  loser: CodenamesTeam | null
}

/** Card as seen by agents (color hidden until revealed) */
export interface CodenamesPublicCard {
  word: string
  revealed: boolean
  color: CardColor | null // null if not yet revealed (hidden from agents)
}

export interface CodenamesPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  team: CodenamesTeam | null
  isSpymaster: boolean
  /** Spymasters see all card colors */
  spymasterCards: CodenamesCard[] | null
}
