import type { CastleTemplate, CellType } from './types'

function rect(x: number, y: number, w: number, h: number, type: CellType): Array<{ col: number; row: number; type: CellType }> {
  const blocks: Array<{ col: number; row: number; type: CellType }> = []
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) blocks.push({ col: c, row: r, type })
  return blocks
}
function wall(x: number, y: number, h: number, type: CellType) { return rect(x, y, 1, h, type) }
function floor(x: number, y: number, w: number, type: CellType) { return rect(x, y, w, 1, type) }

/** All templates use relative coords 0-19. Max height ~7 rows to leave sky space. */
export const CASTLE_TEMPLATES: CastleTemplate[] = [
  {
    id: 'tour',
    labelFr: 'Tour',
    description: 'Tour étroite et haute',
    blocks: [
      ...rect(9, 0, 3, 1, 'stone'),
      ...wall(9, 1, 6, 'wood'), ...wall(11, 1, 6, 'wood'),
      ...floor(10, 1, 1, 'wood'), ...floor(10, 3, 1, 'wood'), ...floor(10, 5, 1, 'wood'),
      ...rect(9, 7, 3, 1, 'stone'),
    ],
  },
  {
    id: 'forteresse',
    labelFr: 'Forteresse',
    description: 'Bunker large et résistant',
    blocks: [
      ...rect(4, 0, 12, 1, 'steel'),
      ...wall(4, 1, 3, 'stone'), ...wall(15, 1, 3, 'stone'),
      ...wall(8, 1, 2, 'stone'), ...wall(11, 1, 2, 'stone'),
      ...floor(5, 1, 3, 'wood'), ...floor(9, 1, 2, 'wood'), ...floor(12, 1, 3, 'wood'),
      ...rect(4, 3, 12, 1, 'stone'),
    ],
  },
  {
    id: 'pyramide',
    labelFr: 'Pyramide',
    description: 'Stable et protégée à la base',
    blocks: [
      ...rect(5, 0, 10, 1, 'stone'),
      ...rect(6, 1, 8, 1, 'wood'),
      ...rect(7, 2, 6, 1, 'stone'),
      ...rect(8, 3, 4, 1, 'wood'),
      ...rect(9, 4, 2, 1, 'stone'),
    ],
  },
  {
    id: 'chateau',
    labelFr: 'Château',
    description: 'Classique avec 2 tours',
    blocks: [
      // Left tower
      ...rect(5, 0, 3, 1, 'steel'),
      ...wall(5, 1, 5, 'stone'), ...wall(7, 1, 5, 'stone'),
      ...floor(6, 1, 1, 'wood'), ...floor(6, 3, 1, 'wood'),
      ...rect(5, 6, 3, 1, 'stone'),
      // Right tower
      ...rect(13, 0, 3, 1, 'steel'),
      ...wall(13, 1, 5, 'stone'), ...wall(15, 1, 5, 'stone'),
      ...floor(14, 1, 1, 'wood'), ...floor(14, 3, 1, 'wood'),
      ...rect(13, 6, 3, 1, 'stone'),
      // Wall between
      ...rect(7, 0, 6, 1, 'stone'),
      ...wall(8, 1, 2, 'wood'), ...wall(12, 1, 2, 'wood'),
      ...floor(8, 2, 5, 'stone'),
    ],
  },
]
