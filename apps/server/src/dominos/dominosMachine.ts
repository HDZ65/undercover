import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import type { DominoTile, BoardState, BoardTile, RoundResult, AttackTier } from '@undercover/shared';
import { TILES_PER_PLAYER, DEFAULT_TARGET_SCORE, getAttackTier } from '@undercover/shared';
import { createDouble6Set, shuffle, getPlayableTileIds, handPipCount, findStartingPlayer } from './tiles.js';

// ─── Server-only types ────────────────────────────────────────────

export interface DominosPlayer {
  id: string;
  name: string;
  connected: boolean;
  characterIndex: number;
}

export interface DominosMachineContext {
  players: DominosPlayer[];
  hands: Record<string, DominoTile[]>;
  board: BoardState;
  boneyard: DominoTile[];
  currentPlayerIndex: number;
  consecutivePasses: number;
  scores: Record<string, number[]>; // per-round scores
  round: number;
  targetScore: number;
  roundResult: RoundResult | null;
  winnerId: string | null;
  lastAction: { playerId: string; action: 'placed' | 'drew' | 'passed' } | null;
}

type DominosMachineEvent =
  | { type: 'ADD_PLAYER'; id: string; name: string }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_TARGET_SCORE'; targetScore: number }
  | { type: 'START_GAME' }
  | { type: 'PLACE_TILE'; tileId: number; end: 'left' | 'right' }
  | { type: 'DRAW_TILE' }
  | { type: 'PASS' }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET_GAME' };

// ─── Helpers ────────────────────────────────────────────────────

function currentPlayer(ctx: DominosMachineContext): DominosPlayer | undefined {
  return ctx.players[ctx.currentPlayerIndex];
}

function currentHand(ctx: DominosMachineContext): DominoTile[] {
  const p = currentPlayer(ctx);
  return p ? ctx.hands[p.id] ?? [] : [];
}

function totalScore(ctx: DominosMachineContext, playerId: string): number {
  return (ctx.scores[playerId] ?? []).reduce((a, b) => a + b, 0);
}

function dealRound(ctx: DominosMachineContext): Partial<DominosMachineContext> {
  const tiles = shuffle(createDouble6Set());
  const hands: Record<string, DominoTile[]> = {};
  let idx = 0;
  for (const p of ctx.players) {
    hands[p.id] = tiles.slice(idx, idx + TILES_PER_PLAYER);
    idx += TILES_PER_PLAYER;
  }
  const boneyard = tiles.slice(idx);
  const board: BoardState = { tiles: [], leftEnd: -1, rightEnd: -1 };

  const handArrays = ctx.players.map(p => hands[p.id]);
  const startIdx = findStartingPlayer(handArrays);

  return {
    hands,
    boneyard,
    board,
    currentPlayerIndex: startIdx,
    consecutivePasses: 0,
    roundResult: null,
    lastAction: null,
  };
}

// ─── Machine ────────────────────────────────────────────────────

