import { randomUUID } from 'node:crypto';
import {
  DEFAULT_TABLE_CONFIG,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_GRACE_MS,
  type TableConfig,
} from '@undercover/shared';
import { addChips, assertInteger } from './chips';
import { PokerBot, type BotProfile } from './bot';
import { getOrCreatePlayer, updatePlayerBalance } from './db';

type TablePlayerStatus = 'active' | 'sitOut' | 'disconnected';

interface TablePlayer {
  id: string;
  name: string;
  seatIndex: number;
  chipStack: number;
  status: TablePlayerStatus;
  socketId: string | null;
  playerToken: string;
  isBot: boolean;
  botProfile?: BotProfile;
  bot?: PokerBot;
}

interface TableState {
  id: string;
  config: TableConfig;
  seats: Array<string | null>;
  players: Map<string, TablePlayer>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  handInProgress: boolean;
  dealerSeatIndex: number;
  deadButtonPending: boolean;
}

interface JoinResult {
  success: boolean;
  error?: string;
}

const normalizeTableConfig = (config?: Partial<TableConfig>): TableConfig => {
  const merged: TableConfig = {
    ...DEFAULT_TABLE_CONFIG,
    ...config,
  };

  if (!Number.isInteger(merged.maxPlayers) || merged.maxPlayers < MIN_PLAYERS || merged.maxPlayers > MAX_PLAYERS) {
    throw new Error(`maxPlayers must be an integer between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`);
  }

  assertInteger(merged.smallBlind, 'smallBlind');
  assertInteger(merged.bigBlind, 'bigBlind');
  assertInteger(merged.minBuyIn, 'minBuyIn');
  assertInteger(merged.maxBuyIn, 'maxBuyIn');
  assertInteger(merged.actionTimeoutMs, 'actionTimeoutMs');

  if (merged.smallBlind <= 0 || merged.bigBlind <= 0) {
    throw new Error('Blinds must be greater than zero.');
  }

  if (merged.minBuyIn <= 0 || merged.maxBuyIn < merged.minBuyIn) {
    throw new Error('Buy-in limits are invalid.');
  }

  return merged;
};

const normalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Player';
  }

  return trimmed.slice(0, 24);
};

export class TableManager {
  private readonly tables = new Map<string, TableState>();

  createTable(config: Partial<TableConfig> = {}): string {
    const tableId = randomUUID();
    const tableConfig = normalizeTableConfig(config);

    this.tables.set(tableId, {
      id: tableId,
      config: tableConfig,
      seats: Array.from({ length: tableConfig.maxPlayers }, () => null),
      players: new Map(),
      disconnectTimers: new Map(),
      handInProgress: false,
      dealerSeatIndex: 0,
      deadButtonPending: false,
    });

    return tableId;
  }

  async joinTable(
    tableId: string,
    playerId: string,
    name: string,
    buyIn: number,
    seatIndex?: number,
  ): Promise<JoinResult> {
    const table = this.tables.get(tableId);
    if (!table) {
      return { success: false, error: 'Table not found.' };
    }

    if (table.handInProgress) {
      return { success: false, error: 'Cannot buy in during an active hand.' };
    }

    if (table.players.has(playerId)) {
      return { success: false, error: 'Player is already seated at this table.' };
    }

    try {
      assertInteger(buyIn, 'buyIn');
    } catch {
      return { success: false, error: 'Buy-in must be an integer.' };
    }

    if (buyIn < table.config.minBuyIn || buyIn > table.config.maxBuyIn) {
      return {
        success: false,
        error: `Buy-in must be between ${table.config.minBuyIn} and ${table.config.maxBuyIn}.`,
      };
    }

    const resolvedSeat = this.resolveSeatForJoin(table, seatIndex);
    if (resolvedSeat === null) {
      return { success: false, error: 'No available seats.' };
    }

    const playerRecord = await getOrCreatePlayer(playerId, normalizeName(name), 'table-manager');
    if (playerRecord.chipBalance < buyIn) {
      return { success: false, error: 'Insufficient balance for buy-in.' };
    }

    await updatePlayerBalance(playerId, -buyIn);

    const player: TablePlayer = {
      id: playerId,
      name: normalizeName(name),
      seatIndex: resolvedSeat,
      chipStack: buyIn,
      status: 'active',
      socketId: null,
      playerToken: randomUUID(),
      isBot: false,
    };

    table.seats[resolvedSeat] = playerId;
    table.players.set(playerId, player);

    return { success: true };
  }

