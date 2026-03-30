/**
 * Empire du Commerce — Commerce & Trade
 *
 * Taxe universelle : 10% minimum sur tout échange.
 *   - Membres de la même org commerciale → 0% taxe (acheteur paie prix de base)
 *   - Pays sous embargo d'une org commerciale du vendeur → taux voté (remplace les 10%)
 *   - Sinon → 10% de taxe sur le prix de base
 *
 * L'acheteur paie : base + Math.floor(base × taxRate)
 * Le vendeur reçoit : base (intégralement)
 * La taxe disparaît de l'économie (friction du marché)
 */

import type { TradeOffer, ResolutionEntry, Sanction, ResourceType } from '@undercover/shared';
import type { ServerPlayerState, EcoWarGameContext } from './types.js';
import { SANCTION_TRADE_SURCHARGE, ORG_TRADE_TAX_MIN } from './constants.js';

export function resolveCommerce(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // Process accepted trades
  const acceptedTrades = context.activeTrades.filter(t => t.status === 'accepted');

  // Suivi de la capacité de transport utilisée par vendeur ce tour
  const capacityUsed = new Map<string, number>();

  for (const trade of acceptedTrades) {
    const from = context.players.get(trade.fromId); // vendeur
    const to   = context.players.get(trade.toId);   // acheteur
    if (!from || !to) continue;

    // ── Vérification capacité de transport du vendeur ──────────
    const tradeVolume = trade.offer.reduce((s, item) => s + item.quantity, 0)
      + (trade.vehicles?.reduce((s, v) => s + v.quantity, 0) ?? 0)
      + (trade.maintenanceParts?.reduce((s, p) => s + p.quantity, 0) ?? 0);
    const fleetCapacity = from.fleet.totalCapacity;
    if (fleetCapacity > 0) {
      const usedSoFar = capacityUsed.get(trade.fromId) ?? 0;
      if (usedSoFar + tradeVolume > fleetCapacity) {
        entries.push({
          step: 'commerce',
          playerId: trade.fromId,
          targetId: trade.toId,
          description: `🚛 Échange annulé — ${from.countryName} dépasse sa capacité de transport (${usedSoFar + tradeVolume}/${fleetCapacity} unités).`,
          icon: '🚛',
          positive: false,
        });
        trade.status = 'rejected';
        continue;
      }
      capacityUsed.set(trade.fromId, usedSoFar + tradeVolume);
    }

    // Blocage sanction totale
    if (isSanctionedTrade(from, to, context)) {
      entries.push({
        step: 'commerce',
        playerId: trade.fromId,
        targetId: trade.toId,
        description: `Échange bloqué entre ${from.countryName} et ${to.countryName} — sanctions actives.`,
        icon: '🚫',
        positive: false,
      });
      trade.status = 'rejected';
      continue;
    }

    // Calcul du taux de taxe effectif
    const sameOrg     = areInSameCommercialOrg(from, to, context);
    const embargoRate = getEmbargoSurcharge(to, from, context); // to = acheteur, from = vendeur
    const taxRate     = sameOrg ? 0 : (embargoRate > 0 ? embargoRate : ORG_TRADE_TAX_MIN);

    const price     = trade.moneyAmount; // prix de base (ce que le vendeur veut recevoir)
    const taxAmount = Math.floor(price * taxRate);
    const totalPaid = price + taxAmount; // ce que l'acheteur paie réellement

    // Vérification fonds acheteur
    if (to.money < totalPaid) {
      entries.push({
        step: 'commerce',
        playerId: trade.fromId,
        targetId: trade.toId,
        description: `Échange annulé — ${to.countryName} n'a pas les fonds suffisants (${totalPaid} €).`,
        icon: '❌',
        positive: false,
      });
      trade.status = 'rejected';
      continue;
    }

    // Vérification stock vendeur (ressources + véhicules + pièces)
    let sellerCanDeliver = true;
    for (const item of trade.offer) {
      const available = from.resources[item.resource as ResourceType] ?? 0;
      if (available < item.quantity) { sellerCanDeliver = false; break; }
    }
    if (sellerCanDeliver && trade.vehicles?.length) {
      for (const item of trade.vehicles) {
        const count = from.fleet.vehicles.filter(v => v.type === item.vehicleType && v.tier === item.tier).length;
        if (count < item.quantity) { sellerCanDeliver = false; break; }
      }
    }
    if (sellerCanDeliver && trade.maintenanceParts?.length) {
      for (const item of trade.maintenanceParts) {
        const entry = from.maintenanceParts.find(p => p.tier === item.tier && p.manufacturerId === from.id);
        if (!entry || entry.quantity < item.quantity) { sellerCanDeliver = false; break; }
      }
    }
    if (sellerCanDeliver && trade.militaryUnits?.length) {
      for (const item of trade.militaryUnits) {
        const owned = from.military.units[item.unitType][item.tier - 1] ?? 0;
        if (owned < item.quantity) { sellerCanDeliver = false; break; }
      }
    }

    if (!sellerCanDeliver) {
      entries.push({
        step: 'commerce',
        playerId: trade.fromId,
        targetId: trade.toId,
        description: `Échange annulé — ${from.countryName} n'a plus les ressources promises.`,
        icon: '❌',
        positive: false,
      });
      trade.status = 'rejected';
      continue;
    }

    // Transfert financier
    to.money   -= totalPaid; // acheteur paie base + taxe
    from.money += price;     // vendeur reçoit prix de base intégralement

    // Transfert de ressources
    for (const item of trade.offer) {
      const res = item.resource as ResourceType;
      from.resources[res] = Math.max(0, (from.resources[res] ?? 0) - item.quantity);
      to.resources[res]   = (to.resources[res] ?? 0) + item.quantity;
    }

    // Transfert de véhicules
    if (trade.vehicles?.length) {
      for (const item of trade.vehicles) {
        let transferred = 0;
        const remaining = from.fleet.vehicles.filter(v => {
          if (transferred < item.quantity && v.type === item.vehicleType && v.tier === item.tier) {
            to.fleet.vehicles.push(v);  // createdBy stays with original manufacturer
            transferred++;
            return false;
          }
          return true;
        });
        from.fleet.vehicles = remaining;
      }
      from.fleet.totalCapacity = from.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);
      to.fleet.totalCapacity   = to.fleet.vehicles.reduce((s, v) => s + v.capacity, 0);
    }

    // Transfert de pièces d'entretien
    if (trade.maintenanceParts?.length) {
      for (const item of trade.maintenanceParts) {
        const sellerEntry = from.maintenanceParts.find(
          p => p.tier === item.tier && p.manufacturerId === from.id && p.quantity >= item.quantity,
        );
        if (!sellerEntry) continue;
        sellerEntry.quantity -= item.quantity;
        const buyerEntry = to.maintenanceParts.find(
          p => p.tier === item.tier && p.manufacturerId === from.id,
        );
        if (buyerEntry) {
          buyerEntry.quantity += item.quantity;
        } else {
          to.maintenanceParts.push({ tier: item.tier, manufacturerId: from.id, quantity: item.quantity });
        }
      }
    }

    // Transfert d'unités militaires
    if (trade.militaryUnits?.length) {
      for (const item of trade.militaryUnits) {
        const tierIdx = item.tier - 1;
        from.military.units[item.unitType][tierIdx] = Math.max(0, (from.military.units[item.unitType][tierIdx] ?? 0) - item.quantity);
        to.military.units[item.unitType][tierIdx] = (to.military.units[item.unitType][tierIdx] ?? 0) + item.quantity;
      }
    }

    // Commerce bonus: successful trades boost happiness (+1 each) — incentivizes diplomacy
    from.population.happinessLevel = Math.min(100, from.population.happinessLevel + 1);
    to.population.happinessLevel   = Math.min(100, to.population.happinessLevel + 1);

    // Trade profit bonus: seller gets 5% bonus on revenue (trade network effect)
    const tradeBonus = Math.round(price * 0.05);
    from.money += tradeBonus;

    const offerDesc  = trade.offer.map(o => `${o.quantity}× ${o.resource}`).join(', ');
    const taxDesc    = taxRate === 0 ? 'sans taxe (org)' : `taxe ${Math.floor(taxRate * 100)}% = ${taxAmount} €`;
    entries.push({
      step: 'commerce',
      playerId: trade.fromId,
      targetId: trade.toId,
      description: `Échange : ${to.countryName} achète ${offerDesc} à ${from.countryName} pour ${price} € (${taxDesc}${tradeBonus > 0 ? `, bonus commerce +${tradeBonus}€` : ''})`,
      icon: '📦',
      positive: true,
    });
  }

  // Expirer les offres encore pending
  for (const trade of context.activeTrades) {
    if (trade.status === 'pending') {
      trade.status = 'expired';
    }
  }

  // Nettoyer les échanges traités
  context.activeTrades = context.activeTrades.filter(t => t.status === 'pending');

  return entries;
}

