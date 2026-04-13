import type { Grid, ShotInput, ShotResult, CellType, WeaponSpec, TrajectoryPoint, PlayerSide } from '@undercover/shared';
import { GRID_COLS, GRID_ROWS, cellIndex, WEAPON_SPECS, HALF_COLS } from '@undercover/shared';

// Physics constants — shared between server and client preview
export const PHYSICS = {
  GRAVITY: 10,
  MAX_VELOCITY: 28,
  DT: 0.03,
  MAX_TIME: 15,
} as const;

/** Get the catapult launch position based on which side the shooter is on */
export function getLaunchPos(shooterSide: PlayerSide): { x: number; y: number } {
  return shooterSide === 'left'
    ? { x: 1.5, y: 2 }
    : { x: GRID_COLS - 1.5, y: 2 };
}

/** Compute trajectory and find first NON-EMPTY cell hit on the grid */
export function computeTrajectoryAndImpact(
  angle: number,
  power: number,
  shooterSide: PlayerSide,
  grid?: Grid,
): { trajectory: TrajectoryPoint[]; impactCol: number; impactRow: number; missed: boolean } {
  const { x: x0, y: y0 } = getLaunchPos(shooterSide);
  const v0 = power * PHYSICS.MAX_VELOCITY;

  const dirX = shooterSide === 'left' ? 1 : -1;
  const vx = v0 * Math.cos(angle) * dirX;
  const vy = v0 * Math.sin(angle);

  const trajectory: TrajectoryPoint[] = [];
  let impactCol = -1;
  let impactRow = -1;
  let missed = true;

  for (let t = 0; t < PHYSICS.MAX_TIME; t += PHYSICS.DT) {
    const x = x0 + vx * t;
    const y = y0 + vy * t - 0.5 * PHYSICS.GRAVITY * t * t;

    trajectory.push({ x, y });

    // Below ground — impact on ground level
    if (y < 0) {
      impactCol = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x)));
      impactRow = 0;
      missed = false;
      break;
    }
    // Out of bounds horizontally
    if (x < -5 || x > GRID_COLS + 5) break;

    // Check if hitting a non-empty cell
    const col = Math.floor(x);
    const row = Math.floor(y);
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      if (grid) {
        const idx = cellIndex(col, row);
        if (grid[idx].type !== 'empty') {
          impactCol = col;
          impactRow = row;
          missed = false;
          break;
        }
      } else {
        // No grid provided (preview mode) — don't stop
      }
    }
  }

  return { trajectory, impactCol, impactRow, missed };
}

/** Apply damage to grid cells in radius from impact point */
export function applyDamage(
  grid: Grid,
  impactCol: number,
  impactRow: number,
  spec: WeaponSpec,
): { destroyedCells: ShotResult['destroyedCells']; killedPigs: number; killedPigOwners: Record<string, number> } {
  const destroyed: ShotResult['destroyedCells'] = [];
  let killedPigs = 0;
  const killedPigOwners: Record<string, number> = {};

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const dist = Math.abs(c - impactCol) + Math.abs(r - impactRow);
      if (dist > spec.radius) continue;

      const idx = cellIndex(c, r);
      const cell = grid[idx];
      if (cell.type === 'empty') continue;

      const wasType = cell.type;
      cell.hp -= spec.damage;
      if (cell.hp <= 0) {
        if (wasType === 'pig') {
          killedPigs++;
          const owner = cell.ownerId ?? '';
          killedPigOwners[owner] = (killedPigOwners[owner] ?? 0) + 1;
        }
        destroyed.push({ col: c, row: r, wasType });
        grid[idx] = { type: 'empty', hp: 0 };
      }
    }
  }

  return { destroyedCells: destroyed, killedPigs, killedPigOwners };
}

/** Apply gravity: unsupported blocks fall down. Returns movements for animation. */
export function applyGravity(grid: Grid): ShotResult['fallenBlocks'] {
  const fallen: ShotResult['fallenBlocks'] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (let r = 1; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = cellIndex(c, r);
        const below = cellIndex(c, r - 1);
        if (grid[idx].type !== 'empty' && grid[below].type === 'empty') {
          fallen.push({ fromCol: c, fromRow: r, toCol: c, toRow: r - 1 });
          grid[below] = { ...grid[idx] };
          grid[idx] = { type: 'empty', hp: 0 };
          changed = true;
        }
      }
    }
  }

  // Check if any pigs were killed by falling blocks landing on them
  // (handled naturally by the gravity loop — blocks push down)
  return fallen;
}

/** Full shot resolution */
export function resolveShot(grid: Grid, shot: ShotInput, shooterSide: PlayerSide): ShotResult {
  const spec = WEAPON_SPECS[shot.weapon];
  const { trajectory, impactCol, impactRow, missed } = computeTrajectoryAndImpact(shot.angle, shot.power, shooterSide, grid);

  if (missed) {
    return {
      impactCol: -1, impactRow: -1,
      weapon: shot.weapon, destroyedCells: [], killedPigs: 0, killedPigOwners: {},
      fallenBlocks: [], trajectory, missed: true,
    };
  }

  const { destroyedCells, killedPigs, killedPigOwners } = applyDamage(grid, impactCol, impactRow, spec);
  const fallenBlocks = applyGravity(grid);

  return {
    impactCol, impactRow,
    weapon: shot.weapon, destroyedCells, killedPigs, killedPigOwners,
    fallenBlocks, trajectory, missed: false,
  };
}
