import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import type { Grid, ShotRecord, WeaponType, TemplateId, CellType } from '@undercover/shared';
import { TOTAL_TURNS, DEFAULT_INVENTORY, MAX_PIGS, CASTLE_TEMPLATES } from '@undercover/shared';
import { createEmptyGrid, applyTemplate, placeBlock, removeBlock, placePig, removePig, countPigs, randomPigPlacement } from './grid.js';
import { resolveShot } from './physics.js';

// ─── Server-only types ────────────────────────────────────────────

export interface CochonsPlayer {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  pigsKilled: number;
  weaponInventory: Record<WeaponType, number>;
}

export interface CochonsMachineContext {
  players: CochonsPlayer[];
  grids: Record<string, Grid>;
  currentPlayerIndex: number;
  turnNumber: number;
  shotHistory: ShotRecord[];
  winnerId: string | null;
  isDraw: boolean;
  buildTimeRemaining: number;
}

type CochonsMachineEvent =
  | { type: 'ADD_PLAYER'; id: string; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'START_GAME' }
  | { type: 'SELECT_TEMPLATE'; playerId: string; templateId: TemplateId }
  | { type: 'PLACE_BLOCK'; playerId: string; col: number; row: number; blockType: CellType }
  | { type: 'REMOVE_BLOCK'; playerId: string; col: number; row: number }
  | { type: 'PLACE_PIG'; playerId: string; col: number; row: number }
  | { type: 'REMOVE_PIG'; playerId: string; col: number; row: number }
  | { type: 'CONFIRM_BUILD'; playerId: string }
  | { type: 'BUILD_TIMER_EXPIRED' }
  | { type: 'FIRE'; playerId: string; angle: number; power: number; weapon: WeaponType }
  | { type: 'SHOT_RESOLVED' }
  | { type: 'RESET_GAME' };

// ─── Helpers ────────────────────────────────────────────────────

function opponentId(ctx: CochonsMachineContext, playerId: string): string {
  return ctx.players.find(p => p.id !== playerId)?.id ?? '';
}

function pigsAlive(grid: Grid): number {
  return countPigs(grid);
}

// ─── Machine ────────────────────────────────────────────────────

