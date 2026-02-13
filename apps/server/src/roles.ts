import { randomInt } from 'node:crypto';
import type { Player, Role } from '@undercover/shared';

interface RoleDistribution {
  undercover: number;
  mrwhite: number;
}

const roleDistributionTable: Array<{
  minPlayers: number;
  maxPlayers: number;
  distribution: RoleDistribution;
}> = [
  { minPlayers: 3, maxPlayers: 4, distribution: { undercover: 1, mrwhite: 0 } },
  { minPlayers: 5, maxPlayers: 6, distribution: { undercover: 1, mrwhite: 1 } },
  { minPlayers: 7, maxPlayers: 8, distribution: { undercover: 2, mrwhite: 1 } },
  { minPlayers: 9, maxPlayers: 12, distribution: { undercover: 2, mrwhite: 1 } },
  { minPlayers: 13, maxPlayers: 16, distribution: { undercover: 3, mrwhite: 1 } },
  { minPlayers: 17, maxPlayers: 20, distribution: { undercover: 3, mrwhite: 2 } },
];

const shuffleArray = <T>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const j = randomInt(index + 1);
    const currentValue = shuffled[index];
    shuffled[index] = shuffled[j];
    shuffled[j] = currentValue;
  }
  return shuffled;
};

const getRoleDistribution = (playerCount: number): RoleDistribution => {
  const row = roleDistributionTable.find(
    ({ minPlayers, maxPlayers }) => playerCount >= minPlayers && playerCount <= maxPlayers,
  );

  if (!row) {
    throw new Error(`Unsupported player count: ${playerCount}. Supported range is 3 to 20 players.`);
  }

  return row.distribution;
};

export const distributeRoles = (players: Player[]): Player[] => {
  const distribution = getRoleDistribution(players.length);
  const civilCount = players.length - distribution.undercover - distribution.mrwhite;

  if (civilCount <= 0) {
    throw new Error('Invalid role distribution. Civil count must remain positive.');
  }

  const roles: Role[] = [
    ...Array.from({ length: civilCount }, (): Role => 'civil'),
    ...Array.from({ length: distribution.undercover }, (): Role => 'undercover'),
    ...Array.from({ length: distribution.mrwhite }, (): Role => 'mrwhite'),
  ];

  const shuffledRoles = shuffleArray(roles);

  return players.map((player, index) => ({
    ...player,
    role: shuffledRoles[index],
    isEliminated: false,
  }));
};

export const getRoleCounts = (players: Player[]) => {
  return players.reduce(
    (accumulator, player) => {
      if (!player.isEliminated) {
        if (player.role === 'civil') {
          accumulator.civil += 1;
        } else if (player.role === 'undercover') {
          accumulator.undercover += 1;
        } else if (player.role === 'mrwhite') {
          accumulator.mrwhite += 1;
        }
      }

      return accumulator;
    },
    { civil: 0, undercover: 0, mrwhite: 0 },
  );
};
