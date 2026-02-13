import {
  ACTION_TIMEOUT_MS,
  DEFAULT_TABLE_CONFIG,
  type Card,
  type PokerAction,
  type PokerPhase,
  type PokerPlayer,
  type PlayerStatus,
  type SidePot,
  type TableConfig,
} from '@undercover/shared';
import { assign, setup } from 'xstate';
import { BettingEngine } from './bettingEngine';
import { PokerBot, type BotProfile } from './bot';
import { createDeck, dealCommunityCards, dealHoleCards, shuffleDeck } from './deck';
import { findWinners } from './handEvaluator';
import { PotManager } from './potManager';

type BettingRoundPhase = 'preFlop' | 'flop' | 'turn' | 'river';

type SerializedPotManagerState = {
  pots: SidePot[];
  playerBets: Record<string, number>;
  foldedPlayerIds: string[];
  winnersByPot: Record<number, string[]>;
  payouts: Record<string, number>;
};

type RoundActionRecord = {
  playerId: string;
  action: PokerAction;
  amount?: number;
};

type SerializedBettingEngineState = {
  currentBet: number;
  minRaise: number;
  lastRaise: number;
  lastAggressor: string | null;
  activePlayerId: string | null;
  roundComplete: boolean;
  initialStacks: Record<string, number>;
  actionsByPhase: Record<BettingRoundPhase, RoundActionRecord[]>;
};

type ShowdownState = {
  order: string[];
  winnersByPot: Record<number, string[]>;
};

export interface PokerMachineContext {
  deck: Card[];
  communityCards: Card[];
  playerHands: Map<string, Card[]>;
  players: PokerPlayer[];
  activePlayers: string[];
  potManagerState: SerializedPotManagerState;
  bettingEngineState: SerializedBettingEngineState;
  dealerSeatIndex: number;
  handNumber: number;
  currentPhase: PokerPhase;
  actionSequenceNumber: number;
  tableConfig: TableConfig;
  showdownState: ShowdownState;
  actionTimeoutMs: number;
}

export type PokerMachineEvent =
  | { type: 'PLAYER_ACTION'; playerId: string; action: PokerAction; amount?: number; sequenceNumber: number }
  | { type: 'START_HAND' }
  | { type: 'TIMEOUT'; playerId: string }
  | { type: 'PLAYER_DISCONNECT'; playerId: string }
  | { type: 'PLAYER_RECONNECT'; playerId: string }
  | { type: 'SIT_OUT'; playerId: string }
  | { type: 'SIT_IN'; playerId: string };

const EMPTY_ACTIONS_BY_PHASE: Record<BettingRoundPhase, RoundActionRecord[]> = {
  preFlop: [],
  flop: [],
  turn: [],
  river: [],
};

const toMap = (record: Record<string, number>): Map<string, number> => {
  return new Map(Object.entries(record));
};

const toRecord = (map: Map<string, number>): Record<string, number> => {
  return Object.fromEntries(map.entries());
};

const isBettingRoundPhase = (phase: PokerPhase): phase is BettingRoundPhase => {
  return phase === 'preFlop' || phase === 'flop' || phase === 'turn' || phase === 'river';
};

const sortPlayersBySeat = (players: PokerPlayer[]): PokerPlayer[] => {
  return [...players].sort((playerA, playerB) => playerA.seatIndex - playerB.seatIndex);
};

const getPlayersAtTable = (context: PokerMachineContext): PokerPlayer[] => {
  return sortPlayersBySeat(context.players).filter((player) => player.status !== 'sitOut' && player.chipStack > 0);
};

const getPlayersStillInHand = (context: PokerMachineContext): PokerPlayer[] => {
  const folded = new Set(context.potManagerState.foldedPlayerIds);
  return sortPlayersBySeat(context.players).filter((player) => {
    return player.holeCards !== null && !folded.has(player.id) && player.status !== 'sitOut';
  });
};

const getNextClockwiseSeatIndex = (seatIndices: number[], fromSeat: number): number => {
  const sorted = [...seatIndices].sort((seatA, seatB) => seatA - seatB);
  const nextSeat = sorted.find((seat) => seat > fromSeat);
  return nextSeat ?? sorted[0];
};

const getNextDealerSeat = (context: PokerMachineContext): number => {
  const playersAtTable = getPlayersAtTable(context);
  if (playersAtTable.length === 0) {
    return context.dealerSeatIndex;
  }

  return getNextClockwiseSeatIndex(
    playersAtTable.map((player) => player.seatIndex),
    context.dealerSeatIndex,
  );
};

