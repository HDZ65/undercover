/**
 * Empire du Commerce — Manufacturing
 *
 * Chaque usine existante produit des biens manufacturés en plus du PIB.
 * Les matières premières sont consommées proportionnellement à la production.
 * Si les intrants manquent, la production est partielle (jamais bloquée brutalement).
 *
 * Bonus engrais : +fertilité agricole passif si stock > 0 (appliqué ici directement
 * sur les plots, avant tickAgriculture).
 */

import type { ServerPlayerState } from './types.js';
import type { MaintenancePart, ResolutionEntry } from '@undercover/shared';
import {
  MFG_OUTPUT_PER_FACTORY,
  MFG_OUTPUT_RESOURCE,
  MFG_INPUTS,
  FERTILIZER_AGRI_BONUS_PER_UNIT,
  FERTILIZER_AGRI_BONUS_CAP,
  MAINTENANCE_PARTS_PER_FACTORY,
  MAINTENANCE_WORKSHOP_MAX_PART_TIER,
  AMMO_OUTPUT_PER_FACTORY,
  AMMO_INPUTS,
  COAL_SUBSTITUTES,
} from './constants.js';

// Multiplicateur par tier d'usine (miroir de FACTORY_TIERS)
const TIER_MULT: Record<string, number> = {
  basic:     1.0,
  advanced:  1.8,
  robotized: 3.0,
};

// ─── Tick principal ────────────────────────────────────────────

export function tickManufacturing(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;
    playerEntries(player, entries);
  }

  return entries;
}

function playerEntries(player: ServerPlayerState, entries: ResolutionEntry[]): void {
  const res = player.resources as unknown as Record<string, number>;

  // Regrouper les usines par secteur (ignorer les usines en pause)
  const sectorCounts: Record<string, { count: number; avgHealth: number; tier: string }> = {};
  for (const factory of player.factories) {
    if (factory.paused) continue;
    if (!sectorCounts[factory.sector]) {
      sectorCounts[factory.sector] = { count: 0, avgHealth: 0, tier: factory.tier };
    }
    const s = sectorCounts[factory.sector];
    s.count++;
    s.avgHealth += factory.health;
    // Utiliser le tier le plus élevé du groupe (simplification)
    if (TIER_MULT[factory.tier] > TIER_MULT[s.tier]) s.tier = factory.tier;
  }
  for (const s of Object.values(sectorCounts)) {
    s.avgHealth = s.avgHealth / s.count / 100; // normalise 0-1
  }

  // ── Production principale ──────────────────────────────────

  for (const [sector, spec] of Object.entries(MFG_OUTPUT_PER_FACTORY)) {
    const sectorData = sectorCounts[sector];
    if (!sectorData || sectorData.count === 0) continue;

    const outputResource = MFG_OUTPUT_RESOURCE[sector];
    if (!outputResource) continue;

    const tierMult   = TIER_MULT[sectorData.tier] ?? 1.0;
    const healthMult = sectorData.avgHealth;

    // Secteurs électroniques : multiplicateur d'infra électrique
    const needsElec = sector === 'electronics' || sector === 'phonesFactory' || sector === 'computersFactory';
    const infraMult = needsElec
      ? 0.3 + 0.7 * (player.infrastructure.electricity / 100)
      : 1.0;

    const rawOutput = spec * sectorData.count * tierMult * healthMult * infraMult;

    // Vérifier disponibilité des intrants (production partielle si manque)
    // Le charbon peut être remplacé par électricité ou pétrole
    const inputs = MFG_INPUTS[sector] ?? [];
    let efficiencyRatio = 1.0;

    for (const input of inputs) {
      const demanded = input.amountPerUnit * rawOutput;
      if (demanded <= 0) continue;
      let available = res[input.resource] ?? 0;
      // Si c'est du charbon et qu'il en manque, compter les substituts disponibles
      if (input.resource === 'coal' && available < demanded) {
        let coalEquivalent = available;
        for (const sub of COAL_SUBSTITUTES) {
          const subAvail = res[sub.resource] ?? 0;
          coalEquivalent += subAvail / sub.ratio;
        }
        available = coalEquivalent;
      }
      if (available < demanded) {
        efficiencyRatio = Math.min(efficiencyRatio, available / demanded);
      }
    }

    const actualOutput = Math.round(rawOutput * efficiencyRatio);
    if (actualOutput <= 0) continue;

    // Consommer les intrants
    for (const input of inputs) {
      let toConsume = input.amountPerUnit * rawOutput * efficiencyRatio;
      if (input.resource === 'coal') {
        // Consommer le charbon d'abord, puis les substituts
        const coalAvail = res['coal'] ?? 0;
        const coalUsed = Math.min(coalAvail, toConsume);
        res['coal'] = Math.max(0, coalAvail - coalUsed);
        let deficit = toConsume - coalUsed;
        for (const sub of COAL_SUBSTITUTES) {
          if (deficit <= 0) break;
          const subAvail = res[sub.resource] ?? 0;
          const subNeeded = deficit * sub.ratio;
          const subUsed = Math.min(subAvail, subNeeded);
          res[sub.resource] = Math.max(0, subAvail - subUsed);
          deficit -= subUsed / sub.ratio;
        }
      } else {
        res[input.resource] = Math.max(0, (res[input.resource] ?? 0) - toConsume);
      }
    }

    // Ajouter la production au stock (ou boost infra pour l'électricité)
    if (outputResource === 'electricity') {
      player.infrastructure.electricity = Math.min(100, player.infrastructure.electricity + actualOutput);
    } else {
      res[outputResource] = (res[outputResource] ?? 0) + actualOutput;
    }

    // Alerte si efficacité fortement réduite
    if (efficiencyRatio < 0.5) {
      entries.push({
        step: 'production',
        playerId: player.id,
        description: `⚠️ ${player.countryName} : production ${outputResource} à ${Math.round(efficiencyRatio * 100)}% — manque de matières premières`,
        icon: '🏭',
        positive: false,
      });
    }
  }

  // ── Bonus engrais sur la fertilité agricole ───────────────

  const fertilizerStock = res['fertilizer'] ?? 0;
  if (fertilizerStock > 0) {
    const bonus = Math.min(FERTILIZER_AGRI_BONUS_CAP, fertilizerStock * FERTILIZER_AGRI_BONUS_PER_UNIT);
    for (const plot of player.agriculture.plots) {
      plot.fertility = Math.min(100, plot.fertility + bonus * 100);
    }
  }
}

