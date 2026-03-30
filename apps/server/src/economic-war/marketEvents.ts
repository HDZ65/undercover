/**
 * Empire du Commerce — Market Events
 * Weighted random event pool from the GDD (15 events)
 */

import type { MarketEvent, MarketEventType, ResolutionEntry } from '@undercover/shared';
import type { ServerPlayerState, EcoWarGameContext } from './types.js';
import { EVENTS_PER_TURN_MIN, EVENTS_PER_TURN_MAX } from './constants.js';

interface EventTemplate {
  type: MarketEventType;
  title: string;
  description: string;
  scope: 'global' | 'local';
  weight: number;
  effects: string;
  duration: number;
  apply: (context: EcoWarGameContext, target?: ServerPlayerState) => ResolutionEntry[];
  getLocalTarget?: (context: EcoWarGameContext) => ServerPlayerState | null;
}

const EVENT_POOL: EventTemplate[] = [
  {
    type: 'drought',
    title: 'Sécheresse',
    description: 'Une sécheresse frappe un pays mal préparé.',
    scope: 'local',
    weight: 10,
    effects: '-30% agriculture pendant 2 tours',
    duration: 2,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => Math.max(0, 50 - p.resources.water)),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.activeEffects.push({ id: `evt-${Date.now()}`, type: 'event_drought', description: 'Sécheresse', affectedSector: 'agriculture', modifier: -0.30, remainingTurns: 2 });
      return [{ step: 'events', playerId: target.id, description: `Sécheresse en ${target.countryName} ! Agriculture -30% pendant 2 tours.`, icon: '🌵', positive: false }];
    },
  },
  {
    type: 'techBoom',
    title: 'Boom technologique',
    description: 'Une avancée mondiale booste la recherche.',
    scope: 'global',
    weight: 8,
    effects: '+20% efficacité recherche pour tous, 1 tour',
    duration: 1,
    apply: (ctx) => {
      for (const [, p] of ctx.players) {
        p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_techboom', description: 'Boom technologique', modifier: 0.20, remainingTurns: 1 });
      }
      return [{ step: 'events', description: 'Boom technologique mondial ! +20% efficacité recherche pour tous.', icon: '🔬', positive: true }];
    },
  },
  {
    type: 'pandemic',
    title: 'Pandémie',
    description: 'Un virus se propage dans les pays à faible système de santé.',
    scope: 'global',
    weight: 6,
    effects: '-15% productivité pour les pays avec santé < 40',
    duration: 2,
    apply: (ctx) => {
      const entries: ResolutionEntry[] = [];
      for (const [, p] of ctx.players) {
        if (p.population.healthLevel < 40) {
          p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_pandemic', description: 'Pandémie', modifier: -0.15, remainingTurns: 2 });
          entries.push({ step: 'events', playerId: p.id, description: `${p.countryName} touché par la pandémie ! -15% productivité.`, icon: '🦠', positive: false });
        }
      }
      if (entries.length === 0) entries.push({ step: 'events', description: 'Pandémie évitée ! Tous les pays ont un système de santé suffisant.', icon: '💉', positive: true });
      return entries;
    },
  },
  {
    type: 'stockCrash',
    title: 'Krach boursier',
    description: 'Les marchés mondiaux s\'effondrent.',
    scope: 'global',
    weight: 7,
    effects: '-10% valeur monnaies',
    duration: 3,
    apply: (ctx) => {
      for (const [, p] of ctx.players) {
        const recovery = p.finance.creditRating > 60 ? 1 : 3;
        p.finance.currencyStrength *= 0.90;
        p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_crash', description: 'Krach boursier', modifier: -0.10, remainingTurns: recovery });
      }
      return [{ step: 'events', description: 'Krach boursier mondial ! -10% valeur des monnaies.', icon: '📉', positive: false }];
    },
  },
  {
    type: 'corruption',
    title: 'Scandale de corruption',
    description: 'Un scandale éclate dans un pays vulnérable.',
    scope: 'local',
    weight: 8,
    effects: '-15% bonheur, -10% influence',
    duration: 1,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => Math.max(0, 60 - p.finance.creditRating)),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.population.happinessLevel = Math.max(0, target.population.happinessLevel - 15);
      target.influence = Math.max(0, target.influence - Math.round(target.influence * 0.10));
      return [{ step: 'events', playerId: target.id, description: `Scandale de corruption en ${target.countryName} ! -15% bonheur, -10% influence.`, icon: '💰', positive: false }];
    },
  },
  {
    type: 'mineDiscovery',
    title: 'Découverte minière',
    description: 'Un gisement rare est découvert.',
    scope: 'local',
    weight: 7,
    effects: '+30 minerais',
    duration: 0,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => p.research.globalLevel),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.resources.iron += 30;
      return [{ step: 'events', playerId: target.id, description: `Découverte minière en ${target.countryName} ! +30 fer.`, icon: '⛏️', positive: true }];
    },
  },
  {
    type: 'oilSpill',
    title: 'Marée noire',
    description: 'Une catastrophe pétrolière frappe un producteur.',
    scope: 'local',
    weight: 6,
    effects: '-20% agriculture + pollution +30%',
    duration: 3,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => p.resources.oil > 50 ? p.resources.oil : 0),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.pollution = Math.min(100, target.pollution + 30);
      target.activeEffects.push({ id: `evt-${Date.now()}`, type: 'event_oilspill', description: 'Marée noire', affectedSector: 'agriculture', modifier: -0.20, remainingTurns: 3 });
      return [{ step: 'events', playerId: target.id, description: `Marée noire en ${target.countryName} ! -20% agriculture, +30% pollution.`, icon: '🛢️', positive: false }];
    },
  },
  {
    type: 'tradeAgreement',
    title: 'Accord commercial mondial',
    description: 'Un accord réduit les frais de transport.',
    scope: 'global',
    weight: 8,
    effects: '-15% coûts transport pour tous',
    duration: 2,
    apply: (ctx) => {
      for (const [, p] of ctx.players) {
        p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_trade', description: 'Accord commercial', modifier: 0.15, remainingTurns: 2 });
      }
      return [{ step: 'events', description: 'Accord commercial mondial ! -15% coûts de transport pour tous.', icon: '🤝', positive: true }];
    },
  },
  {
    type: 'earthquake',
    title: 'Tremblement de terre',
    description: 'Un séisme détruit une infrastructure.',
    scope: 'local',
    weight: 5,
    effects: 'Infrastructure aléatoire -20',
    duration: 0,
    getLocalTarget: (ctx) => pickRandom(ctx),
    apply: (_ctx, target) => {
      if (!target) return [];
      const infras: ('electricity' | 'telecom' | 'waterTreatment')[] = ['electricity', 'telecom', 'waterTreatment'];
      const infra = infras[Math.floor(Math.random() * infras.length)];
      target.infrastructure[infra] = Math.max(0, target.infrastructure[infra] - 20);
      return [{ step: 'events', playerId: target.id, description: `Tremblement de terre en ${target.countryName} ! ${infra} endommagé (-20).`, icon: '🌍', positive: false }];
    },
  },
  {
    type: 'greenRevolution',
    title: 'Révolution verte',
    description: 'L\'énergie propre devient moins chère.',
    scope: 'global',
    weight: 7,
    effects: '-25% coût énergie propre',
    duration: 2,
    apply: (ctx) => {
      for (const [, p] of ctx.players) {
        p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_green', description: 'Révolution verte', modifier: -0.25, remainingTurns: 2 });
      }
      return [{ step: 'events', description: 'Révolution verte ! Énergie propre -25% coût pour tous.', icon: '🌱', positive: true }];
    },
  },
  {
    type: 'dataLeak',
    title: 'Fuite de données',
    description: 'Les données d\'un pays sont exposées.',
    scope: 'local',
    weight: 6,
    effects: 'Ressources visibles par tous',
    duration: 1,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => Math.max(0, 50 - p.infrastructure.telecom)),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.activeEffects.push({ id: `evt-${Date.now()}`, type: 'event_dataleak', description: 'Fuite de données', modifier: 0, remainingTurns: 1 });
      return [{ step: 'events', playerId: target.id, description: `Fuite de données en ${target.countryName} ! Ressources visibles ce tour.`, icon: '💻', positive: false }];
    },
  },
  {
    type: 'housingBubble',
    title: 'Bulle immobilière',
    description: 'Un boom immobilier crée une bulle.',
    scope: 'local',
    weight: 5,
    effects: '+20% PIB 2 tours, puis -15% 2 tours',
    duration: 4,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => p.finance.creditRating < 50 ? 50 - p.finance.creditRating : 0),
    apply: (_ctx, target) => {
      if (!target) return [];
      target.activeEffects.push({ id: `evt-${Date.now()}-boom`, type: 'event_bubble_boom', description: 'Bulle immobilière (boom)', modifier: 0.20, remainingTurns: 2 });
      target.activeEffects.push({ id: `evt-${Date.now()}-bust`, type: 'event_bubble_bust', description: 'Bulle immobilière (crash)', modifier: -0.15, remainingTurns: 4 });
      return [{ step: 'events', playerId: target.id, description: `Bulle immobilière en ${target.countryName} ! +20% PIB temporaire, crash à venir...`, icon: '🏗️', positive: false }];
    },
  },
  {
    type: 'migration',
    title: 'Afflux migratoire',
    description: 'Des migrants affluent vers un pays attractif.',
    scope: 'local',
    weight: 7,
    effects: '+5% population',
    duration: 0,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => p.population.happinessLevel > 60 ? p.population.happinessLevel : 0),
    apply: (_ctx, target) => {
      if (!target) return [];
      const gain = target.population.total * 0.05;
      target.population.total += gain;
      return [{ step: 'events', playerId: target.id, description: `Afflux migratoire vers ${target.countryName} ! +${(gain * 1000).toFixed(0)}k habitants.`, icon: '✈️', positive: true }];
    },
  },
  {
    type: 'oilEmbargo',
    title: 'Embargo pétrolier',
    description: 'Le coût du pétrole explose.',
    scope: 'global',
    weight: 5,
    effects: '+40% coût extraction pétrole',
    duration: 2,
    apply: (ctx) => {
      for (const [, p] of ctx.players) {
        if (p.research.branches.cleanEnergy < 60) {
          p.activeEffects.push({ id: `evt-${Date.now()}-${p.id}`, type: 'event_embargo', description: 'Embargo pétrolier', modifier: 0.40, remainingTurns: 2 });
        }
      }
      return [{ step: 'events', description: 'Embargo pétrolier mondial ! +40% coût extraction (énergie propre épargnée).', icon: '🛢️', positive: false }];
    },
  },
  {
    type: 'innovation',
    title: 'Innovation disruptive',
    description: 'Un brevet gratuit pour un pays innovant.',
    scope: 'local',
    weight: 6,
    effects: '1 brevet gratuit',
    duration: 0,
    getLocalTarget: (ctx) => pickWeighted(ctx, p => p.research.globalLevel),
    apply: (_ctx, target) => {
      if (!target) return [];
      const branches = Object.keys(target.research.branches) as (keyof typeof target.research.branches)[];
      const branch = branches[Math.floor(Math.random() * branches.length)];
      target.patents.push({ id: `patent-${Date.now()}`, branch, incomePerTurn: 70, acquiredAtRound: 0 });
      return [{ step: 'events', playerId: target.id, description: `Innovation disruptive en ${target.countryName} ! Brevet gratuit en ${String(branch)}.`, icon: '💡', positive: true }];
    },
  },
];

