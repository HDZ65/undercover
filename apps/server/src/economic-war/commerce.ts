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

    // Money-based trade: buyer (toId) pays moneyAmount, seller (fromId) delivers goods
    const price = trade.moneyAmount;
    const fee = Math.round(price * totalFeeRate);

    // Buyer must have enough money
    if (to.money < price) {
      entries.push({
        step: 'commerce',
        playerId: trade.fromId,
        targetId: trade.toId,
        description: `Échange annulé — ${to.countryName} n'a pas les fonds suffisants (${price} €).`,
        icon: '❌',
        positive: false,
      });
      trade.status = 'rejected';
      continue;
    }

    to.money -= price;
    from.money += price - fee;

    entries.push({
      step: 'commerce',
      playerId: trade.fromId,
      targetId: trade.toId,
      description: `Échange commercial : ${to.countryName} achète à ${from.countryName} pour ${price} € (frais : ${fee} €)`,
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
