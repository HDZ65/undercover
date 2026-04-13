import { motion } from 'motion/react'

type PixelGrid = string[][]

// 12 columns × 16 rows — more detailed characters
const KNIGHT: PixelGrid = [
  ['','','','','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','','','',''],
  ['','','','#4a6fa5','#6b8fc5','#6b8fc5','#6b8fc5','#6b8fc5','#4a6fa5','','',''],
  ['','','#4a6fa5','#6b8fc5','#8bb0e0','#8bb0e0','#8bb0e0','#8bb0e0','#6b8fc5','#4a6fa5','',''],
  ['','','#4a6fa5','#6b8fc5','#c0c0c0','#8bb0e0','#8bb0e0','#c0c0c0','#6b8fc5','#4a6fa5','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#333','#ffd5b4','#ffd5b4','#333','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','#e8a090','#e8a090','#ffd5b4','#ffd5b4','','',''],
  ['','','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','#4a6fa5','',''],
  ['','#4a6fa5','#6b8fc5','#6b8fc5','#c0c0c0','#c0c0c0','#c0c0c0','#c0c0c0','#6b8fc5','#6b8fc5','#4a6fa5',''],
  ['','#4a6fa5','#6b8fc5','#6b8fc5','#6b8fc5','#c0c0c0','#c0c0c0','#6b8fc5','#6b8fc5','#6b8fc5','#4a6fa5',''],
  ['','','#4a6fa5','#6b8fc5','#6b8fc5','#6b8fc5','#6b8fc5','#6b8fc5','#6b8fc5','#4a6fa5','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','#4a6fa5','#4a6fa5','#4a6fa5','','','#4a6fa5','#4a6fa5','#4a6fa5','',''],
  ['','','#4a6fa5','#4a6fa5','','','','','#4a6fa5','#4a6fa5','',''],
  ['','#3a3a3a','#3a3a3a','#3a3a3a','','','','','#3a3a3a','#3a3a3a','#3a3a3a',''],
]

const BERSERKER: PixelGrid = [
  ['','','','#8b0000','','','','','#8b0000','','',''],
  ['','','#8b0000','#cc3333','#8b0000','','','#8b0000','#cc3333','#8b0000','',''],
  ['','','','#8b0000','#cc3333','#cc3333','#cc3333','#cc3333','#8b0000','','',''],
  ['','','','#8b0000','#cc3333','#ff6666','#ff6666','#cc3333','#8b0000','','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#333','#ffd5b4','#ffd5b4','#333','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000','#8b0000',''],
  ['#8b0000','#cc3333','#cc3333','#cc3333','#666','#666','#666','#666','#cc3333','#cc3333','#cc3333','#8b0000'],
  ['','#8b0000','#cc3333','#cc3333','#cc3333','#666','#666','#cc3333','#cc3333','#cc3333','#8b0000',''],
  ['','','#8b0000','#cc3333','#cc3333','#cc3333','#cc3333','#cc3333','#cc3333','#8b0000','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','#8b0000','#8b0000','#8b0000','','','#8b0000','#8b0000','#8b0000','',''],
  ['','','#8b0000','#8b0000','','','','','#8b0000','#8b0000','',''],
  ['','#3a3a3a','#3a3a3a','#3a3a3a','','','','','#3a3a3a','#3a3a3a','#3a3a3a',''],
]

const MAGE: PixelGrid = [
  ['','','','','','#ffd700','','','','','',''],
  ['','','','','#6a0dad','#ffd700','#6a0dad','','','','',''],
  ['','','','#6a0dad','#9b59b6','#9b59b6','#9b59b6','#6a0dad','','','',''],
  ['','','#6a0dad','#9b59b6','#9b59b6','#ffd700','#9b59b6','#9b59b6','#6a0dad','','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#333','#ffd5b4','#ffd5b4','#333','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','#6a0dad','#6a0dad','#9b59b6','#9b59b6','#9b59b6','#9b59b6','#9b59b6','#9b59b6','#6a0dad','#6a0dad',''],
  ['','','#6a0dad','#9b59b6','#9b59b6','#ffd700','#ffd700','#9b59b6','#9b59b6','#6a0dad','',''],
  ['','','','#6a0dad','#9b59b6','#9b59b6','#9b59b6','#9b59b6','#6a0dad','','',''],
  ['','','','','#6a0dad','#9b59b6','#9b59b6','#6a0dad','','','',''],
  ['','','','#ffd5b4','','#6a0dad','#6a0dad','','#ffd5b4','','',''],
  ['','','','#ffd5b4','','','','','#ffd5b4','','',''],
  ['','','#6a0dad','#6a0dad','#6a0dad','','','#6a0dad','#6a0dad','#6a0dad','',''],
  ['','','#6a0dad','#6a0dad','','','','','#6a0dad','#6a0dad','',''],
  ['','#3a3a3a','#3a3a3a','#3a3a3a','','','','','#3a3a3a','#3a3a3a','#3a3a3a',''],
]

const SAMURAI: PixelGrid = [
  ['','','','','#c0392b','#c0392b','#c0392b','#c0392b','','','',''],
  ['','','','#2c2c2c','#2c2c2c','#c0392b','#c0392b','#2c2c2c','#2c2c2c','','',''],
  ['','','#2c2c2c','#444','#444','#444','#444','#444','#444','#2c2c2c','',''],
  ['','','#2c2c2c','#444','#c0392b','#444','#444','#c0392b','#444','#2c2c2c','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#333','#ffd5b4','#ffd5b4','#333','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','#ffd5b4','','',''],
  ['','#2c2c2c','#2c2c2c','#444','#444','#444','#444','#444','#444','#2c2c2c','#2c2c2c',''],
  ['','#2c2c2c','#444','#444','#c0392b','#c0392b','#c0392b','#c0392b','#444','#444','#2c2c2c',''],
  ['','','#2c2c2c','#444','#444','#c0392b','#c0392b','#444','#444','#2c2c2c','',''],
  ['','','','#2c2c2c','#444','#444','#444','#444','#2c2c2c','','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','','#ffd5b4','#ffd5b4','','','#ffd5b4','#ffd5b4','','',''],
  ['','','#2c2c2c','#2c2c2c','#2c2c2c','','','#2c2c2c','#2c2c2c','#2c2c2c','',''],
  ['','','#2c2c2c','#2c2c2c','','','','','#2c2c2c','#2c2c2c','',''],
  ['','#3a3a3a','#3a3a3a','#3a3a3a','','','','','#3a3a3a','#3a3a3a','#3a3a3a',''],
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
      {/* Name + score */}
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
        {name}
      </span>
      {score !== undefined && (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{score} pts</span>
      )}

      {/* Health bar */}
      <div className={`w-24 h-3 ${hpBgColor} rounded-full overflow-hidden border border-slate-400/30`}>
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
            ? { x: [0, flipped ? -40 : 40, 0], scale: [1, 1.2, 1] }
            : isRecoiling
              ? { x: [0, flipped ? 20 : -20, 0], opacity: [1, 0.2, 1, 0.2, 1] }
              : isVictorious
                ? { y: [0, -10, 0], scale: [1, 1.15, 1] }
                : { y: [0, -3, 0] }
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

      <span className="text-[10px] text-slate-400 dark:text-slate-500">{charName}</span>
    </div>
  )
}
