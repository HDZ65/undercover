import { randomUUID } from 'node:crypto';
import { DEFAULT_TABLE_CONFIG, type Card, type ClientToServerEvents, type PokerAction, type PokerPrivateState, type PokerPublicState, type ServerToClientEvents, type TableConfig } from '@undercover/shared';
import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import { createActor } from 'xstate';
import type { Server, Socket } from 'socket.io';
import { calculateHandStrength } from './handStrength';
import { pokerMachine } from './pokerMachine';
import { TableManager } from './tableManager';

type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type PokerActor = ActorRefFrom<typeof pokerMachine>;
type PokerSnapshot = SnapshotFrom<typeof pokerMachine>;

interface TablePlayerSession {
  id: string;
  name: string;
  socketId: string | null;
  playerToken: string;
  chipStack: number;
}

interface PokerTableRoom {
  id: string;
  actor: PokerActor;
  players: Map<string, TablePlayerSession>;
  config: TableConfig;
}

type ActionPayload = {
  amount?: number;
  sequenceNumber?: number;
};

const normalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Player';
  }

  return trimmed.slice(0, 24);
};

export class PokerRoomManager {
  private readonly tableManager = new TableManager();
  private readonly rooms = new Map<string, PokerTableRoom>();
  private readonly socketPresence = new Map<string, { tableId: string; playerId: string }>();

