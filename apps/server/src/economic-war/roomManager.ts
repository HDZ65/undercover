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
} from '@undercover/shared';
import { ecoWarMachine } from './ecoWarMachine.js';
import type { EcoWarMachineEvent } from './actions.js';
import type { EcoWarGameContext, ServerPlayerState } from './types.js';
import { getWealthTier, buildLeaderboard } from './scoring.js';
import { DISCONNECT_GRACE_MS, EMPTY_ROOM_CLEANUP_MS, PHASE_AUTO_ADVANCE_MS } from './constants.js';
import { COUNTRY_PROFILES } from './countryProfiles.js';
import { createOrganization, proposeVote, castVote, leaveOrganization } from './organizations.js';
import { applySanction } from './commerce.js';
import type { ProductCategory, OrganizationType, TradeOffer, Threat, VoteType } from '@undercover/shared';

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
}

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
    offer: { product: ProductCategory; quantity: number }[],
    request: { product: ProductCategory; quantity: number }[],
  ): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    if (snapshot.value !== 'actionSelection' && snapshot.value !== 'preparation') return;

    const targetPlayer = room.players.get(targetId);
    if (!targetPlayer || targetId === player.id) return;

    const trade: TradeOffer = {
      id: randomUUID(),
      fromId: player.id,
      toId: targetId,
      offer,
      request,
      status: 'pending',
      roundProposed: snapshot.context.currentRound,
    };

    snapshot.context.activeTrades.push(trade);

    // Add to target's incoming trades
    const targetState = snapshot.context.players.get(targetId);
    if (targetState) {
      targetState.incomingTrades.push(trade);
    }

    // Notify the target
    if (targetPlayer.socketId) {
      this.io.to(targetPlayer.socketId).emit('trade:incoming', { trade });
    }

    this.broadcastState(room);
  }

  handleTradeRespond(socket: ServerSocket, tradeId: string, accepted: boolean): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const trade = snapshot.context.activeTrades.find(t => t.id === tradeId);
    if (!trade || trade.toId !== player.id || trade.status !== 'pending') return;

    trade.status = accepted ? 'accepted' : 'rejected';

    // Remove from incoming trades
    const targetState = snapshot.context.players.get(player.id);
    if (targetState) {
      targetState.incomingTrades = targetState.incomingTrades.filter(t => t.id !== tradeId);
    }

    // Notify proposer
    const fromPlayer = room.players.get(trade.fromId);
    if (fromPlayer?.socketId) {
      this.io.to(fromPlayer.socketId).emit('trade:result', { tradeId, accepted });
    }

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

    const founderIds = [player.id, ...invitedPlayerIds.filter(id => id !== player.id && room.players.has(id))];
    const org = createOrganization(name, type, founderIds, snapshot.context.currentRound);
    if (!org) {
      socket.emit('room:error', { message: 'Minimum 3 membres requis pour créer une organisation.' });
      return;
    }

    snapshot.context.organizations.push(org);

    // Update member references
    for (const memberId of org.memberIds) {
      const memberState = snapshot.context.players.get(memberId);
      if (memberState) {
        memberState.organizationMemberships.push(org.id);
      }
    }

    // Notify all members
    this.io.to(room.code).emit('org:updated', { org });
    this.broadcastState(room);
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

  handleOrgProposeVote(socket: ServerSocket, orgId: string, type: string, description: string): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) return;
    const { room, player } = resolved;

    const snapshot = room.actor.getSnapshot();
    const org = snapshot.context.organizations.find(o => o.id === orgId);
    if (!org) return;

    const vote = proposeVote(org, player.id, type as VoteType, description, snapshot.context.currentRound);
    if (vote) {
      // Notify all members
      for (const memberId of org.memberIds) {
        const memberSocket = room.players.get(memberId);
        if (memberSocket?.socketId) {
          this.io.to(memberSocket.socketId).emit('org:voteStarted', {
            orgId: org.id,
            voteId: vote.id,
            description: vote.description,
          });
        }
      }
      this.broadcastState(room);
    }
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
    targetInfrastructure: string,
    demand: string,
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

    const autoAdvancePhases = ['preparation', 'resolution', 'marketEvent'];
    const currentPhase = this.resolvePhase(snapshot);

    if (autoAdvancePhases.includes(currentPhase)) {
      room.phaseAdvanceTimer = setTimeout(() => {
        const liveRoom = this.rooms.get(room.code);
        if (!liveRoom) return;
        this.sendEvent(liveRoom, { type: 'ADVANCE_PHASE' });
      }, PHASE_AUTO_ADVANCE_MS);
    }
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
      phase: context.phase,
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
      availableActions: mp.availableActions,
      submittedActions: mp.submittedActions.length > 0 ? [...mp.submittedActions] : null,
      espionageResults: [...mp.espionageResults],
      incomingTrades: [...mp.incomingTrades],
      notifications: [...mp.notifications],
      organizationMemberships: [...mp.organizationMemberships],
      activeSanctions: [...mp.activeSanctions],
      gdp: mp.gdp,
      influence: mp.influence,
      score: mp.score,
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
