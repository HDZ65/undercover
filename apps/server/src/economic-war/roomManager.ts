/**
 * Empire du Commerce — Room Manager
 * Manages rooms, players, Socket.io events, and XState actor lifecycle
 */

import { randomInt, randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { createActor } from 'xstate';
import type {
  EcoWarClientToServerEvents,
  EcoWarServerToClientEvents,
  EcoWarPublicGameState,
  EcoWarPrivatePlayerState,
  PublicPlayerInfo,
  LeaderboardEntry,
  EcoWarPhase,
  GameConfig,
  PlayerAction,
  PublicWarInfo,
  PublicThreatInfo,
  TradeAuction,
  PendingOrg,
  VehicleTradeItem,
} from '@undercover/shared';
import { ecoWarMachine } from './ecoWarMachine.js';
import type { EcoWarMachineEvent } from './actions.js';
import type { EcoWarGameContext, ServerPlayerState } from './types.js';
import { getWealthTier, buildLeaderboard } from './scoring.js';
import { DISCONNECT_GRACE_MS, EMPTY_ROOM_CLEANUP_MS, PHASE_AUTO_ADVANCE_MS, VEHICLE_SPEC_MAP, VEHICLE_REQUIRED_SECTOR, FORTIFY_COST } from './constants.js';
import { COUNTRY_PROFILES } from './countryProfiles.js';
import { areAdjacent, getProvinceData } from './adjacency.js';
import { createOrganization, castVote, leaveOrganization, proposeEmbargo, proposeAidRequest, castAmountVote, addJoinRequest, voteOnJoinRequest, proposeExpelMember } from './organizations.js';
import { applySanction, areInSameCommercialOrg, getEmbargoSurcharge } from './commerce.js';
import { ORG_TRADE_TAX_MIN } from './constants.js';
import type { ResourceType, OrganizationType, TradeOffer, Threat, ThreatInfraTarget, ThreatDemand, VehicleType, VehicleTier, IndustrySector, WarAllocationSubmission, MilitaryUnitTradeItem } from '@undercover/shared';
import { recruitInfantry, trainInfantry } from './military.js';
import { buildFactoryProductionInfo, buildAlerts, upgradeFactory } from './production.js';

type ServerSocket = Socket<EcoWarClientToServerEvents, EcoWarServerToClientEvents>;

// Manually typed since the machine uses `as any` for XState v5 setup compatibility
interface EcoWarSnapshot {
  value: string;
  context: EcoWarGameContext;
  status: string;
}

interface EcoWarActor {
  start(): void;
  stop(): void;
  getSnapshot(): EcoWarSnapshot;
  send(event: EcoWarMachineEvent): void;
  subscribe(listener: (snapshot: EcoWarSnapshot) => void): { unsubscribe(): void };
}

interface RoomPlayer {
  id: string;
  name: string;
  socketId: string | null;
  playerToken: string;
}

interface Room {
  code: string;
  actor: EcoWarActor;
  players: Map<string, RoomPlayer>;
  hostId: string;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  emptyRoomTimer: NodeJS.Timeout | null;
  actionTimerInterval: NodeJS.Timeout | null;
  phaseAdvanceTimer: NodeJS.Timeout | null;
  activeAuctions: Map<string, { auction: TradeAuction; timer: NodeJS.Timeout }>;
  pendingOrgs: Map<string, PendingOrg>;
}

const AUCTION_DURATION_MS = 60_000; // 1 minute

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_PLAYERS = 12;

export class EcoWarRoomManager {
  private readonly io: Namespace<EcoWarClientToServerEvents, EcoWarServerToClientEvents>;
  private readonly rooms: Map<string, Room> = new Map();
  private readonly socketPresence: Map<string, string> = new Map();
  private readonly actionTimerRemaining: Map<string, number> = new Map();
  private readonly roomPreviousPhases: Map<string, string> = new Map();

  constructor(io: Namespace<EcoWarClientToServerEvents, EcoWarServerToClientEvents>) {
    this.io = io;
  }

  // ─── Room Management ─────────────────────────────────────────

  createRoom(socket: ServerSocket, playerName: string): void {
    this.leaveRoom(socket);

    let roomCode = '';
    do {
      roomCode = this.generateRoomCode();
    } while (this.rooms.has(roomCode));

    const player = this.createRoomPlayer(playerName, socket.id);
    const actor = createActor(ecoWarMachine) as unknown as EcoWarActor;

    const room: Room = {
      code: roomCode,
      actor,
      players: new Map([[player.id, player]]),
      hostId: player.id,
      disconnectTimers: new Map(),
      emptyRoomTimer: null,
      actionTimerInterval: null,
      phaseAdvanceTimer: null,
      activeAuctions: new Map(),
      pendingOrgs: new Map(),
    };

    this.rooms.set(roomCode, room);
    this.socketPresence.set(socket.id, roomCode);
    socket.join(roomCode);

    actor.subscribe((snapshot) => {
      const liveRoom = this.rooms.get(roomCode);
      if (!liveRoom) return;
      this.handleActorSnapshot(liveRoom, snapshot);
    });

    actor.start();
    this.sendEvent(room, {
      type: 'ADD_PLAYER',
      playerId: player.id,
      name: player.name,
      token: player.playerToken,
      socketId: socket.id,
    });

    socket.emit('room:created', {
      roomCode,
      playerToken: player.playerToken,
      playerId: player.id,
    });

    this.broadcastState(room);
  }

  joinRoom(socket: ServerSocket, roomCode: string, playerName: string, playerToken?: string): void {
    this.leaveRoom(socket);

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      socket.emit('room:error', { message: 'Salle introuvable.' });
      return;
    }

    this.clearEmptyRoomTimer(room);

    // Reconnect with token
    const reconnectPlayer = playerToken
      ? [...room.players.values()].find((p) => p.playerToken === playerToken)
      : undefined;

    if (reconnectPlayer) {
      if (reconnectPlayer.socketId && reconnectPlayer.socketId !== socket.id) {
        this.socketPresence.delete(reconnectPlayer.socketId);
      }

      this.clearDisconnectTimer(room, reconnectPlayer.id);
      reconnectPlayer.socketId = socket.id;

      // Update socketId in machine context
      const snapshot = room.actor.getSnapshot();
      const machinePlayer = snapshot.context.players.get(reconnectPlayer.id);
      if (machinePlayer) {
        machinePlayer.socketId = socket.id;
        machinePlayer.connected = true;
        machinePlayer.disconnectedAt = null;
      }

      this.socketPresence.set(socket.id, normalizedCode);
      socket.join(normalizedCode);

      socket.emit('room:joined', {
        playerId: reconnectPlayer.id,
        playerToken: reconnectPlayer.playerToken,
      });

      this.reassignHostIfNeeded(room);
      this.broadcastState(room);
      return;
    }

    // New player
    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'lobby') {
      socket.emit('room:error', {
        message: 'La partie a déjà commencé. Reconnectez-vous avec votre token.',
      });
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      socket.emit('room:error', { message: 'La salle est pleine (max 12 joueurs).' });
      return;
    }

    const player = this.createRoomPlayer(playerName, socket.id);
    room.players.set(player.id, player);

    this.socketPresence.set(socket.id, normalizedCode);
    socket.join(normalizedCode);

    this.sendEvent(room, {
      type: 'ADD_PLAYER',
      playerId: player.id,
      name: player.name,
      token: player.playerToken,
      socketId: socket.id,
    });

    socket.emit('room:joined', {
      playerId: player.id,
      playerToken: player.playerToken,
    });

    this.broadcastState(room);
  }

  leaveRoom(socket: ServerSocket): void {
    const roomCode = this.socketPresence.get(socket.id);
    if (!roomCode) return;

    this.socketPresence.delete(socket.id);
    socket.leave(roomCode);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = this.findPlayerBySocket(room, socket.id);
    if (!player) return;

    this.removePlayer(room, player.id);
  }

  handleDisconnect(socket: ServerSocket): void {
    const roomCode = this.socketPresence.get(socket.id);
    if (!roomCode) return;

    this.socketPresence.delete(socket.id);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = this.findPlayerBySocket(room, socket.id);
    if (!player) return;

    player.socketId = null;

    // Mark as disconnected in machine context
    const snapshot = room.actor.getSnapshot();
    const machinePlayer = snapshot.context.players.get(player.id);
    if (machinePlayer) {
      machinePlayer.connected = false;
      machinePlayer.disconnectedAt = Date.now();
      // Auto-submit for disconnected player so others aren't blocked
      if (snapshot.value === 'actionSelection') {
        machinePlayer.actionsSubmitted = true;
      }
    }

    this.reassignHostIfNeeded(room);
    this.clearDisconnectTimer(room, player.id);

    const timer = setTimeout(() => {
      const liveRoom = this.rooms.get(roomCode);
      if (!liveRoom) return;

      const livePlayer = liveRoom.players.get(player.id);
      if (!livePlayer || livePlayer.socketId !== null) return;

      liveRoom.disconnectTimers.delete(player.id);

      // In-game: mark as abandoned, don't remove
      const snap = liveRoom.actor.getSnapshot();
      if (snap.value !== 'lobby') {
        this.sendEvent(liveRoom, { type: 'PLAYER_ABANDON', playerId: player.id });
      } else {
        this.removePlayer(liveRoom, player.id);
      }
    }, DISCONNECT_GRACE_MS);

    room.disconnectTimers.set(player.id, timer);
    this.broadcastState(room);
  }

  // ─── Game Events ─────────────────────────────────────────────

  handleSetConfig(socket: ServerSocket, config: Partial<GameConfig>): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    if (!this.isHost(room, player.id)) return;
    this.sendEvent(room, { type: 'SET_CONFIG', config });
  }

  handleStartGame(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    if (!this.isHost(room, player.id)) return;
    this.sendEvent(room, { type: 'START_GAME' });
  }

  handleSelectCountry(socket: ServerSocket, countryId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    this.sendEvent(room, { type: 'SELECT_COUNTRY', playerId: player.id, countryId });
  }

  handleSubmitActions(socket: ServerSocket, actions: PlayerAction[]): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection') return;

    this.sendEvent(room, { type: 'SUBMIT_ACTIONS', playerId: player.id, actions });

    // Notify sellers about any buyRegion offers
    const context = room.actor.getSnapshot().context;
    for (const action of actions) {
      if (action.type === 'buyRegion' && action.targetPlayerId) {
        const seller = context.players.get(action.targetPlayerId);
        const sellerSocketId = seller ? room.players.get(seller.id)?.socketId : null;
        if (sellerSocketId && seller) {
          const offer = seller.incomingRegionPurchases.find(o => o.fromId === player.id && o.regionId === action.regionId);
          if (offer) {
            this.io.to(sellerSocketId).emit('region:purchaseIncoming', { offer, buyerName: player.name });
          }
        }
      }
    }
  }

  handleFreeAction(socket: ServerSocket, action: PlayerAction): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    // Allow free actions in any active game phase (preparation, actionSelection, roundSummary)
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    this.sendEvent(room, { type: 'FREE_ACTION', playerId: player.id, action });
    this.broadcastState(room);
  }

  handleSetProductionChoice(
    socket: ServerSocket,
    sector: IndustrySector,
    vehicleType: VehicleType | undefined,
    vehicleTier: VehicleTier | undefined,
    weaponTier?: 1 | 2 | 3 | 4,
    partTier?: 1 | 2 | 3 | 4,
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    serverPlayer.productionChoices[sector] = { vehicleType, vehicleTier, weaponTier, partTier };
    this.broadcastState(room);
  }

  // ─── War ─────────────────────────────────────────────────────

  handleWarAllocate(socket: ServerSocket, allocation: WarAllocationSubmission): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    // Validate war exists and player is a participant
    const war = context.activeWars.find(w => w.id === allocation.warId && w.status === 'active');
    if (!war) return;
    if (war.attackerId !== player.id && war.defenderId !== player.id) return;

    // Replace any existing allocation for this war
    serverPlayer.pendingWarAllocations = serverPlayer.pendingWarAllocations.filter(a => a.warId !== allocation.warId);
    serverPlayer.pendingWarAllocations.push(allocation);
    // Silent: no broadcast needed
  }

  handleRecruitInfantry(socket: ServerSocket, tier: 1 | 2 | 3, count: number, regionId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    const error = recruitInfantry(serverPlayer, tier, count, regionId);
    if (error) {
      socket.emit('room:error', { message: error });
      return;
    }

    this.broadcastState(room);
  }

  handleTrainInfantry(socket: ServerSocket, regionId: string, fromTier: 1 | 2, count: number): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    const error = trainInfantry(serverPlayer, regionId, fromTier, count);
    if (error) {
      socket.emit('room:error', { message: error });
      return;
    }

    this.broadcastState(room);
  }

  handleUpgradeFactory(socket: ServerSocket, factoryId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    const { error } = upgradeFactory(serverPlayer, factoryId);
    if (error) {
      socket.emit('room:error', { message: error });
      return;
    }

    this.broadcastState(room);
  }

  handleTogglePauseFactory(socket: ServerSocket, factoryId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    const factory = serverPlayer.factories.find(f => f.id === factoryId);
    if (!factory) {
      socket.emit('room:error', { message: 'Usine introuvable' });
      return;
    }

    factory.paused = !factory.paused;
    this.broadcastState(room);
  }

  handleDeployTroops(socket: ServerSocket, regionId: string, units: import('@undercover/shared').MilitaryUnits): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    // Validate: player owns the region
    const ownsRegion = serverPlayer.regions.some(r => r.id === regionId && !r.occupiedBy && !r.destroyed);
    if (!ownsRegion) return;

    // Interdit si des troupes ennemies sont déjà dans cette province
    const hasEnemyTroops = [...context.players.values()].some(p =>
      p.id !== serverPlayer.id &&
      p.troopsByRegion[regionId] &&
      (p.troopsByRegion[regionId].infantry.some(v => v > 0) ||
       p.troopsByRegion[regionId].tanks.some(v => v > 0) ||
       p.troopsByRegion[regionId].planes.some(v => v > 0) ||
       p.troopsByRegion[regionId].warships.some(v => v > 0))
    );
    if (hasEnemyTroops) {
      socket.emit('room:error', { message: 'Impossible de déployer dans une province occupée par des troupes ennemies.' });
      return;
    }

    // Validate: enough units in reserve
    const reserve = serverPlayer.military.units;
    for (let t = 0; t < 3; t++) {
      if ((units.infantry[t] ?? 0) > reserve.infantry[t]) return;
      if ((units.tanks[t]    ?? 0) > reserve.tanks[t])    return;
      if ((units.planes[t]   ?? 0) > reserve.planes[t])   return;
      if ((units.warships[t] ?? 0) > reserve.warships[t]) return;
    }

    // Move units from reserve to region
    const current = serverPlayer.troopsByRegion[regionId] ?? {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };
    for (let t = 0; t < 3; t++) {
      reserve.infantry[t] -= (units.infantry[t] ?? 0);
      reserve.tanks[t]    -= (units.tanks[t]    ?? 0);
      reserve.planes[t]   -= (units.planes[t]   ?? 0);
      reserve.warships[t] -= (units.warships[t] ?? 0);
      current.infantry[t] += (units.infantry[t] ?? 0);
      current.tanks[t]    += (units.tanks[t]    ?? 0);
      current.planes[t]   += (units.planes[t]   ?? 0);
      current.warships[t] += (units.warships[t] ?? 0);
    }
    serverPlayer.troopsByRegion[regionId] = current;
    this.broadcastState(room);
  }

  handleTransferTroops(
    socket: ServerSocket,
    fromRegionId: string,
    toRegionId: string,
    units: import('@undercover/shared').MilitaryUnits,
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const phase = snapshot.value;
    if (phase !== 'preparation' && phase !== 'actionSelection' && phase !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    // Validate: both regions belong to this player and are not destroyed/occupied
    const fromRegion = serverPlayer.regions.find(r => r.id === fromRegionId && !r.occupiedBy && !r.destroyed);
    const toRegion   = serverPlayer.regions.find(r => r.id === toRegionId   && !r.occupiedBy && !r.destroyed);
    if (!fromRegion || !toRegion) return;
    if (fromRegionId === toRegionId) return;

    const fromTroops = serverPlayer.troopsByRegion[fromRegionId];
    if (!fromTroops) return;

    // Validate: enough non-exhausted troops in fromRegion
    const exhaustedFrom = serverPlayer.exhaustedTroopsByRegion[fromRegionId] ?? { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] };
    for (let t = 0; t < 3; t++) {
      if ((units.infantry[t] ?? 0) > fromTroops.infantry[t] - exhaustedFrom.infantry[t]) return;
      if ((units.tanks[t]    ?? 0) > fromTroops.tanks[t]    - exhaustedFrom.tanks[t])    return;
      if ((units.planes[t]   ?? 0) > fromTroops.planes[t]   - exhaustedFrom.planes[t])   return;
      if ((units.warships[t] ?? 0) > fromTroops.warships[t] - exhaustedFrom.warships[t]) return;
    }

    const toTroops = serverPlayer.troopsByRegion[toRegionId] ?? {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };
    const exhaustedTo = serverPlayer.exhaustedTroopsByRegion[toRegionId] ?? {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };

    for (let t = 0; t < 3; t++) {
      fromTroops.infantry[t] -= (units.infantry[t] ?? 0);
      fromTroops.tanks[t]    -= (units.tanks[t]    ?? 0);
      fromTroops.planes[t]   -= (units.planes[t]   ?? 0);
      fromTroops.warships[t] -= (units.warships[t] ?? 0);
      toTroops.infantry[t]   += (units.infantry[t] ?? 0);
      toTroops.tanks[t]      += (units.tanks[t]    ?? 0);
      toTroops.planes[t]     += (units.planes[t]   ?? 0);
      toTroops.warships[t]   += (units.warships[t] ?? 0);
      // Les troupes arrivées sont épuisées pour ce tour
      exhaustedTo.infantry[t] += (units.infantry[t] ?? 0);
      exhaustedTo.tanks[t]    += (units.tanks[t]    ?? 0);
      exhaustedTo.planes[t]   += (units.planes[t]   ?? 0);
      exhaustedTo.warships[t] += (units.warships[t] ?? 0);
    }
    serverPlayer.exhaustedTroopsByRegion[toRegionId] = exhaustedTo;

    // Clean up empty regions
    const isEmpty = (m: import('@undercover/shared').MilitaryUnits) =>
      m.infantry.every(v => v === 0) && m.tanks.every(v => v === 0) &&
      m.planes.every(v => v === 0) && m.warships.every(v => v === 0);
    if (isEmpty(fromTroops)) delete serverPlayer.troopsByRegion[fromRegionId];
    serverPlayer.troopsByRegion[toRegionId] = toTroops;

    this.broadcastState(room);
  }

  handleAttackProvince(socket: ServerSocket, order: import('@undercover/shared').AttackOrder): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection' && snapshot.value !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    const { fromRegionId, toRegionId, units } = order;

    // Validation : le joueur possède fromRegion OU y a des troupes déployées (territoire conquis mais pas encore transféré)
    const fromRegion = serverPlayer.regions.find(r => r.id === fromRegionId && !r.occupiedBy && !r.destroyed);
    const hasTroopsInFrom = !!serverPlayer.troopsByRegion[fromRegionId];
    if (!fromRegion && !hasTroopsInFrom) return;

    // Validation : provinces adjacentes
    if (!areAdjacent(fromRegionId, toRegionId)) {
      socket.emit('room:error', { message: 'Ces provinces ne sont pas adjacentes.' });
      return;
    }

    // Validation : toRegion appartient à un ennemi (pas au joueur lui-même)
    const ownsTarget = serverPlayer.regions.some(r => r.id === toRegionId);
    if (ownsTarget) return;

    // Validation : guerre active contre l'owner de la cible
    const targetOwner = [...context.players.values()].find(p =>
      p.regions.some(r => r.id === toRegionId)
    );
    if (targetOwner) {
      const warExists = context.activeWars.some(w =>
        w.status === 'active' &&
        ((w.attackerId === player.id && w.defenderId === targetOwner.id) ||
         (w.defenderId === player.id && w.attackerId === targetOwner.id))
      );
      if (!warExists) {
        socket.emit('room:error', { message: 'Vous devez déclarer la guerre avant d\'attaquer.' });
        return;
      }
    } else {
      // Province neutre → utiliser war:occupyNeutral
      return;
    }

    // Validation : assez de troupes non-épuisées dans fromRegion
    const fromTroops = serverPlayer.troopsByRegion[fromRegionId];
    if (!fromTroops) { socket.emit('room:error', { message: 'Aucune troupe dans cette province.' }); return; }
    const exhaustedFrom = serverPlayer.exhaustedTroopsByRegion[fromRegionId] ?? { infantry:[0,0,0], tanks:[0,0,0], planes:[0,0,0], warships:[0,0,0] };
    for (let t = 0; t < 3; t++) {
      if ((units.infantry[t] ?? 0) > fromTroops.infantry[t] - exhaustedFrom.infantry[t]) return;
      if ((units.tanks[t]    ?? 0) > fromTroops.tanks[t]    - exhaustedFrom.tanks[t])    return;
      if ((units.planes[t]   ?? 0) > fromTroops.planes[t]   - exhaustedFrom.planes[t])   return;
      if ((units.warships[t] ?? 0) > fromTroops.warships[t] - exhaustedFrom.warships[t]) return;
    }

    // Déplacer les troupes immédiatement dans la province ennemie
    const toTroops = serverPlayer.troopsByRegion[toRegionId] ?? {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };
    const exhaustedTo = serverPlayer.exhaustedTroopsByRegion[toRegionId] ?? {
      infantry: [0, 0, 0] as [number, number, number],
      tanks:    [0, 0, 0] as [number, number, number],
      planes:   [0, 0, 0] as [number, number, number],
      warships: [0, 0, 0] as [number, number, number],
    };
    for (let t = 0; t < 3; t++) {
      const mv = {
        infantry: Math.min(units.infantry[t] ?? 0, fromTroops.infantry[t] - exhaustedFrom.infantry[t]),
        tanks:    Math.min(units.tanks[t]    ?? 0, fromTroops.tanks[t]    - exhaustedFrom.tanks[t]),
        planes:   Math.min(units.planes[t]   ?? 0, fromTroops.planes[t]   - exhaustedFrom.planes[t]),
        warships: Math.min(units.warships[t] ?? 0, fromTroops.warships[t] - exhaustedFrom.warships[t]),
      };
      fromTroops.infantry[t] -= mv.infantry;
      fromTroops.tanks[t]    -= mv.tanks;
      fromTroops.planes[t]   -= mv.planes;
      fromTroops.warships[t] -= mv.warships;
      toTroops.infantry[t]   += mv.infantry;
      toTroops.tanks[t]      += mv.tanks;
      toTroops.planes[t]     += mv.planes;
      toTroops.warships[t]   += mv.warships;
      exhaustedTo.infantry[t] += mv.infantry;
      exhaustedTo.tanks[t]    += mv.tanks;
      exhaustedTo.planes[t]   += mv.planes;
      exhaustedTo.warships[t] += mv.warships;
    }
    const isEmpty = (m: import('@undercover/shared').MilitaryUnits) =>
      m.infantry.every(v => v === 0) && m.tanks.every(v => v === 0) &&
      m.planes.every(v => v === 0)   && m.warships.every(v => v === 0);
    if (isEmpty(fromTroops)) delete serverPlayer.troopsByRegion[fromRegionId];
    serverPlayer.troopsByRegion[toRegionId] = toTroops;
    serverPlayer.exhaustedTroopsByRegion[toRegionId] = exhaustedTo;
    this.broadcastState(room);
  }

  handleOccupyNeutral(socket: ServerSocket, fromRegionId: string, toRegionId: string, units?: import('@undercover/shared').MilitaryUnits): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection' && snapshot.value !== 'roundSummary') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    // Validation : fromRegion appartient au joueur
    if (!serverPlayer.regions.some(r => r.id === fromRegionId && !r.occupiedBy && !r.destroyed)) return;

    // Validation : adjacence
    if (!areAdjacent(fromRegionId, toRegionId)) {
      socket.emit('room:error', { message: 'Ces provinces ne sont pas adjacentes.' });
      return;
    }

    // Validation : province neutre (aucun joueur ne la possède)
    const alreadyOwned = [...context.players.values()].some(p => p.regions.some(r => r.id === toRegionId));
    if (alreadyOwned) { socket.emit('room:error', { message: 'Cette province appartient déjà à un joueur.' }); return; }

    // Occupation immédiate : transférer la région au joueur
    const { name: provinceName, terrain: provinceTerrain } = getProvinceData(toRegionId);

    const newRegion: import('@undercover/shared').Region = {
      id: toRegionId,
      name: provinceName,
      population: 0.5,
      productionCapacity: 50,
      terrain: provinceTerrain,
      destroyed: false,
      destroyedUntilRound: null,
      occupiedBy: null,
      resistanceRemaining: 0,
      warIntegrity: 100,
      contestedByWarId: null,
      fortified: false,
    };

    serverPlayer.regions.push(newRegion);

    // Si des unités sont fournies, les déplacer depuis fromRegion vers toRegion
    if (units) {
      const fromTroops = serverPlayer.troopsByRegion[fromRegionId];
      if (fromTroops) {
        const toTroops = serverPlayer.troopsByRegion[toRegionId] ?? {
          infantry: [0, 0, 0] as [number, number, number],
          tanks:    [0, 0, 0] as [number, number, number],
          planes:   [0, 0, 0] as [number, number, number],
          warships: [0, 0, 0] as [number, number, number],
        };
        for (let t = 0; t < 3; t++) {
          const mv = {
            infantry: Math.min(units.infantry[t] ?? 0, fromTroops.infantry[t]),
            tanks:    Math.min(units.tanks[t]    ?? 0, fromTroops.tanks[t]),
            planes:   Math.min(units.planes[t]   ?? 0, fromTroops.planes[t]),
            warships: Math.min(units.warships[t] ?? 0, fromTroops.warships[t]),
          };
          fromTroops.infantry[t] -= mv.infantry;
          fromTroops.tanks[t]    -= mv.tanks;
          fromTroops.planes[t]   -= mv.planes;
          fromTroops.warships[t] -= mv.warships;
          toTroops.infantry[t]   += mv.infantry;
          toTroops.tanks[t]      += mv.tanks;
          toTroops.planes[t]     += mv.planes;
          toTroops.warships[t]   += mv.warships;
        }
        const isEmpty = (m: import('@undercover/shared').MilitaryUnits) =>
          m.infantry.every(v => v === 0) && m.tanks.every(v => v === 0) &&
          m.planes.every(v => v === 0)   && m.warships.every(v => v === 0);
        if (isEmpty(fromTroops)) delete serverPlayer.troopsByRegion[fromRegionId];
        serverPlayer.troopsByRegion[toRegionId] = toTroops;
      }
    }

    this.broadcastState(room);
  }

  handleFortifyProvince(socket: ServerSocket, regionId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection' && snapshot.value !== 'preparation') return;

    const context = snapshot.context;
    const serverPlayer = context.players.get(player.id);
    if (!serverPlayer) return;

    // Validate player owns the region
    const region = serverPlayer.regions.find(r => r.id === regionId && !r.destroyed);
    if (!region) { socket.emit('room:error', { message: 'Cette province ne vous appartient pas.' }); return; }

    // Validate sufficient funds
    if (serverPlayer.money < FORTIFY_COST) {
      socket.emit('room:error', { message: `Fonds insuffisants (${FORTIFY_COST}$ requis).` });
      return;
    }

    // Already fortified
    if (region.fortified) {
      socket.emit('room:error', { message: 'Cette province est déjà fortifiée.' });
      return;
    }

    serverPlayer.money -= FORTIFY_COST;
    region.fortified = true;

    this.broadcastState(room);
  }

  handleReady(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    this.sendEvent(room, { type: 'PLAYER_READY', playerId: player.id });
  }

  handleAbandon(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    this.sendEvent(room, { type: 'PLAYER_ABANDON', playerId: player.id });
  }

  handleResetGame(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;
    if (!this.isHost(room, player.id)) return;
    this.sendEvent(room, { type: 'RESET_GAME' });
  }

  // ─── Trade ──────────────────────────────────────────────────

  handleTradePropose(
    socket: ServerSocket,
    targetId: string,
    offer: { resource: ResourceType; quantity: number }[],
    moneyAmount: number,
    vehicles?: VehicleTradeItem[],
    maintenanceParts?: { tier: 1 | 2 | 3 | 4; quantity: number }[],
    militaryUnits?: MilitaryUnitTradeItem[],
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection' && snapshot.value !== 'preparation') return;
    if (targetId === player.id) return;

    const isPublic = targetId === '__public__';

    // Private trades: target must exist
    if (!isPublic && !room.players.has(targetId)) return;

    // Validate seller has the vehicles they're offering
    const seller = snapshot.context.players.get(player.id);
    if (vehicles && vehicles.length > 0 && seller) {
      for (const item of vehicles) {
        const owned = seller.fleet.vehicles.filter(
          v => v.type === item.vehicleType && v.tier === item.tier,
        ).length;
        if (owned < item.quantity) return;
      }
    }

    // Validate seller has the military units they're offering
    if (militaryUnits && militaryUnits.length > 0 && seller) {
      for (const item of militaryUnits) {
        const owned = seller.military.units[item.unitType][item.tier - 1] ?? 0;
        if (owned < item.quantity) return;
      }
    }

    const trade: TradeOffer = {
      id: randomUUID(),
      fromId: player.id,
      toId: targetId,
      offer,
      vehicles: vehicles && vehicles.length > 0 ? vehicles : undefined,
      maintenanceParts: maintenanceParts && maintenanceParts.length > 0 ? maintenanceParts : undefined,
      militaryUnits: militaryUnits && militaryUnits.length > 0 ? militaryUnits : undefined,
      moneyAmount: Math.max(0, Math.round(moneyAmount)),
      status: 'pending',
      roundProposed: snapshot.context.currentRound,
    };

    snapshot.context.activeTrades.push(trade);

    if (isPublic) {
      // Broadcast to all room members (market place)
      this.io.to(room.code).emit('trade:incoming', { trade });
    } else {
      // Add to specific target's incoming trades
      const targetState = snapshot.context.players.get(targetId);
      if (targetState) {
        targetState.incomingTrades.push(trade);
      }
      const targetPlayer = room.players.get(targetId);
      if (targetPlayer?.socketId) {
        this.io.to(targetPlayer.socketId).emit('trade:incoming', { trade });
      }
    }

    this.broadcastState(room);
  }

  handleTradeRespond(socket: ServerSocket, tradeId: string, accepted: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const trade = snapshot.context.activeTrades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'pending') return;

    const isPublic = trade.toId === '__public__';
    if (!isPublic && trade.toId !== player.id) return;

    if (!accepted) {
      trade.status = 'rejected';
      const buyerState = snapshot.context.players.get(player.id);
      if (buyerState) {
        buyerState.incomingTrades = buyerState.incomingTrades.filter(t => t.id !== tradeId);
      }
      socket.emit('trade:result', { tradeId, accepted: false });
      this.broadcastState(room);
      return;
    }

    // First acceptance → start auction
    const buyerId = player.id;
    const sellerId = trade.fromId;
    if (buyerId === sellerId) return;

    const seller = snapshot.context.players.get(sellerId);
    const buyer  = snapshot.context.players.get(buyerId);
    if (!seller || !buyer) return;

    // Mark trade as auctioning so it's not processed by resolveCommerce
    if (isPublic) trade.toId = buyerId;
    trade.status = 'auctioning';

    const auction: TradeAuction = {
      id: randomUUID(),
      tradeId: trade.id,
      fromId: sellerId,
      fromName: seller.countryName,
      offer: trade.offer.map(o => ({ resource: o.resource, quantity: o.quantity })),
      vehicles: trade.vehicles,
      basePrice: trade.moneyAmount,
      currentPrice: trade.moneyAmount,
      currentWinnerId: buyerId,
      currentWinnerName: buyer.countryName,
      expiresAt: Date.now() + AUCTION_DURATION_MS,
    };

    const timer = setTimeout(() => {
      this.resolveAuction(room, auction.id);
    }, AUCTION_DURATION_MS);

    room.activeAuctions.set(auction.id, { auction, timer });

    this.broadcastState(room);
  }

  handleAuctionBid(socket: ServerSocket, auctionId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const entry = room.activeAuctions.get(auctionId);
    if (!entry) return;
    const { auction } = entry;

    // Seller cannot bid; current winner cannot outbid themselves
    if (player.id === auction.fromId) return;
    if (player.id === auction.currentWinnerId) return;

    const snapshot = room.actor.getSnapshot();
    const bidder = snapshot.context.players.get(player.id);
    if (!bidder) return;

    const newPrice = auction.currentPrice + 15;

    // Check bidder can afford new price (rough pre-check; final check at resolution)
    if (bidder.money < newPrice) return;

    auction.currentPrice = newPrice;
    auction.currentWinnerId = player.id;
    auction.currentWinnerName = bidder.countryName;

    this.broadcastState(room);
  }

  private resolveAuction(room: Room, auctionId: string): void {
    const entry = room.activeAuctions.get(auctionId);
    if (!entry) return;
    const { auction } = entry;

    room.activeAuctions.delete(auctionId);

    const snapshot = room.actor.getSnapshot();
    const seller = snapshot.context.players.get(auction.fromId);
    const buyer  = snapshot.context.players.get(auction.currentWinnerId);

    const trade = snapshot.context.activeTrades.find(t => t.id === auction.tradeId);

    let success = false;

    if (seller && buyer && seller.id !== buyer.id) {
      // Calculate effective tax rate (org / embargo)
      const sameOrg     = areInSameCommercialOrg(seller, buyer, snapshot.context);
      const embargoRate = getEmbargoSurcharge(buyer, seller, snapshot.context);
      const taxRate     = sameOrg ? 0 : (embargoRate > 0 ? embargoRate : ORG_TRADE_TAX_MIN);
      const taxAmount   = Math.floor(auction.currentPrice * taxRate);
      const totalPaid   = auction.currentPrice + taxAmount;

      // Verify seller can still deliver resources
      let sellerCanDeliver = true;
      for (const item of auction.offer) {
        if ((seller.resources[item.resource as ResourceType] ?? 0) < item.quantity) {
          sellerCanDeliver = false;
          break;
        }
      }

      // Verify seller still has the vehicles they offered
      if (sellerCanDeliver && auction.vehicles) {
        for (const vItem of auction.vehicles) {
          const owned = seller.fleet.vehicles.filter(
            v => v.type === vItem.vehicleType && v.tier === vItem.tier,
          ).length;
          if (owned < vItem.quantity) { sellerCanDeliver = false; break; }
        }
      }

      if (sellerCanDeliver && buyer.money >= totalPaid) {
        buyer.money   -= totalPaid;
        seller.money  += auction.currentPrice;
        for (const item of auction.offer) {
          const res = item.resource as ResourceType;
          seller.resources[res] = Math.max(0, (seller.resources[res] ?? 0) - item.quantity);
          buyer.resources[res]  = (buyer.resources[res] ?? 0) + item.quantity;
        }
        // Transfer vehicles
        if (auction.vehicles) {
          for (const vItem of auction.vehicles) {
            let remaining = vItem.quantity;
            seller.fleet.vehicles = seller.fleet.vehicles.filter(v => {
              if (remaining > 0 && v.type === vItem.vehicleType && v.tier === vItem.tier) {
                buyer.fleet.vehicles.push({ ...v });
                remaining--;
                return false;
              }
              return true;
            });
            // Recalculate totalCapacity
            const spec = VEHICLE_SPEC_MAP[vItem.vehicleType]?.[vItem.tier];
            if (spec) {
              seller.fleet.totalCapacity = Math.max(0, seller.fleet.totalCapacity - spec.capacity * vItem.quantity);
              buyer.fleet.totalCapacity  = (buyer.fleet.totalCapacity ?? 0)  + spec.capacity * vItem.quantity;
            }
          }
        }
        if (trade) trade.status = 'completed';
        success = true;
      } else {
        if (trade) trade.status = 'rejected';
      }
    } else {
      if (trade) trade.status = 'rejected';
    }

    // Notify all players of auction result
    this.io.to(room.code).emit('trade:result', {
      tradeId: auction.tradeId,
      accepted: success,
    });

    this.broadcastState(room);
  }

  // ─── Region Purchase ────────────────────────────────────────

  handleRegionPurchaseRespond(socket: ServerSocket, offerId: string, accepted: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player: sellerRoomPlayer } = resolved;

    const context = room.actor.getSnapshot().context;
    const seller = context.players.get(sellerRoomPlayer.id);
    if (!seller) return;

    const offerIdx = seller.incomingRegionPurchases.findIndex(o => o.id === offerId && o.status === 'pending');
    if (offerIdx === -1) return;

    const offer = seller.incomingRegionPurchases[offerIdx];
    const buyer = context.players.get(offer.fromId);
    const buyerSocketId = buyer ? room.players.get(buyer.id)?.socketId : null;

    if (!accepted || !buyer) {
      offer.status = 'rejected';
      seller.incomingRegionPurchases.splice(offerIdx, 1);
      if (buyerSocketId) this.io.to(buyerSocketId).emit('region:purchaseResult', { offerId, accepted: false, regionName: offer.regionName });
      return;
    }

    // Validate: buyer must afford it and seller must still own the region
    const region = seller.regions.find(r => r.id === offer.regionId && !r.occupiedBy && !r.destroyed);
    if (!region || buyer.money < offer.price) {
      offer.status = 'rejected';
      seller.incomingRegionPurchases.splice(offerIdx, 1);
      if (buyerSocketId) this.io.to(buyerSocketId).emit('region:purchaseResult', { offerId, accepted: false, regionName: offer.regionName });
      return;
    }

    // Transfer
    offer.status = 'accepted';
    seller.incomingRegionPurchases.splice(offerIdx, 1);

    // Move region object
    const regionIdx = seller.regions.findIndex(r => r.id === region.id);
    seller.regions.splice(regionIdx, 1);
    region.occupiedBy = null;
    region.resistanceRemaining = 0;
    buyer.regions.push(region);

    // Transfer population proportional to region share (before removal, so include removed region)
    const totalSellerRegionPop = seller.regions.reduce((sum: number, r) => sum + r.population, 0) + region.population;
    const fraction = totalSellerRegionPop > 0 ? region.population / totalSellerRegionPop : 0;
    const transferredPop = seller.population.total * fraction;
    seller.population.total = Math.max(0.1, seller.population.total - transferredPop);
    buyer.population.total += transferredPop;

    // Money transfer
    buyer.money -= offer.price;
    seller.money += offer.price;

    // Notify both parties
    const sellerSocketId = room.players.get(seller.id)?.socketId;
    if (buyerSocketId) this.io.to(buyerSocketId).emit('region:purchaseResult', { offerId, accepted: true, regionName: region.name });
    if (sellerSocketId) this.io.to(sellerSocketId).emit('region:purchaseResult', { offerId, accepted: true, regionName: region.name });

    // Broadcast updated game state
    this.broadcastState(room);
  }

  // ─── Organizations ──────────────────────────────────────────

  handleOrgCreate(
    socket: ServerSocket,
    name: string,
    type: OrganizationType,
    invitedPlayerIds: string[],
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value === 'lobby' || snapshot.value === 'countrySelection' || snapshot.value === 'victory') return;

    // Filter to valid invited players (exclude creator, must be in room)
    const validInvited = invitedPlayerIds.filter(id => id !== player.id && room.players.has(id));

    // Need at least 2 invited so that total with creator = 3
    if (validInvited.length < 2) {
      socket.emit('room:error', { message: 'Minimum 3 membres requis pour créer une organisation.' });
      return;
    }

    const creatorState = snapshot.context.players.get(player.id);

    const pending: PendingOrg = {
      id: randomUUID(),
      name,
      type,
      creatorId: player.id,
      creatorName: creatorState?.countryName ?? player.name,
      acceptedIds: [player.id],
      pendingIds: validInvited,
    };

    room.pendingOrgs.set(pending.id, pending);

    // Notify each invited player individually so they all see the invite
    for (const invitedId of validInvited) {
      const invitedPlayer = room.players.get(invitedId);
      if (invitedPlayer?.socketId) {
        this.io.to(invitedPlayer.socketId).emit('notification:alert', {
          id: randomUUID(),
          type: 'org_vote_started',
          title: 'Invitation organisation',
          message: `${pending.creatorName} vous invite à rejoindre « ${name} »`,
          icon: '🏛️',
          severity: 'info',
          round: snapshot.context.currentRound,
          read: false,
        });
      }
    }

    this.broadcastState(room);
  }

  handleOrgRespondInvite(socket: ServerSocket, pendingOrgId: string, accepted: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const pending = room.pendingOrgs.get(pendingOrgId);
    if (!pending) return;
    if (!pending.pendingIds.includes(player.id)) return;

    // Move player from pendingIds to acceptedIds or cancel
    pending.pendingIds = pending.pendingIds.filter(id => id !== player.id);

    if (!accepted) {
      // One refusal cancels the org
      room.pendingOrgs.delete(pendingOrgId);
      this.broadcastState(room);
      return;
    }

    pending.acceptedIds.push(player.id);

    // If everyone accepted
    if (pending.pendingIds.length === 0) {
      room.pendingOrgs.delete(pendingOrgId);

      const snapshot = room.actor.getSnapshot();
      const org = createOrganization(pending.name, pending.type, pending.acceptedIds, snapshot.context.currentRound);
      if (org) {
        snapshot.context.organizations.push(org);
        for (const memberId of org.memberIds) {
          const memberState = snapshot.context.players.get(memberId);
          if (memberState) memberState.organizationMemberships.push(org.id);
        }
        this.io.to(room.code).emit('org:updated', { org });
      }
    }

    this.broadcastState(room);
  }

  handleOrgRequestJoin(socket: ServerSocket, orgId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const requester = snapshot.context.players.get(player.id);
    const request = addJoinRequest(org, player.id, requester?.countryName ?? player.name, snapshot.context.currentRound);
    if (request) {
      this.broadcastState(room);
    }
  }

  handleOrgVoteJoinRequest(socket: ServerSocket, orgId: string, requestId: string, vote: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const success = voteOnJoinRequest(org, requestId, player.id, vote, snapshot.context.players);
    if (success) {
      this.io.to(room.code).emit('org:updated', { org });
      this.broadcastState(room);
    }
  }

  handleOrgProposeExpel(socket: ServerSocket, orgId: string, targetId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const vote = proposeExpelMember(org, player.id, targetId, snapshot.context.currentRound);
    if (vote) {
      for (const memberId of org.memberIds) {
        const memberSocket = room.players.get(memberId);
        if (memberSocket?.socketId) {
          this.io.to(memberSocket.socketId).emit('org:voteStarted', { orgId: org.id, voteId: vote.id, description: vote.description });
        }
      }
      this.broadcastState(room);
    }
  }

  handleOrgVote(socket: ServerSocket, orgId: string, voteId: string, vote: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const success = castVote(org, voteId, player.id, vote);
    if (success) {
      this.io.to(room.code).emit('org:updated', { org });
      this.broadcastState(room);
    }
  }

  handleOrgLeave(socket: ServerSocket, orgId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const playerState = snapshot.context.players.get(player.id);
    if (!playerState) return;

    leaveOrganization(org, player.id, playerState);
    this.io.to(room.code).emit('org:updated', { org });
    this.broadcastState(room);
  }

  handleOrgProposeEmbargo(socket: ServerSocket, orgId: string, targetId: string, rate: number): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;
    const target = snapshot.context.players.get(targetId);

    const vote = proposeEmbargo(org, player.id, targetId, target?.countryName ?? targetId, rate, snapshot.context.currentRound);
    if (vote) {
      for (const memberId of org.memberIds) {
        const memberSocket = room.players.get(memberId);
        if (memberSocket?.socketId) {
          this.io.to(memberSocket.socketId).emit('org:voteStarted', { orgId: org.id, voteId: vote.id, description: vote.description });
        }
      }
      this.broadcastState(room);
    }
  }

  handleOrgProposeAidRequest(socket: ServerSocket, orgId: string, motivationText: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const vote = proposeAidRequest(org, player.id, motivationText, snapshot.context.currentRound);
    if (vote) {
      for (const memberId of org.memberIds) {
        const memberSocket = room.players.get(memberId);
        if (memberSocket?.socketId) {
          this.io.to(memberSocket.socketId).emit('org:voteStarted', { orgId: org.id, voteId: vote.id, description: vote.description });
        }
      }
      this.broadcastState(room);
    }
  }

  handleOrgCastAmountVote(socket: ServerSocket, orgId: string, voteId: string, amount: number): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    castAmountVote(org, voteId, player.id, amount, snapshot.context.players);
    this.io.to(room.code).emit('org:updated', { org });
    this.broadcastState(room);
  }

  // ─── Sanctions ──────────────────────────────────────────────

  handleSanctionApply(socket: ServerSocket, targetId: string, type: 'trade' | 'tourism' | 'full'): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value === 'lobby' || snapshot.value === 'countrySelection' || snapshot.value === 'victory') return;

    const imposerState = snapshot.context.players.get(player.id);
    const targetState = snapshot.context.players.get(targetId);
    if (!imposerState || !targetState || targetId === player.id) return;

    const sanction = applySanction(imposerState, targetState, type, 'suspicion');
    sanction.roundImposed = snapshot.context.currentRound;

    // Notify target
    const targetSocket = room.players.get(targetId);
    if (targetSocket?.socketId) {
      this.io.to(targetSocket.socketId).emit('notification:alert', {
        id: randomUUID(),
        type: 'sanction_imposed',
        title: 'Sanction imposée',
        message: `${imposerState.countryName} vous a imposé une sanction (${type}).`,
        icon: '⚠️',
        severity: 'danger',
        round: snapshot.context.currentRound,
        read: false,
      });
    }

    this.broadcastState(room);
  }

  handleSanctionLift(socket: ServerSocket, sanctionId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    // Find and remove the sanction
    for (const [, playerState] of snapshot.context.players) {
      const idx = playerState.activeSanctions.findIndex(s => s.id === sanctionId && s.imposedBy === player.id);
      if (idx !== -1) {
        const sanction = playerState.activeSanctions[idx];
        playerState.activeSanctions.splice(idx, 1);

        // Clean up tourism bans
        if (sanction.type === 'tourism') {
          playerState.tourism.bannedBy = playerState.tourism.bannedBy.filter(id => id !== player.id);
          const imposerState = snapshot.context.players.get(player.id);
          if (imposerState) {
            imposerState.tourism.bannedCountries = imposerState.tourism.bannedCountries.filter(id => id !== playerState.id);
          }
        }
        break;
      }
    }

    this.broadcastState(room);
  }

  // ─── Threats ────────────────────────────────────────────────

  handleThreatDeclare(
    socket: ServerSocket,
    targetId: string,
    targetInfrastructure: ThreatInfraTarget,
    demand: ThreatDemand,
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value === 'lobby' || snapshot.value === 'countrySelection' || snapshot.value === 'victory') return;
    if (targetId === player.id) return;

    const threat: Threat = {
      id: randomUUID(),
      attackerId: player.id,
      targetId,
      targetInfrastructure,
      demand,
      status: 'pending',
      roundDeclared: snapshot.context.currentRound,
      deadlineRound: snapshot.context.currentRound + 2,
    };

    snapshot.context.activeThreats.push(threat);

    // Notify target
    const targetSocket = room.players.get(targetId);
    if (targetSocket?.socketId) {
      this.io.to(targetSocket.socketId).emit('threat:received', { threat });
    }

    this.broadcastState(room);
  }

  handleThreatRespond(socket: ServerSocket, threatId: string, accepted: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const threat = snapshot.context.activeThreats.find(t => t.id === threatId);
    if (!threat || threat.targetId !== player.id || threat.status !== 'pending') return;

    threat.status = accepted ? 'accepted' : 'refused';

    // Notify attacker
    const attackerSocket = room.players.get(threat.attackerId);
    if (attackerSocket?.socketId) {
      this.io.to(attackerSocket.socketId).emit('threat:resolved', {
        threatId: threat.id,
        status: threat.status,
      });
    }

    // Notify respondent so their UI removes the threat from incomingThreats
    socket.emit('threat:resolved', {
      threatId: threat.id,
      status: threat.status,
    });

    this.broadcastState(room);
  }

  handleThreatExecute(socket: ServerSocket, threatId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const threat = snapshot.context.activeThreats.find(t => t.id === threatId);
    if (!threat || threat.attackerId !== player.id) return;
    if (threat.status !== 'pending' && threat.status !== 'refused') return;

    threat.status = 'executed';

    // Notify target
    const targetSocket = room.players.get(threat.targetId);
    if (targetSocket?.socketId) {
      this.io.to(targetSocket.socketId).emit('threat:resolved', {
        threatId: threat.id,
        status: 'executed',
      });
    }

    this.broadcastState(room);
  }

  handleThreatWithdraw(socket: ServerSocket, threatId: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const threat = snapshot.context.activeThreats.find(t => t.id === threatId);
    if (!threat || threat.attackerId !== player.id || threat.status !== 'pending') return;

    threat.status = 'withdrawn';

    // Notify target
    const targetSocket = room.players.get(threat.targetId);
    if (targetSocket?.socketId) {
      this.io.to(targetSocket.socketId).emit('threat:resolved', {
        threatId: threat.id,
        status: 'withdrawn',
      });
    }

    this.broadcastState(room);
  }

  // ─── Chat ───────────────────────────────────────────────────

  handleChatMessage(socket: ServerSocket, channel: 'public' | string, message: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const trimmed = message.trim().slice(0, 500);
    if (!trimmed) return;

    const chatPayload = {
      from: player.id,
      fromName: player.name,
      channel,
      message: trimmed,
      timestamp: Date.now(),
    };

    if (channel === 'public') {
      this.io.to(room.code).emit('chat:message', chatPayload);
    } else {
      // DM — send to target + sender
      const targetPlayer = room.players.get(channel);
      if (targetPlayer?.socketId) {
        this.io.to(targetPlayer.socketId).emit('chat:message', chatPayload);
      }
      socket.emit('chat:message', chatPayload);
    }
  }

  // ─── Actor Snapshot Handler ──────────────────────────────────

  private handleActorSnapshot(room: Room, snapshot: EcoWarSnapshot): void {
    const prevPhase = this.roomPreviousPhases.get(room.code);
    const currPhase = snapshot.value as string;
    this.roomPreviousPhases.set(room.code, currPhase);

    // Emit resolution:complete when entering resolution phase
    if (currPhase === 'resolution' && prevPhase !== 'resolution') {
      const log = snapshot.context.resolutionLog;
      if (log.length > 0) {
        this.io.to(room.code).emit('resolution:complete', { roundSummary: log });
      }
    }

    // Emit journal:headlines when entering marketEvent phase (tech spec §4 S2C events)
    if (currPhase === 'marketEvent' && prevPhase !== 'marketEvent') {
      const headlines = snapshot.context.journalHeadlines;
      if (headlines.length > 0) {
        this.io.to(room.code).emit('journal:headlines', { headlines });
      }
    }

    this.syncActionTimer(room, snapshot);
    this.schedulePhaseAdvance(room, snapshot);
    this.broadcastState(room);
  }

  // ─── Action Timer ────────────────────────────────────────────

  private syncActionTimer(room: Room, snapshot: EcoWarSnapshot): void {
    if (snapshot.value !== 'actionSelection') {
      this.stopActionTimer(room);
      return;
    }

    // Pas de timer global : on attend que tout le monde joue librement.
    // Dès qu'il ne reste QU'UN SEUL joueur à soumettre → 10 minutes max pour lui.
    const activePlayers = Array.from(snapshot.context.players.values()).filter(p => !p.abandoned);
    const notSubmitted = activePlayers.filter(p => !p.actionsSubmitted).length;

    if (notSubmitted === 1 && activePlayers.length > 1) {
      // Dernier joueur : démarrer le countdown 10 min si pas déjà en cours
      if (!room.actionTimerInterval) {
        this.startActionTimer(room, 600);
      }
    } else {
      // Plusieurs joueurs pas encore soumis — pas de timer
      this.stopActionTimer(room);
    }
  }

  private startActionTimer(room: Room, seconds: number): void {
    this.stopActionTimer(room);

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection') return;

    let remaining = seconds;
    this.actionTimerRemaining.set(room.code, remaining);

    room.actionTimerInterval = setInterval(() => {
      const liveRoom = this.rooms.get(room.code);
      if (!liveRoom) return;

      const liveSnapshot = liveRoom.actor.getSnapshot();
      if (liveSnapshot.value !== 'actionSelection') {
        this.stopActionTimer(liveRoom);
        return;
      }

      remaining -= 1;
      this.actionTimerRemaining.set(liveRoom.code, Math.max(remaining, 0));

      // Broadcast timer tick
      this.io.to(liveRoom.code).emit('game:timerTick', { remaining: Math.max(remaining, 0) });

      if (remaining <= 0) {
        this.stopActionTimer(liveRoom);
        this.sendEvent(liveRoom, { type: 'ACTION_TIMEOUT' });
      }
    }, 1000);
  }

  private stopActionTimer(room: Room): void {
    if (room.actionTimerInterval) {
      clearInterval(room.actionTimerInterval);
      room.actionTimerInterval = null;
    }
    this.actionTimerRemaining.delete(room.code);
  }

  // ─── Phase Auto-Advance ──────────────────────────────────────

  private schedulePhaseAdvance(room: Room, snapshot: EcoWarSnapshot): void {
    this.clearPhaseAdvanceTimer(room);

    const currentPhase = this.resolvePhase(snapshot);

    // ── Preparation: ONLY advance when ALL active players clicked Prêt ──
    // Never set a fallback timer — the phase waits indefinitely for players.
    if (currentPhase === 'preparation') {
      const activePlayers = Array.from(snapshot.context.players.values())
        .filter(p => !p.abandoned && p.connected);
      if (activePlayers.length > 0 && activePlayers.every(p => p.ready)) {
        room.phaseAdvanceTimer = setTimeout(() => {
          const liveRoom = this.rooms.get(room.code);
          if (!liveRoom) return;
          this.sendEvent(liveRoom, { type: 'ADVANCE_PHASE' });
        }, 0);
      }
      // Always return — never fall through to the timed auto-advance below
      return;
    }

    // ── resolution & marketEvent: auto-advance after a short delay ──
    const autoAdvancePhases = ['resolution', 'marketEvent'];
    if (!autoAdvancePhases.includes(currentPhase)) return;

    room.phaseAdvanceTimer = setTimeout(() => {
      const liveRoom = this.rooms.get(room.code);
      if (!liveRoom) return;
      this.sendEvent(liveRoom, { type: 'ADVANCE_PHASE' });
    }, PHASE_AUTO_ADVANCE_MS);
  }

  private clearPhaseAdvanceTimer(room: Room): void {
    if (room.phaseAdvanceTimer) {
      clearTimeout(room.phaseAdvanceTimer);
      room.phaseAdvanceTimer = null;
    }
  }

  // ─── State Broadcasting ──────────────────────────────────────

  private broadcastState(room: Room): void {
    const snapshot = room.actor.getSnapshot();
    const context = snapshot.context;
    const publicState = this.buildPublicState(context, room);

    // Broadcast public state to all
    this.io.to(room.code).emit('game:publicState', publicState);

    // During country selection, send the available countries list
    if (snapshot.value === 'countrySelection') {
      const takenIds = COUNTRY_PROFILES
        .filter(c => !context.availableCountries.includes(c.id))
        .map(c => c.id);
      this.io.to(room.code).emit('game:countryList', {
        countries: COUNTRY_PROFILES,
        takenIds,
      });
    }

    // Send private state to each player individually
    for (const [playerId, roomPlayer] of room.players) {
      if (!roomPlayer.socketId) continue;
      const privateState = this.buildPrivateState(context, playerId);
      if (privateState) {
        this.io.to(roomPlayer.socketId).emit('game:privateState', privateState);
      }
    }
  }

  private buildPublicState(context: EcoWarGameContext, room: Room): EcoWarPublicGameState {
    const players: PublicPlayerInfo[] = [];

    for (const [playerId, roomPlayer] of room.players) {
      const mp = context.players.get(playerId);
      players.push({
        id: playerId,
        name: roomPlayer.name,
        countryId: mp?.countryId || '',
        countryName: mp?.countryName || '',
        countryFlag: mp?.countryFlag || '',
        score: mp?.score || 0,
        wealthTier: getWealthTier(mp?.score || 0),
        gdp: mp?.gdp || 0,
        connected: roomPlayer.socketId !== null,
        abandoned: mp?.abandoned || false,
        ready: mp?.ready || false,
        actionsSubmitted: mp?.actionsSubmitted || false,
        militaryPower: getMilitaryPowerLabel(mp?.military.effectiveForce || 0),
        atWar: mp?.activeEffects.some(e => e.type === 'war_attacker' || e.type === 'war_defender') || false,
        organizationIds: mp?.organizationMemberships || [],
        regions: mp?.regions || [],
        population: mp?.population.total || 0,
      });
    }

    const activeWars: PublicWarInfo[] = context.activeWars
      .filter(w => w.status === 'active' || w.status === 'armistice')
      .map(w => ({
        id: w.id,
        attackerName: context.players.get(w.attackerId)?.countryName || '',
        attackerId: w.attackerId,
        defenderName: context.players.get(w.defenderId)?.countryName || '',
        defenderId: w.defenderId,
        duration: w.duration,
        status: w.status,
        armisticeProposedBy: w.armisticeProposedBy,
      }));

    const pendingThreats: PublicThreatInfo[] = context.activeThreats
      .filter(t => t.status === 'pending')
      .map(t => ({
        id: t.id,
        attackerName: context.players.get(t.attackerId)?.countryName || '',
        attackerId: t.attackerId,
        targetName: context.players.get(t.targetId)?.countryName || '',
        targetId: t.targetId,
        demand: t.demand,
        status: t.status,
        deadlineRound: t.deadlineRound,
      }));

    return {
      phase: this.resolvePhase(room.actor.getSnapshot()),
      currentRound: context.currentRound,
      config: context.config,
      timer: this.actionTimerRemaining.get(room.code) || null,
      hostId: room.hostId,
      players,
      leaderboard: context.leaderboard,
      activeWars,
      organizations: context.organizations,
      marketEvent: context.marketEvents[0] || null,
      journalHeadlines: context.journalHeadlines,
      pendingThreats,
      activeAuctions: [...room.activeAuctions.values()].map(e => e.auction),
      pendingOrgs: [...room.pendingOrgs.values()],
      activeSanctions: (() => {
        const seen = new Set<string>();
        const result: { targetId: string; imposedBy: string; type: 'trade' | 'tourism' | 'full' }[] = [];
        for (const [, player] of context.players) {
          for (const s of player.activeSanctions) {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              result.push({ targetId: s.targetId, imposedBy: s.imposedBy, type: s.type });
            }
          }
        }
        return result;
      })(),
    };
  }

  private buildPrivateState(context: EcoWarGameContext, playerId: string): EcoWarPrivatePlayerState | null {
    const mp = context.players.get(playerId);
    if (!mp) return null;

    return {
      playerId,
      money: mp.money,
      resources: { ...mp.resources },
      population: { ...mp.population },
      happiness: mp.population.happinessLevel,
      health: mp.population.healthLevel,
      pollution: mp.pollution,
      regions: mp.regions.map(r => ({ ...r })),
      factories: mp.factories.map(f => ({ ...f })),
      research: {
        globalLevel: mp.research.globalLevel,
        branches: { ...mp.research.branches },
        educationLevel: mp.research.educationLevel,
      },
      patents: [...mp.patents],
      tools: { ...mp.tools },
      finance: { ...mp.finance },
      infrastructure: { ...mp.infrastructure },
      transport: { ...mp.transport },
      tourism: {
        ...mp.tourism,
        monuments: [...mp.tourism.monuments],
        bannedCountries: [...mp.tourism.bannedCountries],
        bannedBy: [...mp.tourism.bannedBy],
      },
      military: {
        ...mp.military,
        weapons: mp.military.weapons.map(w => ({ ...w })),
      },
      mining: {
        oil:        { ...mp.mining.oil },
        iron:       { ...mp.mining.iron },
        coal:       { ...mp.mining.coal },
        rareEarths: { ...mp.mining.rareEarths },
        precious:   { ...mp.mining.precious },
        uranium:    { ...mp.mining.uranium },
      },
      agriculture: {
        plots:          mp.agriculture.plots.map(p => ({ ...p })),
        irrigationLevel: mp.agriculture.irrigationLevel,
      },
      livestock: {
        herds: mp.livestock.herds.map(h => ({ ...h })),
      },
      marine: { ...mp.marine },
      fleet: {
        vehicles: mp.fleet.vehicles.map(v => ({ ...v })),
        totalCapacity: mp.fleet.vehicles.reduce((s, v) => s + v.capacity, 0),
      },
      maintenanceParts: mp.maintenanceParts.map(p => ({ ...p })),
      troopsByRegion: Object.fromEntries(
        Object.entries(mp.troopsByRegion).map(([k, v]) => [k, {
          infantry: [...v.infantry] as [number, number, number],
          tanks:    [...v.tanks]    as [number, number, number],
          planes:   [...v.planes]   as [number, number, number],
          warships: [...v.warships] as [number, number, number],
        }])
      ),
      exhaustedTroopsByRegion: Object.fromEntries(
        Object.entries(mp.exhaustedTroopsByRegion).map(([k, v]) => [k, {
          infantry: [...v.infantry] as [number, number, number],
          tanks:    [...v.tanks]    as [number, number, number],
          planes:   [...v.planes]   as [number, number, number],
          warships: [...v.warships] as [number, number, number],
        }])
      ),
      enemyTroopsByRegion: (() => {
        // Provinces où le joueur courant a des troupes OU possède la province
        const myRegionIds = new Set(mp.regions.map(r => r.id));
        const myTroopRegions = new Set(Object.keys(mp.troopsByRegion));
        const relevantRegions = new Set([...myRegionIds, ...myTroopRegions]);
        const result: Record<string, { playerId: string; playerName: string; units: import('@undercover/shared').MilitaryUnits }[]> = {};
        for (const [otherId, other] of context.players) {
          if (otherId === playerId) continue;
          for (const [regionId, troops] of Object.entries(other.troopsByRegion)) {
            if (!relevantRegions.has(regionId)) continue;
            const total = troops.infantry.reduce((s,v)=>s+v,0) + troops.tanks.reduce((s,v)=>s+v,0)
              + troops.planes.reduce((s,v)=>s+v,0) + troops.warships.reduce((s,v)=>s+v,0);
            if (total === 0) continue;
            if (!result[regionId]) result[regionId] = [];
            result[regionId].push({
              playerId: otherId,
              playerName: other.countryName,
              units: {
                infantry: [...troops.infantry] as [number, number, number],
                tanks:    [...troops.tanks]    as [number, number, number],
                planes:   [...troops.planes]   as [number, number, number],
                warships: [...troops.warships] as [number, number, number],
              },
            });
          }
        }
        return result;
      })(),
      productionChoices: { ...mp.productionChoices },
      availableActions: mp.availableActions,
      submittedActions: mp.submittedActions.length > 0 ? [...mp.submittedActions] : null,
      espionageResults: [...mp.espionageResults],
      incomingTrades: [...mp.incomingTrades],
      incomingRegionPurchases: [...mp.incomingRegionPurchases],
      notifications: [...mp.notifications],
      organizationMemberships: [...mp.organizationMemberships],
      activeSanctions: [...mp.activeSanctions],
      gdp: mp.gdp,
      influence: mp.influence,
      score: mp.score,
      factoryProduction: buildFactoryProductionInfo(mp),
      alerts: buildAlerts(mp),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private resolvePhase(snapshot: EcoWarSnapshot): EcoWarPhase {
    if (snapshot.value === 'lobby') return 'lobby';
    if (snapshot.value === 'countrySelection') return 'countrySelection';
    if (snapshot.value === 'preparation') return 'preparation';
    if (snapshot.value === 'actionSelection') return 'actionSelection';
    if (snapshot.value === 'resolution') return 'resolution';
    if (snapshot.value === 'marketEvent') return 'marketEvent';
    if (snapshot.value === 'roundSummary') return 'roundSummary';
    if (snapshot.value === 'victory') return 'victory';
    return 'lobby';
  }

  private resolveRoomAndPlayer(socket: ServerSocket): { room: Room; player: RoomPlayer } | null {
    const roomCode = this.socketPresence.get(socket.id);
    if (!roomCode) {
      socket.emit('room:error', { message: 'Vous n\'êtes pas dans une salle.' });
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      socket.emit('room:error', { message: 'La salle n\'existe plus.' });
      return null;
    }

    const player = this.findPlayerBySocket(room, socket.id);
    if (!player) {
      socket.emit('room:error', { message: 'Session joueur introuvable.' });
      return null;
    }

    return { room, player };
  }

  private findPlayerBySocket(room: Room, socketId: string): RoomPlayer | undefined {
    return [...room.players.values()].find((p) => p.socketId === socketId);
  }

  private removePlayer(room: Room, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) return;

    if (player.socketId) {
      this.socketPresence.delete(player.socketId);
    }

    this.clearDisconnectTimer(room, playerId);
    room.players.delete(playerId);
    this.sendEvent(room, { type: 'REMOVE_PLAYER', playerId });
    this.reassignHostIfNeeded(room);

    if (room.players.size === 0) {
      this.scheduleEmptyRoomCleanup(room);
    } else {
      this.clearEmptyRoomTimer(room);
    }

    this.broadcastState(room);
  }

  private scheduleEmptyRoomCleanup(room: Room): void {
    this.clearEmptyRoomTimer(room);

    room.emptyRoomTimer = setTimeout(() => {
      const liveRoom = this.rooms.get(room.code);
      if (!liveRoom || liveRoom.players.size > 0) return;

      this.stopActionTimer(liveRoom);
      this.clearPhaseAdvanceTimer(liveRoom);

      for (const timer of liveRoom.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      liveRoom.disconnectTimers.clear();
      liveRoom.actor.stop();
      this.rooms.delete(liveRoom.code);
      this.roomPreviousPhases.delete(liveRoom.code);
    }, EMPTY_ROOM_CLEANUP_MS);
  }

  private clearEmptyRoomTimer(room: Room): void {
    if (!room.emptyRoomTimer) return;
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }

  private clearDisconnectTimer(room: Room, playerId: string): void {
    const timer = room.disconnectTimers.get(playerId);
    if (!timer) return;
    clearTimeout(timer);
    room.disconnectTimers.delete(playerId);
  }

  private reassignHostIfNeeded(room: Room): void {
    const currentHost = room.players.get(room.hostId);
    if (currentHost && currentHost.socketId !== null) return;

    const connectedPlayer = [...room.players.values()].find((p) => p.socketId !== null);
    const fallbackPlayer = [...room.players.values()][0];
    const nextHost = connectedPlayer ?? fallbackPlayer;
    const nextHostId = nextHost?.id ?? '';

    if (room.hostId === nextHostId) return;
    room.hostId = nextHostId;

    if (nextHostId) {
      this.io.to(room.code).emit('room:hostChanged', { hostId: nextHostId });
    }
  }

  private isHost(room: Room, playerId: string): boolean {
    return room.hostId === playerId;
  }

  private sendEvent(room: Room, event: EcoWarMachineEvent): void {
    room.actor.send(event);
  }

  private createRoomPlayer(playerName: string, socketId: string): RoomPlayer {
    const normalized = playerName.trim();
    return {
      id: randomUUID(),
      name: normalized.length > 0 ? normalized.slice(0, 24) : 'Joueur',
      socketId,
      playerToken: randomUUID(),
    };
  }

  private generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_CHARSET[randomInt(0, ROOM_CODE_CHARSET.length)];
    }
    return code;
  }
}

function getMilitaryPowerLabel(force: number): 'weak' | 'moderate' | 'strong' | 'superpower' {
  if (force >= 80) return 'superpower';
  if (force >= 50) return 'strong';
  if (force >= 25) return 'moderate';
  return 'weak';
}
