import type { CastleTemplate, CellType } from './types'

function rect(x: number, y: number, w: number, h: number, type: CellType): Array<{ col: number; row: number; type: CellType }> {
  const blocks: Array<{ col: number; row: number; type: CellType }> = []
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      blocks.push({ col: c, row: r, type })
    }
  }
  return blocks
}

function wall(x: number, y: number, h: number, type: CellType) { return rect(x, y, 1, h, type) }
function floor(x: number, y: number, w: number, type: CellType) { return rect(x, y, w, 1, type) }

/** All templates use relative coords 0-19. Server offsets by +20 for right-side player. */
export const CASTLE_TEMPLATES: CastleTemplate[] = [
  {
    id: 'tour',
    labelFr: 'Tour',
    description: 'Tour étroite et haute',
    blocks: [
      ...rect(8, 0, 4, 2, 'stone'),
      ...wall(8, 2, 8, 'wood'), ...wall(11, 2, 8, 'wood'),
      ...floor(9, 2, 2, 'wood'), ...floor(9, 5, 2, 'wood'), ...floor(9, 8, 2, 'wood'),
      ...rect(8, 10, 4, 1, 'stone'),
      { col: 8, row: 11, type: 'stone' }, { col: 11, row: 11, type: 'stone' },
    ],
  },
  {
    id: 'forteresse',
    labelFr: 'Forteresse',
    description: 'Bunker large et résistant',
    blocks: [
      ...rect(3, 0, 14, 1, 'steel'),
      ...wall(3, 1, 4, 'stone'), ...wall(16, 1, 4, 'stone'),
      ...wall(7, 1, 3, 'stone'), ...wall(12, 1, 3, 'stone'),
      ...floor(4, 1, 3, 'wood'), ...floor(8, 1, 4, 'wood'), ...floor(13, 1, 3, 'wood'),
      ...rect(3, 4, 14, 1, 'stone'),
      ...floor(3, 5, 2, 'stone'), ...floor(9, 5, 2, 'stone'), ...floor(15, 5, 2, 'stone'),
    ],
  },
  {
    id: 'pyramide',
    labelFr: 'Pyramide',
    description: 'Stable et protégée à la base',
    blocks: [
      ...rect(3, 0, 14, 1, 'stone'),
      ...rect(4, 1, 12, 1, 'wood'),
      ...rect(5, 2, 10, 1, 'stone'),
      ...rect(6, 3, 8, 1, 'wood'),
      ...rect(7, 4, 6, 1, 'stone'),
      ...rect(8, 5, 4, 1, 'wood'),
      ...rect(9, 6, 2, 1, 'stone'),
    ],
  },
  {
    id: 'chateau',
    labelFr: 'Château',
    description: 'Classique avec 2 tours',
    blocks: [
      ...rect(4, 0, 4, 1, 'steel'),
      ...wall(4, 1, 7, 'stone'), ...wall(7, 1, 7, 'stone'),
      ...floor(5, 1, 2, 'wood'), ...floor(5, 4, 2, 'wood'), ...floor(5, 7, 2, 'wood'),
      ...rect(4, 8, 4, 1, 'stone'),
      { col: 4, row: 9, type: 'stone' }, { col: 7, row: 9, type: 'stone' },
      ...rect(12, 0, 4, 1, 'steel'),
      ...wall(12, 1, 7, 'stone'), ...wall(15, 1, 7, 'stone'),
      ...floor(13, 1, 2, 'wood'), ...floor(13, 4, 2, 'wood'), ...floor(13, 7, 2, 'wood'),
      ...rect(12, 8, 4, 1, 'stone'),
      { col: 12, row: 9, type: 'stone' }, { col: 15, row: 9, type: 'stone' },
      ...rect(7, 0, 5, 1, 'stone'),
      ...wall(8, 1, 3, 'wood'), ...wall(11, 1, 3, 'wood'),
      ...floor(8, 3, 4, 'stone'),
      { col: 9, row: 4, type: 'stone' }, { col: 10, row: 4, type: 'stone' },
    ],
  },
]
