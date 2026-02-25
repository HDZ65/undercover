/**
 * Empire du Commerce — XState Actions
 * assign() actions that modify the machine context
 */

import { assign } from 'xstate';
import type { EcoWarGameContext, ServerPlayerState } from './types.js';
import type { GameConfig, PlayerAction, CountryProfile } from '@undercover/shared';
import { COUNTRY_PROFILES } from './countryProfiles.js';
import { resolveRound } from './resolution.js';
import { doResearch } from './research.js';
import { createFactory, getFactoryCost, upgradeInfrastructure, upgradeTransport } from './production.js';
import { createWeapon, calculateEffectiveForce } from './military.js';
import { createOrganization, castVote, leaveOrganization, proposeVote } from './organizations.js';
import { applySanction } from './commerce.js';
import { WAR_ARMISTICE_MIN_TURNS } from './constants.js';
import { randomUUID as uuid } from 'crypto';

type EcoWarEvent =
  | { type: 'ADD_PLAYER'; playerId: string; name: string; token: string; socketId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_CONFIG'; config: Partial<GameConfig> }
  | { type: 'START_GAME' }
  | { type: 'SELECT_COUNTRY'; playerId: string; countryId: string }
  | { type: 'SUBMIT_ACTIONS'; playerId: string; actions: PlayerAction[] }
  | { type: 'PLAYER_READY'; playerId: string }
  | { type: 'PLAYER_ABANDON'; playerId: string }
  | { type: 'ACTION_TIMEOUT' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'RESOLVE_ROUND' }
  | { type: 'RESET_GAME' };

export type EcoWarMachineEvent = EcoWarEvent;

export const ecoWarActions = {
  addPlayer: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'ADD_PLAYER' }> }) => {
      const players = new Map(context.players);
      players.set(event.playerId, createNewPlayer(event.playerId, event.name, event.token, event.socketId));
      return players;
    },
    hostId: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'ADD_PLAYER' }> }) => {
      return context.hostId || event.playerId;
    },
  }),

  removePlayer: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'REMOVE_PLAYER' }> }) => {
      const players = new Map(context.players);
      players.delete(event.playerId);
      return players;
    },
    hostId: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'REMOVE_PLAYER' }> }) => {
      if (context.hostId === event.playerId) {
        const remaining = Array.from(context.players.keys()).filter(id => id !== event.playerId);
        return remaining[0] || '';
      }
      return context.hostId;
    },
  }),

  setConfig: assign({
    config: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'SET_CONFIG' }> }) => {
      return { ...context.config, ...event.config };
    },
  }),

  initCountrySelection: assign({
    phase: () => 'countrySelection' as const,
    availableCountries: () => COUNTRY_PROFILES.map(c => c.id),
    currentDraftIndex: () => 0,
    turnOrder: ({ context }: { context: EcoWarGameContext }) => {
      // Shuffle player order for draft
      const ids = Array.from(context.players.keys());
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids;
    },
  }),

  selectCountry: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'SELECT_COUNTRY' }> }) => {
      const players = new Map(context.players);
      const player = players.get(event.playerId);
      const profile = COUNTRY_PROFILES.find(c => c.id === event.countryId);
      if (!player || !profile) return players;

      initializePlayerFromCountry(player, profile, context.config);
      return players;
    },
    availableCountries: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'SELECT_COUNTRY' }> }) => {
      return context.availableCountries.filter(id => id !== event.countryId);
    },
    currentDraftIndex: ({ context }: { context: EcoWarGameContext }) => {
      return context.currentDraftIndex + 1;
    },
  }),

  startPreparation: assign({
    phase: () => 'preparation' as const,
    currentRound: ({ context }: { context: EcoWarGameContext }) => context.currentRound + 1,
  }),

  resetTurnState: assign({
    players: ({ context }: { context: EcoWarGameContext }) => {
      const players = new Map(context.players);
      for (const [, player] of players) {
        player.ready = false;
        player.actionsSubmitted = false;
        player.submittedActions = [];
        player.availableActions = context.config.actionsPerTurn;
        player.notifications = []; // clear old notifications
      }
      return players;
    },
    resolutionLog: () => [] as any[],
    activeTrades: ({ context }: { context: EcoWarGameContext }) => {
      return context.activeTrades.filter(t => t.status === 'pending');
    },
  }),

  submitActions: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'SUBMIT_ACTIONS' }> }) => {
      const players = new Map(context.players);
      const player = players.get(event.playerId);
      if (!player) return players;

      // Validate and cap actions
      const maxActions = context.config.actionsPerTurn;
      player.submittedActions = event.actions.slice(0, maxActions);
      player.actionsSubmitted = true;

      // Process immediate actions (trades, org votes)
      processImmediateActions(player, event.actions, context);

      return players;
    },
  }),

  markReady: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'PLAYER_READY' }> }) => {
      const players = new Map(context.players);
      const player = players.get(event.playerId);
      if (player) player.ready = true;
      return players;
    },
  }),

  markAbandoned: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'PLAYER_ABANDON' }> }) => {
      const players = new Map(context.players);
      const player = players.get(event.playerId);
      if (player) {
        player.abandoned = true;
        player.connected = false;
      }
      return players;
    },
  }),

  handleActionTimeout: assign({
    players: ({ context }: { context: EcoWarGameContext }) => {
      const players = new Map(context.players);
      for (const [, player] of players) {
        if (!player.abandoned && !player.actionsSubmitted) {
          player.submittedActions = [];
          player.actionsSubmitted = true;
          player.ready = true;
        }
      }
      return players;
    },
  }),

  executeResolution: assign(({ context }: { context: EcoWarGameContext }) => {
    const result = resolveRound(context);
    return {
      resolutionLog: result.log,
      phase: 'resolution' as const,
    };
  }),

  setPhase: assign({
    phase: (_: any, params: { phase: string }) => params.phase,
  }),

  resetGame: assign(({ context }: { context: EcoWarGameContext }) => {
    const players = new Map(context.players);
    for (const [, player] of players) {
      player.ready = false;
      player.abandoned = false;
      player.actionsSubmitted = false;
      player.submittedActions = [];
      player.countryId = '';
      player.countryName = '';
      player.countryFlag = '';
    }
    return {
      phase: 'lobby' as const,
      currentRound: 0,
      players,
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
  }),
};