const nextSequenceNumber = (context: PokerMachineContext): number => {
  return context.actionSequenceNumber + 1;
};

const createInitialBettingState = (): SerializedBettingEngineState => {
  return {
    currentBet: 0,
    minRaise: DEFAULT_TABLE_CONFIG.bigBlind,
    lastRaise: DEFAULT_TABLE_CONFIG.bigBlind,
    lastAggressor: null,
    activePlayerId: null,
    roundComplete: false,
    initialStacks: {},
    actionsByPhase: {
      preFlop: [],
      flop: [],
      turn: [],
      river: [],
    },
  };
};

const initialContext: PokerMachineContext = {
  deck: [],
  communityCards: [],
  playerHands: new Map<string, Card[]>(),
  players: [],
  activePlayers: [],
  potManagerState: {
    pots: [],
    playerBets: {},
    foldedPlayerIds: [],
    winnersByPot: {},
    payouts: {},
  },
  bettingEngineState: createInitialBettingState(),
  dealerSeatIndex: 0,
  handNumber: 1,
  currentPhase: 'lobby',
  actionSequenceNumber: 0,
  tableConfig: DEFAULT_TABLE_CONFIG,
  showdownState: {
    order: [],
    winnersByPot: {},
  },
  actionTimeoutMs: ACTION_TIMEOUT_MS,
};

const createBettingEngine = (context: PokerMachineContext): BettingEngine | null => {
  const orderedPlayers = sortPlayersBySeat(context.players).filter((player) => {
    return context.bettingEngineState.initialStacks[player.id] !== undefined;
  });

  if (orderedPlayers.length < 2) {
    return null;
  }

  const stacks = new Map<string, number>();
  for (const player of orderedPlayers) {
    stacks.set(player.id, context.bettingEngineState.initialStacks[player.id] ?? 0);
  }

  const engine = new BettingEngine(context.tableConfig, stacks, context.dealerSeatIndex);

  const phasesInOrder: BettingRoundPhase[] = ['preFlop', 'flop', 'turn', 'river'];
  for (const phase of phasesInOrder) {
    engine.startNewRound(phase);
    for (const actionRecord of context.bettingEngineState.actionsByPhase[phase]) {
      engine.executeAction(actionRecord.playerId, actionRecord.action, actionRecord.amount);
    }

    if (phase === context.currentPhase) {
      break;
    }
  }

  return engine;
};

const syncBettingSnapshot = (
  context: PokerMachineContext,
  engine: BettingEngine,
  previousState: SerializedBettingEngineState,
): Pick<SerializedBettingEngineState, 'activePlayerId' | 'roundComplete' | 'currentBet' | 'minRaise' | 'lastRaise' | 'lastAggressor'> => {
  const activePlayerId = engine.getNextActivePlayer();
  const roundComplete = engine.isRoundComplete();

  const currentBet = context.players.reduce((maxBet, player) => {
    return player.currentBet > maxBet ? player.currentBet : maxBet;
  }, 0);

  let minRaise = Math.max(currentBet + previousState.lastRaise, context.tableConfig.bigBlind);
  if (activePlayerId) {
    minRaise = engine.getAvailableActions(activePlayerId).minRaise;
  }

  return {
    activePlayerId,
    roundComplete,
    currentBet,
    minRaise,
    lastRaise: previousState.lastRaise,
    lastAggressor: previousState.lastAggressor,
  };
};

