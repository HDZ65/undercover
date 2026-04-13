import type { Namespace, Socket } from 'socket.io';
import { createActor } from 'xstate';
import type {
  DominosClientToServerEvents,
  DominosServerToClientEvents,
  DominosPublicState,
  DominosPrivateState,
  DominosPublicPlayer,
} from '@undercover/shared';
import { getPlayableTileIds } from './tiles.js';
import { dominosMachine, type DominosPlayer, type DominosActor } from './dominosMachine.js';

type DominosSocket = Socket<DominosClientToServerEvents, DominosServerToClientEvents>;

interface RoomPlayer { id: string; name: string; socketId: string; playerToken: string }
interface Room {
  code: string;
  actor: DominosActor;
  players: Map<string, RoomPlayer>;
  hostId: string;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const DISCONNECT_GRACE_MS = 90_000;

function genCode(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}
function genId(): string { return Math.random().toString(36).substring(2, 10); }

export class DominosRoomManager {
  private rooms = new Map<string, Room>();
  private socketPresence = new Map<string, { roomCode: string; playerId: string }>();

  constructor(private io: Namespace<DominosClientToServerEvents, DominosServerToClientEvents>) {}

  createRoom(socket: DominosSocket, playerName: string) {
    const existing = this.socketPresence.get(socket.id);
    if (existing) this.leaveRoom(socket);

    let code = genCode();
    while (this.rooms.has(code)) code = genCode();

    const playerId = genId();
    const playerToken = genId() + genId();
    const actor = createActor(dominosMachine);
    const room: Room = { code, actor, players: new Map(), hostId: playerId, disconnectTimers: new Map() };
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken });
    this.rooms.set(code, room);
    this.socketPresence.set(socket.id, { roomCode: code, playerId });
    socket.join(code);

