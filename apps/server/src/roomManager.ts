import { randomInt, randomUUID } from 'node:crypto';
import type {
  ClientToServerEvents,
  GamePhase,
  Player,
  PrivatePlayerState,
  PublicGameState,
  PublicPlayer,
  Role,
  ServerToClientEvents,
  WordCategory,
} from '@undercover/shared';
import type { Server, Socket } from 'socket.io';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { gameMachine } from './gameMachine';

type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameActor = ActorRefFrom<typeof gameMachine>;
type GameSnapshot = SnapshotFrom<typeof gameMachine>;

type ForwardGameEvent =
  | 'SET_CATEGORY'
  | 'SET_TIMER_DURATION'
  | 'SET_HIDE_ROLES'
  | 'START_ROLE_DISTRIBUTION'
  | 'PLAYER_READY'
  | 'NEXT_SPEAKER'
  | 'START_VOTING'
  | 'CAST_VOTE'
  | 'SUBMIT_MRWHITE_GUESS'
  | 'CAST_MRWHITE_VOTE'
  | 'RESET_GAME';

interface RoomPlayer {
  id: string;
  name: string;
  socketId: string | null;
  playerToken: string;
  avatar?: string;
}

interface Room {
  code: string;
  actor: GameActor;
  players: Map<string, RoomPlayer>;
  hostId: string;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  emptyRoomTimer: NodeJS.Timeout | null;
  lastEliminatedPlayerId: string | null;
}

