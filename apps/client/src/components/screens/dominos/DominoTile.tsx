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

// Plato-inspired colors for each number
const PIP_COLORS: Record<number, string> = {
  1: 'bg-cyan-400',
  2: 'bg-emerald-400',
  3: 'bg-red-400',
  4: 'bg-purple-400',
  5: 'bg-amber-400',
  6: 'bg-blue-500',
}

function PipHalf({ value, size }: { value: number; size: number }) {
  const dots = DOT_POSITIONS[value] ?? []
  const dotSize = Math.max(4, size * 0.22)
  const padding = size * 0.15
  const cellSize = (size - padding * 2) / 3

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {dots.map(([row, col], i) => (
        <div
          key={i}
          className={`absolute rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] ${PIP_COLORS[value] || 'bg-slate-800'}`}
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
  size = 44, // Slightly larger default size for better visibility
  horizontal = false,
  onClick,
}: DominoTileProps) {
  // Tile dimensions
  const w = horizontal ? size * 2 + 2 : size + 2
  const h = horizontal ? size + 2 : size * 2 + 2

  if (faceDown) {
    return (
      <div
        className="rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-700 to-indigo-900 shadow-[0_4px_0_1px_rgba(30,58,138,1),0_8px_10px_rgba(0,0,0,0.3)] border-t border-blue-400/30"
        style={{ width: w, height: h }}
      >
        <div className="w-1/3 h-1/3 border-2 border-white/10 rounded-full" />
      </div>
    )
  }

  // Base style configuration for different states
  const baseStyle = horizontal ? 'flex-row' : 'flex-col'
  const dividerStyle = horizontal
    ? 'w-[2px] h-3/4 bg-slate-200 dark:bg-slate-700 mx-auto rounded-full shadow-inner'
    : 'h-[2px] w-3/4 bg-slate-200 dark:bg-slate-700 mx-auto rounded-full shadow-inner'

  let containerClasses = `
    flex items-center justify-center rounded-xl transition-all duration-200 select-none
    bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800
    border border-slate-200 dark:border-slate-600
  `

  if (selected) {
    containerClasses += ' ring-4 ring-amber-400 shadow-[0_2px_0_rgba(251,191,36,1),0_8px_15px_rgba(0,0,0,0.2)] -translate-y-2 z-20'
  } else if (playable) {
    // Glow effect to make it extremely obvious
    containerClasses += ' cursor-pointer ring-2 ring-emerald-400/80 shadow-[0_4px_0_rgba(52,211,153,0.8),0_0_15px_rgba(52,211,153,0.4)] dark:shadow-[0_4px_0_rgba(52,211,153,0.6),0_0_15px_rgba(52,211,153,0.3)] hover:-translate-y-1 hover:shadow-[0_6px_0_rgba(52,211,153,0.8),0_0_20px_rgba(52,211,153,0.5)] z-10'
  } else {
    // Heavily greyed out and low opacity to signify unplayable
    containerClasses += ' opacity-40 grayscale-[60%] shadow-[0_2px_0_rgba(203,213,225,0.5)] dark:shadow-[0_2px_0_rgba(51,65,85,0.5)] z-0'
  }

  return (
    <motion.div
      onClick={playable ? onClick : undefined}
      whileTap={playable ? { y: 2, scale: 0.96 } : undefined}
      className={containerClasses}
      style={{ width: w, height: h }}
      layoutId={`tile-${tile.id}`} // Fluid layout animations!
    >
      <div className={`flex ${baseStyle} items-center justify-center w-full h-full p-0.5`}>
        <PipHalf value={horizontal ? tile.top : tile.top} size={size} />
        <div className={`flex items-center justify-center ${horizontal ? 'h-full w-2' : 'w-full h-2'}`}>
           <div className={dividerStyle} />
        </div>
        <PipHalf value={horizontal ? tile.bottom : tile.bottom} size={size} />
      </div>
    </motion.div>
  )
}

