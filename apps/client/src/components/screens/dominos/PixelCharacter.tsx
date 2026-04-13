import { motion } from 'motion/react'

// Pixel art data: each character is a grid of colors
// Format: [row][col] = color hex or '' for transparent
type PixelGrid = string[][]

const KNIGHT: PixelGrid = [
  ['','','','#4a6fa5','#4a6fa5','#4a6fa5','','',''],
  ['','','#4a6fa5','#6b8fc5','#6b8fc5','#6b8fc5','#4a6fa5','',''],
  ['','','#ffd5b4','#ffd5b4','#333','#ffd5b4','#333','',''],
  ['','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','',''],
  ['','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5',''],
  ['','#4a6fa5','#6b8fc5','#6b8fc5','#c0c0c0','#6b8fc5','#6b8fc5','#4a6fa5',''],
  ['','','#4a6fa5','#6b8fc5','#6b8fc5','#6b8fc5','#4a6fa5','',''],
  ['','','','#ffd5b4','','#ffd5b4','','',''],
  ['','','','#4a6fa5','','#4a6fa5','','',''],
  ['','','#4a6fa5','#4a6fa5','','#4a6fa5','#4a6fa5','',''],
]

const BERSERKER: PixelGrid = [
  ['','','','#8b0000','#8b0000','#8b0000','','',''],
  ['','','#8b0000','#cc3333','#cc3333','#cc3333','#8b0000','',''],
  ['','','#ffd5b4','#ffd5b4','#333','#ffd5b4','#333','',''],
  ['','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','',''],
  ['','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000',''],
  ['','#8b0000','#cc3333','#cc3333','#666','#cc3333','#cc3333','#8b0000',''],
  ['','','#8b0000','#cc3333','#cc3333','#cc3333','#8b0000','',''],
  ['','','','#ffd5b4','','#ffd5b4','','',''],
  ['','','','#8b0000','','#8b0000','','',''],
  ['','','#8b0000','#8b0000','','#8b0000','#8b0000','',''],
]

const MAGE: PixelGrid = [
  ['','','','#6a0dad','#6a0dad','#6a0dad','','',''],
  ['','','#6a0dad','#9b59b6','#ffd700','#9b59b6','#6a0dad','',''],
  ['','','#ffd5b4','#ffd5b4','#333','#ffd5b4','#333','',''],
  ['','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','',''],
  ['','#6a0dad','#6a0dad','#9b59b6','#9b59b6','#9b59b6','#6a0dad','#6a0dad',''],
  ['','','#6a0dad','#9b59b6','#ffd700','#9b59b6','#6a0dad','',''],
  ['','','','#6a0dad','#6a0dad','#6a0dad','','',''],
  ['','','','#ffd5b4','','#ffd5b4','','',''],
  ['','','','#6a0dad','','#6a0dad','','',''],
  ['','','#6a0dad','#6a0dad','','#6a0dad','#6a0dad','',''],
]

const SAMURAI: PixelGrid = [
  ['','','','#2c2c2c','#2c2c2c','#2c2c2c','','',''],
  ['','','#2c2c2c','#444','#c0392b','#444','#2c2c2c','',''],
  ['','','#ffd5b4','#ffd5b4','#333','#ffd5b4','#333','',''],
  ['','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','',''],
  ['','#2c2c2c','#2c2c2c','#444','#444','#444','#2c2c2c','#2c2c2c',''],
  ['','#2c2c2c','#444','#444','#c0392b','#444','#444','#2c2c2c',''],
  ['','','#2c2c2c','#444','#444','#444','#2c2c2c','',''],
  ['','','','#ffd5b4','','#ffd5b4','','',''],
  ['','','','#2c2c2c','','#2c2c2c','','',''],
  ['','','#2c2c2c','#2c2c2c','','#2c2c2c','#2c2c2c','',''],
]

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

interface PixelCharacterProps {
  characterIndex: number
  hp: number // 0-100
  name: string
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
  isAttacking = false,
  isRecoiling = false,
  isVictorious = false,
  flipped = false,
  size = 4,
}: PixelCharacterProps) {
  const grid = CHARACTERS[characterIndex % 4]
  const charName = CHARACTER_NAMES[characterIndex % 4]
  const boxShadow = renderPixelGrid(grid, size)
  const gridWidth = 9 * size
  const gridHeight = 10 * size

  const hpColor = hp > 60 ? 'bg-emerald-500' : hp > 30 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Name */}
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
        {name}
      </span>

      {/* Health bar */}
      <div className="w-20 h-2 bg-slate-700/30 dark:bg-slate-600/50 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${hpColor}`}
          animate={{ width: `${Math.max(0, hp)}%` }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      </div>

      {/* Character */}
      <motion.div
        className="relative"
        style={{ width: gridWidth, height: gridHeight }}
        animate={
          isAttacking
            ? { x: [0, flipped ? -30 : 30, 0], scale: [1, 1.2, 1] }
            : isRecoiling
              ? { x: [0, flipped ? 15 : -15, 0], opacity: [1, 0.3, 1, 0.3, 1] }
              : isVictorious
                ? { y: [0, -8, 0], scale: [1, 1.1, 1] }
                : { y: [0, -2, 0] }
        }
        transition={
          isAttacking || isRecoiling
            ? { duration: 0.6, ease: 'easeInOut' }
            : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
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

      {/* Character class */}
      <span className="text-[10px] text-slate-400 dark:text-slate-500">{charName}</span>
    </div>
  )
}