// ─── Helpers ────────────────────────────────────────────────────

function isSanctionedTrade(
  from: ServerPlayerState,
  to: ServerPlayerState,
  _context: EcoWarGameContext,
): boolean {
  const fromSanctions = from.activeSanctions.filter(
    s => (s.targetId === to.id || s.imposedBy === to.id) && (s.type === 'trade' || s.type === 'full'),
  );
  const toSanctions = to.activeSanctions.filter(
    s => (s.targetId === from.id || s.imposedBy === from.id) && (s.type === 'trade' || s.type === 'full'),
  );
  return fromSanctions.length > 0 || toSanctions.length > 0;
}

/**
 * Vérifie si acheteur et vendeur appartiennent à la même org commerciale.
 * Si oui → taxe 0%.
 */
export function areInSameCommercialOrg(
  seller: ServerPlayerState,
  buyer: ServerPlayerState,
  context: EcoWarGameContext,
): boolean {
  return context.organizations.some(
    o =>
      o.type === 'commercial' &&
      o.memberIds.includes(seller.id) &&
      o.memberIds.includes(buyer.id),
  );
}

/**
 * Retourne le taux d'embargo actif (0–1) imposé par l'org commerciale du vendeur sur l'acheteur.
 * 0 si aucun embargo.
 */
