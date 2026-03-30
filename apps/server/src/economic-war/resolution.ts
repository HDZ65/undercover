/**
 * Empire du Commerce — Resolution Orchestrator
 * Executes all 8 resolution steps in deterministic order
 */

import type { ResolutionEntry, PlayerAction } from '@undercover/shared';
import type { EcoWarGameContext } from './types.js';
import { resolveSabotageActions } from './espionage.js';
import { resolveWars, resolveAttackOrders, declareWar, degradeUnmaintainedWeapons, calculateEffectiveForce, tickWeaponProduction, tickCombatUnitProduction, tickUnitMaintenance } from './military.js';
import { tickMining } from './mining.js';
import { tickAgriculture } from './agriculture.js';
import { tickLivestock } from './livestock.js';
import { tickMarine } from './marine.js';
import { tickManufacturing, tickMaintenanceParts, tickAmmunitionProduction } from './manufacturing.js';
import { tickTransport, tickVehicleProduction, tickAutoMaintenance } from './transport.js';
import { collectIncome, calculateMaintenanceCosts } from './production.js';
import { updatePopulation, updatePollution } from './population.js';
import { resolveCommerce } from './commerce.js';
import { generateMarketEvents } from './marketEvents.js';
import { generateJournalHeadlines } from './journal.js';
import { calculateScore, calculateGDP, calculateInfluence, buildLeaderboard } from './scoring.js';
import { collectCotisations, tickOrgVotes, tickEmbargos } from './organizations.js';

export interface RoundResolutionResult {
  log: ResolutionEntry[];
  gameOver: boolean;
}

export function resolveRound(context: EcoWarGameContext): RoundResolutionResult {
  const log: ResolutionEntry[] = [];

  // Gather all submitted actions
  const allActions = new Map<string, PlayerAction[]>();
  const defendingPlayerIds = new Set<string>();

  for (const [playerId, player] of context.players) {
    if (player.abandoned) continue;
    allActions.set(playerId, player.submittedActions || []);

    // Check if player is defending
    if (player.submittedActions?.some(a => a.type === 'defend')) {
      defendingPlayerIds.add(playerId);
    }

    // Réinitialiser les troupes épuisées pour le prochain tour d'action
    player.exhaustedTroopsByRegion = {};
  }

  // ─── Step 1: Defenses ───
  const defenseEntries = resolveDefenses(context, defendingPlayerIds);
  log.push(...defenseEntries);

  // ─── Step 2: Sabotage ───
  const sabotageEntries = resolveSabotageActions(context.players, allActions, defendingPlayerIds);
  log.push(...sabotageEntries);

  // ─── Step 3: Wars ───
  // 3a. Ordres d'attaque province-à-province (nouveau système)
  const attackOrderEntries = resolveAttackOrders(context);
  log.push(...attackOrderEntries);
  // 3b. Résolution abstraite des guerres (fallback + gestion armistice/victoire)
  const warEntries = resolveWars(context);
  log.push(...warEntries);

  // Process war declarations from this turn's actions
  const warDeclarations = resolveWarDeclarations(context, allActions);
  log.push(...warDeclarations);

  // ─── Step 3.5: Mining (recharge + extraction + pollution) ───
  const miningEntries = tickMining(context.players);
  log.push(...miningEntries);

  // ─── Step 3.6: Agriculture (production + fertility evolution) ───
  const agriEntries = tickAgriculture(context.players);
  log.push(...agriEntries);

  // ─── Step 3.7: Livestock (production + feed consumption + herd evolution) ───
  const livestockEntries = tickLivestock(context.players);
  log.push(...livestockEntries);

  // ─── Step 3.8: Marine (extraction + stock evolution) ───
  const marineEntries = tickMarine(context.players);
  log.push(...marineEntries);

  // ─── Step 3.9: Manufacturing (biens produits par les usines) ───
  const mfgEntries = tickManufacturing(context.players);
  log.push(...mfgEntries);

  // ─── Step 3.10: Production automatique de véhicules ──────────
  const vehicleProductionEntries = tickVehicleProduction(context.players);
  log.push(...vehicleProductionEntries);

  // ─── Step 3.10b: Production automatique d'armes ───────────────
  const weaponProductionEntries = tickWeaponProduction(context.players);
  log.push(...weaponProductionEntries);

  // ─── Step 3.10d: Production d'unités de combat (chars, avions, navires) ───
  const combatUnitEntries = tickCombatUnitProduction(context.players);
  log.push(...combatUnitEntries);

  // ─── Step 3.10c: Production de pièces d'entretien ─────────────
  const maintenancePartsEntries = tickMaintenanceParts(context.players);
  log.push(...maintenancePartsEntries);

  // ─── Step 3.10e: Production de munitions ─────────────────────
  const ammoEntries = tickAmmunitionProduction(context.players);
  log.push(...ammoEntries);

  // ─── Step 3.11: Transport (vieillissement + carburant + capacité) ───
  const transportEntries = tickTransport(context.players);
  log.push(...transportEntries);

  // ─── Step 3.11b: Auto-maintenance (pièces appliquées aux véhicules/armes vieillissants) ───
  const playerNames = new Map<string, string>();
  for (const [id, p] of context.players) playerNames.set(id, p.countryName);
  const autoMaintenanceEntries = tickAutoMaintenance(context.players, playerNames);
  log.push(...autoMaintenanceEntries);

  // ─── Step 3.12: Entretien des unités militaires ───────────────
  const unitMaintenanceEntries = tickUnitMaintenance(context.players);
  log.push(...unitMaintenanceEntries);

  // ─── Step 4: Production ───
  const productionEntries = resolveProduction(context);
  log.push(...productionEntries);

  // ─── Step 5: Commerce ───
  const commerceEntries = resolveCommerce(context);
  log.push(...commerceEntries);

  // ─── Step 6: Random Events ───
  const { events, entries: eventEntries } = generateMarketEvents(context);
  context.marketEvents = events;
  log.push(...eventEntries);

  // ─── Step 7: Population ───
  const popEntries = updatePopulation(context.players);
  log.push(...popEntries);

  // Update pollution for all players
  for (const [, player] of context.players) {
    if (!player.abandoned) {
      updatePollution(player);
    }
  }

  // ─── Step 8: Score ───
  const scoreEntries = resolveScores(context);
  log.push(...scoreEntries);

  // Tick temporary effects
  tickTemporaryEffects(context);

  // Organisations : cotisations + résolution des votes + décrément des embargos
  for (const org of context.organizations) {
    collectCotisations(org, context.players, context.currentRound);
    tickOrgVotes(org, context.players, context.currentRound);
    tickEmbargos(org);
  }

  // Generate journal headlines
  context.journalHeadlines = generateJournalHeadlines(context, log);

  // Build leaderboard
  context.leaderboard = buildLeaderboard(context.players);

  // Store resolution log
  context.resolutionLog = log;

  // Check game over: <= 2 active players
  const activePlayers = Array.from(context.players.values()).filter(p => !p.abandoned);
  const gameOver = activePlayers.length <= 2;

  return { log, gameOver };
}

