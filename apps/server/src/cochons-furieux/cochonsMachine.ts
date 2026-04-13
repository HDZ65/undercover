import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import type { Grid, ShotRecord, WeaponType, TemplateId, CellType, PlayerSide } from '@undercover/shared';
import { TOTAL_TURNS, DEFAULT_INVENTORY, MAX_PIGS, CASTLE_TEMPLATES } from '@undercover/shared';
import { createEmptyGrid, applyTemplate, placeBlock, removeBlock, placePig, removePig, countPigsForOwner, randomPigPlacement } from './grid.js';
import { resolveShot } from './physics.js';

export interface CochonsPlayer {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  side: PlayerSide;
  pigsKilled: number;
  weaponInventory: Record<WeaponType, number>;
}

export interface CochonsMachineContext {
  players: CochonsPlayer[];
  grid: Grid;
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
  | { type: 'RESET_GAME' };

function getPlayer(ctx: CochonsMachineContext, id: string): CochonsPlayer | undefined {
  return ctx.players.find(p => p.id === id);
}

export const cochonsMachine = setup({
  types: {
    context: {} as CochonsMachineContext,
    events: {} as CochonsMachineEvent,
  },
  guards: {
    canStart: ({ context }) => context.players.filter(p => p.connected).length === 2,
    bothConfirmed: ({ context }) => context.players.every(p => p.ready),
    hasWeapon: ({ context, event }) => {
      if (event.type !== 'FIRE') return false;
      const player = context.players[context.currentPlayerIndex];
      return player ? (player.weaponInventory[event.weapon] ?? 0) > 0 : false;
    },
    gameEnded: ({ context }) => {
      return context.turnNumber > TOTAL_TURNS ||
        context.players.some(p => countPigsForOwner(context.grid, p.id) === 0);
    },
  },
  actions: {
    addPlayer: assign(({ context, event }) => {
      if (event.type !== 'ADD_PLAYER') return {};
      if (context.players.some(p => p.id === event.id)) return {};
      if (context.players.length >= 2) return {};
      const side: PlayerSide = context.players.length === 0 ? 'left' : 'right';
      return {
        players: [...context.players, {
          id: event.id, name: event.name, connected: true, ready: false,
          side, pigsKilled: 0, weaponInventory: { ...DEFAULT_INVENTORY },
        }],
      };
    }),
    removePlayer: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PLAYER') return {};
      return { players: context.players.filter(p => p.id !== event.id) };
    }),
    initBuild: assign(({ context }) => {
      const players = context.players.map(p => ({
        ...p, ready: false, pigsKilled: 0, weaponInventory: { ...DEFAULT_INVENTORY },
      }));
      return {
        grid: createEmptyGrid(), players,
        turnNumber: 1, shotHistory: [], winnerId: null, isDraw: false, buildTimeRemaining: 60,
      };
    }),
    selectTemplate: assign(({ context, event }) => {
      if (event.type !== 'SELECT_TEMPLATE') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      const tpl = CASTLE_TEMPLATES.find(t => t.id === event.templateId);
      if (!tpl) return {};
      // Clear player's side first, then apply template
      let grid = context.grid.map(c => ({ ...c }));
      // Clear only this player's cells
      for (let i = 0; i < grid.length; i++) {
        if (grid[i].ownerId === player.id) grid[i] = { type: 'empty', hp: 0 };
      }
      grid = applyTemplate(grid, tpl, player.side, player.id);
      return { grid };
    }),
    placeBlockAction: assign(({ context, event }) => {
      if (event.type !== 'PLACE_BLOCK') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      return { grid: placeBlock(context.grid, event.col, event.row, event.blockType, player.side, player.id) };
    }),
    removeBlockAction: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_BLOCK') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      return { grid: removeBlock(context.grid, event.col, event.row, player.side, player.id) };
    }),
    placePigAction: assign(({ context, event }) => {
      if (event.type !== 'PLACE_PIG') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      return { grid: placePig(context.grid, event.col, event.row, player.side, player.id) };
    }),
    removePigAction: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PIG') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      return { grid: removePig(context.grid, event.col, event.row, player.id) };
    }),
    confirmBuild: assign(({ context, event }) => {
      if (event.type !== 'CONFIRM_BUILD') return {};
      const player = getPlayer(context, event.playerId);
      if (!player) return {};
      const players = context.players.map(p =>
        p.id === event.playerId ? { ...p, ready: true } : p,
      );
      let grid = context.grid.map(c => ({ ...c }));
      if (countPigsForOwner(grid, player.id) < MAX_PIGS) {
        grid = randomPigPlacement(grid, player.side, player.id, MAX_PIGS);
      }
      return { players, grid };
    }),
    autoConfirmAll: assign(({ context }) => {
      const players = context.players.map(p => ({ ...p, ready: true }));
      let grid = context.grid.map(c => ({ ...c }));
      const defaultTpl = CASTLE_TEMPLATES.find(t => t.id === 'chateau')!;
      for (const p of players) {
        if (countPigsForOwner(grid, p.id) === 0) {
          grid = applyTemplate(grid, defaultTpl, p.side, p.id);
        }
        if (countPigsForOwner(grid, p.id) < MAX_PIGS) {
          grid = randomPigPlacement(grid, p.side, p.id, MAX_PIGS);
        }
      }
      return { players, grid };
    }),
    fireShot: assign(({ context, event }) => {
      if (event.type !== 'FIRE') return {};
      const shooter = context.players[context.currentPlayerIndex];
      if (!shooter) return {};

      const gridCopy = context.grid.map(c => ({ ...c }));
      const result = resolveShot(gridCopy, { angle: event.angle, power: event.power, weapon: event.weapon }, shooter.side);

      // Count pigs killed that belong to the OPPONENT
      const opponentId = context.players.find(p => p.id !== shooter.id)?.id ?? '';
      const opponentPigsKilled = result.killedPigOwners[opponentId] ?? 0;

      const players = context.players.map(p =>
        p.id === shooter.id
          ? {
              ...p,
              pigsKilled: p.pigsKilled + opponentPigsKilled,
              weaponInventory: { ...p.weaponInventory, [event.weapon]: Math.max(0, p.weaponInventory[event.weapon] - 1) },
            }
          : p,
      );

      const shotRecord: ShotRecord = {
        playerId: shooter.id, turnNumber: context.turnNumber,
        input: { angle: event.angle, power: event.power, weapon: event.weapon },
        result,
      };

      return {
        grid: gridCopy, players,
        shotHistory: [...context.shotHistory, shotRecord],
        turnNumber: context.turnNumber + 1,
      };
    }),
    advanceTurn: assign(({ context }) => ({
      currentPlayerIndex: context.currentPlayerIndex === 0 ? 1 : 0,
    })),
    determineWinner: assign(({ context }) => {
      const [p0, p1] = context.players;
      if (!p0 || !p1) return { winnerId: null, isDraw: true };
      if (p0.pigsKilled > p1.pigsKilled) return { winnerId: p0.id, isDraw: false };
      if (p1.pigsKilled > p0.pigsKilled) return { winnerId: p1.id, isDraw: false };
      return { winnerId: null, isDraw: true };
    }),
    resetAll: assign(({ context }) => ({
      grid: createEmptyGrid(),
      currentPlayerIndex: 0, turnNumber: 1, shotHistory: [] as ShotRecord[],
      winnerId: null, isDraw: false, buildTimeRemaining: 60,
      players: context.players.map(p => ({ ...p, ready: false, pigsKilled: 0, weaponInventory: { ...DEFAULT_INVENTORY } })),
    })),
  },
}).createMachine({
  id: 'cochons',
  initial: 'lobby',
  context: {
    players: [], grid: createEmptyGrid(), currentPlayerIndex: 0,
    turnNumber: 1, shotHistory: [], winnerId: null, isDraw: false, buildTimeRemaining: 60,
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
      always: [{ guard: 'bothConfirmed', target: 'battle' }],
    },
    battle: {
      initial: 'aiming',
      states: {
        aiming: {
          on: {
            FIRE: { guard: 'hasWeapon', target: 'resolving', actions: 'fireShot' },
          },
        },
        resolving: {
          always: [
            { guard: 'gameEnded', target: '#cochons.results', actions: 'determineWinner' },
            { target: 'aiming', actions: 'advanceTurn' },
          ],
        },
      },
      on: { RESET_GAME: { target: 'lobby', actions: 'resetAll' } },
    },
    results: {
      on: { RESET_GAME: { target: 'lobby', actions: 'resetAll' } },
    },
  },
});

export type CochonsActor = ActorRefFrom<typeof cochonsMachine>;
export type CochonsSnapshot = SnapshotFrom<typeof cochonsMachine>;
