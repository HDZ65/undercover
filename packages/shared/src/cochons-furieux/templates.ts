import type { CastleTemplate, CellType } from './types'

function rect(x: number, y: number, w: number, h: number, type: CellType): Array<{ col: number; row: number; type: CellType }> {
  const blocks: Array<{ col: number; row: number; type: CellType }> = []
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) blocks.push({ col: c, row: r, type })
  return blocks
}
function wall(x: number, y: number, h: number, type: CellType) { return rect(x, y, 1, h, type) }
function floor(x: number, y: number, w: number, type: CellType) { return rect(x, y, w, 1, type) }

/**
 * Templates use relative coords 0-19.
 * Server offsets by +20 for right-side player.
 * Structures centered around cols 10-17 (away from catapult at col 1-2).
 * Max height: 5-6 rows to leave lots of sky for arcs.
 */
export const CASTLE_TEMPLATES: CastleTemplate[] = [
  {
    id: 'tour',
    labelFr: 'Tour',
    description: 'Tour étroite',
    blocks: [
      ...rect(12, 0, 2, 1, 'stone'),
      ...wall(12, 1, 5, 'wood'), ...wall(13, 1, 5, 'wood'),
      ...floor(12, 3, 2, 'wood'),
      ...rect(12, 6, 2, 1, 'stone'),
    ],
  },
  {
    id: 'forteresse',
    labelFr: 'Forteresse',
    description: 'Bunker large',
    blocks: [
      ...rect(10, 0, 8, 1, 'steel'),
      ...wall(10, 1, 3, 'stone'), ...wall(17, 1, 3, 'stone'),
      ...wall(13, 1, 2, 'stone'),
      ...floor(11, 1, 2, 'wood'), ...floor(14, 1, 3, 'wood'),
      ...rect(10, 3, 8, 1, 'stone'),
    ],
  },
  {
    id: 'pyramide',
    labelFr: 'Pyramide',
    description: 'Stable à la base',
    blocks: [
      ...rect(10, 0, 8, 1, 'stone'),
      ...rect(11, 1, 6, 1, 'wood'),
      ...rect(12, 2, 4, 1, 'stone'),
      ...rect(13, 3, 2, 1, 'wood'),
    ],
  },
  {
    id: 'chateau',
    labelFr: 'Château',
    description: '2 tours + mur',
    blocks: [
      // Left tower
      ...rect(10, 0, 2, 1, 'steel'),
      ...wall(10, 1, 4, 'stone'), ...wall(11, 1, 4, 'stone'),
      ...rect(10, 5, 2, 1, 'stone'),
      // Right tower
      ...rect(16, 0, 2, 1, 'steel'),
      ...wall(16, 1, 4, 'stone'), ...wall(17, 1, 4, 'stone'),
      ...rect(16, 5, 2, 1, 'stone'),
      // Wall between
      ...rect(11, 0, 5, 1, 'stone'),
      ...wall(12, 1, 2, 'wood'), ...wall(15, 1, 2, 'wood'),
      ...floor(12, 2, 4, 'stone'),
    ],
  },
]