// ─── Production de pièces d'entretien ─────────────────────────

const WORKSHOP_TIER_MULT: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 };

export function tickMaintenanceParts(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    const workshops = player.factories.filter(f => f.sector === 'maintenanceWorkshop');
    if (workshops.length === 0) continue;

    // Best tier + average health
    let bestTier = 'basic';
    let totalHealth = 0;
    for (const f of workshops) {
      if (WORKSHOP_TIER_MULT[f.tier] > WORKSHOP_TIER_MULT[bestTier]) bestTier = f.tier;
      totalHealth += f.health;
    }
    const avgHealth = (totalHealth / workshops.length) / 100;

    const maxPartTier = MAINTENANCE_WORKSHOP_MAX_PART_TIER[bestTier] ?? 2;
    const chosenTier = Math.min(
      player.productionChoices['maintenanceWorkshop']?.partTier ?? 1,
      maxPartTier,
    ) as 1 | 2 | 3 | 4;

    const produced = Math.floor(
      workshops.length * MAINTENANCE_PARTS_PER_FACTORY * (WORKSHOP_TIER_MULT[bestTier] ?? 1.0) * avgHealth,
    );
    if (produced <= 0) continue;

    // Merge into player.maintenanceParts
    const existing = player.maintenanceParts.find(
      p => p.tier === chosenTier && p.manufacturerId === player.id,
    );
    if (existing) {
      existing.quantity += produced;
    } else {
      const part: MaintenancePart = { tier: chosenTier, manufacturerId: player.id, quantity: produced };
      player.maintenanceParts.push(part);
    }

    entries.push({
      step: 'production',
      playerId: player.id,
      description: `🔩 ${player.countryName} : ${produced} pièce(s) d'entretien T${chosenTier} produites`,
      icon: '🔩',
      positive: true,
    });
  }

  return entries;
}

// ─── Production de munitions ───────────────────────────────────

const AMMO_TIER_MULT: Record<string, number> = { basic: 1.0, advanced: 1.8, robotized: 3.0 };

export function tickAmmunitionProduction(
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const [, player] of players) {
    if (player.abandoned) continue;

    const ammoFactories = player.factories.filter(f => f.sector === 'ammunitionFactory');
    if (ammoFactories.length === 0) continue;

    const choice = player.productionChoices['ammunitionFactory'];
    const ammoType: 'munitions' | 'obus' | 'bombs' = choice?.ammoType ?? 'munitions';

    const bestTier = ammoFactories.reduce((best, f) =>
      (AMMO_TIER_MULT[f.tier] ?? 1) > (AMMO_TIER_MULT[best] ?? 1) ? f.tier : best,
      ammoFactories[0].tier,
    );
    const avgHealth = ammoFactories.reduce((s, f) => s + f.health, 0) / ammoFactories.length / 100;
    const tierMult  = AMMO_TIER_MULT[bestTier] ?? 1.0;
    const baseOutput = AMMO_OUTPUT_PER_FACTORY[ammoType];
    const rawOutput  = baseOutput * ammoFactories.length * tierMult * avgHealth;

    const res = player.resources as unknown as Record<string, number>;
    const inputs = AMMO_INPUTS[ammoType];
    let effRatio = 1.0;
    for (const inp of inputs) {
      const available = res[inp.resource] ?? 0;
      const demanded  = inp.amountPerUnit * rawOutput;
      if (demanded > 0 && available < demanded) {
        effRatio = Math.min(effRatio, available / demanded);
      }
    }

    const produced = Math.floor(rawOutput * effRatio);
    if (produced <= 0) continue;

    for (const inp of inputs) {
      res[inp.resource] = Math.max(0, (res[inp.resource] ?? 0) - inp.amountPerUnit * rawOutput * effRatio);
    }

    res[ammoType] = (res[ammoType] ?? 0) + produced;

    entries.push({
      step: 'production',
      playerId: player.id,
      description: `🔴 ${player.countryName} : ${produced} ${ammoType} produit(e)s`,
      icon: '🔴',
      positive: true,
    });
  }

  return entries;
}
