import { useState } from 'react'
import { motion } from 'motion/react'
import type { PokerPublicState, Card as CardType } from '@undercover/shared'
import { PlayerSeat } from './components/PlayerSeat'
import { Card } from './components/Card'
import { PotDisplay } from './components/PotDisplay'

interface PokerTableProps {
  gameState?: PokerPublicState
  playerHoleCards?: CardType[] | null
  playerId?: string
}

// Mock data for development
const mockGameState: PokerPublicState = {
  phase: 'flop',
  communityCards: [
    { suit: 'hearts', rank: 'K' },
    { suit: 'diamonds', rank: 'Q' },
    { suit: 'clubs', rank: 'J' },
  ],
  pots: [
    {
      amount: 50000,
      eligiblePlayerIds: ['p1', 'p2', 'p3', 'p4'],
    },
  ],
  currentBet: 10000,
  minRaise: 10000,
  dealerSeatIndex: 0,
  activeSeatIndex: 2,
  players: [
    {
      id: 'p1',
      name: 'Alice',
      chipStack: 150000,
      status: 'active',
      seatIndex: 0,
      currentBet: 10000,
      hasCards: true,
      avatar: 'alice',
    },
    {
      id: 'p2',
      name: 'Bob',
      chipStack: 200000,
      status: 'active',
      seatIndex: 1,
      currentBet: 10000,
      hasCards: true,
      avatar: 'bob',
    },
    {
      id: 'p3',
      name: 'Charlie',
      chipStack: 100000,
      status: 'active',
      seatIndex: 2,
      currentBet: 10000,
      hasCards: true,
      avatar: 'charlie',
    },
    {
      id: 'p4',
      name: 'Diana',
      chipStack: 175000,
      status: 'folded',
      seatIndex: 3,
      currentBet: 0,
      hasCards: false,
      avatar: 'diana',
    },
    {
      id: 'p5',
      name: 'Eve',
      chipStack: 125000,
      status: 'active',
      seatIndex: 4,
      currentBet: 10000,
      hasCards: true,
      avatar: 'eve',
    },
    {
      id: 'p6',
      name: 'Frank',
      chipStack: 90000,
      status: 'allIn',
      seatIndex: 5,
      currentBet: 5000,
      hasCards: true,
      avatar: 'frank',
    },
  ],
  handNumber: 1,
  tableConfig: {
    maxPlayers: 6,
    smallBlind: 5000,
    bigBlind: 10000,
    minBuyIn: 100000,
    maxBuyIn: 1000000,
    actionTimeoutMs: 30000,
    straddleEnabled: false,
    runItTwiceEnabled: false,
  },
}

const mockHoleCards: CardType[] = [
  { suit: 'spades', rank: 'A' },
  { suit: 'hearts', rank: 'K' },
]

export function PokerTable({
  gameState = mockGameState,
  playerHoleCards = mockHoleCards,
  playerId = 'p3',
}: PokerTableProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)

  // Seat positions for 6-max table (oval layout)
  // Top row: 0 (left), 1 (center), 2 (right)
  // Bottom row: 5 (left), 4 (center), 3 (right)
  const seatPositions: Array<'top-left' | 'top-center' | 'top-right' | 'bottom-right' | 'bottom-center' | 'bottom-left'> = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-right',
    'bottom-center',
    'bottom-left',
  ]

  const totalPot = gameState.pots.reduce((sum, pot) => sum + pot.amount, 0)

  return (
    <motion.div
      className="w-full h-screen bg-gradient-to-br from-green-700 via-green-600 to-green-800 dark:from-green-900 dark:via-green-800 dark:to-green-950 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full max-w-6xl aspect-video relative">
        {/* Table Felt */}
        <div className="absolute inset-0 rounded-full border-8 border-slate-800 dark:border-slate-900 bg-gradient-to-br from-green-600 to-green-800 dark:from-green-800 dark:to-green-900 shadow-2xl overflow-hidden">
          {/* Subtle texture */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_50%,white,transparent_50%)]" />

          {/* Player Seats */}
          {gameState.players.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              onClick={() => setSelectedSeat(player.seatIndex)}
              className="cursor-pointer"
            >
              <PlayerSeat
                player={player}
                holeCards={player.id === playerId ? playerHoleCards : undefined}
                isActive={gameState.activeSeatIndex === player.seatIndex}
                isDealer={gameState.dealerSeatIndex === player.seatIndex}
                position={seatPositions[player.seatIndex]}
              />
            </motion.div>
          ))}

          {/* Center Area: Community Cards + Pot */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 md:gap-8">
            {/* Community Cards */}
            <motion.div
              className="flex gap-2 md:gap-3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {/* Flop (3 cards) */}
              {gameState.phase !== 'preFlop' && gameState.communityCards.length >= 3 && (
                <>
                  {gameState.communityCards.slice(0, 3).map((card, idx) => (
                    <motion.div
                      key={`flop-${idx}`}
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: 0.4 + idx * 0.1, duration: 0.3 }}
                    >
                      <Card card={card} size="md" />
                    </motion.div>
                  ))}
                </>
              )}

              {/* Turn (1 card) */}
              {gameState.phase !== 'preFlop' && gameState.phase !== 'flop' && gameState.communityCards.length >= 4 && (
                <motion.div
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ delay: 0.7, duration: 0.3 }}
                >
                  <Card card={gameState.communityCards[3]} size="md" />
                </motion.div>
              )}

              {/* River (1 card) */}
              {gameState.phase === 'river' && gameState.communityCards.length >= 5 && (
                <motion.div
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ delay: 0.8, duration: 0.3 }}
                >
                  <Card card={gameState.communityCards[4]} size="md" />
                </motion.div>
              )}

              {/* Empty slots for unrevealed cards */}
              {gameState.phase === 'preFlop' && (
                <>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Card key={`empty-${idx}`} card={null} faceDown size="md" />
                  ))}
                </>
              )}
              {gameState.phase === 'flop' && (
                <>
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <Card key={`empty-${idx}`} card={null} faceDown size="md" />
                  ))}
                </>
              )}
              {gameState.phase === 'turn' && (
                <Card key="empty-river" card={null} faceDown size="md" />
              )}
            </motion.div>

            {/* Pot Display */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <PotDisplay mainPot={totalPot} sidePots={gameState.pots.slice(1)} />
            </motion.div>
          </div>

          {/* Game Info Bar */}
          <div className="absolute bottom-4 left-4 right-4 bg-black/40 dark:bg-black/60 rounded-lg px-4 py-2 text-white text-xs md:text-sm font-mono">
            <div className="flex justify-between items-center gap-4">
              <span>Hand #{gameState.handNumber}</span>
              <span>Phase: {gameState.phase}</span>
              <span>
                Blinds: ${(gameState.tableConfig.smallBlind / 100).toFixed(2)} / $
                {(gameState.tableConfig.bigBlind / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Info (for debugging) */}
      {selectedSeat !== null && (
        <motion.div
          className="absolute top-4 right-4 bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg max-w-xs"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          <button
            onClick={() => setSelectedSeat(null)}
            className="absolute top-2 right-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Seat {selectedSeat + 1}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {gameState.players[selectedSeat]?.name || 'Empty'}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