export const dominosMachine = setup({
  types: {
    context: {} as DominosMachineContext,
    events: {} as DominosMachineEvent,
  },
  guards: {
    canStart: ({ context }) => {
      const active = context.players.filter(p => p.connected);
      return active.length >= 2 && active.length <= 4;
    },
    isValidPlay: ({ context, event }) => {
      if (event.type !== 'PLACE_TILE') return false;
      const hand = currentHand(context);
      const tile = hand.find(t => t.id === event.tileId);
      if (!tile) return false;
      if (context.board.leftEnd === -1) return true; // empty board
      const endValue = event.end === 'left' ? context.board.leftEnd : context.board.rightEnd;
      return tile.top === endValue || tile.bottom === endValue;
    },
    canDraw: ({ context }) => {
      return context.boneyard.length > 0 && getPlayableTileIds(currentHand(context), context.board).length === 0;
    },
    canPass: ({ context }) => {
      return context.boneyard.length === 0 && getPlayableTileIds(currentHand(context), context.board).length === 0;
    },
    handEmpty: ({ context }) => {
      const p = currentPlayer(context);
      return p ? (context.hands[p.id] ?? []).length === 0 : false;
    },
    allBlocked: ({ context }) => {
      return context.consecutivePasses >= context.players.filter(p => p.connected).length;
    },
    isGameOver: ({ context }) => {
      return context.players.some(p => totalScore(context, p.id) >= context.targetScore);
    },
  },
  actions: {
    addPlayer: assign(({ context, event }) => {
      if (event.type !== 'ADD_PLAYER') return {};
      if (context.players.some(p => p.id === event.id)) return {};
      const charIdx = context.players.length % 4;
      return {
        players: [...context.players, { id: event.id, name: event.name, connected: true, characterIndex: charIdx }],
        scores: { ...context.scores, [event.id]: [] },
      };
    }),
    removePlayer: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_PLAYER') return {};
      const next = context.players.filter(p => p.id !== event.id);
      const newScores = { ...context.scores };
      delete newScores[event.id];
      return { players: next, scores: newScores };
    }),
    setTargetScore: assign(({ event }) => {
      if (event.type !== 'SET_TARGET_SCORE') return {};
      return { targetScore: Math.max(50, Math.min(300, event.targetScore)) };
    }),
    dealRound: assign(({ context }) => dealRound(context)),
    placeTile: assign(({ context, event }) => {
      if (event.type !== 'PLACE_TILE') return {};
      const p = currentPlayer(context)!;
      const hand = [...(context.hands[p.id] ?? [])];
      const tileIdx = hand.findIndex(t => t.id === event.tileId);
      if (tileIdx === -1) return {};
      const tile = hand[tileIdx];
      hand.splice(tileIdx, 1);

      const board = { ...context.board, tiles: [...context.board.tiles] };

      if (board.leftEnd === -1) {
        // First tile on empty board
        board.tiles.push({ tile, flipped: false });
        board.leftEnd = tile.top;
        board.rightEnd = tile.bottom;
      } else if (event.end === 'left') {
        // Placing on the left: the tile's RIGHT side (bottom in horizontal display) must match board.leftEnd
        const endVal = board.leftEnd;
        // If bottom already matches → no flip needed (bottom faces right, towards the board)
        // If top matches → flip so top goes to right side
        const flipped = tile.top === endVal;
        const bt: BoardTile = { tile, flipped };
        board.tiles.unshift(bt);
        // New leftEnd = the side that faces outward (left)
        board.leftEnd = flipped ? tile.bottom : tile.top;
      } else {
        // Placing on the right: the tile's LEFT side (top in horizontal display) must match board.rightEnd
        const endVal = board.rightEnd;
        // If top already matches → no flip needed (top faces left, towards the board)
        // If bottom matches → flip so bottom goes to left side
        const flipped = tile.bottom === endVal;
        const bt: BoardTile = { tile, flipped };
        board.tiles.push(bt);
        // New rightEnd = the side that faces outward (right)
        board.rightEnd = flipped ? tile.top : tile.bottom;
      }

      return {
        board,
        hands: { ...context.hands, [p.id]: hand },
        consecutivePasses: 0,
        lastAction: { playerId: p.id, action: 'placed' as const },
      };
    }),
    drawOneTile: assign(({ context }) => {
      const p = currentPlayer(context)!;
      const boneyard = [...context.boneyard];
      const drawn = boneyard.pop()!;
      const hand = [...(context.hands[p.id] ?? []), drawn];
      return {
        boneyard,
        hands: { ...context.hands, [p.id]: hand },
        lastAction: { playerId: p.id, action: 'drew' as const },
      };
    }),
    advanceTurn: assign(({ context }) => {
      const active = context.players.filter(p => p.connected);
      if (active.length === 0) return {};
      const nextIdx = (context.currentPlayerIndex + 1) % active.length;
      return { currentPlayerIndex: nextIdx };
    }),
    incrementPasses: assign(({ context }) => {
      const p = currentPlayer(context);
      return {
        consecutivePasses: context.consecutivePasses + 1,
        lastAction: p ? { playerId: p.id, action: 'passed' as const } : context.lastAction,
      };
    }),
    computeRoundWin: assign(({ context }) => {
      const winner = currentPlayer(context)!;
      const pipCounts: Record<string, number> = {};
      let points = 0;
      for (const p of context.players) {
        const pips = handPipCount(context.hands[p.id] ?? []);
        pipCounts[p.id] = pips;
        if (p.id !== winner.id) points += pips;
      }
      const tier: AttackTier = getAttackTier(points);
      const roundResult: RoundResult = { winnerId: winner.id, pointsScored: points, attackTier: tier, playerPipCounts: pipCounts };
      const scores = { ...context.scores };
      scores[winner.id] = [...(scores[winner.id] ?? []), points];
      for (const p of context.players) {
        if (p.id !== winner.id && !scores[p.id]?.length) {
          scores[p.id] = [...(scores[p.id] ?? []), 0];
        } else if (p.id !== winner.id) {
          scores[p.id] = [...(scores[p.id] ?? []), 0];
        }
      }
      return { roundResult, scores };
    }),
    computeRoundWinByPips: assign(({ context }) => {
      const pipCounts: Record<string, number> = {};
      let minPips = Infinity;
      let winnerId = context.players[0]?.id ?? '';
      for (const p of context.players) {
        const pips = handPipCount(context.hands[p.id] ?? []);
        pipCounts[p.id] = pips;
        if (pips < minPips) { minPips = pips; winnerId = p.id; }
      }
      let points = 0;
      for (const p of context.players) {
        if (p.id !== winnerId) points += pipCounts[p.id];
      }
      // Subtract winner's own pips (standard Draw scoring when blocked)
      points = Math.max(0, points - minPips);
      const tier: AttackTier = getAttackTier(points);
      const roundResult: RoundResult = { winnerId, pointsScored: points, attackTier: tier, playerPipCounts: pipCounts };
      const scores = { ...context.scores };
      scores[winnerId] = [...(scores[winnerId] ?? []), points];
      for (const p of context.players) {
        if (p.id !== winnerId) scores[p.id] = [...(scores[p.id] ?? []), 0];
      }
      return { roundResult, scores };
    }),
    determineWinner: assign(({ context }) => {
      let best = '';
      let bestScore = -1;
      for (const p of context.players) {
        const s = totalScore(context, p.id);
        if (s > bestScore) { bestScore = s; best = p.id; }
      }
      return { winnerId: best };
    }),
    incrementRound: assign(({ context }) => ({ round: context.round + 1 })),
    resetAll: assign(({ context }) => {
      const scores: Record<string, number[]> = {};
      for (const p of context.players) scores[p.id] = [];
      return {
        hands: {} as Record<string, DominoTile[]>,
        board: { tiles: [], leftEnd: -1, rightEnd: -1 } as BoardState,
        boneyard: [] as DominoTile[],
        currentPlayerIndex: 0,
        consecutivePasses: 0,
        scores,
        round: 1,
        roundResult: null,
        winnerId: null,
        lastAction: null,
      };
    }),
  },
}).createMachine({
  id: 'dominos',
  initial: 'lobby',
  context: {
    players: [],
    hands: {},
    board: { tiles: [], leftEnd: -1, rightEnd: -1 },
    boneyard: [],
    currentPlayerIndex: 0,
    consecutivePasses: 0,
    scores: {},
    round: 1,
    targetScore: DEFAULT_TARGET_SCORE,
    roundResult: null,
    winnerId: null,
    lastAction: null,
  },
  states: {
    lobby: {
      on: {
        ADD_PLAYER: { actions: 'addPlayer' },
        REMOVE_PLAYER: { actions: 'removePlayer' },
        SET_TARGET_SCORE: { actions: 'setTargetScore' },
        START_GAME: {
          guard: 'canStart',
          target: 'playerTurn',
          actions: 'dealRound',
        },
        RESET_GAME: { actions: 'resetAll' },
      },
    },
    playerTurn: {
      on: {
        PLACE_TILE: {
          guard: 'isValidPlay',
          target: 'checkRoundEnd',
          actions: 'placeTile',
        },
        DRAW_TILE: {
          guard: 'canDraw',
          actions: 'drawOneTile',
          // stays in playerTurn — player keeps drawing
        },
        PASS: {
          guard: 'canPass',
          target: 'checkAfterPass',
          actions: 'incrementPasses',
        },
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
    },
    checkRoundEnd: {
      always: [
        { guard: 'handEmpty', target: 'roundEnd', actions: 'computeRoundWin' },
        { target: 'playerTurn', actions: 'advanceTurn' },
      ],
    },
    checkAfterPass: {
      always: [
        { guard: 'allBlocked', target: 'roundEnd', actions: 'computeRoundWinByPips' },
        { target: 'playerTurn', actions: 'advanceTurn' },
      ],
    },
    roundEnd: {
      on: {
        NEXT_ROUND: [
          { guard: 'isGameOver', target: 'gameOver', actions: 'determineWinner' },
          { target: 'playerTurn', actions: ['incrementRound', 'dealRound'] },
        ],
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
    },
    gameOver: {
      on: {
        RESET_GAME: { target: 'lobby', actions: 'resetAll' },
      },
    },
  },
});

export type DominosActor = ActorRefFrom<typeof dominosMachine>;
export type DominosSnapshot = SnapshotFrom<typeof dominosMachine>;
