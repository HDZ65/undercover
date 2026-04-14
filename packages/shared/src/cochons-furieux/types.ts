// ─── Cochons Furieux — Shared Types ──────────────────────────────

// Single shared grid: Player 1 on left (cols 0-19), Player 2 on right (cols 20-39)
export const GRID_COLS = 40
export const GRID_ROWS = 15
export const GRID_SIZE = GRID_COLS * GRID_ROWS
export const HALF_COLS = 20 // each player's half
export const MAX_PIGS = 5
export const BUILD_TIMER_SECONDS = 60
// Build material limits per player
export const MAX_WOOD = 20
export const MAX_STONE = 12
export const MAX_STEEL = 5
export const SHOTS_PER_PLAYER = 5
export const TOTAL_TURNS = SHOTS_PER_PLAYER * 2

export type PlayerSide = 'left' | 'right'

// ─── Cell & Grid ─────────────────────────────────────────────────

export type CellType = 'empty' | 'wood' | 'stone' | 'steel' | 'pig'

export interface Cell {
  type: CellType
  hp: number
  ownerId?: string // which player placed this cell
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

/** Get the column range for a player side */
export function sideRange(side: PlayerSide): { minCol: number; maxCol: number } {
  return side === 'left'
    ? { minCol: 0, maxCol: HALF_COLS - 1 }
    : { minCol: HALF_COLS, maxCol: GRID_COLS - 1 }
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
  /** Special effect description */
  effect: string
  /** Does the projectile pierce through blocks? (missile) */
  piercing: boolean
  /** Does the projectile split into fragments? (bomb) */
  fragmentCount: number
}

export const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  rock:    { type: 'rock',    radius: 2, damage: 1, count: 3, labelFr: 'Rocher',  emoji: '🪨', effect: 'Impact standard', piercing: false, fragmentCount: 0 },
  bomb:    { type: 'bomb',    radius: 4, damage: 2, count: 1, labelFr: 'Bombe',   emoji: '💣', effect: 'Grande explosion + fragments', piercing: false, fragmentCount: 3 },
  missile: { type: 'missile', radius: 1, damage: 4, count: 1, labelFr: 'Missile', emoji: '🚀', effect: 'Perce les blocs', piercing: true, fragmentCount: 0 },
}

export const DEFAULT_INVENTORY: Record<WeaponType, number> = { rock: 3, bomb: 1, missile: 1 }

// ─── Shot ────────────────────────────────────────────────────────

export interface ShotInput {
  angle: number   // radians
  power: number   // 0-1
  weapon: WeaponType
}

export interface TrajectoryPoint {
  x: number
  y: number
}

export interface ShotResult {
  impactCol: number
  impactRow: number
  weapon: WeaponType
  destroyedCells: Array<{ col: number; row: number; wasType: CellType }>
  killedPigs: number
  killedPigOwners: Record<string, number> // ownerId → count of pigs killed
  fallenBlocks: Array<{ fromCol: number; fromRow: number; toCol: number; toRow: number }>
  trajectory: TrajectoryPoint[] // for client animation
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
  side: PlayerSide
  pigsAlive: number
  pigsKilled: number // pigs this player killed on opponent's side
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
  /** Single shared grid, always visible during battle/results. null during lobby. */
  grid: Grid | null
  shotHistory: ShotRecord[]
  winnerId: string | null
  isDraw: boolean
}

export interface CochonsPrivateState {
  playerId: string
  playerToken: string
  isHost: boolean
  side: PlayerSide
  /** During build: the shared grid (only your side is editable). null during lobby. */
  buildGrid: Grid | null
}

// ─── Templates ───────────────────────────────────────────────────

export type TemplateId = 'tour' | 'forteresse' | 'pyramide' | 'chateau' | 'custom'

export interface CastleTemplate {
  id: TemplateId
  labelFr: string
  description: string
  /** Blocks with relative coords (0-19 range). Offset applied based on player side. */
  blocks: Array<{ col: number; row: number; type: CellType }>
}