const applyAction = (
  context: PokerMachineContext,
  playerId: string,
  action: PokerAction,
  amount?: number,
): PokerMachineContext | null => {
  if (!isBettingRoundPhase(context.currentPhase)) {
    return null;
  }

  const engine = createBettingEngine(context);
  if (!engine) {
    return null;
  }

  const validation = engine.validateAction(playerId, action, amount);
  if (!validation.valid) {
    return null;
  }

  const currentBetBefore = context.bettingEngineState.currentBet;
  const playerBeforeAction = context.players.find((player) => player.id === playerId);
  if (!playerBeforeAction) {
    return null;
  }

  const execution = engine.executeAction(playerId, action, amount);

  const nextPlayers = context.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }

    let nextStatus = player.status;
    let nextCurrentBet = player.currentBet;
    let nextHoleCards = player.holeCards;

    if (action === 'fold') {
      nextStatus = 'folded';
      nextHoleCards = null;
    }

    if (action === 'call' || action === 'raise' || action === 'allIn') {
      nextCurrentBet = player.currentBet + execution.bet;
    }

    if (execution.isAllIn && nextStatus !== 'folded') {
      nextStatus = 'allIn';
    }

    return {
      ...player,
      chipStack: player.chipStack - execution.bet,
      currentBet: nextCurrentBet,
      status: nextStatus,
      holeCards: nextHoleCards,
    };
  });

  const nextBets = {
    ...context.potManagerState.playerBets,
    [playerId]: (context.potManagerState.playerBets[playerId] ?? 0) + execution.bet,
  };

  const foldedPlayerIds =
    action === 'fold' && !context.potManagerState.foldedPlayerIds.includes(playerId)
      ? [...context.potManagerState.foldedPlayerIds, playerId]
      : context.potManagerState.foldedPlayerIds;

  let lastRaise = context.bettingEngineState.lastRaise;
  let lastAggressor = context.bettingEngineState.lastAggressor;

  const nextCurrentBet = nextPlayers.reduce((maxBet, player) => {
    return player.currentBet > maxBet ? player.currentBet : maxBet;
  }, 0);

  const isAggressiveAction = action === 'raise' || action === 'allIn';
  if (isAggressiveAction && nextCurrentBet > currentBetBefore) {
    const raiseIncrement = nextCurrentBet - currentBetBefore;
    if (raiseIncrement >= lastRaise) {
      lastRaise = raiseIncrement;
    }
    lastAggressor = playerId;
  }

  const bettingSnapshot = syncBettingSnapshot(
    {
      ...context,
      players: nextPlayers,
      potManagerState: {
        ...context.potManagerState,
        playerBets: nextBets,
        foldedPlayerIds,
      },
      bettingEngineState: {
        ...context.bettingEngineState,
        lastRaise,
        lastAggressor,
      },
    },
    engine,
    {
      ...context.bettingEngineState,
      lastRaise,
      lastAggressor,
    },
  );

  return {
    ...context,
    players: nextPlayers,
    activePlayers: nextPlayers.filter((player) => player.status === 'active').map((player) => player.id),
    actionSequenceNumber: nextSequenceNumber(context),
    potManagerState: {
      ...context.potManagerState,
      playerBets: nextBets,
      foldedPlayerIds,
    },
    bettingEngineState: {
      ...context.bettingEngineState,
      actionsByPhase: {
        ...context.bettingEngineState.actionsByPhase,
        [context.currentPhase]: [
          ...context.bettingEngineState.actionsByPhase[context.currentPhase],
          {
            playerId,
            action,
            amount,
          },
        ],
      },
      ...bettingSnapshot,
      lastRaise,
      lastAggressor,
    },
  };
};

const calculatePots = (context: PokerMachineContext): SidePot[] => {
  const manager = new PotManager();
  return manager.calculateSidePots(
    toMap(context.potManagerState.playerBets),
    new Set(context.potManagerState.foldedPlayerIds),
  );
};

const resolveShowdownOrder = (context: PokerMachineContext, contenderIds: string[]): string[] => {
  if (contenderIds.length === 0) {
    return [];
  }

  const playersById = new Map(context.players.map((player) => [player.id, player]));
  const contendersBySeat = contenderIds
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PokerPlayer => Boolean(player))
    .sort((playerA, playerB) => playerA.seatIndex - playerB.seatIndex);

  if (contendersBySeat.length === 0) {
    return [];
  }

  const defaultFirstSeat = getNextClockwiseSeatIndex(
    contendersBySeat.map((player) => player.seatIndex),
    context.dealerSeatIndex,
  );

  const firstSeat = (() => {
    const aggressor = context.bettingEngineState.lastAggressor;
    if (!aggressor) {
      return defaultFirstSeat;
    }

    const aggressorPlayer = playersById.get(aggressor);
    if (!aggressorPlayer || !contenderIds.includes(aggressorPlayer.id)) {
      return defaultFirstSeat;
    }

    return aggressorPlayer.seatIndex;
  })();

  const clockwise = contendersBySeat
    .map((player) => ({
      playerId: player.id,
      distance: (player.seatIndex - firstSeat + 1000) % 1000,
    }))
    .sort((entryA, entryB) => entryA.distance - entryB.distance)
    .map((entry) => entry.playerId);

  return clockwise;
};

