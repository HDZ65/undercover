/**
 * Empire du Commerce — XState v5 State Machine
 * Main game logic machine with all phases
 */

import { setup } from 'xstate';
import { DEFAULT_CONFIG } from '@undercover/shared';
import type { EcoWarGameContext } from './types.js';
import { ecoWarActions } from './actions.js';
import type { EcoWarMachineEvent } from './actions.js';
import { ecoWarGuards } from './guards.js';

export const initialContext: EcoWarGameContext = {
  roomCode: '',
  hostId: '',
  config: { ...DEFAULT_CONFIG },
  phase: 'lobby',
  currentRound: 0,
  players: new Map(),
  turnOrder: [],
  organizations: [],
  activeWars: [],
  activeThreats: [],
  activeTrades: [],
  resolutionLog: [],
  marketEvents: [],
  journalHeadlines: [],
  leaderboard: [],
  availableCountries: [],
  currentDraftIndex: 0,
};

// Use loose setup to avoid XState v5 strict typing issues with assign() + Extract<>
// The runtime behavior is identical; we just skip compile-time event narrowing in transitions
const machineSetup = setup({
  types: {} as {
    context: EcoWarGameContext;
    events: EcoWarMachineEvent;
  },
  guards: ecoWarGuards as any,
  actions: ecoWarActions as any,
});

export const ecoWarMachine = (machineSetup as any).createMachine({
  id: 'empireducommerce',
  initial: 'lobby',
  context: initialContext,
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        SET_CONFIG: { actions: 'setConfig' },
        START_GAME: {
          guard: 'hasEnoughPlayers',
          target: 'countrySelection',
          actions: 'initCountrySelection',
        },
        RESET_GAME: { actions: 'resetGame' },
      },
    },

    countrySelection: {
      on: {
        SELECT_COUNTRY: {
          actions: 'selectCountry',
        },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
      always: [
        {
          guard: 'allCountriesSelected',
          target: 'preparation',
          actions: 'startPreparation',
        },
      ],
    },

    preparation: {
      entry: ['resetTurnState'],
      on: {
        PLAYER_READY: { actions: 'markReady' },
        PLAYER_ABANDON: { actions: 'markAbandoned' },
        ADVANCE_PHASE: { target: 'actionSelection' },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
      always: [
        { guard: 'isGameOver', target: 'victory' },
      ],
    },

    actionSelection: {
      on: {
        SUBMIT_ACTIONS: { actions: 'submitActions' },
        PLAYER_READY: { actions: 'markReady' },
        PLAYER_ABANDON: { actions: 'markAbandoned' },
        ACTION_TIMEOUT: {
          target: 'resolution',
          actions: ['handleActionTimeout', 'executeResolution'],
        },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
      always: [
        { guard: 'isGameOver', target: 'victory' },
        {
          guard: 'allActionsSubmitted',
          target: 'resolution',
          actions: 'executeResolution',
        },
      ],
    },

    resolution: {
      on: {
        ADVANCE_PHASE: { target: 'marketEvent' },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
    },

    marketEvent: {
      on: {
        ADVANCE_PHASE: { target: 'roundSummary' },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
    },

    roundSummary: {
      on: {
        PLAYER_READY: { actions: 'markReady' },
        PLAYER_ABANDON: { actions: 'markAbandoned' },
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
      always: [
        { guard: 'isGameOver', target: 'victory' },
        { guard: 'hasEarlyVictory', target: 'victory' },
        {
          guard: 'allPlayersReady',
          target: 'preparation',
          actions: 'startPreparation',
        },
      ],
    },

    victory: {
      on: {
        RESET_GAME: { target: 'lobby', actions: 'resetGame' },
      },
    },
  },
});

export type EcoWarMachine = typeof ecoWarMachine;