// ─── Helpers ───────────────────────────────────────────────────

function createNewPlayer(id: string, name: string, token: string, socketId: string): ServerPlayerState {
  return {
    id,
    name,
    token,
    socketId,
    countryId: '',
    countryName: '',
    countryFlag: '',
    connected: true,
    disconnectedAt: null,
    abandoned: false,
    ready: false,
    actionsSubmitted: false,
    money: 0,
    resources: { oil: 0, minerals: 0, agriculture: 0, water: 0 },
    factories: [],
    tools: { tier: 'basic', durability: 100, maintenanceCost: 10 },
    finance: { money: 0, debt: 0, inflation: 0, currencyStrength: 1.0, creditRating: 50 },
    infrastructure: { electricity: 30, telecom: 20, waterTreatment: 25 },
    transport: { roads: 20, ports: 15, airports: 10, tradeCostReduction: 0.05 },
    tourism: { attractiveness: 20, monuments: [], bannedCountries: [], bannedBy: [], income: 0 },
    population: { total: 1.0, growthRate: 0.02, healthLevel: 50, happinessLevel: 50, productivityMultiplier: 1.0 },
    pollution: 10,
    research: {
      globalLevel: 0,
      branches: { agrotech: 0, nanotech: 0, cleanEnergy: 0, cybersecurity: 0, biotech: 0, military: 0, electronics: 0, nuclear: 0 },
      educationLevel: 10,
    },
    patents: [],
    military: {
      armedForces: 10,
      intelligence: 10,
      weapons: [],
      effectiveForce: 10,
      nuclearBombs: 0,
      nuclearDevelopmentProgress: 0,
      maintenanceCost: 100,
      bombs: 0,
      planes: 0,
    },
    regions: [],
    organizationMemberships: [],
    activeSanctions: [],
    submittedActions: [],
    availableActions: 6,
    gdp: 0,
    influence: 0,
    score: 0,
    accumulatedBanPenalty: 0,
    espionageResults: [],
    incomingTrades: [],
    notifications: [],
    activeEffects: [],
  };
}

