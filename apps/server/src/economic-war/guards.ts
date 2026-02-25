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
      if (player.abandoned || !player.connected) continue;
      if (!player.actionsSubmitted) return false;
    }
    return true;
  },

  allPlayersReady: ({ context }: { context: EcoWarGameContext }) => {
    for (const [, player] of context.players) {
      if (player.abandoned || !player.connected) continue;
      if (!player.ready) return false;
    }
    return true;
  },

  isGameOver: ({ context }: { context: EcoWarGameContext }) => {
    const activePlayers = Array.from(context.players.values()).filter(p => !p.abandoned);
    return activePlayers.length <= MIN_ACTIVE_PLAYERS - 1; // <= 2
  },

  hasEarlyVictory: ({ context }: { context: EcoWarGameContext }) => {
    if (!context.config.earlyVictoryEnabled) return false;
    for (const [, player] of context.players) {
      if (player.abandoned) continue;
      if (player.score >= context.config.earlyVictoryThreshold) return true;
    }
    return false;
  },
};