  async leaveTable(tableId: string, playerId: string): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) {
      return;
    }

    const player = table.players.get(playerId);
    if (!player) {
      return;
    }

    this.clearDisconnectTimer(table, playerId);

    table.players.delete(playerId);
    table.seats[player.seatIndex] = null;

    if (!player.isBot && player.chipStack > 0) {
      await updatePlayerBalance(playerId, player.chipStack);
    }

    this.applyDeadButtonRuleOnLeave(table, player.seatIndex);
  }

  sitOut(tableId: string, playerId: string): void {
    const player = this.getPlayer(tableId, playerId);
    if (!player) {
      return;
    }

    player.status = 'sitOut';
  }

  sitIn(tableId: string, playerId: string): void {
    const player = this.getPlayer(tableId, playerId);
    if (!player) {
      return;
    }

    if (player.chipStack <= 0) {
      throw new Error('Cannot sit in without chips.');
    }

    player.status = 'active';
  }

  async addChips(tableId: string, playerId: string, amount: number): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error('Table not found.');
    }

    if (table.handInProgress) {
      throw new Error('Cannot add chips during an active hand.');
    }

    const player = table.players.get(playerId);
    if (!player) {
      throw new Error('Player not found at this table.');
    }

    if (player.isBot) {
      throw new Error('Cannot add chips to bot players.');
    }

    assertInteger(amount, 'amount');
    if (amount <= 0) {
      throw new Error('Chip amount must be greater than zero.');
    }

    const playerRecord = await getOrCreatePlayer(player.id, player.name, 'table-manager');
    if (playerRecord.chipBalance < amount) {
      throw new Error('Insufficient balance for rebuy.');
    }

    await updatePlayerBalance(player.id, -amount);
    player.chipStack = addChips(player.chipStack, amount);
  }

  handleDisconnect(tableId: string, playerId: string): void {
    const table = this.tables.get(tableId);
    if (!table) {
      return;
    }

    const player = table.players.get(playerId);
    if (!player) {
      return;
    }

    player.status = 'disconnected';
    this.clearDisconnectTimer(table, playerId);

    const timer = setTimeout(() => {
      const maybePlayer = table.players.get(playerId);
      if (!maybePlayer) {
        table.disconnectTimers.delete(playerId);
        return;
      }

      maybePlayer.status = 'sitOut';
      maybePlayer.socketId = null;
      table.disconnectTimers.delete(playerId);
    }, RECONNECT_GRACE_MS);

    timer.unref?.();
    table.disconnectTimers.set(playerId, timer);
  }

  handleReconnect(tableId: string, playerId: string, socketId: string): void {
    const table = this.tables.get(tableId);
    if (!table) {
      return;
    }

    const player = table.players.get(playerId);
    if (!player) {
      return;
    }

    this.clearDisconnectTimer(table, playerId);
    player.socketId = socketId;

    if (player.status === 'disconnected') {
      player.status = player.chipStack > 0 ? 'active' : 'sitOut';
    }
  }

  getAvailableSeat(tableId: string): number | null {
    const table = this.tables.get(tableId);
    if (!table) {
      return null;
    }

    for (let index = 0; index < table.seats.length; index += 1) {
      if (table.seats[index] === null) {
        return index;
      }
    }

    return null;
  }

  fillWithBots(tableId: string, count: number, profiles: BotProfile[]): void {
    const table = this.tables.get(tableId);
    if (!table || count <= 0) {
      return;
    }

    assertInteger(count, 'count');

    const botProfiles: BotProfile[] = profiles.length > 0 ? profiles : ['rock'];
    let created = 0;
    let profileCursor = 0;

    while (created < count) {
      const seatIndex = this.getAvailableSeat(tableId);
      if (seatIndex === null) {
        break;
      }

      const profile = botProfiles[profileCursor % botProfiles.length];
      profileCursor += 1;

      const botId = `bot-${randomUUID()}`;
      const botName = `Bot ${profile} ${created + 1}`;
      table.seats[seatIndex] = botId;
      table.players.set(botId, {
        id: botId,
        name: botName,
        seatIndex,
        chipStack: table.config.minBuyIn,
        status: 'active',
        socketId: null,
        playerToken: randomUUID(),
        isBot: true,
        botProfile: profile,
        bot: new PokerBot(profile, botId),
      });

      created += 1;
    }
  }

  advanceDealerButton(tableId: string): number {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error('Table not found.');
    }

    if (table.deadButtonPending) {
      table.deadButtonPending = false;
      return table.dealerSeatIndex;
    }

    const nextSeat = this.findNextOccupiedSeat(table, table.dealerSeatIndex);
    if (nextSeat !== null) {
      table.dealerSeatIndex = nextSeat;
    }

    return table.dealerSeatIndex;
  }

  setHandInProgress(tableId: string, inProgress: boolean): void {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error('Table not found.');
    }

    table.handInProgress = inProgress;
  }

  private getPlayer(tableId: string, playerId: string): TablePlayer | null {
    const table = this.tables.get(tableId);
    if (!table) {
      return null;
    }

    return table.players.get(playerId) ?? null;
  }

  private resolveSeatForJoin(table: TableState, seatIndex?: number): number | null {
    if (seatIndex === undefined) {
      return this.getAvailableSeat(table.id);
    }

    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= table.config.maxPlayers) {
      return null;
    }

    if (table.seats[seatIndex] !== null) {
      return null;
    }

    return seatIndex;
  }

  private clearDisconnectTimer(table: TableState, playerId: string): void {
    const timer = table.disconnectTimers.get(playerId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    table.disconnectTimers.delete(playerId);
  }

  private applyDeadButtonRuleOnLeave(table: TableState, seatIndex: number): void {
    if (table.dealerSeatIndex === seatIndex) {
      table.deadButtonPending = true;
    }
  }

  private findNextOccupiedSeat(table: TableState, fromSeat: number): number | null {
    if (table.players.size === 0) {
      return null;
    }

    for (let offset = 1; offset <= table.seats.length; offset += 1) {
      const seat = (fromSeat + offset) % table.seats.length;
      const occupantId = table.seats[seat];
      if (!occupantId) {
        continue;
      }

      const occupant = table.players.get(occupantId);
      if (!occupant) {
        continue;
      }

      if (occupant.status === 'sitOut' && occupant.chipStack <= 0) {
        continue;
      }

      return seat;
    }

    return null;
  }
}
