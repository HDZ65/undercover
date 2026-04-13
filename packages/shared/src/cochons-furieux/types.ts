// ─── Cochons Furieux — Shared Types ──────────────────────────────

export const GRID_COLS = 20
export const GRID_ROWS = 15
export const GRID_SIZE = GRID_COLS * GRID_ROWS
export const MAX_PIGS = 5
export const BUILD_TIMER_SECONDS = 60
export const SHOTS_PER_PLAYER = 5
export const TOTAL_TURNS = SHOTS_PER_PLAYER * 2

// ─── Cell & Grid ─────────────────────────────────────────────────

export type CellType = 'empty' | 'wood' | 'stone' | 'steel' | 'pig'

export interface Cell {
  type: CellType
  hp: number // wood=1, stone=2, steel=3, pig=1, empty=0
}

export const CELL_HP: Record<CellType, number> = {
  empty: 0, wood: 1, stone: 2, steel: 3, pig: 1,
}

/** Flat array, row-major. Index = row * GRID_COLS + col. Row 0 = bottom (ground). */
export type Grid = Cell[]

export function cellIndex(col: number, row: number): number {
  return row * GRID_COLS + col
}

export function cellAt(grid: Grid, col: number, row: number): Cell {
  return grid[cellIndex(col, row)]
}

// ─── Weapons ─────────────────────────────────────────────────────

export type WeaponType = 'rock' | 'bomb' | 'missile'

export interface WeaponSpec {
  type: WeaponType
  radius: number
  damage: number
  count: number
  labelFr: string
  emoji: string
}

export const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  rock:    { type: 'rock',    radius: 2, damage: 1, count: 3, labelFr: 'Rocher',  emoji: '🪨' },
  bomb:    { type: 'bomb',    radius: 3, damage: 2, count: 1, labelFr: 'Bombe',   emoji: '💣' },
  missile: { type: 'missile', radius: 1, damage: 3, count: 1, labelFr: 'Missile', emoji: '🚀' },
}

export const DEFAULT_INVENTORY: Record<WeaponType, number> = { rock: 3, bomb: 1, missile: 1 }

// ─── Shot ────────────────────────────────────────────────────────

export interface ShotInput {
  angle: number   // radians
  power: number   // 0-1
  weapon: WeaponType
}

export interface ShotResult {
  impactCol: number
  impactRow: number
  weapon: WeaponType
  destroyedCells: Array<{ col: number; row: number; wasType: CellType }>
  killedPigs: number
  fallenBlocks: Array<{ fromCol: number; fromRow: number; toCol: number; toRow: number }>
  missed: boolean
}

export interface ShotRecord {
  playerId: string
  turnNumber: number
  input: ShotInput
  result: ShotResult
}

// ─── Phases ──────────────────────────────────────────────────────

export type CochonsPhase = 'lobby' | 'buildPhase' | 'battle' | 'resolving' | 'results'

// ─── Public / Private State ──────────────────────────────────────

export interface CochonsPublicPlayer {
  id: string
  name: string
  connected: boolean
  ready: boolean
  pigsAlive: number
  pigsKilled: number
  weaponInventory: Record<WeaponType, number>
}

export interface CochonsPublicState {
  phase: CochonsPhase
  roomCode: string
  hostId: string
  players: CochonsPublicPlayer[]
  currentPlayerId: string | null
  turnNumber: number
  buildTimeRemaining: number
  /** Both grids visible during battle/results. null during lobby/build. */
  grids: Record<string, Grid> | null
  shotHistory: ShotRecord[]
  winnerId: string | null
  isDraw: boolean
}

export interface CochonsPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  /** During build: your own grid. During battle: null (use publicState.grids). */
  myGrid: Grid | null
}

// ─── Templates ───────────────────────────────────────────────────

export type TemplateId = 'tour' | 'forteresse' | 'pyramide' | 'chateau' | 'custom'

export interface CastleTemplate {
  id: TemplateId
  labelFr: string
  description: string
  blocks: Array<{ col: number; row: number; type: CellType }>
}
