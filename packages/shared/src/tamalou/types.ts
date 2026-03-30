// ── Tamalou shared types ──

export type TamalouSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export type TamalouRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface TamalouCard {
  suit: TamalouSuit
  rank: TamalouRank
}

export type TamalouPhase =
  | 'lobby'
  | 'initialPeek'
  | 'playerTurn'
  | 'drawnCard'
  | 'usePower'
  | 'roundEnd'
  | 'gameOver'

/** What power a discarded card triggers */
export type TamalouPower = 'peekOwn' | 'peekOpponent' | 'blindSwap' | null

export interface TamalouPublicPlayer {
  id: string
  name: string
  connected: boolean
  cardCount: number
  /** Which card positions have been revealed at round end */
  revealedCards?: (TamalouCard | null)[]
}

export interface TamalouPublicState {
  phase: TamalouPhase
  roomCode: string
  hostId: string
  players: TamalouPublicPlayer[]
  currentPlayerId: string | null
  discardTop: TamalouCard | null
  drawPileCount: number
  /** Who called Tamalou (null if not called yet) */
  tamalouCaller: string | null
  /** Current power being resolved */
  activePower: TamalouPower
  /** Player whose card is being targeted by a power */
  powerTargetPlayerId: string | null
  /** Scores per round for each player */
  scores: Record<string, number[]>
  /** Max score to end the game */
  maxScore: number
  round: number
  /** At roundEnd: all hands revealed */
  revealedHands: Record<string, TamalouCard[]> | null
  /** At roundEnd: points for this round */
  roundScores: Record<string, number> | null
  /** Winner at gameOver */
  winnerId: string | null
}

export interface TamalouPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  /** Your hand (cards you can see are shown, others are null) */
  hand: (TamalouCard | null)[]
  /** The card you just drew (during drawnCard phase) */
  drawnCard: TamalouCard | null
  /** Card revealed by a power (temporary) */
  peekedCard: { cardIndex: number; card: TamalouCard; owner: string } | null
}

/** Card values for scoring */
export const TAMALOU_CARD_VALUES: Record<TamalouRank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 0,
}

/** Which power each rank triggers when discarded */
export const TAMALOU_CARD_POWERS: Record<TamalouRank, TamalouPower> = {
  'A': null, '2': null, '3': null, '4': null, '5': null, '6': null,
  '7': 'peekOwn', '8': 'peekOwn',
  '9': 'peekOpponent', '10': 'peekOpponent',
  'J': 'blindSwap', 'Q': 'blindSwap',
  'K': null,
}
