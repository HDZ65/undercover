import { motion } from 'motion/react'

type PixelGrid = string[][]

function parseGrid(art: string[], palette: Record<string, string>): PixelGrid {
  return art.map(row => row.split('').map(char => palette[char] || ''))
}

const KNIGHT = parseGrid([
  "    oooo    ",
  "   oOOOOo   ",
  "   ovggvo   ",
  "   o.vv.o   ",
  "   o....o   ",
  "    oooo    ",
  "  .xoooox.  ",
  " .xxoOooOox.",
  " gxxoOooOoxg",
  " g .oooo.  g",
  "   x....x   ",
  "   xO..Ox   ",
  "   x....x   ",
  "   xx..xx   ",
  "   xx  xx   ",
  "  xxx  xxx  ",
], {
  'o': '#90a4ae', 'O': '#cfd8dc', 'x': '#546e7a', '.': '#263238',
  'g': '#fdd835', 'v': '#ffcc80', ' ': ''
})

const BERSERKER = parseGrid([
  "    RrRr    ",
  "   RrRRrR   ",
  "   r.ss.r   ",
  "   r.ss.r   ",
  "    SSSS    ",
  "  .sSSSSs.  ",
  " .ssSSSSss. ",
  "w.bbSSSSbb. ",
  "w.b.SSSS.b. ",
  "w.. bbbb .. ",
  "w   b..b    ",
  "w   b..b    ",
  "    b..b    ",
  "    ....    ",
  "   bb  bb   ",
  "  bbb  bbb  ",
], {
  'S': '#f57c00', 's': '#ffb74d', '.': '#e65100', 'r': '#d32f2f',
  'R': '#f44336', 'b': '#4e342e', 'w': '#eeeeee', ' ': ''
})

const MAGE = parseGrid([
  "     pp     ",
  "    pppp    ",
  "   gppppg   ",
  "   c.ss.c   ",
  "   c....c   ",
  "     ss     ",
  "  pppppppp y",
  " pPppppppPy ",
  " pPppppppPy ",
  " p..pppp..y ",
  "  ..pppp..y ",
  "    p..p  y ",
  "    P..P  y ",
  "    ....  y ",
  "    p  p    ",
  "   pp  pp   ",
], {
  'p': '#5e35b1', 'P': '#311b92', '.': '#1a237e', 's': '#ffcc80',
  'c': '#42a5f5', 'g': '#ffeb3b', 'y': '#8d6e63', ' ': ''
})

const SAMURAI = parseGrid([
  "    g..g    ",
  "   rRRRRr   ",
  "   r....r   ",
  "   r.ss.r   ",
  "    SSSS    ",
  "  x.RRRR.x  ",
  " xx.RrRr.xx ",
  " xx.RRRR.xx ",
  " .. .RR. .. ",
  "w   ....   w",
  "w  xR..Rx  w",
  "    R..R    ",
  "    ....    ",
  "    x..x    ",
  "    x  x    ",
  "   xx  xx   ",
], {
  'R': '#d32f2f', 'r': '#b71c1c', 'x': '#212121', '.': '#000000',
  'S': '#ffb74d', 's': '#ffe082', 'g': '#fbc02d', 'w': '#e0e0e0', ' ': ''
})

const CHARACTERS = [KNIGHT, BERSERKER, MAGE, SAMURAI]
const CHARACTER_NAMES = ['Chevalier', 'Berserker', 'Mage', 'Samouraï']

function renderPixelGrid(grid: PixelGrid, pixelSize: number): string {
  const shadows: string[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]) {
        shadows.push(`${c * pixelSize}px ${r * pixelSize}px 0 ${grid[r][c]}`)
      }
    }
  }
  return shadows.join(', ')
}

export interface PixelCharacterProps {
  characterIndex: number
  hp: number
  name: string
  score?: number
  isAttacking?: boolean
  isRecoiling?: boolean
  isVictorious?: boolean
  flipped?: boolean
  size?: number
}

export function PixelCharacter({
  characterIndex,
  hp,
  name,
  score,
  isAttacking = false,
  isRecoiling = false,
  isVictorious = false,
  flipped = false,
  size = 4,
}: PixelCharacterProps) {
  const grid = CHARACTERS[characterIndex % 4]
  const charName = CHARACTER_NAMES[characterIndex % 4]
  const boxShadow = renderPixelGrid(grid, size)
  const gridWidth = 12 * size
  const gridHeight = 16 * size

  const hpColor = hp > 60 ? 'bg-emerald-500' : hp > 30 ? 'bg-amber-500' : 'bg-red-500'
  const hpBgColor = hp > 60 ? 'bg-emerald-900/30' : hp > 30 ? 'bg-amber-900/30' : 'bg-red-900/30'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
        {name}
      </span>
      {score !== undefined && (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{score} pts</span>
      )}

      <div className={`w-24 h-2.5 ${hpBgColor} rounded-full overflow-hidden border border-slate-400/30 shadow-inner`}>
        <motion.div
          className={`h-full rounded-full ${hpColor}`}
          animate={{ width: `${Math.max(0, hp)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <motion.div
        className="relative"
        style={{ width: gridWidth, height: gridHeight }}
        animate={
          isAttacking
            ? { 
                scale: [1, 1.25, 0.9, 1], 
                x: [0, flipped ? -45 : 45, 0],
                rotate: [0, flipped ? -15 : 15, 0]
              }
            : isRecoiling
              ? { 
                  rotate: [0, flipped ? 25 : -25, 0], 
                  x: [0, flipped ? 15 : -15, 0], 
                  opacity: [1, 0.5, 1, 0.5, 1]
                }
              : isVictorious
                ? { y: [0, -15, 0], scale: [1, 1.15, 1] }
                : { scaleY: [1, 0.96, 1], scaleX: [1, 1.02, 1], y: [0, 1, 0] } // Idle breathing effect
        }
        transition={
          isAttacking
            ? { duration: 0.5, ease: 'easeInOut' }
            : isRecoiling
              ? { duration: 0.6, ease: 'easeOut' }
              : isVictorious
                ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } // Idle
        }
      >
        <div
          style={{
            width: 1,
            height: 1,
            boxShadow,
            transform: flipped ? `scaleX(-1) translateX(-${gridWidth}px)` : undefined,
          }}
        />
      </motion.div>

      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">{charName}</span>
    </div>
  )
}