// ─── Step Implementations ──────────────────────────────────────

function resolveDefenses(
  context: EcoWarGameContext,
  defendingPlayerIds: Set<string>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const playerId of defendingPlayerIds) {
    const player = context.players.get(playerId);
    if (!player) continue;

    entries.push({
      step: 'defense',
      playerId,
      description: `${player.countryName} active ses défenses ce tour.`,
      icon: '🛡️',
      positive: true,
    });
  }

  return entries;
}

function resolveWarDeclarations(
  context: EcoWarGameContext,
  allActions: Map<string, PlayerAction[]>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [playerId, actions] of allActions) {
    const warActions = actions.filter(a => a.type === 'war' && a.targetPlayerId);
    const attacker = context.players.get(playerId);
    if (!attacker) continue;

    for (const action of warActions) {
      const defender = context.players.get(action.targetPlayerId!);
      if (!defender) continue;

      // Check if already at war with this player
      const alreadyAtWar = context.activeWars.some(
        w => w.status === 'active' &&
          ((w.attackerId === playerId && w.defenderId === action.targetPlayerId) ||
           (w.defenderId === playerId && w.attackerId === action.targetPlayerId)),
      );
      if (alreadyAtWar) continue;

      const war = declareWar(attacker, defender, context);

      entries.push({
        step: 'war',
        playerId,
        targetId: action.targetPlayerId,
        description: `${attacker.countryName} DÉCLARE LA GUERRE à ${defender.countryName} !`,
        icon: '⚔️',
        positive: false,
        details: { warId: war.id },
      });
    }
  }

  return entries;
}

function resolveProduction(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of context.players) {
    if (player.abandoned) continue;

    const income = collectIncome(player);
    const maintenance = calculateMaintenanceCosts(player);
    const net = income - maintenance;

    player.money += net;

    entries.push({
      step: 'production',
      playerId: player.id,
      description: `${player.countryName} : revenus +${income.toLocaleString()}, entretien -${maintenance.toLocaleString()}, net ${net >= 0 ? '+' : ''}${net.toLocaleString()}`,
      icon: net >= 0 ? '🏭' : '📉',
      positive: net >= 0,
    });
  }

  return entries;
}

function resolveScores(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of context.players) {
    if (player.abandoned) continue;

    const orgCount = player.organizationMemberships.length;
    player.gdp = calculateGDP(player);
    player.influence = calculateInfluence(player, orgCount);
    player.military.effectiveForce = calculateEffectiveForce(player);
    const oldScore = player.score;
    player.score = calculateScore(player);
    const diff = player.score - oldScore;

    entries.push({
      step: 'score',
      playerId: player.id,
      description: `${player.countryName} : Score ${player.score.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff.toLocaleString()})`,
      icon: diff >= 0 ? '📊' : '📉',
      positive: diff >= 0,
    });
  }

  return entries;
}

function tickTemporaryEffects(context: EcoWarGameContext): void {
  for (const [, player] of context.players) {
    if (!player.abandoned) {
      degradeUnmaintainedWeapons(player, context);
    }
    player.activeEffects = player.activeEffects.filter(effect => {
      effect.remainingTurns--;
      return effect.remainingTurns > 0;
    });
  }

  // Tick war durations and check for ended wars
  context.activeWars = context.activeWars.filter(war => {
    return war.status === 'active';
  });

  // Clean up expired or resolved threats
  context.activeThreats = context.activeThreats.filter(t => {
    if (t.status !== 'pending') return false;
    return context.currentRound <= t.deadlineRound;
  });

  // Tick region resistance
  for (const [, player] of context.players) {
    for (const region of player.regions) {
      if (region.resistanceRemaining > 0) {
        region.resistanceRemaining--;
      }
      // Check if destroyed region can be recovered
      if (region.destroyed && region.destroyedUntilRound !== null && context.currentRound >= region.destroyedUntilRound) {
        region.destroyed = false;
        region.destroyedUntilRound = null;
        region.productionCapacity = 30; // starts recovering
      }
    }
  }
}