function initializePlayerFromCountry(
  player: ServerPlayerState,
  profile: CountryProfile,
  config: GameConfig,
): void {
  player.countryId = profile.id;
  player.countryName = profile.name;
  player.countryFlag = profile.flag;
  player.money = config.startingCapital + profile.startingMoney;
  player.resources = { ...profile.startingResources };
  player.population.total = profile.startingPopulation;
  player.research.globalLevel = profile.bonuses.researchBonus;
  player.military.armedForces = 10 + profile.bonuses.militaryBonus;
  player.military.intelligence = 10;
  player.tourism.attractiveness = 20 + profile.bonuses.tradeBonus;

  // Create regions
  player.regions = profile.regions.map((r, i) => ({
    id: `${profile.id}-region-${i}`,
    name: r.name,
    population: Math.round((profile.startingPopulation / profile.regions.length) * 1_000_000),
    productionCapacity: 100,
    destroyed: false,
    destroyedUntilRound: null,
    occupiedBy: null,
    resistanceRemaining: 0,
  }));

  // Starting factories based on country bonuses
  if (profile.bonuses.agricultureBonus > 10) {
    player.factories.push(createFactory('food', 'basic'));
    player.factories.push(createFactory('rawMaterials', 'basic'));
  }
  if (profile.bonuses.researchBonus > 10) {
    player.factories.push(createFactory('electronics', 'basic'));
  }
  if (profile.bonuses.militaryBonus > 10) {
    player.factories.push(createFactory('armament', 'basic'));
  }
  // Everyone gets at least one factory
  if (player.factories.length === 0) {
    player.factories.push(createFactory('manufacturing', 'basic'));
  }
}

