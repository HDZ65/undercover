import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameActor } from '../../hooks/useGameActor'

const TIMER_PRESETS = [30, 60, 90, 120, 180]

const vibrate = (duration: number = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}

export function GameMaster() {
  const [snapshot, send] = useGameActor()
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  const players = snapshot.context.players || []
  const alivePlayers = players.filter((p) => !p.isEliminated)
  const currentSpeakerIndex = snapshot.context.currentSpeakerIndex || 0
  const currentSpeaker = alivePlayers[currentSpeakerIndex]
  const timerDuration = snapshot.context.timerDuration || 60
  const currentRound = snapshot.context.currentRound || 1

  // Timer countdown effect
  useEffect(() => {
    if (!isTimerRunning || timeRemaining === null || timeRemaining <= 0) {
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          setIsTimerRunning(false)
          vibrate(200)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerRunning, timeRemaining])

  const handleStartTimer = () => {
    setTimeRemaining(timerDuration)
    setIsTimerRunning(true)
    vibrate(50)
  }

  const handlePauseTimer = () => {
    setIsTimerRunning(false)
    vibrate(30)
  }

  const handleResetTimer = () => {
    setTimeRemaining(timerDuration)
    setIsTimerRunning(false)
    vibrate(30)
  }

  const handleNextSpeaker = () => {
    send({ type: 'NEXT_SPEAKER' })
    vibrate(50)
    handleResetTimer()
  }

  const handleSetTimerDuration = (duration: number) => {
    send({ type: 'SET_TIMER_DURATION', duration })
    setTimeRemaining(duration)
    setIsTimerRunning(false)
    setShowPresets(false)
    vibrate(30)
  }

  const handleStartVoting = () => {
    vibrate(100)
    send({ type: 'START_VOTING' })
  }

  // Calculate circular progress
  const progress = timeRemaining !== null ? (timeRemaining / timerDuration) * 100 : 100
  const circumference = 2 * Math.PI * 120
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
          Tour {currentRound}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {alivePlayers.length} joueurs restants
        </p>
      </motion.div>

      {/* Circular Timer */}
      <motion.div
        className="flex-1 flex items-center justify-center mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="relative">
          {/* SVG Circle */}
          <svg className="w-64 h-64 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-slate-200 dark:text-slate-700"
            />
            {/* Progress circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${
                timeRemaining !== null && timeRemaining <= 10
                  ? 'text-red-500'
                  : 'text-blue-600 dark:text-blue-500'
              }`}
            />
          </svg>

          {/* Timer Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              className="text-6xl font-bold text-slate-900 dark:text-slate-100"
              animate={{
                scale: timeRemaining !== null && timeRemaining <= 10 && isTimerRunning ? [1, 1.1, 1] : 1,
              }}
              transition={{ duration: 1, repeat: timeRemaining !== null && timeRemaining <= 10 ? Infinity : 0 }}
            >
              {timeRemaining !== null ? Math.floor(timeRemaining / 60) : Math.floor(timerDuration / 60)}:
              {timeRemaining !== null
                ? String(timeRemaining % 60).padStart(2, '0')
                : String(timerDuration % 60).padStart(2, '0')}
            </motion.div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {isTimerRunning ? 'En cours...' : 'Prêt'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Timer Controls */}
      <motion.div
        className="flex gap-2 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {!isTimerRunning ? (
          <motion.button
            onClick={handleStartTimer}
            className="flex-1 min-h-[48px] px-4 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Démarrer
          </motion.button>
        ) : (
          <motion.button
            onClick={handlePauseTimer}
            className="flex-1 min-h-[48px] px-4 py-3 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Pause
          </motion.button>
        )}
        <motion.button
          onClick={handleResetTimer}
          className="min-h-[48px] min-w-[48px] px-4 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ↻
        </motion.button>
        <motion.button
          onClick={() => setShowPresets(!showPresets)}
          className="min-h-[48px] min-w-[48px] px-4 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ⚙
        </motion.button>
      </motion.div>

      {/* Timer Presets */}
      <AnimatePresence>
        {showPresets && (
          <motion.div
            className="flex gap-2 mb-6 flex-wrap"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {TIMER_PRESETS.map((preset) => (
              <motion.button
                key={preset}
                onClick={() => handleSetTimerDuration(preset)}
                className={`min-h-[44px] px-4 py-2 rounded-lg font-medium transition-all ${
                  timerDuration === preset
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {preset}s
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Speaker */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            Orateur actuel
          </p>
          {currentSpeaker ? (
            <div className="flex items-center gap-3">
              {currentSpeaker.avatar && (
                <img
                  src={currentSpeaker.avatar}
                  alt={currentSpeaker.name}
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700"
                />
              )}
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {currentSpeaker.name}
              </p>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Aucun orateur</p>
          )}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <motion.button
          onClick={handleNextSpeaker}
          className="w-full min-h-[56px] px-6 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-lg rounded-lg transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Orateur suivant
        </motion.button>
        <motion.button
          onClick={handleStartVoting}
          className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-500 dark:to-red-500 hover:from-rose-700 hover:to-red-700 dark:hover:from-rose-600 dark:hover:to-red-600 text-white font-bold text-lg rounded-lg shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Passer au vote
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
