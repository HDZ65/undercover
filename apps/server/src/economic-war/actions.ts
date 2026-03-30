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
import { createFactory, getFactoryCost, upgradeInfrastructure, upgradeTransport, reconvertFactory } from './production.js';
import { createWeapon, calculateEffectiveForce } from './military.js';
import { createOrganization, castVote, leaveOrganization, proposeEmbargo, proposeAidRequest, castAmountVote } from './organizations.js';
import { applySanction } from './commerce.js';
import { buyMiningMachine, buyRefinery, computeInitialUnderground } from './mining.js';
import { upgradeEquipment, toggleFallow, investIrrigation, computeInitialAgriculture } from './agriculture.js';
import { upgradeHerdEquipment, computeInitialLivestock } from './livestock.js';
import { upgradeMarineEquipment, computeInitialMarine } from './marine.js';
import { buildVehicle } from './transport.js';
import { randomUUID as uuid } from 'crypto';
import { WAR_ARMISTICE_MIN_TURNS, SECTOR_RESEARCH_REQUIREMENTS } from './constants.js';

type EcoWarEvent =
  | { type: 'ADD_PLAYER'; playerId: string; name: string; token: string; socketId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_CONFIG'; config: Partial<GameConfig> }
  | { type: 'START_GAME' }
  | { type: 'SELECT_COUNTRY'; playerId: string; countryId: string }
  | { type: 'SUBMIT_ACTIONS'; playerId: string; actions: PlayerAction[] }
  | { type: 'FREE_ACTION'; playerId: string; action: PlayerAction }
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

  selectCountry: assign(({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'SELECT_COUNTRY' }> }) => {
    const players = new Map(context.players);
    const player = players.get(event.playerId);
    const profile = COUNTRY_PROFILES.find(c => c.id === event.countryId);
    if (!player || !profile) return {};

    // Save old country BEFORE mutation (initializePlayerFromCountry mutates in place)
    const oldCountryId = player.countryId;
    initializePlayerFromCountry(player, profile, context.config);

    let available = context.availableCountries.filter(id => id !== event.countryId);
    if (oldCountryId && oldCountryId !== event.countryId) {
      available = [...available, oldCountryId];
    }

    return {
      players,
      availableCountries: available,
      currentDraftIndex: context.currentDraftIndex + 1,
    };
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

      // Validate and cap actions — free actions (isFreeAction=true) bypass the slot cap
      const maxActions = context.config.actionsPerTurn;
      const freeActions = event.actions.filter(a => a.isFreeAction);
      const slottedActions = event.actions.filter(a => !a.isFreeAction);
      player.submittedActions = slottedActions.slice(0, maxActions);
      player.actionsSubmitted = true;

      // Process immediate actions (trades, org votes, reconversions)
      processImmediateActions(player, [...player.submittedActions, ...freeActions], context);

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

  /** Process a free action (doesn't consume an action slot, doesn't set actionsSubmitted). */
  processFreeAction: assign({
    players: ({ context, event }: { context: EcoWarGameContext; event: Extract<EcoWarEvent, { type: 'FREE_ACTION' }> }) => {
      const players = new Map(context.players);
      const player = players.get(event.playerId);
      if (!player) return players;

      if (event.action.factoryReconversion) {
        reconvertFactory(player, event.action.factoryReconversion.factoryId, event.action.factoryReconversion.newSector);
      }
      if (event.action.miningAction) {
        const { resource, type } = event.action.miningAction;
        if (type === 'machine') {
          buyMiningMachine(player, resource);
        } else {
          buyRefinery(player, resource);
        }
      }
      if (event.action.farmAction) {
        const { type, plotCategory } = event.action.farmAction;
        if (type === 'upgradeEquipment' && plotCategory) {
          upgradeEquipment(player, plotCategory);
        } else if (type === 'toggleFallow' && plotCategory) {
          toggleFallow(player, plotCategory);
        } else if (type === 'investIrrigation') {
          investIrrigation(player);
        }
      }
      if (event.action.livestockAction) {
        upgradeHerdEquipment(player, event.action.livestockAction.herdCategory);
      }
      if (event.action.marineAction) {
        upgradeMarineEquipment(player);
      }
      return players;
    },
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
    resources: { oil: 0, iron: 0, coal: 0, rareEarths: 0, precious: 0, uranium: 0, water: 0, cereals: 0, vegetables: 0, sugarOils: 0, fodder: 0, redMeat: 0, whiteMeat: 0, dairy: 0, fish: 0, steel: 0, fuel: 0, electronicComponents: 0, pharmaceuticals: 0, processedFood: 0, fertilizer: 0, phones: 0, computers: 0, munitions: 0, obus: 0, bombs: 0 },
    factories: [],
    tools: { tier: 'basic', durability: 100, maintenanceCost: 10 },
    finance: { money: 0, debt: 0, inflation: 0, currencyStrength: 1.0, creditRating: 50 },
    infrastructure: { electricity: 30, telecom: 20, waterTreatment: 25 },
    transport: { roads: 20, ports: 15, airports: 10, tradeCostReduction: 0.05 },
    tourism: { attractiveness: 20, monuments: [], bannedCountries: [], bannedBy: [], income: 0 },
    population: {
      total: 1.0, growthRate: 0.02, healthLevel: 50, happinessLevel: 50, productivityMultiplier: 1.0,
      developmentIndex: 30, needsSatisfaction: 60, birthRate: 0.02, mortalityRate: 0.008, consumptionMultiplier: 0.72,
    },
    pollution: 10,
    research: {
      globalLevel: 0,
      branches: { agrotech: 0, nanotech: 0, cleanEnergy: 0, cybersecurity: 0, biotech: 0, military: 0, electronics: 0, nuclear: 0, counterIntelligence: 0 },
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
      units: {
        infantry: [0, 0, 0] as [number, number, number],
        tanks:    [0, 0, 0] as [number, number, number],
        planes:   [0, 0, 0] as [number, number, number],
        warships: [0, 0, 0] as [number, number, number],
      },
    },
    mining: {
      oil:        { underground: 0, machines: 0, hasRefinery: false },
      iron:       { underground: 0, machines: 0, hasRefinery: false },
      coal:       { underground: 0, machines: 0, hasRefinery: false },
      rareEarths: { underground: 0, machines: 0, hasRefinery: false },
      precious:   { underground: 0, machines: 0, hasRefinery: false },
      uranium:    { underground: 0, machines: 0, hasRefinery: false },
    },
    agriculture: { plots: [], irrigationLevel: 0 },
    livestock: { herds: [] },
    marine: { stockTotal: 0, initialStock: 0, equipment: 'basic' },
    fleet: { vehicles: [], totalCapacity: 0 },
    maintenanceParts: [],
    vehicleProductionQueue: {},
    productionChoices: {},
    pendingWarAllocations: [],
    pendingAttackOrders: [],
    troopsByRegion: {},
    exhaustedTroopsByRegion: {},
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
    incomingRegionPurchases: [],
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
  // Initialize underground reserves proportionally to starting stock (preserves country asymmetry)
  player.mining.oil.underground        = computeInitialUnderground(profile.startingResources.oil,        'oil');
  player.mining.iron.underground       = computeInitialUnderground(profile.startingResources.iron,       'iron');
  player.mining.coal.underground       = computeInitialUnderground(profile.startingResources.coal,       'coal');
  player.mining.rareEarths.underground = computeInitialUnderground(profile.startingResources.rareEarths, 'rareEarths');
  player.mining.precious.underground   = computeInitialUnderground(profile.startingResources.precious,   'precious');
  player.mining.uranium.underground    = computeInitialUnderground(profile.startingResources.uranium,    'uranium');
  // Endowment agricole = somme des cultures de départ
  const agriEndowment = profile.startingResources.cereals + profile.startingResources.vegetables
    + profile.startingResources.sugarOils + profile.startingResources.fodder;
  // Initialize farm plots proportionally to country's agriculture endowment
  player.agriculture = computeInitialAgriculture(agriEndowment);
  // Initialize livestock herds proportionally to country's agriculture endowment
  player.livestock = computeInitialLivestock(agriEndowment);
  // Initialize marine stock proportionally to country's water resource
  player.marine = computeInitialMarine(profile.startingResources.water);
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
    terrain: r.terrain ?? 'plains',
    warIntegrity: 100,
    contestedByWarId: null,
    fortified: false,
    destroyed: false,
    destroyedUntilRound: null,
    occupiedBy: null,
    resistanceRemaining: 0,
  }));

  // Starting factories from country profile
  if (profile.startingFactories && profile.startingFactories.length > 0) {
    for (const { sector, tier } of profile.startingFactories) {
      player.factories.push(createFactory(sector, tier));
    }
  } else {
    // Fallback: everyone gets at least one basic manufacturing factory
    player.factories.push(createFactory('manufacturing', 'basic'));
  }

  // Every country starts with 2 self-made trucks T1
  for (let i = 0; i < 2; i++) {
    player.fleet.vehicles.push({
      id: uuid(),
      type: 'truck',
      tier: 1,
      capacity: 10,
      ageInTurns: 0,
      maxLifespan: 8,
      fuelType: 'oil',
      fuelConsumption: 2,
      createdBy: player.id,
    });
  }
  player.fleet.totalCapacity = player.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);
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
          const reqs = SECTOR_RESEARCH_REQUIREMENTS[`${action.sector}:${action.factoryTier}`] ?? [];
          const meetsResearch = reqs.every(
            r => (player.research.branches[r.branch as keyof typeof player.research.branches] ?? 0) >= r.level
          );
          if (meetsResearch) {
            const existingCount = player.factories.filter(f => f.sector === action.sector).length;
            const cost = getFactoryCost(action.sector, action.factoryTier, existingCount);
            if (player.money >= cost) {
              player.money -= cost;
              player.factories.push(createFactory(action.sector, action.factoryTier));
            }
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
        if (action.miningAction) {
          const { resource, type } = action.miningAction;
          if (type === 'machine') {
            buyMiningMachine(player, resource);
          } else {
            buyRefinery(player, resource);
          }
        }
        if (action.farmAction) {
          const { type, plotCategory } = action.farmAction;
          if (type === 'upgradeEquipment' && plotCategory) {
            upgradeEquipment(player, plotCategory);
          } else if (type === 'toggleFallow' && plotCategory) {
            toggleFallow(player, plotCategory);
          } else if (type === 'investIrrigation') {
            investIrrigation(player);
          }
        }
        if (action.livestockAction) {
          const { herdCategory } = action.livestockAction;
          upgradeHerdEquipment(player, herdCategory);
        }
        if (action.marineAction) {
          upgradeMarineEquipment(player);
        }
        if (action.factoryReconversion) {
          reconvertFactory(player, action.factoryReconversion.factoryId, action.factoryReconversion.newSector);
        }
        if (action.vehicleAction) {
          buildVehicle(player, action.vehicleAction.vehicleType, action.vehicleAction.tier);
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
            const allMembers = [player.id, ...oa.invitedPlayerIds];
            const org = createOrganization(oa.name, oa.type, allMembers, context.currentRound);
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

          if (oa.action === 'proposeEmbargo' && oa.orgId && oa.targetId && oa.amount !== undefined) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            const target = context.players.get(oa.targetId);
            if (org) proposeEmbargo(org, player.id, oa.targetId, target?.countryName ?? oa.targetId, oa.amount, context.currentRound);
          }

          if (oa.action === 'proposeAidRequest' && oa.orgId && oa.motivationText) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            if (org) proposeAidRequest(org, player.id, oa.motivationText, context.currentRound);
          }

          if (oa.action === 'castAmountVote' && oa.orgId && oa.voteId && oa.amount !== undefined) {
            const org = context.organizations.find(o => o.id === oa.orgId);
            if (org) castAmountVote(org, oa.voteId, player.id, oa.amount, context.players);
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

      case 'buyRegion':
        if (action.targetPlayerId && action.regionId && action.regionPrice && action.regionPrice > 0) {
          const seller = context.players.get(action.targetPlayerId);
          if (seller && seller.id !== player.id) {
            const region = seller.regions.find(r => r.id === action.regionId && !r.occupiedBy && !r.destroyed);
            if (region) {
              const offer = {
                id: uuid(),
                fromId: player.id,
                toId: seller.id,
                regionId: region.id,
                regionName: region.name,
                price: action.regionPrice,
                status: 'pending' as const,
                roundProposed: context.currentRound,
              };
              seller.incomingRegionPurchases.push(offer);
            }
          }
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

      case 'threat':
        if (action.targetPlayerId && action.threatData) {
          const target = context.players.get(action.targetPlayerId);
          if (target) {
            const { infrastructureTarget, demand } = action.threatData;
            const infraLabels: Record<string, string> = {
              electricity:        'Réseau électrique',
              telecom:            'Infrastructures télécom',
              waterTreatment:     'Traitement de l\'eau',
              factories_food:     'Industrie agroalimentaire',
              factories_energy:   'Secteur énergétique',
              factories_armament: 'Arsenal militaire',
              military:           'Forces armées',
            };
            const infraLabel = infraLabels[infrastructureTarget] ?? infrastructureTarget;

            let demandLabel = '';
            if (demand.type === 'money') demandLabel = `payer ${demand.amount ?? 0} €`;
            else if (demand.type === 'resource') demandLabel = `livrer ${demand.amount ?? 0}× ${demand.resourceType}`;
            else if (demand.type === 'military_withdrawal') demandLabel = 'réduire les forces armées de 20';
            else if (demand.type === 'lift_sanctions') demandLabel = 'lever les sanctions';

            target.notifications.push({
              id: uuid(),
              type: 'threat_received',
              title: '⚠️ Menace diplomatique',
              message: `${player.countryName} menace de détruire votre ${infraLabel}. Exigence : ${demandLabel}.`,
              icon: '⚠️',
              severity: 'danger',
              round: context.currentRound,
              read: false,
            });

            // Stocker la menace dans le contexte pour résolution ultérieure
            context.activeThreats.push({
              id: uuid(),
              attackerId: player.id,
              targetId: action.targetPlayerId,
              targetInfrastructure: infrastructureTarget,
              demand,
              status: 'pending',
              roundDeclared: context.currentRound,
              deadlineRound: context.currentRound + 2,
            });
          }
        }
        break;
    }
  }
}
