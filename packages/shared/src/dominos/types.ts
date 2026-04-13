// ─── Dominos (Draw) — Shared Types ───────────────────────────────

export interface DominoTile {
  id: number       // 0-27
  top: number      // 0-6
  bottom: number   // 0-6
}

export interface BoardTile {
  tile: DominoTile
  flipped: boolean // if true, display top/bottom swapped
}

export interface BoardState {
  tiles: BoardTile[]
  leftEnd: number   // pip value exposed at left (-1 = empty board)
  rightEnd: number  // pip value exposed at right (-1 = empty board)
}

export type DominosPhase =
  | 'lobby'
  | 'playerTurn'
  | 'roundEnd'
  | 'gameOver'

export type AttackTier = 'miss' | 'punch' | 'energyBall' | 'combo'

export interface RoundResult {
  winnerId: string
  pointsScored: number
  attackTier: AttackTier
  playerPipCounts: Record<string, number>
}

export interface DominosPublicPlayer {
  id: string
  name: string
  connected: boolean
  tileCount: number
  totalScore: number
  characterIndex: number // 0-3
}

export interface DominosPublicState {
  phase: DominosPhase
  roomCode: string
  hostId: string
  players: DominosPublicPlayer[]
  currentPlayerId: string | null
  board: BoardState
  boneyardCount: number
  round: number
  targetScore: number
  roundResult: RoundResult | null
  winnerId: string | null
  lastAction: { playerId: string; action: 'placed' | 'drew' | 'passed' } | null
}

export interface DominosPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  hand: DominoTile[]
  playableTileIds: number[]
  canDraw: boolean
  canPass: boolean
}

// Constants
export const DOMINOS_SET_SIZE = 28
export const TILES_PER_PLAYER = 7
export const DOMINOS_MIN_PLAYERS = 2
export const DOMINOS_MAX_PLAYERS = 4
export const DEFAULT_TARGET_SCORE = 100

export function tilePipCount(tile: DominoTile): number {
  return tile.top + tile.bottom
}

export function getAttackTier(points: number): AttackTier {
  if (points === 0) return 'miss'
  if (points > 30) return 'combo'
  if (points >= 15) return 'energyBall'
  return 'punch'
}
