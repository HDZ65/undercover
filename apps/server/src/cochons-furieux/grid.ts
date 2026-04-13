import type { Grid, Cell, CellType, CastleTemplate, PlayerSide } from '@undercover/shared';
import { GRID_COLS, GRID_ROWS, GRID_SIZE, CELL_HP, HALF_COLS, cellIndex, cellAt, MAX_PIGS, sideRange } from '@undercover/shared';

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, (): Cell => ({ type: 'empty', hp: 0 }));
}

/** Apply a template to a player's side. Template coords are 0-19, offset for right side. */
export function applyTemplate(grid: Grid, template: CastleTemplate, side: PlayerSide, ownerId: string): Grid {
  const g = grid.map(c => ({ ...c }));
  const offset = side === 'right' ? HALF_COLS : 0;
  for (const b of template.blocks) {
    const col = b.col + offset;
    if (col >= 0 && col < GRID_COLS && b.row >= 0 && b.row < GRID_ROWS) {
      g[cellIndex(col, b.row)] = { type: b.type, hp: CELL_HP[b.type], ownerId };
    }
  }
  return g;
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