export function getEmbargoSurcharge(
  buyer: ServerPlayerState,
  seller: ServerPlayerState,
  context: EcoWarGameContext,
): number {
  for (const org of context.organizations) {
    if (org.type !== 'commercial') continue;
    if (!org.memberIds.includes(seller.id)) continue;
    const emb = org.activeEmbargos.find(e => e.targetId === buyer.id);
    if (emb) return emb.rate;
  }
  return 0;
}

// ─── Sanctions individuelles ─────────────────────────────────────

export function applySanction(
  imposer: ServerPlayerState,
  target: ServerPlayerState,
  type: 'trade' | 'tourism' | 'full',
  evidence: 'proof' | 'suspicion' | 'none',
): Sanction {
  const sanction: Sanction = {
    id: `sanction-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetId: target.id,
    imposedBy: imposer.id,
    type,
    tradeSurcharge: type === 'trade' ? SANCTION_TRADE_SURCHARGE : 0,
    roundImposed: 0,
    evidence,
  };

  target.activeSanctions.push(sanction);

  if (type === 'tourism') {
    target.tourism.bannedBy.push(imposer.id);
    imposer.tourism.bannedCountries.push(target.id);
    const penalty = Math.floor(imposer.influence * 0.05);
    imposer.accumulatedBanPenalty = (imposer.accumulatedBanPenalty || 0) + penalty;
  }

  return sanction;
}