export const cochonsMachine = setup({
  types: {
    context: {} as CochonsMachineContext,
    events: {} as CochonsMachineEvent,
  },
  guards: {
    canStart: ({ context }) => context.players.filter(p => p.connected).length === 2,
    bothConfirmed: ({ context }) => context.players.every(p => p.ready),
    isCurrentPlayer: ({ context, event }) => {
      if (!('playerId' in event)) return false;
      const active = context.players.filter(p => p.connected);
      return active[context.currentPlayerIndex]?.id === (event as { playerId: string }).playerId;
    },
    hasWeapon: ({ context, event }) => {
      if (event.type !== 'FIRE') return false;
      const player = context.players[context.currentPlayerIndex];
      return player ? (player.weaponInventory[event.weapon] ?? 0) > 0 : false;
    },
    allShotsFired: ({ context }) => context.turnNumber >= TOTAL_TURNS,
    allPigsDead: ({ context }) => {
      return context.players.some(p => pigsAlive(context.grids[p.id] ?? []) === 0);
    },
    gameEnded: ({ context }) => {
      return context.turnNumber >= TOTAL_TURNS ||
        context.players.some(p => pigsAlive(context.grids[p.id] ?? []) === 0);
    },
  },
  actions: {
    addPlayer: assign(({ context, event }) => {
      if (event.type !== 'ADD_PLAYER') return {};
      if (context.players.some(p => p.id === event.id)) return {};
      if (context.players.length >= 2) return {};
      return {
        players: [...context.players, {
          id: event.id,
          name: event.name,
          connected: true,
          ready: false,
          pigsKilled: 0,
          weaponInventory: { ...DEFAULT_INVENTORY },
        }],
      };
    }),
    removePlayer: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PLAYER') return {};
      return { players: context.players.filter(p => p.id !== event.id) };
    }),
    initBuild: assign(({ context }) => {
      const grids: Record<string, Grid> = {};
      const players = context.players.map(p => ({
        ...p,
        ready: false,
        pigsKilled: 0,
        weaponInventory: { ...DEFAULT_INVENTORY },
      }));
      for (const p of players) grids[p.id] = createEmptyGrid();
      return { grids, players, turnNumber: 1, shotHistory: [], winnerId: null, isDraw: false, buildTimeRemaining: 60 };
    }),
    selectTemplate: assign(({ context, event }) => {
      if (event.type !== 'SELECT_TEMPLATE') return {};
      const tpl = CASTLE_TEMPLATES.find(t => t.id === event.templateId);
      if (!tpl) return {};
      let grid = createEmptyGrid();
      grid = applyTemplate(grid, tpl);
      return { grids: { ...context.grids, [event.playerId]: grid } };
    }),
    placeBlockAction: assign(({ context, event }) => {
      if (event.type !== 'PLACE_BLOCK') return {};
      const grid = placeBlock(context.grids[event.playerId] ?? [], event.col, event.row, event.blockType);
      return { grids: { ...context.grids, [event.playerId]: grid } };
    }),
    removeBlockAction: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_BLOCK') return {};
      const grid = removeBlock(context.grids[event.playerId] ?? [], event.col, event.row);
      return { grids: { ...context.grids, [event.playerId]: grid } };
    }),
    placePigAction: assign(({ context, event }) => {
      if (event.type !== 'PLACE_PIG') return {};
      const grid = placePig(context.grids[event.playerId] ?? [], event.col, event.row);
      return { grids: { ...context.grids, [event.playerId]: grid } };
    }),
    removePigAction: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PIG') return {};
      const grid = removePig(context.grids[event.playerId] ?? [], event.col, event.row);
      return { grids: { ...context.grids, [event.playerId]: grid } };
    }),
    confirmBuild: assign(({ context, event }) => {
      if (event.type !== 'CONFIRM_BUILD') return {};
      const players = context.players.map(p =>
        p.id === event.playerId ? { ...p, ready: true } : p,
      );
      // Auto-place pigs if not enough
      let grid = context.grids[event.playerId] ?? createEmptyGrid();
      if (countPigs(grid) < MAX_PIGS) {
        grid = randomPigPlacement(grid, MAX_PIGS);
      }
      return { players, grids: { ...context.grids, [event.playerId]: grid } };
    }),
    autoConfirmAll: assign(({ context }) => {
      const players = context.players.map(p => ({ ...p, ready: true }));
      const grids = { ...context.grids };
      const defaultTpl = CASTLE_TEMPLATES.find(t => t.id === 'chateau')!;
      for (const p of players) {
        if (countPigs(grids[p.id] ?? []) === 0) {
          let g = createEmptyGrid();
          g = applyTemplate(g, defaultTpl);
          g = randomPigPlacement(g, MAX_PIGS);
          grids[p.id] = g;
        } else if (countPigs(grids[p.id] ?? []) < MAX_PIGS) {
          grids[p.id] = randomPigPlacement(grids[p.id] ?? [], MAX_PIGS);
        }
      }
      return { players, grids };
    }),
    fireShot: assign(({ context, event }) => {
      if (event.type !== 'FIRE') return {};
      const shooter = context.players[context.currentPlayerIndex];
      if (!shooter) return {};
      const targetId = opponentId(context, shooter.id);
      const targetGrid = (context.grids[targetId] ?? []).map(c => ({ ...c }));

      const result = resolveShot(targetGrid, { angle: event.angle, power: event.power, weapon: event.weapon });

      // Update weapon inventory
      const players = context.players.map(p =>
        p.id === shooter.id
          ? {
              ...p,
              pigsKilled: p.pigsKilled + result.killedPigs,
              weaponInventory: { ...p.weaponInventory, [event.weapon]: Math.max(0, p.weaponInventory[event.weapon] - 1) },
            }
          : p,
      );

      const shotRecord: ShotRecord = {
        playerId: shooter.id,
        turnNumber: context.turnNumber,
        input: { angle: event.angle, power: event.power, weapon: event.weapon },
        result,
      };

      return {
        grids: { ...context.grids, [targetId]: targetGrid },
        players,
        shotHistory: [...context.shotHistory, shotRecord],
        turnNumber: context.turnNumber + 1,
      };
    }),
    advanceTurn: assign(({ context }) => ({
      currentPlayerIndex: context.currentPlayerIndex === 0 ? 1 : 0,
    })),
    determineWinner: assign(({ context }) => {
      const p0 = context.players[0];
      const p1 = context.players[1];
      if (!p0 || !p1) return { winnerId: null, isDraw: true };
      if (p0.pigsKilled > p1.pigsKilled) return { winnerId: p0.id, isDraw: false };
      if (p1.pigsKilled > p0.pigsKilled) return { winnerId: p1.id, isDraw: false };
      return { winnerId: null, isDraw: true };
    }),
    resetAll: assign(() => ({
      grids: {} as Record<string, Grid>,
      currentPlayerIndex: 0,
      turnNumber: 1,
      shotHistory: [] as ShotRecord[],
      winnerId: null,
      isDraw: false,
      buildTimeRemaining: 60,
    })),
  },
}).createMachine({
  id: 'cochons',
  initial: 'lobby',
  context: {
    players: [],
    grids: {},
    currentPlayerIndex: 0,
    turnNumber: 1,
    shotHistory: [],
    winnerId: null,
    isDraw: false,
    buildTimeRemaining: 60,
  },
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        START_GAME: { guard: 'canStart', target: 'buildPhase', actions: 'initBuild' },
        RESET_GAME: { actions: 'resetAll' },
      },
    },
    buildPhase: {
      on: {
        SELECT_TEMPLATE: { actions: 'selectTemplate' },
        PLACE_BLOCK: { actions: 'placeBlockAction' },
        REMOVE_BLOCK: { actions: 'removeBlockAction' },
        PLACE_PIG: { actions: 'placePigAction' },
        REMOVE_PIG: { actions: 'removePigAction' },
        CONFIRM_BUILD: { actions: 'confirmBuild' },
        BUILD_TIMER_EXPIRED: { target: 'battle', actions: 'autoConfirmAll' },
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
      always: [
        { guard: 'bothConfirmed', target: 'battle' },
      ],
    },
    battle: {
      initial: 'aiming',
      states: {
        aiming: {
          on: {
            FIRE: {
              guard: 'hasWeapon',
              target: 'resolving',
              actions: 'fireShot',
            },
          },
        },
        resolving: {
          always: [
            { guard: 'gameEnded', target: '#cochons.results', actions: 'determineWinner' },
            { target: 'aiming', actions: 'advanceTurn' },
          ],
        },
      },
      on: {
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
    },
    results: {
      on: {
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
    },
  },
});

export type CochonsActor = ActorRefFrom<typeof cochonsMachine>;
export type CochonsSnapshot = SnapshotFrom<typeof cochonsMachine>;