export function generateMarketEvents(context: EcoWarGameContext): { events: MarketEvent[]; entries: ResolutionEntry[] } {
  const count = EVENTS_PER_TURN_MIN + Math.floor(Math.random() * (EVENTS_PER_TURN_MAX - EVENTS_PER_TURN_MIN + 1));
  const events: MarketEvent[] = [];
  const allEntries: ResolutionEntry[] = [];
  const usedTypes = new Set<MarketEventType>();

  for (let i = 0; i < count; i++) {
    const available = EVENT_POOL.filter(e => !usedTypes.has(e.type));
    const template = pickWeightedEvent(available);
    if (!template) break;
    usedTypes.add(template.type);

    let target: ServerPlayerState | undefined;
    if (template.scope === 'local' && template.getLocalTarget) {
      target = template.getLocalTarget(context) ?? undefined;
      if (!target) continue;
    }

    const entries = template.apply(context, target);
    allEntries.push(...entries);

    events.push({
      type: template.type,
      title: template.title,
      description: template.description,
      scope: template.scope,
      targetPlayerId: target?.id || null,
      effects: template.effects,
      duration: template.duration,
    });
  }

  return { events, entries: allEntries };
}

// ─── Helpers ───────────────────────────────────────────────────

function pickWeightedEvent(pool: EventTemplate[]): EventTemplate | null {
  if (pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}

function pickWeighted(ctx: EcoWarGameContext, weightFn: (p: ServerPlayerState) => number): ServerPlayerState | null {
  const active = Array.from(ctx.players.values()).filter(p => !p.abandoned);
  if (active.length === 0) return null;
  const weights = active.map(p => Math.max(1, weightFn(p)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < active.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return active[i];
  }
  return active[active.length - 1];
}

function pickRandom(ctx: EcoWarGameContext): ServerPlayerState | null {
  const active = Array.from(ctx.players.values()).filter(p => !p.abandoned);
  if (active.length === 0) return null;
  return active[Math.floor(Math.random() * active.length)];
}
