import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { HandHistoryEntry } from '@undercover/shared';
import { assertInteger } from './chips';

type SqlPrimitive = string | number | null | Uint8Array;

interface SqlExecResult {
  columns: string[];
  values: SqlPrimitive[][];
}

interface SqlDatabase {
  exec(sql: string, params?: SqlPrimitive[] | Record<string, SqlPrimitive>): SqlExecResult[];
  run(sql: string, params?: SqlPrimitive[] | Record<string, SqlPrimitive>): SqlDatabase;
  export(): Uint8Array;
}

interface SqlModule {
  Database: new (data?: Uint8Array) => SqlDatabase;
}

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlModule>;

export type Database = SqlDatabase;

const DEFAULT_PLAYER_BALANCE = 10_000;
const PERSIST_INTERVAL_MS = 30_000;
const DATA_DIRECTORY_NAME = 'data';
const DATABASE_FILE_NAME = 'poker.db';

const require = createRequire(import.meta.url);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const serverRootDirectory = resolve(currentDirectory, '..', '..');
const dataDirectoryPath = resolve(serverRootDirectory, DATA_DIRECTORY_NAME);
const databaseFilePath = resolve(dataDirectoryPath, DATABASE_FILE_NAME);
const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

let sqlModule: SqlModule | null = null;
let database: SqlDatabase | null = null;
let initPromise: Promise<SqlDatabase> | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let isDirty = false;
let persistQueue: Promise<void> = Promise.resolve();

