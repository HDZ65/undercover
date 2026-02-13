import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import type { PokerAction } from '@undercover/shared'

interface BetControlsProps {
  availableActions: PokerAction[]
  minBet: number
  maxBet: number
  potSize: number
  onAction: (action: PokerAction, amount?: number) => void
  disabled?: boolean
}

export function BetControls({
  availableActions,
  minBet,
  maxBet,
  potSize,
  onAction,
  disabled = false,
}: BetControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet)

  // Update bet amount when minBet changes
  useEffect(() => {
    setBetAmount(Math.max(minBet, Math.min(betAmount, maxBet)))
  }, [minBet, maxBet])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (disabled) return

      const key = e.key.toLowerCase()

      if (key === 'f' && availableActions.includes('fold')) {
        e.preventDefault()
        onAction('fold')
      } else if (key === 'c') {
        e.preventDefault()
        if (availableActions.includes('check')) {
          onAction('check')
        } else if (availableActions.includes('call')) {
          onAction('call')
        }
      } else if (key === 'r' && availableActions.includes('raise')) {
        e.preventDefault()
        onAction('raise', betAmount)
      } else if (key === 'a' && availableActions.includes('allIn')) {
        e.preventDefault()
        onAction('allIn')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [disabled, availableActions, betAmount, onAction])

  // Quick bet calculations
  const quickBets = {
    pot: potSize,
    halfPot: Math.floor(potSize / 2),
    twoPot: potSize * 2,
  }

  const handleQuickBet = (amount: number) => {
    const clamped = Math.max(minBet, Math.min(amount, maxBet))
    setBetAmount(clamped)
  }

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto p-4 bg-slate-900/80 dark:bg-slate-950/80 rounded-lg border border-slate-700 dark:border-slate-800 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Bet Slider Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-slate-200">Bet Amount</label>
          <span className="text-lg font-bold text-emerald-400">
            ${(betAmount / 100).toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min={minBet}
          max={maxBet}
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.currentTarget.value))}
          disabled={disabled || !availableActions.includes('raise')}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-emerald-500"
        />

        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>${(minBet / 100).toFixed(2)}</span>
          <span>${(maxBet / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Quick Bet Buttons */}
      {availableActions.includes('raise') && (
        <div className="mb-6 grid grid-cols-3 gap-2">
          <button
            onClick={() => handleQuickBet(quickBets.halfPot)}
            disabled={disabled}
            className="px-3 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded transition-colors"
            title="Half Pot"
          >
            1/2 Pot
          </button>
          <button
            onClick={() => handleQuickBet(quickBets.pot)}
            disabled={disabled}
            className="px-3 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded transition-colors"
            title="Pot"
          >
            Pot
          </button>
          <button
            onClick={() => handleQuickBet(quickBets.twoPot)}
            disabled={disabled}
            className="px-3 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded transition-colors"
            title="2x Pot"
          >
            2x Pot
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {/* Fold Button */}
        <motion.button
          onClick={() => onAction('fold')}
          disabled={disabled || !availableActions.includes('fold')}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          className="px-4 py-3 font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-12 flex items-center justify-center"
          title="Fold (F)"
        >
          <span className="hidden sm:inline">Fold</span>
          <span className="sm:hidden">F</span>
        </motion.button>

        {/* Check/Call Button */}
        {availableActions.includes('check') ? (
          <motion.button
            onClick={() => onAction('check')}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className="px-4 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-12 flex items-center justify-center"
            title="Check (C)"
          >
            <span className="hidden sm:inline">Check</span>
            <span className="sm:hidden">C</span>
          </motion.button>
        ) : availableActions.includes('call') ? (
          <motion.button
            onClick={() => onAction('call')}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className="px-4 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-12 flex items-center justify-center"
            title="Call (C)"
          >
            <span className="hidden sm:inline">Call</span>
            <span className="sm:hidden">C</span>
          </motion.button>
        ) : (
          <div className="px-4 py-3 bg-slate-800 rounded-lg opacity-30" />
        )}

        {/* Raise Button */}
        <motion.button
          onClick={() => onAction('raise', betAmount)}
          disabled={disabled || !availableActions.includes('raise')}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          className="px-4 py-3 font-bold text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-12 flex items-center justify-center"
          title="Raise (R)"
        >
          <span className="hidden sm:inline">Raise</span>
          <span className="sm:hidden">R</span>
        </motion.button>

        {/* All-In Button */}
        <motion.button
          onClick={() => onAction('allIn')}
          disabled={disabled || !availableActions.includes('allIn')}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          className="px-4 py-3 font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-12 flex items-center justify-center"
          title="All-In (A)"
        >
          <span className="hidden sm:inline">All-In</span>
          <span className="sm:hidden">A</span>
        </motion.button>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="mt-4 text-xs text-slate-400 text-center">
        Keyboard: <kbd className="bg-slate-800 px-1 rounded">F</kbd> Fold •{' '}
        <kbd className="bg-slate-800 px-1 rounded">C</kbd> Check/Call •{' '}
        <kbd className="bg-slate-800 px-1 rounded">R</kbd> Raise •{' '}
        <kbd className="bg-slate-800 px-1 rounded">A</kbd> All-In
      </div>
    </motion.div>
  )
}
