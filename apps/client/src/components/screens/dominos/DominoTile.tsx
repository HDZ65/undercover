import { motion } from 'motion/react'
import type { DominoTile as TileType } from '@undercover/shared'

// Dot positions for 0-6 pips (relative positions in a 3x3 grid)
const DOT_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

function PipHalf({ value, size }: { value: number; size: number }) {
  const dots = DOT_POSITIONS[value] ?? []
  const dotSize = Math.max(3, size * 0.18)
  const padding = size * 0.15
  const cellSize = (size - padding * 2) / 3

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {dots.map(([row, col], i) => (
        <div
          key={i}
          className="absolute rounded-full bg-slate-800 dark:bg-slate-200"
          style={{
            width: dotSize,
            height: dotSize,
            left: padding + col * cellSize + (cellSize - dotSize) / 2,
            top: padding + row * cellSize + (cellSize - dotSize) / 2,
          }}
        />
      ))}
    </div>
  )
}

interface DominoTileProps {
  tile: TileType
  playable?: boolean
  selected?: boolean
  faceDown?: boolean
  size?: number
  horizontal?: boolean
  onClick?: () => void
}

export function DominoTileComponent({
  tile,
  playable = false,
  selected = false,
  faceDown = false,
  size = 40,
  horizontal = false,
  onClick,
}: DominoTileProps) {
  const w = horizontal ? size * 2 + 4 : size + 4
  const h = horizontal ? size + 4 : size * 2 + 4

  if (faceDown) {
    return (
      <div
        className="rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-700 shadow-md"
        style={{ width: w, height: h }}
      />
    )
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={playable ? { scale: 1.08, y: -4 } : undefined}
      whileTap={playable ? { scale: 0.95 } : undefined}
      className={`
        rounded-lg border-2 shadow-md cursor-${playable ? 'pointer' : 'default'} transition-colors
        ${selected
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50'
          : playable
            ? 'border-emerald-400 bg-white dark:bg-slate-700 hover:border-emerald-300'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 opacity-70'
        }
      `}
      style={{ width: w, height: h }}
    >
      <div className={`flex ${horizontal ? 'flex-row' : 'flex-col'} items-center`}>
        <PipHalf value={horizontal ? tile.top : tile.top} size={size} />
        <div className={horizontal
          ? 'w-px h-full bg-slate-300 dark:bg-slate-500'
          : 'h-px w-full bg-slate-300 dark:bg-slate-500'
        } />
        <PipHalf value={horizontal ? tile.bottom : tile.bottom} size={size} />
      </div>
    </motion.div>
  )
}
