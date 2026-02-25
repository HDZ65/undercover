/**
 * Empire du Commerce — Espionage & Sabotage
 * Handles sabotage resolution (success roll + visibility roll)
 */

import type { PlayerAction, EspionageResult, SabotageOutcome, ResolutionEntry } from '@undercover/shared';
import type { ServerPlayerState, TemporaryEffect } from './types';
import {
  SABOTAGE_COST_RATE,
  SABOTAGE_DAMAGE_MIN,
  SABOTAGE_DAMAGE_MAX,
  SABOTAGE_DURATION_MIN,
  SABOTAGE_DURATION_MAX,
  SABOTAGE_SUCCESS_RATES,
  SABOTAGE_VISIBILITY,
  SABOTAGE_FAILED_DETECT_MIN,
  SABOTAGE_FAILED_DETECT_MAX,
} from './constants';
import { randomUUID as uuid } from 'crypto';

export function resolveSabotageActions(
  players: Map<string, ServerPlayerState>,
  actions: Map<string, PlayerAction[]>,
  defendingPlayerIds: Set<string>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [attackerId, playerActions] of actions) {
    const sabotageActions = playerActions.filter(a => a.type === 'sabotage');
    const attacker = players.get(attackerId);
    if (!attacker) continue;

    for (const action of sabotageActions) {
      if (!action.targetPlayerId) continue;
      const target = players.get(action.targetPlayerId);
      if (!target) continue;

      // Check if target is defending
      if (defendingPlayerIds.has(target.id)) {
        entries.push({
          step: 'sabotage',
          playerId: target.id,
          description: `${target.countryName} a bloqué une tentative de sabotage grâce à sa défense active !`,
          icon: '🛡️',
          positive: true,
        });
        // Attacker still pays cost
        const cost = Math.round(attacker.gdp * SABOTAGE_COST_RATE);
        attacker.money -= cost;
        continue;
      }

      // Pay sabotage cost
      const cost = Math.round(attacker.gdp * SABOTAGE_COST_RATE);
      attacker.money -= cost;

      // Calculate intelligence differential
      const diff = attacker.military.intelligence - target.military.intelligence;

      // Step 1: Success roll
      const successRate = getSabotageSuccessRate(diff);
      const roll = Math.random();
      const succeeded = roll < successRate;

      if (succeeded) {
        // Step 2a: Visibility roll
        const outcome = getVisibilityOutcome(diff);
        const damage = randomBetween(SABOTAGE_DAMAGE_MIN, SABOTAGE_DAMAGE_MAX);
        const duration = randomIntBetween(SABOTAGE_DURATION_MIN, SABOTAGE_DURATION_MAX);

        // Apply damage as temporary effect
        const effect: TemporaryEffect = {
          id: uuid(),
          type: 'sabotage_damage',
          description: `Sabotage : ${action.sector || 'infrastructure'} endommagé(e)`,
          affectedSector: action.sector || action.infrastructureType,
          modifier: -(damage / 100),
          remainingTurns: duration,
        };
        target.activeEffects.push(effect);

        // Damage specific factory or infrastructure
        applySabotageDamage(target, action, damage);

        const espResult: EspionageResult = {
          id: uuid(),
          attackerId,
          targetId: target.id,
          targetDescription: action.sector || action.infrastructureType || 'infrastructure',
          outcome: outcome as SabotageOutcome,
          damagePercent: damage,
          damageDuration: duration,
          roundExecuted: 0, // set by caller
        };

        // Record result for both sides
        target.espionageResults.push(espResult);

        if (outcome === 'success_invisible') {
          entries.push({
            step: 'sabotage',
            playerId: target.id,
            description: `${target.countryName} subit un sabotage mystérieux sur ${action.sector || 'son infrastructure'} (-${damage}%, ${duration} tours)`,
            icon: '💥',
            positive: false,
          });
        } else if (outcome === 'success_suspicion') {
          // Target knows who did it, but no proof
          target.notifications.push({
            id: uuid(),
            type: 'sabotage_suffered',
            title: 'Sabotage détecté — Soupçon',
            message: `Votre ${action.sector || 'infrastructure'} a été saboté(e). Vous soupçonnez ${attacker.countryName}.`,
            icon: '🕵️',
            severity: 'warning',
            round: 0,
            read: false,
          });
          entries.push({
            step: 'sabotage',
            playerId: target.id,
            description: `${target.countryName} subit un sabotage. Un suspect est identifié...`,
            icon: '💥',
            positive: false,
          });
        } else {
          // success_proof — everyone sees
          entries.push({
            step: 'sabotage',
            playerId: target.id,
            targetId: attackerId,
            description: `PREUVE : ${attacker.countryName} a saboté ${target.countryName} ! (-${damage}%, ${duration} tours)`,
            icon: '🔍',
            positive: false,
          });
          target.notifications.push({
            id: uuid(),
            type: 'sabotage_suffered',
            title: 'Sabotage — Preuve irréfutable !',
            message: `${attacker.countryName} a saboté votre ${action.sector || 'infrastructure'}. Preuve en main.`,
            icon: '🔍',
            severity: 'danger',
            round: 0,
            read: false,
          });
        }
      } else {
        // Step 2b: Failed — detection chance
        const detectRate = lerp(SABOTAGE_FAILED_DETECT_MIN, SABOTAGE_FAILED_DETECT_MAX, Math.max(0, -diff) / 60);
        const detected = Math.random() < detectRate;

        if (detected) {
          target.notifications.push({
            id: uuid(),
            type: 'sabotage_failed',
            title: 'Tentative de sabotage neutralisée',
            message: `Une tentative de sabotage de ${attacker.countryName} a été neutralisée par vos services de renseignement.`,
            icon: '🛡️',
            severity: 'info',
            round: 0,
            read: false,
          });
          entries.push({
            step: 'sabotage',
            playerId: target.id,
            description: `${target.countryName} a neutralisé une tentative de sabotage. L'attaquant a été identifié.`,
            icon: '🛡️',
            positive: true,
          });
        } else {
          // Failed and not detected — nothing happens visibly
          target.notifications.push({
            id: uuid(),
            type: 'sabotage_failed',
            title: 'Tentative de sabotage neutralisée',
            message: `Une tentative de sabotage a été neutralisée. L'auteur est inconnu.`,
            icon: '🛡️',
            severity: 'info',
            round: 0,
            read: false,
          });
        }

        attacker.notifications.push({
          id: uuid(),
          type: 'sabotage_failed',
          title: 'Opération échouée',
          message: `Votre sabotage contre ${target.countryName} a échoué.${detected ? ' Vous avez été identifié !' : ''}`,
          icon: detected ? '🚨' : '❌',
          severity: detected ? 'danger' : 'warning',
          round: 0,
          read: false,
        });
      }
    }
  }

  return entries;
}

