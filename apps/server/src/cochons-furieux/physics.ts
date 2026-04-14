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

/** Full shot resolution with weapon-specific effects */
export function resolveShot(grid: Grid, shot: ShotInput, shooterSide: PlayerSide): ShotResult {
  const spec = WEAPON_SPECS[shot.weapon];

  // Missile: piercing — don't stop at first hit, continue through and damage everything on the line
  const useGrid = spec.piercing ? undefined : grid;
  const { trajectory, impactCol, impactRow, missed } = computeTrajectoryAndImpact(shot.angle, shot.power, shooterSide, useGrid);

  if (missed && !spec.piercing) {
    return {
      impactCol: -1, impactRow: -1,
      weapon: shot.weapon, destroyedCells: [], killedPigs: 0, killedPigOwners: {},
      fallenBlocks: [], trajectory, missed: true,
    };
  }

  let allDestroyed: ShotResult['destroyedCells'] = [];
  let totalKilledPigs = 0;
  const allKilledPigOwners: Record<string, number> = {};

  if (spec.piercing) {
    // Missile: damage every non-empty cell the trajectory passes through
    const hitCells = new Set<string>();
    for (const pt of trajectory) {
      const c = Math.floor(pt.x); const r = Math.floor(pt.y);
      if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) continue;
      const key = `${c},${r}`;
      if (hitCells.has(key)) continue;
      hitCells.add(key);
      const idx = cellIndex(c, r);
      if (grid[idx].type !== 'empty') {
        const wasType = grid[idx].type;
        grid[idx].hp -= spec.damage;
        if (grid[idx].hp <= 0) {
          if (wasType === 'pig') {
            totalKilledPigs++;
            const owner = grid[idx].ownerId ?? '';
            allKilledPigOwners[owner] = (allKilledPigOwners[owner] ?? 0) + 1;
          }
          allDestroyed.push({ col: c, row: r, wasType });
          grid[idx] = { type: 'empty', hp: 0 };
        }
      }
    }
  } else {
    // Rock & Bomb: standard area damage at impact point
    const { destroyedCells, killedPigs, killedPigOwners } = applyDamage(grid, impactCol, impactRow, spec);
    allDestroyed = destroyedCells;
    totalKilledPigs = killedPigs;
    Object.assign(allKilledPigOwners, killedPigOwners);
  }

  // Bomb fragments: additional smaller impacts around the main explosion
  if (spec.fragmentCount > 0 && !missed) {
    const offsets = [[-2, 1], [2, 1], [0, -2]];
    for (let f = 0; f < Math.min(spec.fragmentCount, offsets.length); f++) {
      const fc = impactCol + offsets[f][0];
      const fr = impactRow + offsets[f][1];
      if (fc >= 0 && fc < GRID_COLS && fr >= 0 && fr < GRID_ROWS) {
        // Fragment does 1 damage in radius 1
        const { destroyedCells, killedPigs, killedPigOwners } = applyDamage(grid, fc, fr, { ...spec, radius: 1, damage: 1 });
        allDestroyed.push(...destroyedCells);
        totalKilledPigs += killedPigs;
        for (const [owner, count] of Object.entries(killedPigOwners)) {
          allKilledPigOwners[owner] = (allKilledPigOwners[owner] ?? 0) + count;
        }
      }
    }
  }

  const fallenBlocks = applyGravity(grid);

  return {
    impactCol, impactRow,
    weapon: shot.weapon, destroyedCells: allDestroyed, killedPigs: totalKilledPigs,
    killedPigOwners: allKilledPigOwners,
    fallenBlocks, trajectory, missed: missed && !spec.piercing,
  };
}
