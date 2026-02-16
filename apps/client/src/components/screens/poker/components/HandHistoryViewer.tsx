import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { HandHistoryEntry } from '@undercover/shared'

interface HandHistoryViewerProps {
  history: HandHistoryEntry[]
  isOpen: boolean
  onClose: () => void
}

export function HandHistoryViewer({ history, isOpen, onClose }: HandHistoryViewerProps) {
  const [expandedHandId, setExpandedHandId] = useState<number | null>(null)

  const formatChips = (centimes: number): string => {
    return `€${(centimes / 100).toFixed(2)}`
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getWinnerName = (entry: HandHistoryEntry): string => {
    if (entry.winners.length === 0) return 'No winner'
    if (entry.winners.length === 1) {
      const winner = entry.players.find((p) => p.id === entry.winners[0].playerId)
      return winner?.name || 'Unknown'
    }
    return `${entry.winners.length} winners`
  }

  const getTotalWinnings = (entry: HandHistoryEntry): number => {
    return entry.winners.reduce((sum, w) => sum + w.amount, 0)
  }

  const exportAsText = (entry: HandHistoryEntry): string => {
    const lines: string[] = []

    // Header
    lines.push(`Main #${entry.handNumber} - Texas Hold'em No Limit`)
    lines.push(`Blinds: ${formatChips(entry.tableConfig.smallBlind)} / ${formatChips(entry.tableConfig.bigBlind)}`)
    lines.push(`Date: ${formatTimestamp(entry.timestamp)}`)
    lines.push('')

    // Players
    lines.push('Players:')
    entry.players.forEach((p) => {
      lines.push(`  Seat ${p.seatIndex + 1}: ${p.name} (${formatChips(p.startingStack)})`)
    })
    lines.push('')

    // Actions grouped by phase
    const actionsByPhase: Record<string, typeof entry.actions> = {}
    entry.actions.forEach((action) => {
      if (!actionsByPhase[action.phase]) {
        actionsByPhase[action.phase] = []
      }
      actionsByPhase[action.phase].push(action)
    })

    const phaseOrder = ['preFlop', 'flop', 'turn', 'river', 'showdown']
    phaseOrder.forEach((phase) => {
      if (actionsByPhase[phase]) {
        const phaseLabel = {
          preFlop: '*** HOLE CARDS ***',
          flop: '*** FLOP ***',
          turn: '*** TURN ***',
          river: '*** RIVER ***',
          showdown: '*** SHOWDOWN ***',
        }[phase]

        if (phaseLabel) {
          lines.push(phaseLabel)
        }

        // Add community cards for flop/turn/river
        if (phase === 'flop' && entry.communityCards[0]) {
          const cards = entry.communityCards[0].map((c) => `${c.rank}${c.suit[0].toUpperCase()}`).join(' ')
          lines.push(`[${cards}]`)
        } else if (phase === 'turn' && entry.communityCards[1]) {
          const cards = entry.communityCards[1].map((c) => `${c.rank}${c.suit[0].toUpperCase()}`).join(' ')
          lines.push(`[${cards}]`)
        } else if (phase === 'river' && entry.communityCards[2]) {
          const cards = entry.communityCards[2].map((c) => `${c.rank}${c.suit[0].toUpperCase()}`).join(' ')
          lines.push(`[${cards}]`)
        }

        // Add actions
        actionsByPhase[phase].forEach((action) => {
          const player = entry.players.find((p) => p.id === action.playerId)
          const playerName = player?.name || 'Unknown'

          let actionStr = `${playerName}: ${action.action}`
          if (action.amount !== undefined) {
            actionStr += ` ${formatChips(action.amount)}`
          }
          lines.push(actionStr)
        })

        lines.push('')
      }
    })

    // Winners
    if (entry.winners.length > 0) {
      lines.push('*** WINNERS ***')
      entry.winners.forEach((winner) => {
        const player = entry.players.find((p) => p.id === winner.playerId)
        lines.push(`${player?.name || 'Unknown'} wins ${formatChips(winner.amount)} (${winner.handDescription})`)
      })
    }

    return lines.join('\n')
  }

  const handleCopyToClipboard = (entry: HandHistoryEntry) => {
    const text = exportAsText(entry)
    navigator.clipboard.writeText(text).then(() => {
      // Show brief feedback (could add toast here)
      alert('Hand history copied to clipboard!')
    })
  }

  if (!isOpen) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hand History</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <p>No hand history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <AnimatePresence>
                  {history.map((entry, idx) => (
                    <motion.div
                      key={entry.handNumber}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      {/* Summary Row */}
                      <button
                        onClick={() =>
                          setExpandedHandId(expandedHandId === entry.handNumber ? null : entry.handNumber)
                        }
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              Hand #{entry.handNumber}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {formatTimestamp(entry.timestamp)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {getWinnerName(entry)}
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              {formatChips(getTotalWinnings(entry))}
                            </p>
                          </div>

                          <motion.div
                            animate={{ rotate: expandedHandId === entry.handNumber ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-slate-400"
                          >
                            ▼
                          </motion.div>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedHandId === entry.handNumber && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3"
                          >
                            {/* Players */}
                            <div>
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                                Players
                              </p>
                              <div className="space-y-1">
                                {entry.players.map((p) => (
                                  <p key={p.id} className="text-sm text-slate-700 dark:text-slate-300">
                                    {p.name} - {formatChips(p.startingStack)}
                                  </p>
                                ))}
                              </div>
                            </div>

                            {/* Actions Summary */}
                            <div>
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                                Actions ({entry.actions.length})
                              </p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {entry.actions.slice(0, 10).map((action, idx) => {
                                  const player = entry.players.find((p) => p.id === action.playerId)
                                  return (
                                    <p key={idx} className="text-xs text-slate-600 dark:text-slate-400">
                                      <span className="font-medium">{player?.name}:</span> {action.action}
                                      {action.amount !== undefined && ` ${formatChips(action.amount)}`}
                                    </p>
                                  )
                                })}
                                {entry.actions.length > 10 && (
                                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                    +{entry.actions.length - 10} more actions
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Winners */}
                            <div>
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                                Winners
                              </p>
                              <div className="space-y-1">
                                {entry.winners.map((winner) => {
                                  const player = entry.players.find((p) => p.id === winner.playerId)
                                  return (
                                    <p key={winner.playerId} className="text-sm text-green-600 dark:text-green-400">
                                      {player?.name} - {formatChips(winner.amount)} ({winner.handDescription})
                                    </p>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Export Button */}
                            <button
                              onClick={() => handleCopyToClipboard(entry)}
                              className="w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Copy as Text
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