function applySabotageDamage(target: ServerPlayerState, action: PlayerAction, damage: number): void {
  if (action.sector) {
    // Damage a factory in this sector
    const factory = target.factories.find(f => f.sector === action.sector && f.health > 0);
    if (factory) {
      factory.health = Math.max(0, factory.health - damage);
    }
  } else if (action.infrastructureType) {
    // Damage infrastructure
    const current = target.infrastructure[action.infrastructureType];
    target.infrastructure[action.infrastructureType] = Math.max(0, current - damage);
  }
}

function getSabotageSuccessRate(diff: number): number {
  for (const tier of SABOTAGE_SUCCESS_RATES) {
    if (diff >= tier.diffMin) return tier.rate;
  }
  return 0.20;
}

function getVisibilityOutcome(diff: number): SabotageOutcome {
  let rates: readonly [number, number, number];

  if (diff >= 30) {
    rates = SABOTAGE_VISIBILITY.attackerStrong;
  } else if (diff >= -9) {
    rates = SABOTAGE_VISIBILITY.equal;
  } else {
    rates = SABOTAGE_VISIBILITY.defenderStrong;
  }

  const roll = Math.random();
  if (roll < rates[0]) return 'success_invisible';
  if (roll < rates[0] + rates[1]) return 'success_suspicion';
  return 'success_proof';
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomIntBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