    actor.subscribe(() => this.broadcastState(room));
    actor.start();
    actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName });

    socket.emit('room:joined', { roomCode: code, playerId, playerToken });
    console.log(`[Dominos] Room ${code} created by ${playerName}`);
  }

  joinRoom(socket: DominosSocket, roomCode: string, playerName: string, playerToken?: string) {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) { socket.emit('room:error', { message: 'Salon introuvable' }); return; }

    // Reconnection by token
    if (playerToken) {
      for (const [pid, player] of room.players) {
        if (player.playerToken === playerToken) {
          const t = room.disconnectTimers.get(pid);
          if (t) { clearTimeout(t); room.disconnectTimers.delete(pid); }
          player.socketId = socket.id;
          player.name = playerName;
          this.socketPresence.set(socket.id, { roomCode: code, playerId: pid });
          socket.join(code);
          const mp = room.actor.getSnapshot().context.players.find((p: DominosPlayer) => p.id === pid);
          if (mp) mp.connected = true;
          socket.emit('room:joined', { roomCode: code, playerId: pid, playerToken: player.playerToken });
          this.broadcastState(room);
          return;
        }
      }
    }

    // New player
    const snapshot = room.actor.getSnapshot();
    const phase = this.resolvePhase(snapshot.value);
    if (phase !== 'lobby') {
      socket.emit('room:error', { message: 'Partie en cours. Reconnectez-vous avec votre token.' });
      return;
    }
    if (room.players.size >= 4) {
      socket.emit('room:error', { message: 'Salon complet (4 joueurs max)' });
      return;
    }

    const playerId = genId();
    const newToken = genId() + genId();
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken: newToken });
    this.socketPresence.set(socket.id, { roomCode: code, playerId });
    socket.join(code);
    room.actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName });
    socket.emit('room:joined', { roomCode: code, playerId, playerToken: newToken });
  }

  leaveRoom(socket: DominosSocket) {
    const p = this.socketPresence.get(socket.id);
    if (!p) return;
    const room = this.rooms.get(p.roomCode);
    if (!room) return;
    this.removePlayer(room, p.playerId);
    this.socketPresence.delete(socket.id);
    socket.leave(p.roomCode);
  }

  handleStartGame(socket: DominosSocket) {
    const r = this.resolve(socket);
    if (!r || r.room.hostId !== r.playerId) return;
    r.room.actor.send({ type: 'START_GAME' });
  }

  handleSetTargetScore(socket: DominosSocket, targetScore: number) {
    const r = this.resolve(socket);
    if (!r || r.room.hostId !== r.playerId) return;
    r.room.actor.send({ type: 'SET_TARGET_SCORE', targetScore });
  }

  handlePlaceTile(socket: DominosSocket, tileId: number, end: 'left' | 'right') {
    const r = this.resolve(socket);
    if (!r || !this.isCurrent(r.room, r.playerId)) return;
    r.room.actor.send({ type: 'PLACE_TILE', tileId, end });
  }

  handleDrawTile(socket: DominosSocket) {
    const r = this.resolve(socket);
    if (!r || !this.isCurrent(r.room, r.playerId)) return;
    r.room.actor.send({ type: 'DRAW_TILE' });
  }

  handlePass(socket: DominosSocket) {
    const r = this.resolve(socket);
    if (!r || !this.isCurrent(r.room, r.playerId)) return;
    r.room.actor.send({ type: 'PASS' });
  }

  handleNextRound(socket: DominosSocket) {
    const r = this.resolve(socket);
    if (!r) return;
    r.room.actor.send({ type: 'NEXT_ROUND' });
  }

  handleResetGame(socket: DominosSocket) {
    const r = this.resolve(socket);
    if (!r || r.room.hostId !== r.playerId) return;
    r.room.actor.send({ type: 'RESET_GAME' });
  }

  handleDisconnect(socket: DominosSocket) {
    const p = this.socketPresence.get(socket.id);
    if (!p) return;
    const room = this.rooms.get(p.roomCode);
    if (!room) return;
    const pid = p.playerId;
    this.socketPresence.delete(socket.id);

    const mp = room.actor.getSnapshot().context.players.find((pl: DominosPlayer) => pl.id === pid);
    if (mp) mp.connected = false;
    this.broadcastState(room);

    const timer = setTimeout(() => {
      room.disconnectTimers.delete(pid);
      this.removePlayer(room, pid);
    }, DISCONNECT_GRACE_MS);
    room.disconnectTimers.set(pid, timer);
  }

  // ─── Private ─────────────────────────────────────────────────

  private resolve(socket: DominosSocket): { room: Room; playerId: string } | null {
    const p = this.socketPresence.get(socket.id);
    if (!p) return null;
    const room = this.rooms.get(p.roomCode);
    if (!room) return null;
    return { room, playerId: p.playerId };
  }

  private isCurrent(room: Room, pid: string): boolean {
    const ctx = room.actor.getSnapshot().context;
    const active = ctx.players.filter((p: DominosPlayer) => p.connected);
    return active[ctx.currentPlayerIndex]?.id === pid;
  }

  private removePlayer(room: Room, playerId: string) {
    room.players.delete(playerId);
    room.actor.send({ type: 'REMOVE_PLAYER', id: playerId });
    if (room.players.size === 0) {
      room.actor.stop();
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) {
      const first = room.players.values().next().value;
      if (first) room.hostId = first.id;
    }
    this.broadcastState(room);
  }

  private broadcastState(room: Room) {
    const snapshot = room.actor.getSnapshot();
    const ctx = snapshot.context;
    const phase = this.resolvePhase(snapshot.value);

    const publicPlayers: DominosPublicPlayer[] = ctx.players.map((p: DominosPlayer) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      tileCount: (ctx.hands[p.id] ?? []).length,
      totalScore: (ctx.scores[p.id] ?? []).reduce((a: number, b: number) => a + b, 0),
      characterIndex: p.characterIndex,
    }));

    const publicState: DominosPublicState = {
      phase,
      roomCode: room.code,
      hostId: room.hostId,
      players: publicPlayers,
      currentPlayerId: ctx.players[ctx.currentPlayerIndex]?.id ?? null,
      board: ctx.board,
      boneyardCount: ctx.boneyard.length,
      round: ctx.round,
      targetScore: ctx.targetScore,
      roundResult: ctx.roundResult,
      winnerId: ctx.winnerId,
      lastAction: ctx.lastAction,
    };

    for (const rp of room.players.values()) {
      const targetSocket = this.io.sockets.get(rp.socketId);
      if (!targetSocket) continue;

      const hand = ctx.hands[rp.id] ?? [];
      const playableIds = phase === 'playerTurn' && ctx.players[ctx.currentPlayerIndex]?.id === rp.id
        ? getPlayableTileIds(hand, ctx.board)
        : [];
      const canDraw = phase === 'playerTurn'
        && ctx.players[ctx.currentPlayerIndex]?.id === rp.id
        && ctx.boneyard.length > 0
        && playableIds.length === 0;
      const canPass = phase === 'playerTurn'
        && ctx.players[ctx.currentPlayerIndex]?.id === rp.id
        && ctx.boneyard.length === 0
        && playableIds.length === 0;

      const privateState: DominosPrivateState = {
        playerId: rp.id,
        playerToken: rp.playerToken,
        isHost: room.hostId === rp.id,
        hand,
        playableTileIds: playableIds,
        canDraw,
        canPass,
      };

      targetSocket.emit('game:state', { publicState, privateState });
    }

    // Emit combat animation event during roundEnd
    if (phase === 'roundEnd' && ctx.roundResult) {
      const result = ctx.roundResult;
      const losers = ctx.players.filter((p: DominosPlayer) => p.id !== result.winnerId).map((p: DominosPlayer) => p.id);
      const damagePerPlayer: Record<string, number> = {};
      for (const lid of losers) {
        damagePerPlayer[lid] = result.playerPipCounts[lid] ?? 0;
      }
      this.io.to(room.code).emit('game:combatAnimation', {
        winnerId: result.winnerId,
        losers,
        attackTier: result.attackTier,
        pointsScored: result.pointsScored,
        damagePerPlayer,
      });
    }
  }

  private resolvePhase(value: unknown): DominosPublicState['phase'] {
    if (typeof value === 'string') return value as DominosPublicState['phase'];
    return 'lobby';
  }
}
