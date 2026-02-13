const CENTIMES_PER_EURO = 100;

const assertNonNegative = (value: number, label: string): void => {
  if (value < 0) {
    throw new Error(`${label} must be greater than or equal to 0.`);
  }
};

const assertChipAmount = (value: number, label: string): void => {
  assertInteger(value, label);
  assertNonNegative(value, label);
};

export const assertInteger = (value: number, label = 'value'): void => {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
};

export const addChips = (a: number, b: number): number => {
  assertChipAmount(a, 'a');
  assertChipAmount(b, 'b');

  const total = a + b;
  assertInteger(total, 'total');

  return total;
};

export const subtractChips = (a: number, b: number): number => {
  assertChipAmount(a, 'a');
  assertChipAmount(b, 'b');

  const result = a - b;
  if (result < 0) {
    throw new Error('Chip amount cannot be negative.');
  }

  return result;
};

export const divideChips = (total: number, players: number): { perPlayer: number; remainder: number } => {
  assertChipAmount(total, 'total');
  assertInteger(players, 'players');

  if (players <= 0) {
    throw new Error('players must be greater than 0.');
  }

  const remainder = total % players;
  const perPlayer = (total - remainder) / players;

  return { perPlayer, remainder };
};

export const formatChips = (centimes: number): string => {
  assertChipAmount(centimes, 'centimes');

  const euros = Math.trunc(centimes / CENTIMES_PER_EURO);
  const cents = centimes % CENTIMES_PER_EURO;

  return `${euros}.${cents.toString().padStart(2, '0')}€`;
};

export const parseChips = (display: string): number => {
  const normalized = display.trim().replace(/€/g, '').trim();
  const match = normalized.match(/^(\d+)(?:[.,](\d{1,2}))?$/);

  if (!match) {
    throw new Error('Invalid chip amount format.');
  }

  const euros = Number.parseInt(match[1], 10);
  const cents = Number.parseInt((match[2] ?? '').padEnd(2, '0') || '0', 10);
  const centimes = euros * CENTIMES_PER_EURO + cents;

  assertChipAmount(centimes, 'centimes');

  return centimes;
};