const buildPublicState = (context: PokerMachineContext): {
  phase: PokerPhase;
  communityCards: Card[];
  pots: SidePot[];
  currentBet: number;
  minRaise: number;
  dealerSeatIndex: number;
  activeSeatIndex: number;
  players: Array<{
    id: string;
    name: string;
    chipStack: number;
    status: PokerPlayer['status'];
    seatIndex: number;
    currentBet: number;
    hasCards: boolean;
    avatar?: string;
  }>;
  handNumber: number;
  tableConfig: TableConfig;
} => {
  const activePlayer = context.players.find((player) => player.id === context.bettingEngineState.activePlayerId);
  return {
    phase: context.currentPhase,
    communityCards: [...context.communityCards],
    pots: [...context.potManagerState.pots],
    currentBet: context.bettingEngineState.currentBet,
    minRaise: context.bettingEngineState.minRaise,
    dealerSeatIndex: context.dealerSeatIndex,
    activeSeatIndex: activePlayer?.seatIndex ?? -1,
    players: context.players.map((player) => ({
      id: player.id,
      name: player.name,
      chipStack: player.chipStack,
      status: player.status,
      seatIndex: player.seatIndex,
      currentBet: player.currentBet,
      hasCards: Boolean(player.holeCards),
      avatar: player.avatar,
    })),
    handNumber: context.handNumber,
    tableConfig: context.tableConfig,
  };
};

const getBotProfile = (playerName: string): BotProfile => {
  if (playerName.toLowerCase().includes('maniac')) {
    return 'maniac';
  }

  if (playerName.toLowerCase().includes('station')) {
    return 'callingStation';
  }

  return 'rock';
};

