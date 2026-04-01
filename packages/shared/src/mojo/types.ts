// ── Mojo shared types ──

export type MojoColor = 'blue' | 'green' | 'yellow' | 'orange' | 'red'

export interface MojoCard {
  id: number
  color: MojoColor
  value: number
}

export type MojoPhase =
  | 'lobby'
  | 'playing'
  | 'mojoTime'
  | 'roundEnd'
  | 'gameOver'

export interface MojoPublicPlayer {
  id: string
  name: string
  connected: boolean
  handCount: number
  /** Face-down cards in mojo time (count) */
  mojoCardsCount: number
  /** Cards already revealed during mojo time */
  revealedMojoCards: MojoCard[]
  /** True if this player has entered mojo time */
  inMojoTime: boolean
  /** True if player has the mojo card */
  hasMojo: boolean
}

export interface MojoPublicState {
  phase: MojoPhase
  roomCode: string
  hostId: string
  players: MojoPublicPlayer[]
  currentPlayerId: string | null
  /** Top card(s) of discard pile(s) */
  discardTops: (MojoCard | null)[]
  drawPileCount: number
  /** How many discard piles (1 = standard, 2 = variant) */
  discardCount: 1 | 2
  /** Who has the mojo card */
  mojoHolderId: string | null
  /** Play direction: 1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1
  scores: Record<string, number[]>
  round: number
  /** At roundEnd: revealed hands & scores */
  roundScores: Record<string, number> | null
  revealedHands: Record<string, MojoCard[]> | null
  mojoScoreZero: boolean
  mojoPenalty: boolean
  winnerId: string | null
  /** Variant mode */
  doubleDiscard: boolean
  /** Current turn: did player already play a card this turn? (for equal chain) */
  playedThisTurn: boolean
  /** Must draw before ending turn (played a higher card) */
  mustDraw: boolean
  /** Active equal chain — must play another card */
  equalChainActive: boolean
  /** Which discard pile was used this turn (for equal chain + draw from other) */
  activeDiscardIndex: number
}

export interface MojoPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  hand: MojoCard[]
  /** Face-down mojo cards (only you see them until revealed) */
  mojoCards: MojoCard[]
}

/** Card distribution for the 79-card deck */
export const MOJO_DECK_SPEC: { color: MojoColor; value: number; count: number }[] = [
  { color: 'blue', value: 0, count: 4 },
  { color: 'blue', value: 1, count: 4 },
  { color: 'green', value: 2, count: 5 },
  { color: 'green', value: 3, count: 5 },
  { color: 'green', value: 4, count: 5 },
  { color: 'yellow', value: 5, count: 6 },
  { color: 'yellow', value: 6, count: 6 },
  { color: 'yellow', value: 7, count: 6 },
  { color: 'orange', value: 8, count: 7 },
  { color: 'orange', value: 9, count: 7 },
  { color: 'orange', value: 10, count: 7 },
  { color: 'red', value: 11, count: 8 },
  { color: 'red', value: 12, count: 8 },
]

export const MOJO_COLOR_LABELS: Record<MojoColor, string> = {
  blue: 'Bleu',
  green: 'Vert',
  yellow: 'Jaune',
  orange: 'Orange',
  red: 'Rouge',
}
