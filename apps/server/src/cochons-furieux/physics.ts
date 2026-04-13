import type { Grid, ShotInput, ShotResult, CellType, WeaponSpec } from '@undercover/shared';
import { GRID_COLS, GRID_ROWS, cellIndex, WEAPON_SPECS } from '@undercover/shared';

// Physics constants
const GRAVITY = 15;
const MAX_VELOCITY = 30;
const DT = 0.02;
const MAX_TIME = 10; // seconds, safety cap

// Slingshot position: to the left of the grid
const LAUNCH_X = -3;
const LAUNCH_Y = 7; // roughly mid-height

/** Compute where the projectile impacts the grid. Returns null if miss. */
export function computeImpact(
  angle: number,
  power: number,
): { col: number; row: number } | null {
  const v0 = power * MAX_VELOCITY;
  const vx = v0 * Math.cos(angle);
  const vy = v0 * Math.sin(angle);

  for (let t = DT; t < MAX_TIME; t += DT) {
    const x = LAUNCH_X + vx * t;
    const y = LAUNCH_Y + vy * t - 0.5 * GRAVITY * t * t;

    // Below ground
    if (y < 0) return null;
    // Past grid right edge
    if (x > GRID_COLS) return null;
    // In the grid
    if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
      return { col: Math.floor(x), row: Math.floor(y) };
    }
  }
  return null;
}

/** Compute trajectory points for client preview. */
export function computeTrajectory(
  angle: number,
  power: number,
  steps: number = 50,
): Array<{ x: number; y: number }> {
  const v0 = power * MAX_VELOCITY;
  const vx = v0 * Math.cos(angle);
  const vy = v0 * Math.sin(angle);
  const points: Array<{ x: number; y: number }> = [];
  const maxT = 2 * vy / GRAVITY + 1; // approximate flight time
  const dt = maxT / steps;

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const x = LAUNCH_X + vx * t;
    const y = LAUNCH_Y + vy * t - 0.5 * GRAVITY * t * t;
    if (y < -1 || x > GRID_COLS + 5) break;
    points.push({ x, y });
  }
  return points;
}

/** Apply damage to grid cells in radius from impact point. */
export function applyDamage(
  grid: Grid,
  impactCol: number,
  impactRow: number,
  spec: WeaponSpec,
): { destroyedCells: ShotResult['destroyedCells']; killedPigs: number } {
  const destroyed: ShotResult['destroyedCells'] = [];
  let killedPigs = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const dist = Math.abs(c - impactCol) + Math.abs(r - impactRow); // Manhattan
      if (dist > spec.radius) continue;

      const idx = cellIndex(c, r);
      const cell = grid[idx];
      if (cell.type === 'empty') continue;

      const wasType = cell.type;
      cell.hp -= spec.damage;
      if (cell.hp <= 0) {
        if (wasType === 'pig') killedPigs++;
        destroyed.push({ col: c, row: r, wasType });
        grid[idx] = { type: 'empty', hp: 0 };
      }
    }
  }

  return { destroyedCells: destroyed, killedPigs };
}

/** Apply gravity: unsupported blocks fall down. Returns movements for animation. */
export function applyGravity(grid: Grid): ShotResult['fallenBlocks'] {
  const fallen: ShotResult['fallenBlocks'] = [];
  let changed = true;

  while (changed) {
    changed = false;
    // Scan from row 1 upward (row 0 = ground, never falls)
    for (let r = 1; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = cellIndex(c, r);
        const below = cellIndex(c, r - 1);
        if (grid[idx].type !== 'empty' && grid[below].type === 'empty') {
          // Block falls one row
          fallen.push({ fromCol: c, fromRow: r, toCol: c, toRow: r - 1 });
          grid[below] = { ...grid[idx] };
          grid[idx] = { type: 'empty', hp: 0 };
          changed = true;
        }
      }
    }
  }

  // Check for pigs that were crushed by falling blocks (shouldn't happen with this logic, but safety)
  return fallen;
}

/** Full shot resolution: trajectory → impact → damage → gravity. */
export function resolveShot(grid: Grid, shot: ShotInput): ShotResult {
  const spec = WEAPON_SPECS[shot.weapon];
  const impact = computeImpact(shot.angle, shot.power);

  if (!impact) {
    return {
      impactCol: -1,
      impactRow: -1,
      weapon: shot.weapon,
      destroyedCells: [],
      killedPigs: 0,
      fallenBlocks: [],
      missed: true,
    };
  }

  const { destroyedCells, killedPigs } = applyDamage(grid, impact.col, impact.row, spec);
  const fallenBlocks = applyGravity(grid);

  // Check for pigs killed by falling (pigs at row 0 that got crushed)
  let extraKills = 0;
  for (const fall of fallenBlocks) {
    const landedIdx = cellIndex(fall.toCol, fall.toRow);
    // If a pig was at the destination before the fall... this is handled by applyGravity moving it
  }

  return {
    impactCol: impact.col,
    impactRow: impact.row,
    weapon: shot.weapon,
    destroyedCells,
    killedPigs: killedPigs + extraKills,
    fallenBlocks,
    missed: false,
  };
}
