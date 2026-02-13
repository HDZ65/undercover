import { HandRank } from '@undercover/shared';
import type { Card, PokerAction, PokerPhase, PokerPublicState, Rank } from '@undercover/shared';
import { evaluateHand } from './handEvaluator';

export type BotProfile = 'rock' | 'maniac' | 'callingStation';

export interface BotDecision {
  action: PokerAction;
  amount?: number;
}

type ProfileConfig = {
  bluffFrequency: number;
  raiseFrequency: number;
  preFlopPlayThreshold: number;
};

type PostFlopSignals = {
  handRank: HandRank;
  hasPairOrBetter: boolean;
  hasTopPairOrBetter: boolean;
  hasDraw: boolean;
  hasOvercards: boolean;
  hasNutsLikeHand: boolean;
};

const UINT32_RANGE = 0x1_0000_0000;
const MIN_THINK_TIME_MS = 1_000;
const MAX_THINK_TIME_MS = 5_000;

const PROFILE_CONFIG: Record<BotProfile, ProfileConfig> = {
  rock: {
    bluffFrequency: 0.05,
    raiseFrequency: 0.3,
    preFlopPlayThreshold: 0.62,
  },
  maniac: {
    bluffFrequency: 0.3,
    raiseFrequency: 0.6,
    preFlopPlayThreshold: 0.35,
  },
  callingStation: {
    bluffFrequency: 0,
    raiseFrequency: 0.05,
    preFlopPlayThreshold: 0.5,
  },
};

const RANK_STRENGTH: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const TOP_15_PRE_FLOP_HANDS = new Set<string>([
  'AA',
  'KK',
  'QQ',
  'JJ',
  'TT',
  'AKs',
  'AKo',
  'AQs',
  'AQo',
  'AJs',
  'ATs',
  'KQs',
  'KJs',
  '99',
  '88',
]);

const PRE_FLOP_EQUITY_TABLE: Record<string, number> = {
  AA: 0.85,
  KK: 0.82,
  QQ: 0.8,
  JJ: 0.77,
  TT: 0.75,
  '99': 0.68,
  '88': 0.64,
  '77': 0.59,
  '66': 0.55,
  '55': 0.52,
  '44': 0.5,
  '33': 0.49,
  '22': 0.48,
  AKs: 0.67,
  AKo: 0.65,
  AQs: 0.64,
  AQo: 0.62,
  AJs: 0.61,
  AJo: 0.58,
  ATs: 0.57,
  ATo: 0.53,
  A9s: 0.54,
  A8s: 0.52,
  A7s: 0.5,
  KQs: 0.6,
  KQo: 0.55,
  KJs: 0.57,
  KTs: 0.53,
  QJs: 0.56,
  QTs: 0.52,
  JTs: 0.55,
  J9s: 0.5,
  T9s: 0.52,
  '98s': 0.5,
  '87s': 0.48,
  '76s': 0.46,
  '65s': 0.45,
  '54s': 0.43,
  A2s: 0.47,
  A2o: 0.42,
  K2o: 0.39,
  Q2o: 0.37,
  J2o: 0.36,
  T2o: 0.35,
  '72o': 0.35,
  '32o': 0.31,
};

const POST_FLOP_BASE_EQUITY: Record<HandRank, number> = {
  [HandRank.HIGH_CARD]: 0.2,
  [HandRank.ONE_PAIR]: 0.45,
  [HandRank.TWO_PAIR]: 0.62,
  [HandRank.THREE_OF_A_KIND]: 0.73,
  [HandRank.STRAIGHT]: 0.82,
  [HandRank.FLUSH]: 0.86,
  [HandRank.FULL_HOUSE]: 0.93,
  [HandRank.FOUR_OF_A_KIND]: 0.97,
  [HandRank.STRAIGHT_FLUSH]: 0.99,
  [HandRank.ROYAL_FLUSH]: 1,
};

