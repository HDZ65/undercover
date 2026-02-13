import type { PublicPokerPlayer } from '@undercover/shared'
import { Card } from './Card'
import type { Card as CardType } from '@undercover/shared'

interface PlayerSeatProps {
  player: PublicPokerPlayer
  holeCards?: CardType[] | null
  isActive?: boolean
  isDealer?: boolean
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-right' | 'bottom-center' | 'bottom-left'
}

const positionClasses: Record<string, string> = {
  'top-left': 'absolute top-0 left-0 md:top-4 md:left-4',
  'top-center': 'absolute top-0 left-1/2 -translate-x-1/2 md:top-4',
  'top-right': 'absolute top-0 right-0 md:top-4 md:right-4',
  'bottom-right': 'absolute bottom-0 right-0 md:bottom-4 md:right-4',
  'bottom-center': 'absolute bottom-0 left-1/2 -translate-x-1/2 md:bottom-4',
  'bottom-left': 'absolute bottom-0 left-0 md:bottom-4 md:left-4',
}

const statusColors: Record<string, string> = {
  active: 'border-green-500 dark:border-green-400',
  folded: 'border-slate-400 dark:border-slate-600 opacity-60',
  allIn: 'border-orange-500 dark:border-orange-400',
  sitOut: 'border-slate-400 dark:border-slate-600 opacity-50',
  disconnected: 'border-red-500 dark:border-red-400 opacity-40',
}

const statusBadgeColors: Record<string, string> = {
  active: 'bg-green-500 dark:bg-green-600 text-white',
  folded: 'bg-slate-400 dark:bg-slate-600 text-white',
  allIn: 'bg-orange-500 dark:bg-orange-600 text-white',
  sitOut: 'bg-slate-400 dark:bg-slate-600 text-white',
  disconnected: 'bg-red-500 dark:bg-red-600 text-white',
}

function getAvatarUrl(playerId: string, playerName: string): string {
  const seed = playerName || playerId
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`
}

export function PlayerSeat({
  player,
  holeCards,
  isActive = false,
  isDealer = false,
  position,
}: PlayerSeatProps) {
  const formatChips = (centimes: number) => {
    return (centimes / 100).toFixed(2)
  }

  const avatarUrl = getAvatarUrl(player.id, player.name)

  return (
    <div className={`${positionClasses[position]} w-24 md:w-28`}>
      <div
        className={`rounded-lg border-2 ${statusColors[player.status]} bg-white dark:bg-slate-800 p-2 md:p-3 shadow-lg transition-all ${
          isActive ? 'ring-2 ring-yellow-400 dark:ring-yellow-300' : ''
        }`}
      >
        {/* Dealer Button */}
        {isDealer && (
          <div className="absolute -top-2 -right-2 w-6 h-6 md:w-7 md:h-7 rounded-full bg-white dark:bg-slate-700 border-2 border-yellow-500 dark:border-yellow-400 flex items-center justify-center text-xs font-bold text-yellow-600 dark:text-yellow-300 shadow-md">
            D
          </div>
        )}

        {/* Avatar */}
        <div className="flex justify-center mb-1">
          <img
            src={avatarUrl}
            alt={player.name}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-slate-300 dark:border-slate-600"
          />
        </div>

        {/* Name */}
        <p className="text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100 text-center truncate">
          {player.name}
        </p>

        {/* Chip Stack */}
        <p className="text-xs text-slate-600 dark:text-slate-400 text-center font-mono">
          ${formatChips(player.chipStack)}
        </p>

        {/* Current Bet */}
        {player.currentBet > 0 && (
          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 text-center">
            Bet: ${formatChips(player.currentBet)}
          </p>
        )}

        {/* Status Badge */}
        {player.status !== 'active' && (
          <div className={`text-xs font-semibold text-center mt-1 px-2 py-0.5 rounded ${statusBadgeColors[player.status]}`}>
            {player.status === 'folded' && 'Folded'}
            {player.status === 'allIn' && 'All-In'}
            {player.status === 'sitOut' && 'Sit Out'}
            {player.status === 'disconnected' && 'Offline'}
          </div>
        )}

        {/* Hole Cards */}
        {player.hasCards && holeCards && holeCards.length === 2 && (
          <div className="flex gap-1 justify-center mt-2">
            <Card card={holeCards[0]} size="sm" />
            <Card card={holeCards[1]} size="sm" />
          </div>
        )}

        {/* Hidden Cards Indicator */}
        {player.hasCards && (!holeCards || holeCards.length === 0) && (
          <div className="flex gap-1 justify-center mt-2">
            <Card card={null} faceDown size="sm" />
            <Card card={null} faceDown size="sm" />
          </div>
        )}
      </div>
    </div>
  )
}
