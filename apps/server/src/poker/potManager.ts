import type { SidePot } from '@undercover/shared';
import { addChips, assertInteger, divideChips, subtractChips } from './chips';

const ZERO_CHIPS = 0;

const clonePot = (pot: SidePot): SidePot => {
  return {
    amount: pot.amount,
    eligiblePlayerIds: [...pot.eligiblePlayerIds],
  };
};

const getSortedThresholds = (playerBets: Map<string, number>): number[] => {
  return [...new Set([...playerBets.values()])].sort((amountA, amountB) => amountA - amountB);
};

const getContributorsAtThreshold = (playerBets: Map<string, number>, threshold: number): string[] => {
  return [...playerBets.entries()]
    .filter(([, betAmount]) => betAmount >= threshold)
    .map(([playerId]) => playerId);
};

const buildPotAmount = (contributorCount: number, contributionPerPlayer: number): number => {
  let amount = ZERO_CHIPS;

  for (let index = 0; index < contributorCount; index += 1) {
    amount = addChips(amount, contributionPerPlayer);
  }

  return amount;
};

const toUniquePlayerIds = (playerIds: string[]): string[] => {
  return [...new Set(playerIds)];
};

const resolveTableSize = (playerSeatIndices: Map<string, number>, dealerSeatIndex: number): number => {
  const highestSeatIndex = [...playerSeatIndices.values()].reduce((maxSeatIndex, currentSeatIndex) => {
    return currentSeatIndex > maxSeatIndex ? currentSeatIndex : maxSeatIndex;
  }, dealerSeatIndex);

  return highestSeatIndex + 1;
};

const getClockwiseDistance = (dealerSeatIndex: number, seatIndex: number, tableSize: number): number => {
  const distance = (seatIndex - dealerSeatIndex + tableSize) % tableSize;
  return distance === 0 ? tableSize : distance;
};

const getOddChipOrder = (
  winnerIds: string[],
  dealerSeatIndex: number,
  playerSeatIndices: Map<string, number>,
): string[] => {
  const tableSize = resolveTableSize(playerSeatIndices, dealerSeatIndex);

  return winnerIds
    .map((playerId, index) => {
      const seatIndex = playerSeatIndices.get(playerId);

      if (seatIndex === undefined) {
        return {
          playerId,
          index,
          distance: Number.POSITIVE_INFINITY,
        };
      }

      assertInteger(seatIndex, `seatIndex for ${playerId}`);

      return {
        playerId,
        index,
        distance: getClockwiseDistance(dealerSeatIndex, seatIndex, tableSize),
      };
    })
    .sort((entryA, entryB) => {
      if (entryA.distance !== entryB.distance) {
        return entryA.distance - entryB.distance;
      }

      return entryA.index - entryB.index;
    })
    .map((entry) => entry.playerId);
};

export class PotManager {
  private pots: SidePot[] = [];

  private playerBets: Map<string, number> = new Map();

  private foldedPlayerIds: Set<string> = new Set();

  public addBet(playerId: string, amount: number): void {
    const currentBet = this.playerBets.get(playerId) ?? ZERO_CHIPS;
    this.playerBets.set(playerId, addChips(currentBet, amount));
  }

  public playerFolded(playerId: string): void {
    this.foldedPlayerIds.add(playerId);
  }

  public playerAllIn(playerId: string, amount: number): void {
    this.addBet(playerId, amount);
  }

  public calculateSidePots(playerBets: Map<string, number>, foldedPlayerIds: Set<string>): SidePot[] {
    this.playerBets = new Map<string, number>();
    this.foldedPlayerIds = new Set(foldedPlayerIds);

    for (const [playerId, betAmount] of playerBets.entries()) {
      const validatedBetAmount = addChips(ZERO_CHIPS, betAmount);

      if (validatedBetAmount > ZERO_CHIPS) {
        this.playerBets.set(playerId, validatedBetAmount);
      }
    }

    const nextPots: SidePot[] = [];
    const thresholds = getSortedThresholds(this.playerBets);
    let previousThreshold = ZERO_CHIPS;

    for (const threshold of thresholds) {
      const contributionPerPlayer = subtractChips(threshold, previousThreshold);
      const contributors = getContributorsAtThreshold(this.playerBets, threshold);

      if (contributors.length === 0) {
        previousThreshold = threshold;
        continue;
      }

      const potAmount = buildPotAmount(contributors.length, contributionPerPlayer);
      const eligiblePlayerIds = contributors.filter((playerId) => !this.foldedPlayerIds.has(playerId));

      if (potAmount > ZERO_CHIPS && eligiblePlayerIds.length > 0) {
        nextPots.push({
          amount: potAmount,
          eligiblePlayerIds,
        });
      }

      previousThreshold = threshold;
    }

    this.pots = nextPots;
    return this.getPots();
  }

  public distributePots(
    winners: Map<number, string[]>,
    dealerSeatIndex: number,
    playerSeatIndices: Map<string, number>,
  ): Map<string, number> {
    assertInteger(dealerSeatIndex, 'dealerSeatIndex');

    const payouts = new Map<string, number>();

    this.pots.forEach((pot, potIndex) => {
      const winnerIds = winners.get(potIndex) ?? [];
      const uniqueWinnerIds = toUniquePlayerIds(winnerIds);
      const eligibleWinners = uniqueWinnerIds.filter((playerId) => pot.eligiblePlayerIds.includes(playerId));

      if (eligibleWinners.length === 0) {
        return;
      }

      const { perPlayer, remainder } = divideChips(pot.amount, eligibleWinners.length);

      for (const playerId of eligibleWinners) {
        const currentPayout = payouts.get(playerId) ?? ZERO_CHIPS;
        payouts.set(playerId, addChips(currentPayout, perPlayer));
      }

      if (remainder === ZERO_CHIPS) {
        return;
      }

      const oddChipOrder = getOddChipOrder(eligibleWinners, dealerSeatIndex, playerSeatIndices);

      for (let oddChipIndex = 0; oddChipIndex < remainder; oddChipIndex += 1) {
        const recipientId = oddChipOrder[oddChipIndex % oddChipOrder.length];
        const currentPayout = payouts.get(recipientId) ?? ZERO_CHIPS;
        payouts.set(recipientId, addChips(currentPayout, 1));
      }
    });

    return payouts;
  }

  public getTotalPot(): number {
    return this.pots.reduce((total, currentPot) => addChips(total, currentPot.amount), ZERO_CHIPS);
  }

  public getPots(): SidePot[] {
    return this.pots.map(clonePot);
  }
}
