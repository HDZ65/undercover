import type { Namespace, Socket } from 'socket.io';
import { createActor } from 'xstate';
import type {
  CochonsClientToServerEvents,
  CochonsServerToClientEvents,
  CochonsPublicState,
  CochonsPrivateState,
  CochonsPublicPlayer,
  WeaponType,
  TemplateId,
  CellType,
} from '@undercover/shared';
import { countPigsForOwner } from './grid.js';
import { cochonsMachine, type CochonsPlayer, type CochonsActor } from './cochonsMachine.js';

type CochonsSocket = Socket<CochonsClientToServerEvents, CochonsServerToClientEvents>;

interface RoomPlayer { id: string; name: string; socketId: string; playerToken: string }
interface Room {
  code: string; actor: CochonsActor; players: Map<string, RoomPlayer>;
  hostId: string; disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  buildTimer: ReturnType<typeof setInterval> | null;
}

const DISCONNECT_GRACE_MS = 90_000;
function genCode(): string { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
function genId(): string { return Math.random().toString(36).substring(2, 10); }

export class CochonsRoomManager {
  private rooms = new Map<string, Room>();
  private socketPresence = new Map<string, { roomCode: string; playerId: string }>();
  constructor(private io: Namespace<CochonsClientToServerEvents, CochonsServerToClientEvents>) {}

  createRoom(socket: CochonsSocket, playerName: string) {
    const existing = this.socketPresence.get(socket.id);
    if (existing) this.leaveRoom(socket);
    let code = genCode(); while (this.rooms.has(code)) code = genCode();
    const playerId = genId(); const playerToken = genId() + genId();
    const actor = createActor(cochonsMachine);
    const room: Room = { code, actor, players: new Map(), hostId: playerId, disconnectTimers: new Map(), buildTimer: null };
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken });
    this.rooms.set(code, room); this.socketPresence.set(socket.id, { roomCode: code, playerId }); socket.join(code);
    actor.subscribe((snapshot) => {
      this.broadcastState(room);
      const phase = this.resolvePhase(snapshot.value);
      if (phase === 'buildPhase' && !room.buildTimer) this.startBuildTimer(room);
      if (phase !== 'buildPhase' && room.buildTimer) { clearInterval(room.buildTimer); room.buildTimer = null; }
    });
    actor.start();
    actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName });
    socket.emit('room:joined', { roomCode: code, playerId, playerToken });
  }

  joinRoom(socket: CochonsSocket, roomCode: string, playerName: string, playerToken?: string) {
    const code = roomCode.toUpperCase(); const room = this.rooms.get(code);
    if (!room) { socket.emit('room:error', { message: 'Salon introuvable' }); return; }
    if (playerToken) {
      for (const [pid, player] of room.players) {
        if (player.playerToken === playerToken) {
          const t = room.disconnectTimers.get(pid); if (t) { clearTimeout(t); room.disconnectTimers.delete(pid); }
          player.socketId = socket.id; player.name = playerName;
          this.socketPresence.set(socket.id, { roomCode: code, playerId: pid }); socket.join(code);
          const mp = room.actor.getSnapshot().context.players.find((p: CochonsPlayer) => p.id === pid);
          if (mp) mp.connected = true;
          socket.emit('room:joined', { roomCode: code, playerId: pid, playerToken: player.playerToken });
          this.broadcastState(room); return;
        }
      }
    }
    const phase = this.resolvePhase(room.actor.getSnapshot().value);
    if (phase !== 'lobby') { socket.emit('room:error', { message: 'Partie en cours' }); return; }
    if (room.players.size >= 2) { socket.emit('room:error', { message: 'Salon complet' }); return; }
    const playerId = genId(); const newToken = genId() + genId();
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken: newToken });
    this.socketPresence.set(socket.id, { roomCode: code, playerId }); socket.join(code);
    room.actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName });
    socket.emit('room:joined', { roomCode: code, playerId, playerToken: newToken });
  }

  leaveRoom(socket: CochonsSocket) {
    const p = this.socketPresence.get(socket.id); if (!p) return;
    const room = this.rooms.get(p.roomCode); if (!room) return;
    this.removePlayer(room, p.playerId); this.socketPresence.delete(socket.id); socket.leave(p.roomCode);
  }

  handleStartGame(socket: CochonsSocket) { const r = this.resolve(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'START_GAME' }); }
  handleSelectTemplate(socket: CochonsSocket, templateId: TemplateId) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'SELECT_TEMPLATE', playerId: r.playerId, templateId }); }
  handlePlaceBlock(socket: CochonsSocket, col: number, row: number, type: CellType) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'PLACE_BLOCK', playerId: r.playerId, col, row, blockType: type }); }
  handleRemoveBlock(socket: CochonsSocket, col: number, row: number) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'REMOVE_BLOCK', playerId: r.playerId, col, row }); }
  handlePlacePig(socket: CochonsSocket, col: number, row: number) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'PLACE_PIG', playerId: r.playerId, col, row }); }
  handleRemovePig(socket: CochonsSocket, col: number, row: number) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'REMOVE_PIG', playerId: r.playerId, col, row }); }
  handleConfirmBuild(socket: CochonsSocket) { const r = this.resolve(socket); if (!r) return; r.room.actor.send({ type: 'CONFIRM_BUILD', playerId: r.playerId }); }

  handleFire(socket: CochonsSocket, angle: number, power: number, weapon: WeaponType) {
    const r = this.resolve(socket); if (!r) return;
    const ctx = r.room.actor.getSnapshot().context;
    const active = ctx.players.filter((p: CochonsPlayer) => p.connected);
    if (active[ctx.currentPlayerIndex]?.id !== r.playerId) return;
    r.room.actor.send({ type: 'FIRE', playerId: r.playerId, angle, power, weapon });
    const newCtx = r.room.actor.getSnapshot().context;
    const lastShot = newCtx.shotHistory[newCtx.shotHistory.length - 1];
    if (lastShot) {
      const targetId = newCtx.players.find((p: CochonsPlayer) => p.id !== r.playerId)?.id ?? '';
      this.io.to(r.room.code).emit('game:shotAnimation', { shooterId: r.playerId, targetId, input: lastShot.input, result: lastShot.result });
    }
  }

  handleResetGame(socket: CochonsSocket) { const r = this.resolve(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'RESET_GAME' }); }

  handleDisconnect(socket: CochonsSocket) {
    const p = this.socketPresence.get(socket.id); if (!p) return;
    const room = this.rooms.get(p.roomCode); if (!room) return;
    this.socketPresence.delete(socket.id);
    const mp = room.actor.getSnapshot().context.players.find((pl: CochonsPlayer) => pl.id === p.playerId);
    if (mp) mp.connected = false; this.broadcastState(room);
    const timer = setTimeout(() => { room.disconnectTimers.delete(p.playerId); this.removePlayer(room, p.playerId); }, DISCONNECT_GRACE_MS);
    room.disconnectTimers.set(p.playerId, timer);
  }

  private resolve(socket: CochonsSocket) {
    const p = this.socketPresence.get(socket.id); if (!p) return null;
    const room = this.rooms.get(p.roomCode); if (!room) return null;
    return { room, playerId: p.playerId };
  }

  private removePlayer(room: Room, playerId: string) {
    room.players.delete(playerId); room.actor.send({ type: 'REMOVE_PLAYER', id: playerId });
    if (room.players.size === 0) { if (room.buildTimer) clearInterval(room.buildTimer); room.actor.stop(); this.rooms.delete(room.code); return; }
    if (room.hostId === playerId) { const f = room.players.values().next().value; if (f) room.hostId = f.id; }
    this.broadcastState(room);
  }

  private startBuildTimer(room: Room) {
    let remaining = 60;
    room.buildTimer = setInterval(() => {
      remaining--;
      this.io.to(room.code).emit('game:buildTimer', { secondsRemaining: remaining });
      if (remaining <= 0) { clearInterval(room.buildTimer!); room.buildTimer = null; room.actor.send({ type: 'BUILD_TIMER_EXPIRED' }); }
    }, 1000);
  }

  private broadcastState(room: Room) {
    const snapshot = room.actor.getSnapshot();
    const ctx = snapshot.context;
    const phase = this.resolvePhase(snapshot.value);

    const publicPlayers: CochonsPublicPlayer[] = ctx.players.map((p: CochonsPlayer) => ({
      id: p.id, name: p.name, connected: p.connected, ready: p.ready, side: p.side,
      pigsAlive: countPigsForOwner(ctx.grid, p.id),
      pigsKilled: p.pigsKilled, weaponInventory: { ...p.weaponInventory },
    }));

    const showGrid = phase !== 'lobby';

    const publicState: CochonsPublicState = {
      phase, roomCode: room.code, hostId: room.hostId, players: publicPlayers,
      currentPlayerId: ctx.players[ctx.currentPlayerIndex]?.id ?? null,
      turnNumber: ctx.turnNumber, buildTimeRemaining: ctx.buildTimeRemaining,
      grid: showGrid ? ctx.grid : null,
      shotHistory: ctx.shotHistory, winnerId: ctx.winnerId, isDraw: ctx.isDraw,
    };

    for (const rp of room.players.values()) {
      const targetSocket = this.io.sockets.get(rp.socketId);
      if (!targetSocket) continue;
      const player = ctx.players.find((p: CochonsPlayer) => p.id === rp.id);
      const privateState: CochonsPrivateState = {
        playerId: rp.id, playerToken: rp.playerToken,
        isHost: room.hostId === rp.id,
        side: player?.side ?? 'left',
        buildGrid: phase === 'buildPhase' ? ctx.grid : null,
      };
      targetSocket.emit('game:state', { publicState, privateState });
    }
  }

  private resolvePhase(value: unknown): CochonsPublicState['phase'] {
    if (typeof value === 'string') return value as CochonsPublicState['phase'];
    if (typeof value === 'object' && value !== null && 'battle' in value) return 'battle';
    return 'lobby';
  }
}