export const pokerMachine = setup({
  types: {
    context: {} as PokerMachineContext,
    events: {} as PokerMachineEvent,
  },
  guards: {
    hasEnoughPlayers: ({ context }) => {
      return getPlayersAtTable(context).length >= 2;
    },
    isRoundComplete: ({ context }) => {
      return context.bettingEngineState.roundComplete;
    },
    isOnlyOnePlayerLeft: ({ context }) => {
      return getPlayersStillInHand(context).length <= 1;
    },
    isActionValid: ({ context, event }) => {
      if (event.type !== 'PLAYER_ACTION') {
        return false;
      }

      if (!isBettingRoundPhase(context.currentPhase)) {
        return false;
      }

      if (event.sequenceNumber !== context.actionSequenceNumber + 1) {
        return false;
      }

      if (context.bettingEngineState.activePlayerId !== event.playerId) {
        return false;
      }

      const engine = createBettingEngine(context);
      if (!engine) {
        return false;
      }

      return engine.validateAction(event.playerId, event.action, event.amount).valid;
    },
  },
  actions: {
    dealHoleCards: assign(({ context }) => {
      const handPlayers = getPlayersAtTable(context);
      if (handPlayers.length < 2) {
        return {};
      }

      const dealt = dealHoleCards(context.deck, handPlayers.length);
      const playerHands = new Map<string, Card[]>();

      const cardsByPlayerId = new Map<string, Card[]>();
      handPlayers.forEach((player, index) => {
        cardsByPlayerId.set(player.id, dealt.holeCardsByPlayer[index]);
        playerHands.set(player.id, dealt.holeCardsByPlayer[index]);
      });

      const updatedPlayers = context.players.map((player) => {
        const cards = cardsByPlayerId.get(player.id);
        if (!cards) {
          const nextStatus: PlayerStatus = player.status === 'disconnected' ? 'disconnected' : 'sitOut';
          return {
            ...player,
            holeCards: null,
            currentBet: 0,
            status: nextStatus,
          };
        }

        const nextStatus: PlayerStatus = player.status === 'disconnected' ? 'disconnected' : 'active';

        return {
          ...player,
          holeCards: cards,
          currentBet: 0,
          status: nextStatus,
        };
      });

      const initialStacks = Object.fromEntries(
        updatedPlayers
          .filter((player) => player.holeCards !== null)
          .sort((playerA, playerB) => playerA.seatIndex - playerB.seatIndex)
          .map((player) => [player.id, player.chipStack]),
      );

      return {
        deck: dealt.remaining,
        playerHands,
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
        bettingEngineState: {
          ...createInitialBettingState(),
          initialStacks,
          lastRaise: context.tableConfig.bigBlind,
          minRaise: context.tableConfig.bigBlind,
        },
        potManagerState: {
          pots: [],
          playerBets: Object.fromEntries(updatedPlayers.map((player) => [player.id, 0])),
          foldedPlayerIds: [],
          winnersByPot: {},
          payouts: {},
        },
      };
    }),

    postBlinds: assign(({ context }) => {
      const handPlayers = sortPlayersBySeat(context.players).filter((player) => player.holeCards !== null);
      if (handPlayers.length < 2) {
        return {};
      }

      const seatIndices = handPlayers.map((player) => player.seatIndex);
      const buttonSeat = seatIndices.includes(context.dealerSeatIndex)
        ? context.dealerSeatIndex
        : getNextClockwiseSeatIndex(seatIndices, context.dealerSeatIndex);

      const sbSeat = handPlayers.length === 2 ? buttonSeat : getNextClockwiseSeatIndex(seatIndices, buttonSeat);
      const bbSeat = getNextClockwiseSeatIndex(seatIndices, sbSeat);

      const sbPlayer = handPlayers.find((player) => player.seatIndex === sbSeat);
      const bbPlayer = handPlayers.find((player) => player.seatIndex === bbSeat);
      if (!sbPlayer || !bbPlayer) {
        return {};
      }

      const sbAmount = Math.min(sbPlayer.chipStack, context.tableConfig.smallBlind);
      const bbAmount = Math.min(bbPlayer.chipStack, context.tableConfig.bigBlind);

      const updatedPlayers = context.players.map((player) => {
        if (player.id === sbPlayer.id) {
          const nextStack = player.chipStack - sbAmount;
          return {
            ...player,
            chipStack: nextStack,
            currentBet: sbAmount,
            status: nextStack === 0 ? ('allIn' as const) : player.status,
          };
        }

        if (player.id === bbPlayer.id) {
          const nextStack = player.chipStack - bbAmount;
          return {
            ...player,
            chipStack: nextStack,
            currentBet: bbAmount,
            status: nextStack === 0 ? ('allIn' as const) : player.status,
          };
        }

        return {
          ...player,
          currentBet: player.holeCards ? 0 : player.currentBet,
        };
      });

      const postedBets = {
        ...context.potManagerState.playerBets,
        [sbPlayer.id]: (context.potManagerState.playerBets[sbPlayer.id] ?? 0) + sbAmount,
        [bbPlayer.id]: (context.potManagerState.playerBets[bbPlayer.id] ?? 0) + bbAmount,
      };

      const engine = createBettingEngine({
        ...context,
        players: updatedPlayers,
      });

      let nextActivePlayerId: string | null = null;
      let roundComplete = false;
      let minRaise = context.tableConfig.bigBlind * 2;
      if (engine) {
        nextActivePlayerId = engine.getNextActivePlayer();
        roundComplete = engine.isRoundComplete();
        if (nextActivePlayerId) {
          minRaise = engine.getAvailableActions(nextActivePlayerId).minRaise;
        }
      }

      return {
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
        potManagerState: {
          ...context.potManagerState,
          playerBets: postedBets,
          pots: calculatePots({
            ...context,
            potManagerState: {
              ...context.potManagerState,
              playerBets: postedBets,
            },
          }),
        },
        bettingEngineState: {
          ...context.bettingEngineState,
          currentBet: Math.max(sbAmount, bbAmount),
          minRaise,
          lastRaise: context.tableConfig.bigBlind,
          activePlayerId: nextActivePlayerId,
          roundComplete,
        },
      };
    }),

    dealCommunity: assign(({ context }) => {
      if (!isBettingRoundPhase(context.currentPhase) || context.currentPhase === 'preFlop') {
        return {};
      }

      const street = context.currentPhase;
      const dealt = dealCommunityCards(context.deck, street);

      return {
        deck: dealt.remaining,
        communityCards: [...context.communityCards, ...dealt.community],
      };
    }),

    executePlayerAction: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_ACTION') {
        return {};
      }

      const updated = applyAction(context, event.playerId, event.action, event.amount);
      if (!updated) {
        return {};
      }

      return updated;
    }),

    evaluateShowdown: assign(({ context }) => {
      const contenders = getPlayersStillInHand(context);
      if (contenders.length === 0) {
        return {
          showdownState: {
            order: [],
            winnersByPot: {},
          },
        };
      }

      const playerHandMap = new Map<string, Card[]>();
      for (const player of contenders) {
        if (player.holeCards) {
          playerHandMap.set(player.id, player.holeCards);
        }
      }

      const winnerTiers = findWinners(playerHandMap, context.communityCards);
      const pots = calculatePots(context);
      const winnersByPot: Record<number, string[]> = {};

      pots.forEach((pot, potIndex) => {
        const eligible = new Set(pot.eligiblePlayerIds);
        for (const tier of winnerTiers) {
          const tierWinners = tier.winners.filter((winnerId) => eligible.has(winnerId));
          if (tierWinners.length > 0) {
            winnersByPot[potIndex] = tierWinners;
            break;
          }
        }
      });

      return {
        potManagerState: {
          ...context.potManagerState,
          pots,
          winnersByPot,
        },
        showdownState: {
          order: resolveShowdownOrder(
            context,
            contenders.map((player) => player.id),
          ),
          winnersByPot,
        },
      };
    }),

    distributePots: assign(({ context }) => {
      const pots = context.potManagerState.pots.length > 0 ? context.potManagerState.pots : calculatePots(context);
      const winnersByPot = context.potManagerState.winnersByPot;
      if (Object.keys(winnersByPot).length === 0) {
        return {
          potManagerState: {
            ...context.potManagerState,
            pots,
            payouts: {},
          },
        };
      }

      const manager = new PotManager();
      manager.calculateSidePots(
        toMap(context.potManagerState.playerBets),
        new Set(context.potManagerState.foldedPlayerIds),
      );

      const seatIndices = new Map(context.players.map((player) => [player.id, player.seatIndex]));
      const payouts = manager.distributePots(
        new Map(Object.entries(winnersByPot).map(([potIndex, playerIds]) => [Number(potIndex), playerIds])),
        context.dealerSeatIndex,
        seatIndices,
      );

      const payoutsRecord = toRecord(payouts);
      const players = context.players.map((player) => ({
        ...player,
        chipStack: player.chipStack + (payoutsRecord[player.id] ?? 0),
      }));

      return {
        players,
        potManagerState: {
          ...context.potManagerState,
          pots,
          payouts: payoutsRecord,
        },
      };
    }),

    advanceDealer: assign(({ context }) => ({
      dealerSeatIndex: getNextDealerSeat(context),
    })),

    startActionTimer: assign(({ context }) => {
      return {
        actionTimeoutMs: context.tableConfig.actionTimeoutMs,
      };
    }),

    handleTimeout: assign(({ context, event }) => {
      if (event.type !== 'TIMEOUT') {
        return {};
      }

      const activePlayerId = context.bettingEngineState.activePlayerId;
      if (!activePlayerId || activePlayerId !== event.playerId) {
        return {};
      }

      const engine = createBettingEngine(context);
      if (!engine) {
        return {};
      }

      const available = engine.getAvailableActions(activePlayerId);
      let action: PokerAction = available.actions.includes('check') ? 'check' : 'fold';
      let amount: number | undefined;

      const timedOutPlayer = context.players.find((player) => player.id === activePlayerId);
      if (timedOutPlayer && timedOutPlayer.name.toLowerCase().includes('bot') && timedOutPlayer.holeCards) {
        const bot = new PokerBot(getBotProfile(timedOutPlayer.name), timedOutPlayer.id);
        const decision = bot.decideAction(
          buildPublicState(context),
          timedOutPlayer.holeCards,
          available.actions,
          available.callAmount,
          context.potManagerState.pots.reduce((sum, pot) => sum + pot.amount, 0),
        );
        action = decision.action;
        amount = decision.amount;
      }

      const applied = applyAction(context, activePlayerId, action, amount);
      return applied ?? {};
    }),

    prepareHand: assign(({ context }) => ({
      deck: shuffleDeck(createDeck()),
      communityCards: [],
      playerHands: new Map<string, Card[]>(),
      currentPhase: 'preFlop',
      actionSequenceNumber: 0,
      showdownState: {
        order: [],
        winnersByPot: {},
      },
      potManagerState: {
        pots: [],
        playerBets: {},
        foldedPlayerIds: [],
        winnersByPot: {},
        payouts: {},
      },
      bettingEngineState: {
        ...createInitialBettingState(),
        minRaise: context.tableConfig.bigBlind,
        lastRaise: context.tableConfig.bigBlind,
      },
    })),

    prepareBettingRound: assign(({ context }) => {
      if (!isBettingRoundPhase(context.currentPhase)) {
        return {};
      }

      const resetPlayers = context.players.map((player) => ({
        ...player,
        currentBet: player.holeCards ? 0 : player.currentBet,
      }));

      const engine = createBettingEngine({
        ...context,
        players: resetPlayers,
      });

      const activePlayerId = engine?.getNextActivePlayer() ?? null;
      const roundComplete = engine?.isRoundComplete() ?? true;
      const minRaise = activePlayerId ? (engine?.getAvailableActions(activePlayerId).minRaise ?? context.tableConfig.bigBlind) : context.tableConfig.bigBlind;

      return {
        players: resetPlayers,
        bettingEngineState: {
          ...context.bettingEngineState,
          currentBet: 0,
          minRaise,
          activePlayerId,
          roundComplete,
        },
      };
    }),

    setPreFlopPhase: assign({
      currentPhase: () => 'preFlop',
    }),

    setFlopPhase: assign({
      currentPhase: () => 'flop',
    }),

    setTurnPhase: assign({
      currentPhase: () => 'turn',
    }),

    setRiverPhase: assign({
      currentPhase: () => 'river',
    }),

    setShowdownPhase: assign({
      currentPhase: () => 'showdown',
    }),

    setHandCompletePhase: assign({
      currentPhase: () => 'handComplete',
    }),

    completeBoardForShowdown: assign(({ context }) => {
      let deck = context.deck;
      const communityCards = [...context.communityCards];

      while (communityCards.length < 5) {
        const street: 'flop' | 'turn' | 'river' =
          communityCards.length === 0 ? 'flop' : communityCards.length === 3 ? 'turn' : 'river';
        const dealt = dealCommunityCards(deck, street);
        deck = dealt.remaining;
        communityCards.push(...dealt.community);
      }

      return {
        deck,
        communityCards,
      };
    }),

    prepareSingleWinner: assign(({ context }) => {
      const contenders = getPlayersStillInHand(context);
      const winner = contenders[0];
      if (!winner) {
        return {};
      }

      const pots = calculatePots(context);
      const winnersByPot: Record<number, string[]> = {};
      pots.forEach((_, potIndex) => {
        winnersByPot[potIndex] = [winner.id];
      });

      return {
        potManagerState: {
          ...context.potManagerState,
          pots,
          winnersByPot,
        },
        showdownState: {
          order: [winner.id],
          winnersByPot,
        },
      };
    }),

    cleanupHand: assign(({ context }) => ({
      players: context.players.map((player) => {
        const isSatOut = player.status === 'sitOut' || player.status === 'disconnected';
        return {
          ...player,
          holeCards: null,
          currentBet: 0,
          status: isSatOut ? player.status : 'active',
        };
      }),
      activePlayers: context.players
        .filter((player) => player.status === 'active' && player.chipStack > 0)
        .map((player) => player.id),
      communityCards: [],
      playerHands: new Map<string, Card[]>(),
      potManagerState: {
        pots: [],
        playerBets: {},
        foldedPlayerIds: [],
        winnersByPot: {},
        payouts: {},
      },
      bettingEngineState: {
        ...createInitialBettingState(),
        minRaise: context.tableConfig.bigBlind,
        lastRaise: context.tableConfig.bigBlind,
      },
      currentPhase: 'handComplete',
      handNumber: context.handNumber + 1,
      actionSequenceNumber: 0,
      showdownState: {
        order: [],
        winnersByPot: {},
      },
      deck: [],
    })),

    handleDisconnect: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_DISCONNECT') {
        return {};
      }

      const disconnectPlayer = context.players.find((player) => player.id === event.playerId);
      if (!disconnectPlayer) {
        return {};
      }

      const updatedPlayers = context.players.map((player) => {
        if (player.id !== event.playerId) {
          return player;
        }

        const shouldFoldHand = player.holeCards !== null;
        return {
          ...player,
          status: 'disconnected' as const,
          holeCards: shouldFoldHand ? null : player.holeCards,
        };
      });

      const foldedPlayerIds =
        disconnectPlayer.holeCards && !context.potManagerState.foldedPlayerIds.includes(disconnectPlayer.id)
          ? [...context.potManagerState.foldedPlayerIds, disconnectPlayer.id]
          : context.potManagerState.foldedPlayerIds;

      return {
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
        potManagerState: {
          ...context.potManagerState,
          foldedPlayerIds,
        },
      };
    }),

    handleReconnect: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_RECONNECT') {
        return {};
      }

      const updatedPlayers = context.players.map((player) => {
        if (player.id !== event.playerId || player.status !== 'disconnected') {
          return player;
        }

        return {
          ...player,
          status: player.chipStack > 0 ? ('active' as const) : ('sitOut' as const),
        };
      });

      return {
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
      };
    }),

    sitOutPlayer: assign(({ context, event }) => {
      if (event.type !== 'SIT_OUT') {
        return {};
      }

      const sitOutPlayer = context.players.find((player) => player.id === event.playerId);
      if (!sitOutPlayer) {
        return {};
      }

      const updatedPlayers = context.players.map((player) => {
        if (player.id !== event.playerId) {
          return player;
        }

        return {
          ...player,
          status: 'sitOut' as const,
          holeCards: player.holeCards ? null : player.holeCards,
        };
      });

      const foldedPlayerIds =
        sitOutPlayer.holeCards && !context.potManagerState.foldedPlayerIds.includes(sitOutPlayer.id)
          ? [...context.potManagerState.foldedPlayerIds, sitOutPlayer.id]
          : context.potManagerState.foldedPlayerIds;

      return {
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
        potManagerState: {
          ...context.potManagerState,
          foldedPlayerIds,
        },
      };
    }),

    sitInPlayer: assign(({ context, event }) => {
      if (event.type !== 'SIT_IN') {
        return {};
      }

      const updatedPlayers = context.players.map((player) => {
        if (player.id !== event.playerId || player.status !== 'sitOut') {
          return player;
        }

        return {
          ...player,
          status: player.chipStack > 0 ? ('active' as const) : ('sitOut' as const),
        };
      });

      return {
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter((player) => player.status === 'active').map((player) => player.id),
      };
    }),
  },
}).createMachine({
  id: 'pokerGame',
  initial: 'waitingForPlayers',
  context: initialContext,
  states: {
    waitingForPlayers: {
      on: {
        START_HAND: {
          guard: 'hasEnoughPlayers',
          target: 'preFlop',
        },
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
      },
    },

    preFlop: {
      entry: ['setPreFlopPhase', 'prepareHand', 'dealHoleCards', 'postBlinds', 'startActionTimer'],
      on: {
        PLAYER_ACTION: {
          guard: 'isActionValid',
          actions: ['executePlayerAction', 'startActionTimer'],
        },
        TIMEOUT: {
          actions: ['handleTimeout', 'startActionTimer'],
        },
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
      },
      always: [
        {
          guard: 'isOnlyOnePlayerLeft',
          target: 'handComplete',
          actions: ['prepareSingleWinner', 'distributePots'],
        },
        {
          guard: 'isRoundComplete',
          target: 'flop',
        },
      ],
    },

    flop: {
      entry: ['setFlopPhase', 'dealCommunity', 'prepareBettingRound', 'startActionTimer'],
      on: {
        PLAYER_ACTION: {
          guard: 'isActionValid',
          actions: ['executePlayerAction', 'startActionTimer'],
        },
        TIMEOUT: {
          actions: ['handleTimeout', 'startActionTimer'],
        },
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
      },
      always: [
        {
          guard: 'isOnlyOnePlayerLeft',
          target: 'handComplete',
          actions: ['prepareSingleWinner', 'distributePots'],
        },
        {
          guard: 'isRoundComplete',
          target: 'turn',
        },
      ],
    },

    turn: {
      entry: ['setTurnPhase', 'dealCommunity', 'prepareBettingRound', 'startActionTimer'],
      on: {
        PLAYER_ACTION: {
          guard: 'isActionValid',
          actions: ['executePlayerAction', 'startActionTimer'],
        },
        TIMEOUT: {
          actions: ['handleTimeout', 'startActionTimer'],
        },
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
      },
      always: [
        {
          guard: 'isOnlyOnePlayerLeft',
          target: 'handComplete',
          actions: ['prepareSingleWinner', 'distributePots'],
        },
        {
          guard: 'isRoundComplete',
          target: 'river',
        },
      ],
    },

    river: {
      entry: ['setRiverPhase', 'dealCommunity', 'prepareBettingRound', 'startActionTimer'],
      on: {
        PLAYER_ACTION: {
          guard: 'isActionValid',
          actions: ['executePlayerAction', 'startActionTimer'],
        },
        TIMEOUT: {
          actions: ['handleTimeout', 'startActionTimer'],
        },
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
      },
      always: [
        {
          guard: 'isOnlyOnePlayerLeft',
          target: 'handComplete',
          actions: ['prepareSingleWinner', 'distributePots'],
        },
        {
          guard: 'isRoundComplete',
          target: 'showdown',
        },
      ],
    },

    showdown: {
      entry: ['setShowdownPhase', 'completeBoardForShowdown', 'evaluateShowdown', 'distributePots'],
      always: {
        target: 'handComplete',
      },
      on: {
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
      },
    },

    handComplete: {
      entry: ['setHandCompletePhase', 'advanceDealer', 'cleanupHand'],
      always: [
        {
          guard: 'hasEnoughPlayers',
          target: 'preFlop',
        },
        {
          target: 'waitingForPlayers',
        },
      ],
      on: {
        PLAYER_DISCONNECT: {
          actions: 'handleDisconnect',
        },
        PLAYER_RECONNECT: {
          actions: 'handleReconnect',
        },
        SIT_OUT: {
          actions: 'sitOutPlayer',
        },
        SIT_IN: {
          actions: 'sitInPlayer',
        },
        START_HAND: {
          guard: 'hasEnoughPlayers',
          target: 'preFlop',
        },
      },
    },
  },
});
