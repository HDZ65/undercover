import type { Grid, Cell, CellType, CastleTemplate, PlayerSide } from '@undercover/shared';
import { GRID_COLS, GRID_ROWS, GRID_SIZE, CELL_HP, HALF_COLS, cellIndex, MAX_PIGS, sideRange, MAX_WOOD, MAX_STONE, MAX_STEEL } from '@undercover/shared';

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, (): Cell => ({ type: 'empty', hp: 0 }));
}

/**
 * Apply a template to a player's side.
 * Template coords are 0-19. Left player uses as-is, right player gets mirrored
 * so structures are near the CENTER of the map (away from their catapult).
 */
export function applyTemplate(grid: Grid, template: CastleTemplate, side: PlayerSide, ownerId: string): Grid {
  const g = grid.map(c => ({ ...c }));
  for (const b of template.blocks) {
    let col: number;
    if (side === 'left') {
      col = b.col; // left player: structures at cols 10-18, catapult at col ~1
    } else {
      // Mirror: col 18 in template → col 21 in grid (near center)
      // col 10 in template → col 29 in grid (farther from center)
      col = HALF_COLS + (HALF_COLS - 1 - b.col);
    }
    if (col >= 0 && col < GRID_COLS && b.row >= 0 && b.row < GRID_ROWS) {
      g[cellIndex(col, b.row)] = { type: b.type, hp: CELL_HP[b.type], ownerId };
    }
  }
  return g;
}

/** Count blocks of each type owned by a player */
export function countBlocks(grid: Grid, ownerId: string): Record<string, number> {
  const counts: Record<string, number> = { wood: 0, stone: 0, steel: 0 };
  for (const c of grid) {
    if (c.ownerId === ownerId && c.type !== 'pig' && c.type !== 'empty') {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
  }
  return counts;
}

/** Check if player can place more of this block type */
export function canPlaceBlock(grid: Grid, type: CellType, ownerId: string): boolean {
  const counts = countBlocks(grid, ownerId);
  const limits: Record<string, number> = { wood: MAX_WOOD, stone: MAX_STONE, steel: MAX_STEEL };
  return (counts[type] ?? 0) < (limits[type] ?? 0);
}

/** Check if a col is within the player's side */
export function isInSide(col: number, side: PlayerSide): boolean {
  const { minCol, maxCol } = sideRange(side);
  return col >= minCol && col <= maxCol;
}

export function placeBlock(grid: Grid, col: number, row: number, type: CellType, side: PlayerSide, ownerId: string): Grid {
  if (!isInSide(col, side)) return grid;
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  if (type === 'empty' || type === 'pig') return grid;
  if (!canPlaceBlock(grid, type, ownerId)) return grid;
  const idx = cellIndex(col, row);
  if (grid[idx].type !== 'empty') return grid;
  const g = grid.map(c => ({ ...c }));
  g[idx] = { type, hp: CELL_HP[type], ownerId };
  return g;
}

export function removeBlock(grid: Grid, col: number, row: number, side: PlayerSide, ownerId: string): Grid {
  if (!isInSide(col, side)) return grid;
  const idx = cellIndex(col, row);
  if (grid[idx].ownerId !== ownerId) return grid;
  const g = grid.map(c => ({ ...c }));
  g[idx] = { type: 'empty', hp: 0 };
  return g;
}

export function placePig(grid: Grid, col: number, row: number, side: PlayerSide, ownerId: string): Grid {
  if (!isInSide(col, side)) return grid;
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  if (grid[cellIndex(col, row)].type !== 'empty') return grid;
  if (countPigsForOwner(grid, ownerId) >= MAX_PIGS) return grid;
  const g = grid.map(c => ({ ...c }));
  g[cellIndex(col, row)] = { type: 'pig', hp: 1, ownerId };
  return g;
}

export function removePig(grid: Grid, col: number, row: number, ownerId: string): Grid {
  const idx = cellIndex(col, row);
  if (grid[idx].type !== 'pig' || grid[idx].ownerId !== ownerId) return grid;
  const g = grid.map(c => ({ ...c }));
  g[idx] = { type: 'empty', hp: 0 };
  return g;
}

export function countPigsForOwner(grid: Grid, ownerId: string): number {
  return grid.filter(c => c.type === 'pig' && c.ownerId === ownerId).length;
}

export function countPigs(grid: Grid): number {
  return grid.filter(c => c.type === 'pig').length;
}

export function randomPigPlacement(grid: Grid, side: PlayerSide, ownerId: string, count: number): Grid {
  const g = grid.map(c => ({ ...c }));
  const { minCol, maxCol } = sideRange(side);
  const emptyCells: number[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const idx = cellIndex(c, r);
      if (g[idx].type === 'empty') emptyCells.push(idx);
    }
  }
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
  }
  const existing = countPigsForOwner(g, ownerId);
  const toPlace = Math.min(count - existing, emptyCells.length);
  for (let i = 0; i < toPlace; i++) {
    g[emptyCells[i]] = { type: 'pig', hp: 1, ownerId };
  }
  return g;
}
