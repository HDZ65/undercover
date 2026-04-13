import type { DominoTile, BoardState } from '@undercover/shared';

/** Generate the 28 tiles of a double-6 set */
export function createDouble6Set(): DominoTile[] {
  const tiles: DominoTile[] = [];
  let id = 0;
  for (let top = 0; top <= 6; top++) {
    for (let bottom = top; bottom <= 6; bottom++) {
      tiles.push({ id, top, bottom });
      id++;
    }
  }
  return tiles;
}

/** Fisher-Yates shuffle */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check if a tile can be played on a specific end value */
export function canPlayOnEnd(tile: DominoTile, endValue: number): boolean {
  return tile.top === endValue || tile.bottom === endValue;
}

/** Get IDs of tiles in hand that can be played on the current board */
export function getPlayableTileIds(hand: DominoTile[], board: BoardState): number[] {
  if (board.leftEnd === -1) return hand.map(t => t.id); // empty board — play anything
  return hand
    .filter(t => canPlayOnEnd(t, board.leftEnd) || canPlayOnEnd(t, board.rightEnd))
    .map(t => t.id);
}

/** Sum of all pips in a hand */
export function handPipCount(hand: DominoTile[]): number {
  return hand.reduce((sum, t) => sum + t.top + t.bottom, 0);
}

/** Find the starting player (highest double, or highest tile) */
export function findStartingPlayer(hands: DominoTile[][]): number {
  // Highest double
  for (let d = 6; d >= 0; d--) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(t => t.top === d && t.bottom === d)) return i;
    }
  }
  // No doubles found — highest pip total
  let best = 0;
  let bestPips = -1;
  for (let i = 0; i < hands.length; i++) {
    const max = Math.max(...hands[i].map(t => t.top + t.bottom));
    if (max > bestPips) { bestPips = max; best = i; }
  }
  return best;
}