const DISCONNECT_GRACE_MS = 90_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly socketPresence = new Map<string, { roomCode: string; playerId: string }>();

  constructor(private readonly io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  createRoom(socket: ServerSocket, data: { playerName: string }): void {
    this.leaveRoom(socket);

    const roomCode = this.generateRoomCode();
    const player = this.createRoomPlayer(data.playerName, socket.id);

    const actor = createActor(gameMachine);
    actor.start();

    const room: Room = {
      code: roomCode,
      actor,
      players: new Map([[player.id, player]]),
      hostId: player.id,
      disconnectTimers: new Map(),
      emptyRoomTimer: null,
      lastEliminatedPlayerId: null,
    };

    this.rooms.set(roomCode, room);
    this.socketPresence.set(socket.id, { roomCode, playerId: player.id });
    socket.join(roomCode);

    room.actor.subscribe(() => {
      this.broadcastState(room);
    });
    room.actor.send({ type: 'ADD_PLAYER', player: this.toMachinePlayer(player) });

    socket.emit('room:created', {
      roomCode,
      playerToken: player.playerToken,
      playerId: player.id,
    });

    this.broadcastState(room);
  }

  joinRoom(
    socket: ServerSocket,
    data: { roomCode: string; playerName: string; playerToken?: string },
  ): void {
    this.leaveRoom(socket);

    const roomCode = data.roomCode.trim();
    const room = this.rooms.get(roomCode);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' });
      return;
    }

    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
      room.emptyRoomTimer = null;
    }

    const reconnectPlayer = data.playerToken
      ? [...room.players.values()].find((candidate) => candidate.playerToken === data.playerToken)
      : undefined;

    if (reconnectPlayer) {
      this.clearDisconnectTimer(room, reconnectPlayer.id);
      reconnectPlayer.socketId = socket.id;
      this.socketPresence.set(socket.id, { roomCode, playerId: reconnectPlayer.id });
      socket.join(roomCode);

      socket.emit('room:joined', {
        roomCode,
        playerToken: reconnectPlayer.playerToken,
        playerId: reconnectPlayer.id,
      });

      this.reassignHostIfNeeded(room);
      this.broadcastState(room);
      return;
    }

    if (!room.actor.getSnapshot().matches('lobby') && !room.actor.getSnapshot().matches('menu')) {
      socket.emit('room:error', { message: 'Game already started. Reconnect with your player token.' });
      return;
    }

    if (room.players.size >= 20) {
      socket.emit('room:error', { message: 'Room is full.' });
      return;
    }

    const player = this.createRoomPlayer(data.playerName, socket.id);
    room.players.set(player.id, player);
    room.actor.send({ type: 'ADD_PLAYER', player: this.toMachinePlayer(player) });

    this.socketPresence.set(socket.id, { roomCode, playerId: player.id });
    socket.join(roomCode);

    socket.emit('room:joined', {
      roomCode,
      playerToken: player.playerToken,
      playerId: player.id,
    });

    this.io.to(roomCode).emit('room:playerJoined', { player: this.toPublicPlayer(player) });
    this.broadcastState(room);
  }


  leaveRoom(socket: ServerSocket): void {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      return;
    }

    const room = this.rooms.get(presence.roomCode);
    if (!room) {
      this.socketPresence.delete(socket.id);
      return;
    }

    this.socketPresence.delete(socket.id);
    socket.leave(room.code);
    this.clearDisconnectTimer(room, presence.playerId);

    const player = room.players.get(presence.playerId);
    if (!player) {
      return;
    }

    player.socketId = null;
    this.removePlayer(room, player.id);
  }

  handleDisconnect(socket: ServerSocket): void {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      return;
    }

    this.socketPresence.delete(socket.id);
    const room = this.rooms.get(presence.roomCode);
    if (!room) {
      return;
    }

    const player = room.players.get(presence.playerId);
    if (!player) {
      return;
    }

    player.socketId = null;
    this.reassignHostIfNeeded(room);

    const timer = setTimeout(() => {
      this.removePlayer(room, player.id);
    }, DISCONNECT_GRACE_MS);

    room.disconnectTimers.set(player.id, timer);
    this.broadcastState(room);
  }

  handleGameEvent(socket: ServerSocket, eventType: ForwardGameEvent, payload?: unknown): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) {
      return;
    }

    const { room, player } = resolved;

    switch (eventType) {
      case 'SET_CATEGORY': {
        if (!this.isHost(room, player.id)) {
          return;
        }
        const category = (payload as { category?: WordCategory } | undefined)?.category;
        if (!category) {
          return;
        }
        room.actor.send({ type: 'SET_CATEGORY', category });
        return;
      }
      case 'SET_TIMER_DURATION': {
        if (!this.isHost(room, player.id)) {
          return;
        }
        const duration = (payload as { duration?: number } | undefined)?.duration;
        if (typeof duration !== 'number') {
          return;
        }
        room.actor.send({ type: 'SET_TIMER_DURATION', duration });
        return;
      }
      case 'SET_HIDE_ROLES': {
        if (!this.isHost(room, player.id)) {
          return;
        }
        const hideRoles = (payload as { hideRoles?: boolean } | undefined)?.hideRoles;
        if (typeof hideRoles !== 'boolean') {
          return;
        }
        room.actor.send({ type: 'SET_HIDE_ROLES', hideRoles });
        return;
      }
      case 'START_ROLE_DISTRIBUTION': {
        if (!this.isHost(room, player.id)) {
          return;
        }
        room.actor.send({ type: 'START_ROLE_DISTRIBUTION' });
        return;
      }
      case 'PLAYER_READY': {
        room.actor.send({ type: 'PLAYER_READY', playerId: player.id });
        return;
      }
      case 'NEXT_SPEAKER': {
        room.actor.send({ type: 'NEXT_SPEAKER' });
        return;
      }
      case 'START_VOTING': {
        room.actor.send({ type: 'START_VOTING' });
        return;
      }
      case 'CAST_VOTE': {
        const targetId = (payload as { targetId?: string } | undefined)?.targetId;
        if (!targetId) {
          return;
        }
        room.actor.send({ type: 'CAST_VOTE', voterId: player.id, targetId });
        room.actor.send({ type: 'FINISH_VOTING' });
        return;
      }
      case 'SUBMIT_MRWHITE_GUESS': {
        const guess = (payload as { guess?: string } | undefined)?.guess;
        if (typeof guess !== 'string') {
          return;
        }
        room.actor.send({ type: 'SUBMIT_MRWHITE_GUESS', guess });
        return;
      }
      case 'CAST_MRWHITE_VOTE': {
        const accepted = (payload as { accepted?: boolean } | undefined)?.accepted;
        if (typeof accepted !== 'boolean') {
          return;
        }
        room.actor.send({ type: 'CAST_MRWHITE_VOTE', voterId: player.id, accepted });
        room.actor.send({ type: 'RESOLVE_MRWHITE_VOTE' });
        return;
      }
      case 'RESET_GAME': {
        if (!this.isHost(room, player.id)) {
          return;
        }
        room.actor.send({ type: 'RESET_GAME' });
      }
    }
  }

  private resolveRoomAndPlayer(socket: ServerSocket): { room: Room; player: RoomPlayer } | null {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      socket.emit('room:error', { message: 'You are not in a room.' });
      return null;
    }

    const room = this.rooms.get(presence.roomCode);
    if (!room) {
      socket.emit('room:error', { message: 'Room no longer exists.' });
      return null;
    }

    const player = room.players.get(presence.playerId);
    if (!player) {
      socket.emit('room:error', { message: 'Player session not found.' });
      return null;
    }

    return { room, player };
  }


  private removePlayer(room: Room, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) {
      return;
    }

    this.clearDisconnectTimer(room, playerId);
    room.players.delete(playerId);
    room.actor.send({ type: 'REMOVE_PLAYER', playerId });
    this.io.to(room.code).emit('room:playerLeft', { playerId });

    this.reassignHostIfNeeded(room);

    if (room.players.size === 0) {
      room.emptyRoomTimer = setTimeout(() => {
        room.actor.stop();
        this.rooms.delete(room.code);
      }, EMPTY_ROOM_TTL_MS);
    }

    this.broadcastState(room);
  }

  private reassignHostIfNeeded(room: Room): void {
    const currentHost = room.players.get(room.hostId);
    if (currentHost?.socketId) {
      return;
    }

    const nextHost = [...room.players.values()].find((candidate) => candidate.socketId) ?? [...room.players.values()][0];
    const nextHostId = nextHost?.id ?? '';

    if (room.hostId !== nextHostId) {
      room.hostId = nextHostId;
      if (nextHostId) {
        this.io.to(room.code).emit('room:hostChanged', { hostId: nextHostId });
      }
    }
  }

  private broadcastState(room: Room): void {
    const snapshot = room.actor.getSnapshot();
    const publicState = this.getPublicState(room, snapshot);

    for (const player of room.players.values()) {
      if (!player.socketId) {
        continue;
      }

      const targetSocket = this.io.sockets.sockets.get(player.socketId);
      if (!targetSocket) {
        continue;
      }

      const privateState = this.getPrivateState(room, snapshot, player.id);
      targetSocket.emit('game:state', { publicState, privateState });
    }

    const eliminatedPlayer = this.getEliminatedPlayerWithRole(snapshot, room);
    if (eliminatedPlayer && room.lastEliminatedPlayerId !== eliminatedPlayer.id) {
      room.lastEliminatedPlayerId = eliminatedPlayer.id;
      this.io.to(room.code).emit('game:eliminated', { player: eliminatedPlayer });
    }

    if (publicState.phase === 'victory' && publicState.winner) {
      const players = snapshot.context.players
        .filter((player): player is Player & { role: Role } => typeof player.role === 'string')
        .map((player) => ({
          ...this.toPublicPlayerFromMachine(player, room),
          role: player.role,
        }));
      this.io.to(room.code).emit('game:victory', { winner: publicState.winner, players });
    }
  }

  private getPublicState(room: Room, snapshot: GameSnapshot): PublicGameState {
    const context = snapshot.context;
    const phase = this.resolvePhase(snapshot);
    const machinePlayersById = new Map(context.players.map((player) => [player.id, player]));

    const players: PublicPlayer[] = [...room.players.values()].map((roomPlayer) => {
      const machinePlayer = machinePlayersById.get(roomPlayer.id);
      return {
        id: roomPlayer.id,
        name: roomPlayer.name,
        avatar: roomPlayer.avatar,
        isEliminated: machinePlayer?.isEliminated,
      };
    });

    const eliminatedMachinePlayer = context.eliminatedPlayer
      ? context.players.find((player) => player.id === context.eliminatedPlayer)
      : undefined;

    const eliminatedPlayer: PublicPlayer | null =
      eliminatedMachinePlayer && eliminatedMachinePlayer.role
        ? {
            ...this.toPublicPlayerFromMachine(eliminatedMachinePlayer as Player & { role: Role }, room),
            role: eliminatedMachinePlayer.role,
          }
        : null;

    const voteCount = context.alivePlayers.filter((playerId) => typeof context.votes[playerId] === 'string').length;
    const mrWhiteVoteCount = context.alivePlayers.filter((playerId) => {
      const vote = context.votes[playerId];
      return vote === 'accept' || vote === 'reject';
    }).length;

    const publicPlayers =
      phase === 'victory'
        ? context.players
            .filter((player): player is Player & { role: Role } => typeof player.role === 'string')
            .map((player) => ({ ...this.toPublicPlayerFromMachine(player, room), role: player.role }))
        : players;

    return {
      phase,
      players: publicPlayers,
      alivePlayers: [...context.alivePlayers],
      currentRound: context.currentRound,
      currentSpeakerIndex: context.currentSpeakerIndex,
      timerDuration: context.timerDuration,
      votingComplete: voteCount === context.alivePlayers.length && context.alivePlayers.length > 0,
      eliminatedPlayer,
      winner: context.winner,
      mrWhiteGuess: context.mrWhiteGuess,
      tieCandidates: [...context.tieCandidates],
      voteCount,
      totalVoters: context.alivePlayers.length,
      mrWhiteVoteCount,
      roomCode: room.code,
      hostId: room.hostId,
      readyPlayers: [...context.readyPlayers],
      hideRoles: context.hideRoles,
    };
  }


  private getPrivateState(room: Room, snapshot: GameSnapshot, playerId: string): PrivatePlayerState {
    const context = snapshot.context;
    const machinePlayer = context.players.find((candidate) => candidate.id === playerId);
    const roomPlayer = room.players.get(playerId);

    let word: string | undefined;
    if (machinePlayer?.role === 'civil') {
      word = context.wordPair?.civil;
    } else if (machinePlayer?.role === 'undercover') {
      word = context.wordPair?.undercover;
    }

    const hasVoted = typeof context.votes[playerId] === 'string';

    // When hideRoles is enabled, don't send the role to the player
    const role = context.hideRoles ? undefined : machinePlayer?.role;

    return {
      playerId,
      playerToken: roomPlayer?.playerToken ?? '',
      role,
      word,
      hasVoted,
      isHost: room.hostId === playerId,
    };
  }

  private getEliminatedPlayerWithRole(snapshot: GameSnapshot, room: Room): (PublicPlayer & { role: Role }) | null {
    const eliminatedId = snapshot.context.eliminatedPlayer;
    if (!eliminatedId) {
      return null;
    }

    const machinePlayer = snapshot.context.players.find((player) => player.id === eliminatedId);
    if (!machinePlayer?.role) {
      return null;
    }

    return {
      ...this.toPublicPlayerFromMachine(machinePlayer as Player & { role: Role }, room),
      role: machinePlayer.role,
    };
  }

  private resolvePhase(snapshot: GameSnapshot): GamePhase {
    if (snapshot.matches('menu')) return 'menu';
    if (snapshot.matches('lobby')) return 'lobby';
    if (snapshot.matches('roleDistribution')) return 'roleDistribution';
    if (snapshot.matches({ gameRound: 'discussion' })) return 'discussion';
    if (snapshot.matches({ gameRound: 'voting' })) return 'voting';
    if (snapshot.matches('elimination')) return 'elimination';
    if (snapshot.matches('mrWhiteGuess')) return 'mrWhiteGuess';
    if (snapshot.matches('mrWhiteVote')) return 'mrWhiteVote';
    return 'victory';
  }

  private clearDisconnectTimer(room: Room, playerId: string): void {
    const timer = room.disconnectTimers.get(playerId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    room.disconnectTimers.delete(playerId);
  }

  private createRoomPlayer(playerName: string, socketId: string): RoomPlayer {
    return {
      id: randomUUID(),
      name: this.normalizePlayerName(playerName),
      socketId,
      playerToken: randomUUID(),
    };
  }

  private normalizePlayerName(name: string): string {
    const normalized = name.trim();
    if (normalized.length === 0) {
      return 'Player';
    }
    return normalized.slice(0, 24);
  }

  private toMachinePlayer(player: RoomPlayer): Player {
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      isEliminated: false,
    };
  }

  private toPublicPlayer(player: RoomPlayer): PublicPlayer {
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
    };
  }

  private toPublicPlayerFromMachine(player: Player, room: Room): PublicPlayer {
    const roomPlayer = room.players.get(player.id);
    return {
      id: player.id,
      name: roomPlayer?.name ?? player.name,
      avatar: roomPlayer?.avatar ?? player.avatar,
      isEliminated: player.isEliminated,
    };
  }

  private isHost(room: Room, playerId: string): boolean {
    return room.hostId === playerId;
  }

  private generateRoomCode(): string {
    let code = '';

    do {
      const digits = randomInt(4, 7);
      const lowerBound = 10 ** (digits - 1);
      const upperBound = 10 ** digits;
      code = String(randomInt(lowerBound, upperBound));
    } while (this.rooms.has(code));

    return code;
  }
}
