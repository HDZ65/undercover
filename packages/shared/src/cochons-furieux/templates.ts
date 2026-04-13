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

function wall(x: number, y: number, h: number, type: CellType): Array<{ col: number; row: number; type: CellType }> {
  return rect(x, y, 1, h, type)
}

function floor(x: number, y: number, w: number, type: CellType): Array<{ col: number; row: number; type: CellType }> {
  return rect(x, y, w, 1, type)
}

export const CASTLE_TEMPLATES: CastleTemplate[] = [
  {
    id: 'tour',
    labelFr: 'Tour',
    description: 'Tour étroite et haute — difficile à toucher mais fragile',
    blocks: [
      // Base stone 4 wide
      ...rect(8, 0, 4, 2, 'stone'),
      // Wood body
      ...wall(8, 2, 8, 'wood'),
      ...wall(11, 2, 8, 'wood'),
      // Floors every 3 rows
      ...floor(9, 2, 2, 'wood'),
      ...floor(9, 5, 2, 'wood'),
      ...floor(9, 8, 2, 'wood'),
      // Stone top
      ...rect(8, 10, 4, 1, 'stone'),
      // Battlements
      { col: 8, row: 11, type: 'stone' },
      { col: 11, row: 11, type: 'stone' },
    ],
  },
  {
    id: 'forteresse',
    labelFr: 'Forteresse',
    description: 'Bunker large et bas — très résistant mais facile à cibler',
    blocks: [
      // Thick steel base
      ...rect(3, 0, 14, 1, 'steel'),
      // Stone walls
      ...wall(3, 1, 4, 'stone'),
      ...wall(16, 1, 4, 'stone'),
      // Stone internal supports
      ...wall(7, 1, 3, 'stone'),
      ...wall(12, 1, 3, 'stone'),
      // Wood floors
      ...floor(4, 1, 3, 'wood'),
      ...floor(8, 1, 4, 'wood'),
      ...floor(13, 1, 3, 'wood'),
      // Roof
      ...rect(3, 4, 14, 1, 'stone'),
      // Battlements
      ...floor(3, 5, 2, 'stone'),
      ...floor(9, 5, 2, 'stone'),
      ...floor(15, 5, 2, 'stone'),
    ],
  },
  {
    id: 'pyramide',
    labelFr: 'Pyramide',
    description: 'Structure en triangle — stable et bien protégée à la base',
    blocks: [
      // Row 0 (ground): 14 wide
      ...rect(3, 0, 14, 1, 'stone'),
      // Row 1: 12 wide
      ...rect(4, 1, 12, 1, 'wood'),
      // Row 2: 10 wide
      ...rect(5, 2, 10, 1, 'stone'),
      // Row 3: 8 wide
      ...rect(6, 3, 8, 1, 'wood'),
      // Row 4: 6 wide
      ...rect(7, 4, 6, 1, 'stone'),
      // Row 5: 4 wide
      ...rect(8, 5, 4, 1, 'wood'),
      // Row 6: 2 wide (top)
      ...rect(9, 6, 2, 1, 'stone'),
    ],
  },
  {
    id: 'chateau',
    labelFr: 'Château',
    description: 'Classique avec 2 tours et un mur central — polyvalent',
    blocks: [
      // Left tower base
      ...rect(4, 0, 4, 1, 'steel'),
      ...wall(4, 1, 7, 'stone'),
      ...wall(7, 1, 7, 'stone'),
      ...floor(5, 1, 2, 'wood'),
      ...floor(5, 4, 2, 'wood'),
      ...floor(5, 7, 2, 'wood'),
      // Left tower top
      ...rect(4, 8, 4, 1, 'stone'),
      { col: 4, row: 9, type: 'stone' },
      { col: 7, row: 9, type: 'stone' },
      // Right tower base
      ...rect(12, 0, 4, 1, 'steel'),
      ...wall(12, 1, 7, 'stone'),
      ...wall(15, 1, 7, 'stone'),
      ...floor(13, 1, 2, 'wood'),
      ...floor(13, 4, 2, 'wood'),
      ...floor(13, 7, 2, 'wood'),
      // Right tower top
      ...rect(12, 8, 4, 1, 'stone'),
      { col: 12, row: 9, type: 'stone' },
      { col: 15, row: 9, type: 'stone' },
      // Connecting wall
      ...rect(7, 0, 5, 1, 'stone'),
      ...wall(8, 1, 3, 'wood'),
      ...wall(11, 1, 3, 'wood'),
      ...floor(8, 3, 4, 'stone'),
      // Wall battlements
      { col: 9, row: 4, type: 'stone' },
      { col: 10, row: 4, type: 'stone' },
    ],
  },
]
