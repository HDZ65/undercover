import type { Grid, Cell, CellType, CastleTemplate } from '@undercover/shared';
import { GRID_COLS, GRID_ROWS, GRID_SIZE, CELL_HP, cellIndex, cellAt, MAX_PIGS } from '@undercover/shared';

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => ({ type: 'empty' as CellType, hp: 0 }));
}

export function applyTemplate(grid: Grid, template: CastleTemplate): Grid {
  const g = grid.map(c => ({ ...c }));
  for (const b of template.blocks) {
    if (b.col >= 0 && b.col < GRID_COLS && b.row >= 0 && b.row < GRID_ROWS) {
      const idx = cellIndex(b.col, b.row);
      g[idx] = { type: b.type, hp: CELL_HP[b.type] };
    }
  }
  return g;
}

export function placeBlock(grid: Grid, col: number, row: number, type: CellType): Grid {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  if (type === 'empty' || type === 'pig') return grid;
  const g = grid.map(c => ({ ...c }));
  g[cellIndex(col, row)] = { type, hp: CELL_HP[type] };
  return g;
}

export function removeBlock(grid: Grid, col: number, row: number): Grid {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  const g = grid.map(c => ({ ...c }));
  g[cellIndex(col, row)] = { type: 'empty', hp: 0 };
  return g;
}

export function placePig(grid: Grid, col: number, row: number): Grid {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  const cell = cellAt(grid, col, row);
  if (cell.type !== 'empty') return grid;
  if (countPigs(grid) >= MAX_PIGS) return grid;
  const g = grid.map(c => ({ ...c }));
  g[cellIndex(col, row)] = { type: 'pig', hp: 1 };
  return g;
}

export function removePig(grid: Grid, col: number, row: number): Grid {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return grid;
  const cell = cellAt(grid, col, row);
  if (cell.type !== 'pig') return grid;
  const g = grid.map(c => ({ ...c }));
  g[cellIndex(col, row)] = { type: 'empty', hp: 0 };
  return g;
}

export function countPigs(grid: Grid): number {
  return grid.filter(c => c.type === 'pig').length;
}

export function randomPigPlacement(grid: Grid, count: number): Grid {
  const g = grid.map(c => ({ ...c }));
  const emptyCells: number[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (g[i].type === 'empty') emptyCells.push(i);
  }
  // Shuffle and pick first `count`
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
  }
  const toPlace = Math.min(count - countPigs(g), emptyCells.length);
  for (let i = 0; i < toPlace; i++) {
    g[emptyCells[i]] = { type: 'pig', hp: 1 };
  }
  return g;
}