const createSchema = (db: SqlDatabase): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      chip_balance INTEGER NOT NULL DEFAULT 10000,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS hand_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_number INTEGER NOT NULL,
      table_id TEXT,
      timestamp INTEGER NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS table_sessions (
      id TEXT PRIMARY KEY,
      config TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL
    );
  `);
};

const readDatabaseFile = async (): Promise<Uint8Array | null> => {
  try {
    const fileBuffer = await readFile(databaseFilePath);
    return new Uint8Array(fileBuffer);
  } catch (error) {
    const ioError = error as NodeJS.ErrnoException;
    if (ioError.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const loadSqlModule = async (): Promise<SqlModule> => {
  if (sqlModule) {
    return sqlModule;
  }

  const moduleName = 'sql.js';
  const dynamicModule = await import(moduleName);
  const initSqlJs = dynamicModule.default as InitSqlJs;

  sqlModule = await initSqlJs({
    locateFile: () => sqlWasmPath,
  });

  return sqlModule;
};

const persistDatabase = async (): Promise<void> => {
  if (!database || !isDirty) {
    return;
  }

  const exportedDatabase = database.export();
  await writeFile(databaseFilePath, Buffer.from(exportedDatabase));
  isDirty = false;
};

const queuePersist = async (): Promise<void> => {
  persistQueue = persistQueue.catch(() => undefined).then(async () => {
    await persistDatabase();
  });

  await persistQueue;
};

const startPeriodicPersist = (): void => {
  if (persistTimer) {
    return;
  }

  persistTimer = setInterval(() => {
    void queuePersist().catch((error) => {
      console.error('[DB] Failed to persist poker database.', error);
    });
  }, PERSIST_INTERVAL_MS);

  persistTimer.unref?.();
};

const getDatabase = async (): Promise<SqlDatabase> => {
  if (database) {
    return database;
  }

  return initDatabase();
};

const extractBalance = (results: SqlExecResult[]): number | null => {
  const balanceCell = results[0]?.values[0]?.[0];
  if (typeof balanceCell !== 'number') {
    return null;
  }

  assertInteger(balanceCell, 'chip_balance');
  return balanceCell;
};

const resolveTableId = (entry: HandHistoryEntry): string => {
  const handWithTable = entry as HandHistoryEntry & { tableId?: string; table_id?: string };
  const tableId = handWithTable.tableId ?? handWithTable.table_id;
  if (typeof tableId === 'string' && tableId.trim().length > 0) {
    return tableId;
  }

  return 'default';
};

const wasPlayerInHand = (entry: HandHistoryEntry, playerId: string): boolean => {
  return entry.players.some((player) => player.id === playerId);
};

export const initDatabase = async (): Promise<Database> => {
  if (database) {
    return database;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await mkdir(dataDirectoryPath, { recursive: true });

    const SQL = await loadSqlModule();
    const existingDatabase = await readDatabaseFile();
    const nextDatabase = existingDatabase ? new SQL.Database(existingDatabase) : new SQL.Database();

    createSchema(nextDatabase);
    database = nextDatabase;
    isDirty = true;

    await queuePersist();
    startPeriodicPersist();

    return nextDatabase;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
};

export const getPlayerBalance = async (playerId: string): Promise<number> => {
  const db = await getDatabase();
  const result = db.exec('SELECT chip_balance FROM players WHERE id = ? LIMIT 1', [playerId]);
  const balance = extractBalance(result);

  if (balance === null) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  return balance;
};

export const updatePlayerBalance = async (playerId: string, delta: number): Promise<void> => {
  assertInteger(delta, 'delta');

  const db = await getDatabase();
  const currentBalance = await getPlayerBalance(playerId);
  const nextBalance = currentBalance + delta;

  assertInteger(nextBalance, 'nextBalance');
  if (nextBalance < 0) {
    throw new Error('Chip balance cannot be negative.');
  }

  db.run('UPDATE players SET chip_balance = ?, last_seen = ? WHERE id = ?', [nextBalance, Date.now(), playerId]);
  isDirty = true;
};

export const saveHandHistory = async (entry: HandHistoryEntry): Promise<void> => {
  assertInteger(entry.handNumber, 'entry.handNumber');
  assertInteger(entry.timestamp, 'entry.timestamp');

  const db = await getDatabase();

  db.run('INSERT INTO hand_history (hand_number, table_id, timestamp, data) VALUES (?, ?, ?, ?)', [
    entry.handNumber,
    resolveTableId(entry),
    entry.timestamp,
    JSON.stringify(entry),
  ]);

  isDirty = true;
  await queuePersist();
};

export const getHandHistory = async (playerId: string, limit: number): Promise<HandHistoryEntry[]> => {
  assertInteger(limit, 'limit');
  if (limit <= 0) {
    return [];
  }

  const db = await getDatabase();
  const result = db.exec('SELECT data FROM hand_history ORDER BY timestamp DESC');
  const rows = result[0]?.values ?? [];

  const history: HandHistoryEntry[] = [];

  for (const row of rows) {
    const serializedEntry = row[0];
    if (typeof serializedEntry !== 'string') {
      continue;
    }

    try {
      const entry = JSON.parse(serializedEntry) as HandHistoryEntry;
      if (wasPlayerInHand(entry, playerId)) {
        history.push(entry);
      }
    } catch {
      continue;
    }

    if (history.length >= limit) {
      break;
    }
  }

  return history;
};

export const getOrCreatePlayer = async (
  id: string,
  name: string,
  ip: string,
): Promise<{ id: string; chipBalance: number }> => {
  const db = await getDatabase();
  const now = Date.now();

  const existing = db.exec('SELECT chip_balance FROM players WHERE id = ? LIMIT 1', [id]);
  const existingBalance = extractBalance(existing);

  if (existingBalance !== null) {
    db.run('UPDATE players SET name = ?, ip_address = ?, last_seen = ? WHERE id = ?', [name, ip, now, id]);
    isDirty = true;

    return { id, chipBalance: existingBalance };
  }

  db.run('INSERT INTO players (id, name, chip_balance, created_at, last_seen, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    name,
    DEFAULT_PLAYER_BALANCE,
    now,
    now,
    ip,
  ]);

  isDirty = true;

  return {
    id,
    chipBalance: DEFAULT_PLAYER_BALANCE,
  };
};