function processImmediateActions(
  player: ServerPlayerState,
  actions: PlayerAction[],
  context: EcoWarGameContext,
): void {
  for (const action of actions) {
    switch (action.type) {
      case 'invest':
        if (action.sector && action.factoryTier) {
          const existingCount = player.factories.filter(f => f.sector === action.sector).length;
          const cost = getFactoryCost(action.sector, action.factoryTier, existingCount);
          if (player.money >= cost) {
            player.money -= cost;
            player.factories.push(createFactory(action.sector, action.factoryTier));
          }
        }
        if (action.infrastructureTarget) {
          const cost = 300;
          if (player.money >= cost) {
            player.money -= cost;
            upgradeInfrastructure(player, action.infrastructureTarget, 10);
          }
        }
        if (action.transportType) {
          const cost = 250;
          if (player.money >= cost) {
            player.money -= cost;
            upgradeTransport(player, action.transportType, 10);
          }
        }
        if (action.toolTier) {
          const cost = action.toolTier === 'robotized' ? 1000 : action.toolTier === 'advanced' ? 500 : 200;
          if (player.money >= cost) {
            player.money -= cost;
            player.tools.tier = action.toolTier;
          }
        }
        if (action.militaryUpgrade) {
          const currentLevel = player.military.armedForces;
          // Coût croissant : ~332 au niveau 10, ~654 au niveau 50, ~1016 au niveau 80
          const cost = Math.round(300 + Math.pow(currentLevel, 1.5));
          if (player.money >= cost && currentLevel < 100) {
            player.money -= cost;
            player.military.armedForces = Math.min(100, currentLevel + 5);
            player.military.effectiveForce = calculateEffectiveForce(player);
          }
        }
        break;

      case 'research':
        if (action.researchBranch) {
          doResearch(player, action.researchBranch, context.currentRound);
        }
        break;

      case 'buildWeapon':
        if (action.weaponTier) {
          const weapon = createWeapon(action.weaponTier, 'open', null);
          const cost = weapon.maintenanceCost * 10;
          if (player.money >= cost) {
            player.money -= cost;
            player.military.weapons.push(weapon);
            player.military.effectiveForce = calculateEffectiveForce(player);
          }
        }
        break;

      case 'diplomacy':
        if (action.orgAction) {
          const oa = action.orgAction;
          if (oa.action === 'create' && oa.name && oa.type && oa.invitedPlayerIds) {
            const org = createOrganization(oa.name, oa.type, [player.id, ...oa.invitedPlayerIds], context.currentRound);
            if (org) {
              context.organizations.push(org);
              player.organizationMemberships.push(org.id);
              for (const memberId of oa.invitedPlayerIds) {
                const member = context.players.get(memberId);
                if (member) member.organizationMemberships.push(org.id);
              }
            }
          }
          if (oa.action === 'vote' && oa.orgId && oa.voteId && oa.vote !== undefined) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            if (org) castVote(org, oa.voteId, player.id, oa.vote);
          }
          if (oa.action === 'leave' && oa.orgId) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            if (org) leaveOrganization(org, player.id, player);
          }
          if (oa.action === 'proposeVote' && oa.orgId && oa.proposal) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            if (org) proposeVote(org, player.id, 'custom', oa.proposal, context.currentRound);
          }
        }
        break;

      case 'trade':
        if (action.tradeOffer) {
          const trade = {
            id: uuid(),
            fromId: player.id,
            toId: action.tradeOffer.toId,
            offer: action.tradeOffer.offer,
            moneyAmount: action.tradeOffer.moneyAmount,
            status: 'pending' as const,
            roundProposed: context.currentRound,
          };
          context.activeTrades.push(trade);
          const tradeTarget = context.players.get(trade.toId);
          if (tradeTarget) tradeTarget.incomingTrades.push(trade);
        }
        break;

      case 'armistice':
        if (action.targetPlayerId) {
          const war = context.activeWars.find(
            w => w.status === 'active' &&
              ((w.attackerId === player.id && w.defenderId === action.targetPlayerId) ||
               (w.defenderId === player.id && w.attackerId === action.targetPlayerId)),
          );
          if (war && war.duration >= WAR_ARMISTICE_MIN_TURNS) {
            if (war.armisticeProposedBy === action.targetPlayerId) {
              // Opponent already proposed → both agree → armistice
              war.status = 'armistice';
              const opponentName = context.players.get(action.targetPlayerId)?.countryName || 'votre adversaire';
              player.notifications.push({
                id: uuid(),
                type: 'armistice_concluded',
                title: 'Armistice conclu',
                message: `La paix est rétablie avec ${opponentName}.`,
                icon: '🕊️',
                severity: 'success',
                round: context.currentRound,
                read: false,
              });
              const opponent = context.players.get(action.targetPlayerId);
              if (opponent) {
                opponent.notifications.push({
                  id: uuid(),
                  type: 'armistice_concluded',
                  title: 'Armistice conclu',
                  message: `La paix est rétablie avec ${player.countryName}.`,
                  icon: '🕊️',
                  severity: 'success',
                  round: context.currentRound,
                  read: false,
                });
              }
            } else if (!war.armisticeProposedBy) {
              // First proposal
              war.armisticeProposedBy = player.id;
              const opponent = context.players.get(action.targetPlayerId);
              if (opponent) {
                opponent.notifications.push({
                  id: uuid(),
                  type: 'armistice_offer',
                  title: 'Proposition d\'armistice',
                  message: `${player.countryName} vous propose un armistice. Acceptez via l'action "Armistice" ce même tour.`,
                  icon: '🤝',
                  severity: 'info',
                  round: context.currentRound,
                  read: false,
                });
              }
            }
          }
        }
        break;
    }
  }
}