const PHASE_EQUITY_MULTIPLIER: Partial<Record<PokerPhase, number>> = {
  flop: 0.82,
  turn: 0.92,
  river: 1,
  showdown: 1,
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const normalizeRank = (rank: Rank): string => {
  return rank === '10' ? 'T' : rank;
};

const getRankValue = (rank: Rank): number => {
  return RANK_STRENGTH[rank];
};

export class PokerBot {
  constructor(
    private readonly profile: BotProfile,
    private readonly playerId: string,
  ) {}

  decideAction(
    publicState: PokerPublicState,
    holeCards: Card[],
    availableActions: PokerAction[],
    callAmount: number,
    potSize: number,
  ): BotDecision {
    const potOdds = this.calculatePotOdds(callAmount, potSize);
    const estimatedEquity = this.estimateEquity(holeCards, publicState.communityCards, publicState.phase);
    const equityNoise = this.randomBetween(-0.04, 0.04);
    const effectiveEquity = clamp(estimatedEquity + equityNoise, 0.02, 0.99);

    if (publicState.phase === 'preFlop') {
      return this.decidePreFlopAction(holeCards, publicState, availableActions, callAmount, potOdds, effectiveEquity);
    }

    const signals = this.getPostFlopSignals(holeCards, publicState.communityCards, publicState.phase);
    return this.decidePostFlopAction(signals, publicState, availableActions, callAmount, potOdds, effectiveEquity);
  }

  async decideActionWithThinkTime(
    publicState: PokerPublicState,
    holeCards: Card[],
    availableActions: PokerAction[],
    callAmount: number,
    potSize: number,
  ): Promise<BotDecision> {
    await this.delay(this.getThinkTimeMs());
    return this.decideAction(publicState, holeCards, availableActions, callAmount, potSize);
  }

  getThinkTimeMs(): number {
    return this.getCryptoRandomIntInclusive(MIN_THINK_TIME_MS, MAX_THINK_TIME_MS);
  }

  calculatePotOdds(callAmount: number, potSize: number): number {
    if (callAmount <= 0) {
      return 0;
    }

    const totalPotAfterCall = callAmount + Math.max(0, potSize);

    if (totalPotAfterCall <= 0) {
      return 0;
    }

    return callAmount / totalPotAfterCall;
  }

  private estimateEquity(holeCards: Card[], communityCards: Card[], phase: PokerPhase): number {
    if (holeCards.length !== 2) {
      throw new Error(`PokerBot requires exactly 2 hole cards. Received ${holeCards.length}.`);
    }

    if (phase === 'preFlop' || communityCards.length === 0) {
      return this.estimatePreFlopEquity(holeCards);
    }

    const allCards = [...holeCards, ...communityCards];
    const evaluatedHand = evaluateHand(allCards);
    let equity = POST_FLOP_BASE_EQUITY[evaluatedHand.rank] ?? 0.2;

    const phaseMultiplier = PHASE_EQUITY_MULTIPLIER[phase] ?? 0.85;
    equity *= phaseMultiplier;

    if (evaluatedHand.rank < HandRank.STRAIGHT && this.hasFlushDraw(allCards)) {
      equity += 0.1;
    }

    if (evaluatedHand.rank < HandRank.STRAIGHT && this.hasStraightDraw(allCards)) {
      equity += 0.08;
    }

    if (this.hasOvercards(holeCards, communityCards)) {
      equity += 0.04;
    }

    return clamp(equity, 0.05, 0.99);
  }

  private estimatePreFlopEquity(holeCards: Card[]): number {
    const key = this.getPreFlopHandKey(holeCards);
    const exactMatch = PRE_FLOP_EQUITY_TABLE[key];
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    const [highCard, lowCard] = this.getSortedHoleCards(holeCards);
    const highValue = (getRankValue(highCard.rank) - 2) / 12;
    const lowValue = (getRankValue(lowCard.rank) - 2) / 12;
    const isPair = highCard.rank === lowCard.rank;
    const isSuited = highCard.suit === lowCard.suit;
    const gap = Math.abs(getRankValue(highCard.rank) - getRankValue(lowCard.rank));

    let estimated = 0.3 + highValue * 0.2 + lowValue * 0.1;

    if (isPair) {
      estimated += 0.2 + highValue * 0.08;
    }

    if (isSuited) {
      estimated += 0.03;
    }

    if (gap === 1) {
      estimated += 0.02;
    }

    if (gap === 2) {
      estimated += 0.01;
    }

    if (highCard.rank === 'A') {
      estimated += 0.03;
    }

    return clamp(estimated, 0.28, 0.84);
  }

  private decidePreFlopAction(
    holeCards: Card[],
    publicState: PokerPublicState,
    availableActions: PokerAction[],
    callAmount: number,
    potOdds: number,
    equity: number,
  ): BotDecision {
    const handKey = this.getPreFlopHandKey(holeCards);
    const canRaise = availableActions.includes('raise');
    const profileConfig = PROFILE_CONFIG[this.profile];
    const shouldContinueByPotOdds = equity >= potOdds;

    switch (this.profile) {
      case 'rock': {
        const isTop15Hand = TOP_15_PRE_FLOP_HANDS.has(handKey);

        if (!isTop15Hand && callAmount > 0) {
          return this.foldOrCheck(availableActions, callAmount);
        }

        if (isTop15Hand && shouldContinueByPotOdds && canRaise && this.shouldRaise()) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        return this.callOrCheck(availableActions, callAmount);
      }

      case 'maniac': {
        const shouldPlay =
          equity >= profileConfig.preFlopPlayThreshold ||
          this.randomBetween(0, 1) < 0.2 ||
          callAmount === 0;

        if (!shouldPlay && callAmount > 0) {
          return this.foldOrCheck(availableActions, callAmount);
        }

        if (canRaise && (this.shouldRaise() || this.shouldBluff())) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        return this.callOrCheck(availableActions, callAmount);
      }

      case 'callingStation': {
        const shouldPlay = this.isCallingStationPlayablePreFlop(holeCards) || equity >= profileConfig.preFlopPlayThreshold;

        if (!shouldPlay && callAmount > 0) {
          return this.foldOrCheck(availableActions, callAmount);
        }

        const hasPreFlopNuts = handKey === 'AA' || handKey === 'KK';
        if (hasPreFlopNuts && canRaise && this.shouldRaise()) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        return this.callOrCheck(availableActions, callAmount);
      }
    }
  }

  private decidePostFlopAction(
    signals: PostFlopSignals,
    publicState: PokerPublicState,
    availableActions: PokerAction[],
    callAmount: number,
    potOdds: number,
    equity: number,
  ): BotDecision {
    const shouldContinueByPotOdds = equity >= potOdds;
    const canRaise = availableActions.includes('raise');

    switch (this.profile) {
      case 'rock': {
        if (signals.hasTopPairOrBetter && shouldContinueByPotOdds) {
          if (canRaise && this.shouldRaise() && equity >= potOdds + 0.12) {
            return this.raiseOrAllIn(publicState, availableActions, callAmount);
          }

          return this.callOrCheck(availableActions, callAmount);
        }

        if (canRaise && this.shouldBluff() && callAmount === 0) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        return this.foldOrCheck(availableActions, callAmount);
      }

      case 'maniac': {
        const shouldContinue =
          signals.hasPairOrBetter ||
          signals.hasDraw ||
          signals.hasOvercards ||
          shouldContinueByPotOdds ||
          callAmount === 0;

        if (shouldContinue) {
          if (canRaise && (this.shouldRaise() || this.shouldBluff())) {
            return this.raiseOrAllIn(publicState, availableActions, callAmount);
          }

          return this.callOrCheck(availableActions, callAmount);
        }

        if (canRaise && this.shouldBluff()) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        return this.foldOrCheck(availableActions, callAmount);
      }

      case 'callingStation': {
        if (signals.hasNutsLikeHand && canRaise && this.shouldRaise()) {
          return this.raiseOrAllIn(publicState, availableActions, callAmount);
        }

        if (signals.hasPairOrBetter || signals.hasDraw || shouldContinueByPotOdds) {
          return this.callOrCheck(availableActions, callAmount);
        }

        return this.foldOrCheck(availableActions, callAmount);
      }
    }
  }

  private getPostFlopSignals(holeCards: Card[], communityCards: Card[], phase: PokerPhase): PostFlopSignals {
    const allCards = [...holeCards, ...communityCards];
    const evaluatedHand = evaluateHand(allCards);
    const hasDraw = this.hasFlushDraw(allCards) || this.hasStraightDraw(allCards);
    const hasPairOrBetter = evaluatedHand.rank >= HandRank.ONE_PAIR;

    return {
      handRank: evaluatedHand.rank,
      hasPairOrBetter,
      hasTopPairOrBetter: this.hasTopPairOrBetter(holeCards, communityCards, evaluatedHand.rank),
      hasDraw,
      hasOvercards: this.hasOvercards(holeCards, communityCards),
      hasNutsLikeHand: this.isNutsLikeHand(evaluatedHand.rank, phase),
    };
  }

  private hasTopPairOrBetter(holeCards: Card[], communityCards: Card[], handRank: HandRank): boolean {
    if (handRank >= HandRank.TWO_PAIR) {
      return true;
    }

    if (handRank !== HandRank.ONE_PAIR || communityCards.length === 0) {
      return false;
    }

    const boardHighest = communityCards.reduce((currentHighest, card) => {
      return getRankValue(card.rank) > getRankValue(currentHighest.rank) ? card : currentHighest;
    }, communityCards[0]);

    const hasTopPair = holeCards.some((card) => card.rank === boardHighest.rank);
    if (hasTopPair) {
      return true;
    }

    const isPocketPair = holeCards[0].rank === holeCards[1].rank;
    const isOverPair = isPocketPair && getRankValue(holeCards[0].rank) > getRankValue(boardHighest.rank);
    return isOverPair;
  }

  private hasOvercards(holeCards: Card[], communityCards: Card[]): boolean {
    if (communityCards.length === 0) {
      return false;
    }

    const boardHighValue = Math.max(...communityCards.map((card) => getRankValue(card.rank)));
    return holeCards.some((card) => getRankValue(card.rank) > boardHighValue);
  }

  private isNutsLikeHand(handRank: HandRank, phase: PokerPhase): boolean {
    if (handRank >= HandRank.STRAIGHT_FLUSH) {
      return true;
    }

    return phase === 'river' && handRank >= HandRank.FULL_HOUSE;
  }

  private hasFlushDraw(cards: Card[]): boolean {
    const suitCounts = new Map<Card['suit'], number>();

    for (const card of cards) {
      suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
    }

    for (const count of suitCounts.values()) {
      if (count >= 4) {
        return true;
      }
    }

    return false;
  }

  private hasStraightDraw(cards: Card[]): boolean {
    const rankValues = new Set<number>();

    for (const card of cards) {
      const rankValue = getRankValue(card.rank);
      rankValues.add(rankValue);
      if (rankValue === 14) {
        rankValues.add(1);
      }
    }

    for (let start = 1; start <= 10; start += 1) {
      let matches = 0;

      for (let offset = 0; offset < 5; offset += 1) {
        if (rankValues.has(start + offset)) {
          matches += 1;
        }
      }

      if (matches === 4) {
        return true;
      }
    }

    return false;
  }

  private getPreFlopHandKey(holeCards: Card[]): string {
    const [highCard, lowCard] = this.getSortedHoleCards(holeCards);

    if (highCard.rank === lowCard.rank) {
      return `${normalizeRank(highCard.rank)}${normalizeRank(lowCard.rank)}`;
    }

    const suitedSuffix = highCard.suit === lowCard.suit ? 's' : 'o';
    return `${normalizeRank(highCard.rank)}${normalizeRank(lowCard.rank)}${suitedSuffix}`;
  }

  private getSortedHoleCards(holeCards: Card[]): [Card, Card] {
    if (holeCards.length !== 2) {
      throw new Error(`PokerBot requires exactly 2 hole cards. Received ${holeCards.length}.`);
    }

    const [firstCard, secondCard] = holeCards;
    if (getRankValue(firstCard.rank) >= getRankValue(secondCard.rank)) {
      return [firstCard, secondCard];
    }

    return [secondCard, firstCard];
  }

  private isCallingStationPlayablePreFlop(holeCards: Card[]): boolean {
    const [firstCard, secondCard] = holeCards;
    const isPair = firstCard.rank === secondCard.rank;
    if (isPair) {
      return true;
    }

    if (firstCard.rank === 'A' || secondCard.rank === 'A') {
      return true;
    }

    const isSuited = firstCard.suit === secondCard.suit;
    if (isSuited) {
      return true;
    }

    const rankGap = Math.abs(getRankValue(firstCard.rank) - getRankValue(secondCard.rank));
    const highCardValue = Math.max(getRankValue(firstCard.rank), getRankValue(secondCard.rank));
    return rankGap <= 1 && highCardValue >= 10;
  }

  private shouldRaise(): boolean {
    const raiseFrequency = PROFILE_CONFIG[this.profile].raiseFrequency;
    return this.randomBetween(0, 1) < raiseFrequency;
  }

  private shouldBluff(): boolean {
    const bluffFrequency = PROFILE_CONFIG[this.profile].bluffFrequency;
    return this.randomBetween(0, 1) < bluffFrequency;
  }

  private foldOrCheck(availableActions: PokerAction[], callAmount: number): BotDecision {
    if (callAmount <= 0 && availableActions.includes('check')) {
      return {
        action: 'check',
      };
    }

    if (availableActions.includes('fold')) {
      return {
        action: 'fold',
      };
    }

    return this.callOrCheck(availableActions, callAmount);
  }

  private callOrCheck(availableActions: PokerAction[], callAmount: number): BotDecision {
    if (callAmount <= 0 && availableActions.includes('check')) {
      return {
        action: 'check',
      };
    }

    if (availableActions.includes('call')) {
      return {
        action: 'call',
        amount: Math.max(0, callAmount),
      };
    }

    if (availableActions.includes('check')) {
      return {
        action: 'check',
      };
    }

    if (availableActions.includes('allIn')) {
      return {
        action: 'allIn',
      };
    }

    if (availableActions.includes('raise')) {
      return {
        action: 'raise',
        amount: Math.max(1, callAmount + 1),
      };
    }

    return {
      action: 'fold',
    };
  }

  private raiseOrAllIn(
    publicState: PokerPublicState,
    availableActions: PokerAction[],
    callAmount: number,
  ): BotDecision {
    if (!availableActions.includes('raise')) {
      return this.callOrCheck(availableActions, callAmount);
    }

    const amount = this.getRaiseAmount(publicState, callAmount);
    if (amount !== null) {
      return {
        action: 'raise',
        amount,
      };
    }

    if (availableActions.includes('allIn')) {
      return {
        action: 'allIn',
      };
    }

    return this.callOrCheck(availableActions, callAmount);
  }

  private getRaiseAmount(publicState: PokerPublicState, callAmount: number): number | null {
    const minRaiseIncrement = Math.max(1, publicState.minRaise);
    const aggressionMultiplier = this.profile === 'maniac' ? 2 : 1;
    const desiredRaise = callAmount + minRaiseIncrement * aggressionMultiplier;

    const player = publicState.players.find((candidate) => candidate.id === this.playerId);
    if (!player) {
      return desiredRaise;
    }

    return desiredRaise >= player.chipStack ? null : desiredRaise;
  }

  private randomBetween(min: number, max: number): number {
    if (max <= min) {
      return min;
    }

    return min + this.getCryptoRandomFloat() * (max - min);
  }

  private getCryptoRandomFloat(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] / UINT32_RANGE;
  }

  private getCryptoRandomIntInclusive(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error('Random integer bounds must be integers.');
    }

    if (maxInclusive < minInclusive) {
      throw new Error('Random integer bounds are invalid.');
    }

    const span = maxInclusive - minInclusive + 1;
    const unbiasedUpperBound = Math.floor(UINT32_RANGE / span) * span;
    let candidate = 0;

    do {
      candidate = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (candidate >= unbiasedUpperBound);

    return minInclusive + (candidate % span);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
