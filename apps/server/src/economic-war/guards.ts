/**
 * Empire du Commerce — XState Guards
 */

import type { EcoWarGameContext } from './types.js';
import { MIN_ACTIVE_PLAYERS } from './constants.js';

export const ecoWarGuards = {
  hasEnoughPlayers: ({ context }: { context: EcoWarGameContext }) => {
    return context.players.size >= context.config.minPlayers;
  },

  allCountriesSelected: ({ context }: { context: EcoWarGameContext }) => {
    for (const [, player] of context.players) {
      if (!player.countryId) return false;
    }
    return true;
  },

  allActionsSubmitted: ({ context }: { context: EcoWarGameContext }) => {
    for (const [, player] of context.players) {
      if (player.abandoned) continue;
      if (!player.actionsSubmitted) return false;
    }
    return true;
  },

  allPlayersReady: ({ context }: { context: EcoWarGameContext }) => {
    let hasActive = false;
    for (const [, player] of context.players) {
      if (player.abandoned || !player.connected) continue;
      hasActive = true;
      if (!player.ready) return false;
    }
    return hasActive; // false if no active players at all
  },

  isGameOver: ({ context }: { context: EcoWarGameContext }) => {
    const activePlayers = Array.from(context.players.values()).filter(p => !p.abandoned);
    return activePlayers.length <= MIN_ACTIVE_PLAYERS - 1; // <= 2
  },

  hasEarlyVictory: ({ context }: { context: EcoWarGameContext }) => {
    if (!context.config.earlyVictoryEnabled) return false;

    // Score threshold victory
    for (const [, player] of context.players) {
      if (player.abandoned) continue;
      if (player.score >= context.config.earlyVictoryThreshold) return true;
    }

    // Conquest victory: a player controls 80% of all regions
    const totalRegions = Array.from(context.players.values())
      .reduce((sum, p) => sum + p.regions.length, 0);
    if (totalRegions > 0) {
      for (const [, player] of context.players) {
        if (player.abandoned) continue;
        if (player.regions.length / totalRegions >= 0.80) return true;
      }
    }

    return false;
  },
};