  constructor(private readonly io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  createTable(socket: ServerSocket, data: { playerName: string; config?: Partial<TableConfig> }): void {
    this.leaveTable(socket);

    try {
      const tableId = this.tableManager.createTable(data.config);
      const actor = createActor(pokerMachine);
      actor.start();

      const room: PokerTableRoom = {
        id: tableId,
        actor,
        players: new Map(),
        config: {
          ...DEFAULT_TABLE_CONFIG,
          ...data.config,
        },
      };

      this.rooms.set(tableId, room);
      actor.subscribe(() => {
        this.broadcastState(room);
      });

      this.broadcastTableList();
      socket.emit('poker:tableList', { tables: [{ id: room.id, playerCount: room.players.size, config: room.config }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create table.';
      socket.emit('poker:error', { message, code: 'TABLE_CREATE_FAILED' });
    }
  }

  async joinTable(
    socket: ServerSocket,
    data: { tableId: string; playerName: string; buyIn: number; seatIndex?: number; playerToken?: string },
  ): Promise<void> {
    this.leaveTable(socket);

    const room = this.rooms.get(data.tableId);
    if (!room) {
      socket.emit('poker:error', { message: 'Table not found.', code: 'TABLE_NOT_FOUND' });
      return;
    }

    const reconnectPlayer = data.playerToken
      ? [...room.players.values()].find((candidate) => candidate.playerToken === data.playerToken)
      : undefined;

    if (reconnectPlayer) {
      reconnectPlayer.socketId = socket.id;
      this.socketPresence.set(socket.id, { tableId: room.id, playerId: reconnectPlayer.id });
      this.tableManager.handleReconnect(room.id, reconnectPlayer.id, socket.id);
      room.actor.send({ type: 'PLAYER_RECONNECT', playerId: reconnectPlayer.id });
      socket.join(room.id);
      this.broadcastState(room);
      this.broadcastTableList();
      return;
    }

    const playerId = randomUUID();
    const joinResult = await this.tableManager.joinTable(
      room.id,
      playerId,
      normalizeName(data.playerName),
      data.buyIn,
      data.seatIndex,
    );

    if (!joinResult.success) {
      socket.emit('poker:error', { message: joinResult.error ?? 'Unable to join table.', code: 'JOIN_FAILED' });
      return;
    }

    const playerToken = randomUUID();
    room.players.set(playerId, {
      id: playerId,
      name: normalizeName(data.playerName),
      socketId: socket.id,
      playerToken,
      chipStack: data.buyIn,
    });

    this.socketPresence.set(socket.id, { tableId: room.id, playerId });
    socket.join(room.id);

    this.broadcastState(room);
    this.broadcastTableList();
  }

  async leaveTable(socket: ServerSocket): Promise<void> {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      return;
    }

    this.socketPresence.delete(socket.id);

    const room = this.rooms.get(presence.tableId);
    if (!room) {
      return;
    }

    const player = room.players.get(presence.playerId);
    if (!player) {
      return;
    }

    player.socketId = null;
    socket.leave(room.id);

    await this.tableManager.leaveTable(room.id, player.id);
    room.players.delete(player.id);
    room.actor.send({ type: 'PLAYER_DISCONNECT', playerId: player.id });

    if (room.players.size === 0) {
      room.actor.stop();
      this.rooms.delete(room.id);
    }

    this.broadcastState(room);
    this.broadcastTableList();
  }

  sitOut(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) {
      return;
    }

    this.tableManager.sitOut(resolved.room.id, resolved.player.id);
    resolved.room.actor.send({ type: 'SIT_OUT', playerId: resolved.player.id });
  }

  sitIn(socket: ServerSocket): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) {
      return;
    }

    try {
      this.tableManager.sitIn(resolved.room.id, resolved.player.id);
      resolved.room.actor.send({ type: 'SIT_IN', playerId: resolved.player.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sit in.';
      socket.emit('poker:error', { message, code: 'SIT_IN_FAILED' });
    }
  }

  handleAction(socket: ServerSocket, action: PokerAction, payload?: ActionPayload): void {
    const resolved = this.resolveRoomAndPlayer(socket);
    if (!resolved) {
      return;
    }

    const sequenceNumber = payload?.sequenceNumber;
    if (!Number.isInteger(sequenceNumber)) {
      socket.emit('poker:error', { message: 'Missing sequence number.', code: 'INVALID_SEQUENCE' });
      return;
    }

    const snapshot = resolved.room.actor.getSnapshot();
    const expected = snapshot.context.actionSequenceNumber + 1;
    if (sequenceNumber !== expected) {
      socket.emit('poker:error', {
        message: `Invalid sequence number. Expected ${expected}.`,
        code: 'INVALID_SEQUENCE',
      });
      return;
    }

    if (action === 'raise') {
      if (!Number.isInteger(payload?.amount)) {
        socket.emit('poker:error', { message: 'Raise amount is required.', code: 'INVALID_AMOUNT' });
        return;
      }
    }

    resolved.room.actor.send({
      type: 'PLAYER_ACTION',
      playerId: resolved.player.id,
      action,
      amount: payload?.amount,
      sequenceNumber,
    });

    this.io.to(resolved.room.id).emit('poker:action', {
      playerId: resolved.player.id,
      action,
      amount: payload?.amount,
    });
  }

  handleDisconnect(socket: ServerSocket): void {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      return;
    }

    this.socketPresence.delete(socket.id);

    const room = this.rooms.get(presence.tableId);
    if (!room) {
      return;
    }

    const player = room.players.get(presence.playerId);
    if (!player) {
      return;
    }

    player.socketId = null;
    this.tableManager.handleDisconnect(room.id, player.id);
    room.actor.send({ type: 'PLAYER_DISCONNECT', playerId: player.id });
    this.broadcastState(room);
    this.broadcastTableList();
  }

  private resolveRoomAndPlayer(socket: ServerSocket): { room: PokerTableRoom; player: TablePlayerSession } | null {
    const presence = this.socketPresence.get(socket.id);
    if (!presence) {
      socket.emit('poker:error', { message: 'You are not seated at a table.', code: 'NO_TABLE' });
      return null;
    }

    const room = this.rooms.get(presence.tableId);
    if (!room) {
      socket.emit('poker:error', { message: 'Table no longer exists.', code: 'TABLE_NOT_FOUND' });
      return null;
    }

    const player = room.players.get(presence.playerId);
    if (!player) {
      socket.emit('poker:error', { message: 'Player session not found.', code: 'PLAYER_NOT_FOUND' });
      return null;
    }

    return { room, player };
  }

  private broadcastState(room: PokerTableRoom): void {
    const snapshot = room.actor.getSnapshot();
    const publicState = this.buildPublicState(snapshot);

    for (const player of room.players.values()) {
      if (!player.socketId) {
        continue;
      }

      const targetSocket = this.io.sockets.sockets.get(player.socketId);
      if (!targetSocket) {
        continue;
      }

      const privateState = this.buildPrivateState(snapshot, player.id);
      targetSocket.emit('poker:state', { publicState, privateState });
    }
  }

  private buildPublicState(snapshot: PokerSnapshot): PokerPublicState {
    const context = snapshot.context;
    const activePlayer = context.players.find((player) => player.id === context.bettingEngineState.activePlayerId);

    return {
      phase: context.currentPhase,
      communityCards: [...context.communityCards],
      pots: [...context.potManagerState.pots],
      currentBet: context.bettingEngineState.currentBet,
      minRaise: context.bettingEngineState.minRaise,
      dealerSeatIndex: context.dealerSeatIndex,
      activeSeatIndex: activePlayer?.seatIndex ?? -1,
      players: context.players.map((player) => ({
        id: player.id,
        name: player.name,
        chipStack: player.chipStack,
        status: player.status,
        seatIndex: player.seatIndex,
        currentBet: player.currentBet,
        hasCards: Boolean(player.holeCards),
        avatar: player.avatar,
      })),
      handNumber: context.handNumber,
      tableConfig: context.tableConfig,
    };
  }

  private buildPrivateState(snapshot: PokerSnapshot, playerId: string): PokerPrivateState {
    const context = snapshot.context;
    const player = context.players.find((candidate) => candidate.id === playerId);
    const holeCards = [...(player?.holeCards ?? [])];
    const currentBet = context.bettingEngineState.currentBet;
    const playerBet = player?.currentBet ?? 0;
    const callAmount = Math.max(0, currentBet - playerBet);

    const availableActions: PokerAction[] = [];
    const isPlayersTurn = context.bettingEngineState.activePlayerId === playerId;
    if (isPlayersTurn && player) {
      availableActions.push('fold');
      if (callAmount === 0) {
        availableActions.push('check');
      } else {
        availableActions.push('call');
      }

      if (player.chipStack > callAmount) {
        availableActions.push('raise');
      }
      if (player.chipStack > 0) {
        availableActions.push('allIn');
      }
    }

    let handStrength: string | undefined;
    if (holeCards.length === 2) {
      try {
        handStrength = calculateHandStrength(holeCards, context.communityCards).description;
      } catch {
        handStrength = undefined;
      }
    }

    return {
      playerId,
      holeCards,
      handStrength,
      availableActions,
      minBetAmount: context.bettingEngineState.minRaise,
      maxBetAmount: player?.chipStack ?? 0,
    };
  }

  private broadcastTableList(): void {
    const tables = [...this.rooms.values()].map((room) => ({
      id: room.id,
      playerCount: room.players.size,
      config: room.config,
    }));

    this.io.emit('poker:tableList', { tables });
  }
}
