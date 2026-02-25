/**
 * Empire du Commerce — Commerce & Trade
 * Handles trade resolution, fees, sanctions
 */

import type { TradeOffer, ResolutionEntry, Sanction } from '@undercover/shared';
import type { ServerPlayerState, EcoWarGameContext } from './types';
import { SANCTION_TRADE_SURCHARGE } from './constants';

export function resolveCommerce(context: EcoWarGameContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  // Process accepted trades
  const acceptedTrades = context.activeTrades.filter(t => t.status === 'accepted');

  for (const trade of acceptedTrades) {
    const from = context.players.get(trade.fromId);
    const to = context.players.get(trade.toId);
    if (!from || !to) continue;

    // Check if sanctioned
    const sanctioned = isSanctionedTrade(from, to, context);
    if (sanctioned) {
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

    // Calculate transaction fees
    const baseFee = 0.10; // 10% base fee
    const transportReduction = (from.transport.tradeCostReduction + to.transport.tradeCostReduction) / 2;
    const orgReduction = getOrgTradeReduction(from, to, context);
    const surcharge = getSanctionSurcharge(from, to, context);
    const totalFeeRate = Math.max(0.02, baseFee - transportReduction - orgReduction + surcharge);

    // Execute the trade (simplified: transfer money based on product values)
    const offerValue = calculateProductValue(trade.offer);
    const requestValue = calculateProductValue(trade.request);

    const feePaidByFrom = Math.round(offerValue * totalFeeRate);
    const feePaidByTo = Math.round(requestValue * totalFeeRate);

    from.money -= feePaidByFrom;
    to.money -= feePaidByTo;

    // Exchange goods (simplified: direct money transfer representing goods)
    from.money += requestValue - feePaidByFrom;
    to.money += offerValue - feePaidByTo;

    entries.push({
      step: 'commerce',
      playerId: trade.fromId,
      targetId: trade.toId,
      description: `Échange commercial entre ${from.countryName} et ${to.countryName} (frais : ${(totalFeeRate * 100).toFixed(1)}%)`,
      icon: '📦',
      positive: true,
    });
  }

  // Expire pending trades
  for (const trade of context.activeTrades) {
    if (trade.status === 'pending') {
      trade.status = 'expired';
    }
  }

  // Clean up processed trades
  context.activeTrades = context.activeTrades.filter(t => t.status === 'pending');

  return entries;
}

function isSanctionedTrade(
  from: ServerPlayerState,
  to: ServerPlayerState,
  context: EcoWarGameContext,
): boolean {
  // Check if either player has a full trade sanction against the other
  const fromSanctions = from.activeSanctions.filter(
    s => (s.targetId === to.id || s.imposedBy === to.id) && (s.type === 'trade' || s.type === 'full'),
  );
  const toSanctions = to.activeSanctions.filter(
    s => (s.targetId === from.id || s.imposedBy === from.id) && (s.type === 'trade' || s.type === 'full'),
  );
  return fromSanctions.length > 0 || toSanctions.length > 0;
}

function getSanctionSurcharge(
  from: ServerPlayerState,
  to: ServerPlayerState,
  _context: EcoWarGameContext,
): number {
  // Apply surcharge for any sanction with evidence (proof or suspicion)
  const evidencedSanctions = from.activeSanctions.filter(
    s => s.targetId === to.id && s.evidence !== 'none',
  );
  if (evidencedSanctions.length > 0) {
    return SANCTION_TRADE_SURCHARGE;
  }
  return 0;
}

function getOrgTradeReduction(
  from: ServerPlayerState,
  to: ServerPlayerState,
  context: EcoWarGameContext,
): number {
  // Find shared commercial organizations
  let maxReduction = 0;
  for (const org of context.organizations) {
    if (
      org.type === 'commercial' &&
      org.memberIds.includes(from.id) &&
      org.memberIds.includes(to.id)
    ) {
      maxReduction = Math.max(maxReduction, org.transactionFeeReduction);
    }
  }
  return maxReduction;
}

function calculateProductValue(
  products: { product: string; quantity: number }[],
): number {
  // Simplified product values
  const pricePerUnit: Record<string, number> = {
    rawAgricultural: 5,
    energy: 10,
    minerals: 8,
    manufactured: 15,
    electronics: 30,
    industrialEquipment: 25,
    pharmaceutical: 20,
    armament: 35,
    luxury: 25,
    financial: 20,
    infrastructure: 15,
    processedFood: 8,
  };

  return products.reduce((total, p) => {
    return total + (pricePerUnit[p.product] || 10) * p.quantity;
  }, 0);
}

// ─── Sanctions ─────────────────────────────────────────────────

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
    roundImposed: 0, // set by caller
    evidence,
  };

  target.activeSanctions.push(sanction);

  if (type === 'tourism') {
    target.tourism.bannedBy.push(imposer.id);
    imposer.tourism.bannedCountries.push(target.id);
    // GDD §9: coût diplomatique fixe de -5% d'influence pour le pays qui bannit
    const penalty = Math.round(imposer.influence * 0.05);
    imposer.accumulatedBanPenalty = (imposer.accumulatedBanPenalty || 0) + penalty;
  }

  return sanction;
}
