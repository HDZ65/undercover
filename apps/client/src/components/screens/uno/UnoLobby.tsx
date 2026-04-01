import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import type { CardColor, PlayerScore, PublicPlayer } from '@uno/shared'
import { UnoCard } from './UnoCard'
import { UnoAnimationOverlay } from './UnoAnimationOverlay'
import { UnoParticles } from './UnoParticles'
import { useUnoSocket } from './hooks/useUnoSocket'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

type LandingMode = 'create' | 'join'

interface UnoLobbyProps {
  onBack?: () => void
}

const CARD_COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow']

const COLOR_BADGES: Record<CardColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
}

const COLOR_BUTTONS: Record<CardColor, { bg: string; glow: string }> = {
  red: { bg: 'from-red-500 to-rose-600', glow: '0 0 25px rgba(239,68,68,0.5)' },
  blue: { bg: 'from-blue-500 to-indigo-600', glow: '0 0 25px rgba(59,130,246,0.5)' },
  green: { bg: 'from-emerald-500 to-green-600', glow: '0 0 25px rgba(16,185,129,0.5)' },
  yellow: { bg: 'from-yellow-400 to-amber-500', glow: '0 0 25px rgba(245,158,11,0.5)' },
}

function getRoundWinner(scores: PlayerScore[]): PlayerScore | null {
  let winner: PlayerScore | null = null
  for (const score of scores) {
    if (!winner || score.roundScore > winner.roundScore) {
      winner = score
    }
  }

  if (!winner || winner.roundScore <= 0) {
    return null
  }

  return winner
}

function getGameWinner(scores: PlayerScore[]): PlayerScore | null {
  let winner: PlayerScore | null = null
  for (const score of scores) {
    if (!winner || score.totalScore > winner.totalScore) {
      winner = score
    }
  }
  return winner
}

function fireConfetti() {
  const duration = 2500
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'],
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }
  frame()
}

export function UnoLobby({ onBack }: UnoLobbyProps) {
  const [mode, setMode] = useState<LandingMode>('create')
  const [playerName, setPlayerName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const prevDiscardIdRef = useRef<string | null>(null)
  const [discardSlam, setDiscardSlam] = useState(false)

  const {
    connected,
    error,
    publicState,
    privateState,
    phase,
    playerId,
    roomCode,
    isHost,
    isMyTurn,
    myHand,
    canDraw,
    canCallUno,
    canCatchUno,
    mustChooseColor,
    lastAnimation,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playCard,
    playCards,
    drawCard,
    callUno,
    catchUno,
    chooseColor,
    challengeWD4,
    acceptWD4,
    continueNextRound,
    resetGame,
    clearAnimation,
  } = useUnoSocket()
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())

  // Clear selection when turn changes or phase changes
  const { setConnected: setGlobalConnected } = useConnectionStatus()
  useEffect(() => { setGlobalConnected(connected) }, [connected, setGlobalConnected])

  useEffect(() => {
    setSelectedCardIds(new Set())
  }, [publicState?.currentPlayerId, phase])

  // Discard slam animation trigger
  useEffect(() => {
    const discardId = publicState?.discardTop?.id ?? null
    if (discardId && discardId !== prevDiscardIdRef.current) {
      if (prevDiscardIdRef.current !== null) {
        setDiscardSlam(true)
        const timer = setTimeout(() => setDiscardSlam(false), 400)
        return () => clearTimeout(timer)
      }
      prevDiscardIdRef.current = discardId
    }
  }, [publicState?.discardTop?.id])

  // Confetti on round/game over
  useEffect(() => {
    if (phase === 'roundOver' || phase === 'gameOver') {
      fireConfetti()
    }
  }, [phase])

  const isNumericCard = useCallback((cardId: string) => {
    const card = myHand.find((c) => c.id === cardId)
    if (!card) return false
    return typeof card.value === 'string' && /^[0-9]$/.test(card.value)
  }, [myHand])

  const getCardValue = useCallback((cardId: string) => {
    return myHand.find((c) => c.id === cardId)?.value ?? null
  }, [myHand])

  const handleCardClick = useCallback((cardId: string) => {
    const card = myHand.find((c) => c.id === cardId)
    if (!card || !isMyTurn) return

    // Non-numeric cards: play immediately (no multi-select)
    if (!isNumericCard(cardId)) {
      setSelectedCardIds(new Set())
      playCard(cardId)
      return
    }

    // Numeric card: toggle selection for multi-card play
    setSelectedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
        return next
      }

      // Only allow selecting cards with same numeric value
      const clickedValue = getCardValue(cardId)
      for (const selectedId of next) {
        if (getCardValue(selectedId) !== clickedValue) {
          next.clear()
          break
        }
      }
      next.add(cardId)
      return next
    })
  }, [myHand, isMyTurn, isNumericCard, getCardValue, playCard])

  const handlePlaySelected = useCallback(() => {
    if (selectedCardIds.size === 0) return
    if (selectedCardIds.size === 1) {
      playCard([...selectedCardIds][0])
    } else {
      playCards([...selectedCardIds])
    }
    setSelectedCardIds(new Set())
  }, [selectedCardIds, playCard, playCards])

  const playableCardIds = useMemo(
    () => new Set((privateState?.canPlayCards ?? []).map((card) => card.id)),
    [privateState?.canPlayCards],
  )

  const playerNameById = useMemo(() => {
    const entries = (publicState?.players ?? []).map((player) => [player.id, player.name] as const)
    return new Map(entries)
  }, [publicState?.players])

  const catchablePlayers = useMemo(
    () =>
      (publicState?.players ?? []).filter(
        (player) => player.id !== playerId && player.handSize === 1 && !player.hasCalledUno,
      ),
    [playerId, publicState?.players],
  )

  const turnTimeRemaining = publicState?.turnTimeRemaining ?? 0
  const timerIsUrgent = turnTimeRemaining > 0 && turnTimeRemaining <= 10

  const turnTimeLabel = useMemo(() => {
    return `${Math.floor(turnTimeRemaining / 60)
      .toString()
      .padStart(2, '0')}:${(turnTimeRemaining % 60).toString().padStart(2, '0')}`
  }, [turnTimeRemaining])

  const handleCreate = () => {
    createRoom(playerName)
  }

  const handleJoin = () => {
    joinRoom(joinRoomCode, playerName)
  }

  const handleLeave = () => {
    leaveRoom()
    if (onBack) {
      onBack()
    }
  }

  const tabClass = (tab: LandingMode) =>
    `min-h-[48px] rounded-lg font-semibold transition-all text-sm ${
      mode === tab
        ? 'bg-gradient-to-r from-red-500 to-yellow-500 text-white shadow-md'
        : 'text-slate-700 dark:text-slate-300'
    }`

  const renderConnectionInfo = () => (
    <div className="mt-4 text-sm text-center">
      <span className={connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
        {connected ? 'Connecte au serveur UNO' : 'Connexion au serveur UNO...'}
      </span>
      {error && <p className="text-rose-600 dark:text-rose-400 mt-2">{error}</p>}
    </div>
  )

  const LandingView = () => (
    <motion.div
      className="w-full max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
        <motion.h1
          className="text-5xl md:text-6xl font-bold text-center tracking-tight mb-2"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 bg-clip-text text-transparent">
            UNO
          </span>
        </motion.h1>

        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">Multijoueur en temps reel</p>

        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/70">
          <button onClick={() => setMode('create')} className={tabClass('create')}>
            Creer
          </button>
          <button onClick={() => setMode('join')} className={tabClass('join')}>
            Rejoindre
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {mode === 'join' && (
              <input
                type="text"
                value={joinRoomCode}
                onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
                placeholder="Code de la salle"
                className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                maxLength={8}
              />
            )}

            <input
              type="text"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Nom du joueur"
              className="w-full min-h-[56px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              maxLength={24}
            />

            <motion.button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 hover:from-red-600 hover:to-yellow-600 text-white font-bold text-lg rounded-lg shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {mode === 'create' ? 'Creer une partie' : 'Rejoindre une partie'}
            </motion.button>
          </motion.div>
        </AnimatePresence>

        {renderConnectionInfo()}

        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Retour aux jeux
          </button>
        )}
      </div>
    </motion.div>
  )

  const LobbyView = () => (
    <motion.div
      className="w-full max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
        <h1 className="text-5xl md:text-6xl font-bold text-center tracking-tight mb-2">
          <span className="bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 bg-clip-text text-transparent">
            UNO
          </span>
        </h1>

        <div className="text-center mb-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">Code de la salle</p>
          <p className="text-3xl font-black tracking-wider text-slate-900 dark:text-slate-100">
            {publicState?.roomCode ?? roomCode}
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Joueurs ({publicState?.players.length ?? 0})
          </p>
          <AnimatePresence>
            {(publicState?.players ?? []).map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{player.name}</span>
                <div className="flex items-center gap-2">
                  {!player.isConnected && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-300/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      Hors ligne
                    </span>
                  )}
                  {player.id === publicState?.hostId && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                      Hote
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {isHost && (publicState?.players.length ?? 0) >= 2 && (
          <motion.button
            onClick={() => startGame()}
            className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-red-500 to-yellow-500 dark:from-red-400 dark:to-yellow-400 hover:from-red-600 hover:to-yellow-600 text-white font-bold text-lg rounded-lg shadow-lg mb-4"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Lancer la partie
          </motion.button>
        )}

        {isHost && (publicState?.players.length ?? 0) < 2 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">
            En attente d'autres joueurs...
          </p>
        )}

        {renderConnectionInfo()}

        <button
          onClick={handleLeave}
          className="mt-4 w-full min-h-[44px] text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          ← Quitter la salle
        </button>
      </div>
    </motion.div>
  )

  const GameBoardView = () => {
    const players = publicState?.players ?? []
    const discardTop = publicState?.discardTop ?? null
    const currentPlayer = players.find((player) => player.id === publicState?.currentPlayerId)
    const activeColor = discardTop?.color
    const handSize = myHand.length

    return (
      <motion.div
        className="w-full max-w-7xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Game board with animated gradient bg */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          {/* Outer glow border */}
          <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 opacity-60" />

          <div className="relative rounded-3xl uno-gradient-bg text-white p-4 md:p-6 min-h-[76vh] flex flex-col gap-5">
            {/* Floating particles background */}
            <UnoParticles />

            {/* Turn announcement banner */}
            <AnimatePresence>
              {isMyTurn && (
                <motion.div
                  initial={{ y: -60, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -40, opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative z-10 mx-auto rounded-2xl px-8 py-3 uno-pulse-glow"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(245,158,11,0.25))',
                    border: '1px solid rgba(250,204,21,0.4)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <motion.p
                    className="text-center font-black text-lg tracking-wide"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24, #ef4444)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    A vous de jouer !
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top bar: Room info + Direction + Timer */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Salle</p>
                <p className="text-2xl font-black tracking-wider">{publicState?.roomCode ?? roomCode}</p>
              </div>

              {/* Animated direction indicator */}
              <motion.div
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm"
                animate={publicState?.playDirection === 'counterclockwise'
                  ? { rotate: [0, -10, 0] }
                  : { rotate: [0, 10, 0] }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                key={publicState?.playDirection}
              >
                <span className="text-xs uppercase tracking-wider text-white/70">Direction</span>
                <motion.span
                  className="text-2xl leading-none"
                  animate={{ rotate: publicState?.playDirection === 'counterclockwise' ? -360 : 360 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  key={`dir-${publicState?.playDirection}`}
                >
                  {publicState?.playDirection === 'counterclockwise' ? '↺' : '↻'}
                </motion.span>
              </motion.div>

              {/* Timer with urgency */}
              <motion.div
                className={`rounded-2xl border px-4 py-2 text-right backdrop-blur-sm ${
                  timerIsUrgent
                    ? 'border-red-400/60 bg-red-500/20 uno-urgency'
                    : 'border-white/20 bg-black/30'
                }`}
                animate={timerIsUrgent ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={timerIsUrgent ? { duration: 0.6, repeat: Infinity } : {}}
              >
                <p className="text-xs uppercase tracking-wider text-white/60">Tour actuel</p>
                <p className="font-bold">{currentPlayer?.name ?? 'En attente...'}</p>
                <p className={`text-sm font-mono font-bold ${timerIsUrgent ? 'text-red-300' : 'text-white/70'}`}>
                  {turnTimeLabel}
                </p>
              </motion.div>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 items-start">
              {/* Player panel with animated highlights */}
              <div className="rounded-2xl border border-white/15 bg-black/30 backdrop-blur-sm p-3 space-y-2">
                <p className="text-sm font-semibold text-white/80">Joueurs</p>
                <AnimatePresence>
                  {players.map((player: PublicPlayer) => {
                    const isCurrent = publicState?.currentPlayerId === player.id
                    const isSelf = player.id === playerId
                    return (
                      <motion.div
                        key={player.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`rounded-xl px-3 py-2 border transition-all duration-300 ${
                          isCurrent
                            ? 'border-yellow-300/70 bg-yellow-300/15 uno-turn-ring'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <motion.div
                                className="w-2 h-2 rounded-full bg-yellow-400"
                                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            )}
                            <p className="font-semibold text-sm truncate">
                              {player.name}
                              {isSelf ? ' (vous)' : ''}
                            </p>
                          </div>
                          <span className="text-xs text-white/70 tabular-nums">{player.handSize} cartes</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-white/75">
                          {player.id === publicState?.hostId && <span>Hote</span>}
                          {player.hasCalledUno && (
                            <motion.span
                              className="text-yellow-200 font-black"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.5, repeat: 3 }}
                            >
                              UNO!
                            </motion.span>
                          )}
                          {!player.isConnected && <span className="text-rose-300">Hors ligne</span>}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {canCatchUno && catchablePlayers.length > 0 && (
                  <div className="pt-2 border-t border-white/15 space-y-2">
                    <p className="text-xs uppercase tracking-wider text-white/60">Attraper UNO</p>
                    {catchablePlayers.map((player) => (
                      <motion.button
                        key={player.id}
                        onClick={() => catchUno(player.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className="w-full rounded-lg bg-rose-500/80 hover:bg-rose-500 px-3 py-2 text-sm font-semibold"
                      >
                        Penaliser {player.name}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Main game area */}
              <div className="flex flex-col gap-4">
                {/* Draw + Discard area */}
                <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-4 md:p-6">
                  {/* Draw pile */}
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Pioche</p>
                    <motion.button
                      onClick={drawCard}
                      disabled={!canDraw}
                      whileHover={canDraw ? { y: -5, scale: 1.04 } : undefined}
                      whileTap={canDraw ? { scale: 0.96 } : undefined}
                      className={`relative w-24 h-36 rounded-2xl border-2 shadow-lg overflow-hidden ${
                        canDraw
                          ? 'border-white/80 bg-gradient-to-br from-slate-800 via-slate-900 to-black uno-draw-pulse cursor-pointer'
                          : 'border-white/20 bg-slate-900/60 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
                      <div className="absolute inset-3 rounded-[40%] border-2 border-white/15 bg-gradient-to-br from-red-600/30 via-yellow-500/20 to-blue-600/30" />
                      {canDraw && <div className="absolute inset-0 uno-shimmer rounded-2xl" />}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="font-black text-xl relative z-10" style={{
                          textShadow: '0 0 10px rgba(255,255,255,0.2)',
                        }}>UNO</p>
                        <p className="text-xs text-white/75 mt-1 relative z-10 tabular-nums">
                          {publicState?.drawPileSize ?? 0} cartes
                        </p>
                      </div>
                    </motion.button>
                  </div>

                  {/* Discard pile with slam animation */}
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Defausse</p>
                    <div className="flex items-center gap-3">
                      <div className={discardSlam ? 'uno-card-slam' : ''}>
                        <UnoCard card={discardTop} disabled className="pointer-events-none" />
                      </div>
                      <div className="min-w-20 text-left">
                        <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Couleur</p>
                        <div className="flex items-center gap-2">
                          <motion.span
                            className={`w-5 h-5 rounded-full border-2 border-white/40 ${
                              activeColor ? COLOR_BADGES[activeColor] : 'bg-slate-500'
                            }`}
                            key={activeColor}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          />
                          <span className="text-sm font-semibold capitalize">{activeColor ?? 'wild'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Player hand */}
                <div className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm font-semibold text-white/85">Votre main ({handSize})</p>
                    <div className="flex items-center gap-2">
                      {/* Multi-card play button */}
                      <AnimatePresence>
                        {selectedCardIds.size > 0 && (
                          <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            onClick={handlePlaySelected}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-black text-white shadow-lg"
                            style={{ boxShadow: '0 0 20px rgba(6,182,212,0.4)' }}
                          >
                            Jouer {selectedCardIds.size > 1 ? `${selectedCardIds.size} cartes` : '1 carte'}
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* UNO call button — dramatic */}
                      <AnimatePresence>
                        {canCallUno && (
                          <motion.button
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{
                              scale: [1, 1.08, 1],
                              rotate: [0, -3, 3, 0],
                            }}
                            exit={{ scale: 0, rotate: 20 }}
                            transition={{
                              scale: { duration: 0.8, repeat: Infinity },
                              rotate: { duration: 0.5, repeat: Infinity },
                            }}
                            onClick={callUno}
                            whileTap={{ scale: 0.9 }}
                            className="rounded-xl px-5 py-2 text-sm font-black text-white shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #ef4444, #f59e0b, #ef4444)',
                              backgroundSize: '200% 200%',
                              animation: 'uno-gradient-shift 2s ease infinite',
                              boxShadow: '0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(245,158,11,0.3)',
                            }}
                          >
                            UNO !
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Turn indicator */}
                      <span className={`text-sm font-semibold ${isMyTurn ? 'text-yellow-200' : 'text-white/50'}`}>
                        {isMyTurn ? '' : 'En attente...'}
                      </span>
                    </div>
                  </div>

                  {/* Fan-shaped hand with staggered entry */}
                  <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max items-end justify-center" style={{ paddingTop: '1rem' }}>
                      <AnimatePresence mode="popLayout">
                        {myHand.map((card, index) => {
                          const playable = playableCardIds.has(card.id)
                          const selected = selectedCardIds.has(card.id)
                          // Fan angle: spread cards in an arc
                          const centerIndex = (handSize - 1) / 2
                          const offset = index - centerIndex
                          const fanAngle = handSize > 5 ? offset * 3 : offset * 5
                          const fanY = Math.abs(offset) * (handSize > 8 ? 3 : 5)
                          const marginValue = handSize > 7 ? -10 : handSize > 4 ? -4 : 4

                          return (
                            <motion.div
                              key={card.id}
                              layout
                              initial={{ opacity: 0, y: 40, scale: 0.8 }}
                              animate={{
                                opacity: 1,
                                y: selected ? -fanY - 16 : fanY,
                                scale: 1,
                                rotate: fanAngle,
                              }}
                              exit={{ opacity: 0, y: -30, scale: 0.6 }}
                              transition={{
                                layout: { type: 'spring', stiffness: 300, damping: 25 },
                                opacity: { delay: index * 0.03 },
                                y: { type: 'spring', stiffness: 350, damping: 25 },
                              }}
                              style={{ marginLeft: index === 0 ? 0 : marginValue, zIndex: selected ? 50 : index }}
                            >
                              <UnoCard
                                card={card}
                                playable={playable}
                                selected={selected}
                                disabled={!playable || !isMyTurn}
                                onClick={playable && isMyTurn ? () => handleCardClick(card.id) : undefined}
                              />
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wild+4 challenge bar */}
            <AnimatePresence>
              {phase === 'challengeWD4' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="relative z-10 rounded-2xl border border-amber-300/60 bg-amber-500/15 backdrop-blur-sm p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm uppercase tracking-wider text-amber-100/80">Wild +4</p>
                    <p className="font-semibold">Choisissez: contester ou accepter la penalite.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={challengeWD4}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="rounded-lg bg-rose-500 hover:bg-rose-400 px-4 py-2 text-sm font-semibold shadow-lg"
                      style={{ boxShadow: '0 0 15px rgba(239,68,68,0.4)' }}
                    >
                      Contester
                    </motion.button>
                    <motion.button
                      onClick={acceptWD4}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold shadow-lg"
                      style={{ boxShadow: '0 0 15px rgba(16,185,129,0.4)' }}
                    >
                      Accepter
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Color choice modal — dramatic */}
            <AnimatePresence>
              {mustChooseColor && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 10 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl"
                    style={{ boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 120px rgba(168,85,247,0.15)' }}
                  >
                    <p className="text-sm uppercase tracking-wider text-white/60 mb-4 text-center font-semibold">
                      Choisir une couleur
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {CARD_COLORS.map((color, index) => (
                        <motion.button
                          key={color}
                          onClick={() => chooseColor(color)}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: index * 0.08, type: 'spring', stiffness: 400, damping: 15 }}
                          whileHover={{ scale: 1.08, boxShadow: COLOR_BUTTONS[color].glow }}
                          whileTap={{ scale: 0.92 }}
                          className={`rounded-xl bg-gradient-to-br ${COLOR_BUTTONS[color].bg} px-4 py-5 text-sm font-black uppercase shadow-lg text-white`}
                        >
                          {color}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom bar */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-sm">
              {renderConnectionInfo()}
              <button
                onClick={handleLeave}
                className="rounded-lg border border-white/25 px-3 py-1.5 text-white/80 hover:text-white hover:border-white/50 transition-colors"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>

        <UnoAnimationOverlay animation={lastAnimation} onComplete={clearAnimation} />
      </motion.div>
    )
  }

  const RoundOverView = () => {
    const scores = publicState?.scores ?? []
    const roundWinner = getRoundWinner(scores)

    return (
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.4 }}
      >
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
          <motion.h2
            className="text-3xl md:text-4xl font-black text-center mb-2 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Manche terminee
          </motion.h2>
          <motion.p
            className="text-center text-slate-600 dark:text-slate-300 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {roundWinner
              ? `${playerNameById.get(roundWinner.playerId) ?? 'Joueur'} gagne ${roundWinner.roundScore} points`
              : 'Aucun point attribue sur cette manche'}
          </motion.p>

          <div className="space-y-2 mb-6">
            {scores
              .slice()
              .sort((left, right) => right.totalScore - left.totalScore)
              .map((score, index) => (
                <motion.div
                  key={score.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.08 }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {index === 0 && <span className="text-lg">🏆</span>}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {playerNameById.get(score.playerId) ?? score.playerId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.span
                      className="text-sm font-bold text-emerald-500"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + index * 0.08, type: 'spring' }}
                    >
                      +{score.roundScore}
                    </motion.span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                      Total {score.totalScore}
                    </span>
                  </div>
                </motion.div>
              ))}
          </div>

          {isHost && (
            <motion.button
              onClick={continueNextRound}
              className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 text-white font-black shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Continuer
            </motion.button>
          )}

          {!isHost && <p className="text-center text-sm text-slate-500 mt-3">L'hote prepare la prochaine manche...</p>}
        </div>
      </motion.div>
    )
  }

  const GameOverView = () => {
    const scores = publicState?.scores ?? []
    const winner = getGameWinner(scores)

    return (
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl p-6 md:p-8 overflow-hidden relative">
          {/* Victory glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.6), transparent 70%)' }} />

          <motion.div
            className="text-6xl text-center mb-2"
            initial={{ y: -30, scale: 0 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.1 }}
          >
            🏆
          </motion.div>

          <motion.h2
            className="text-3xl md:text-4xl font-black text-center mb-2 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Partie terminee
          </motion.h2>

          <motion.p
            className="text-center text-slate-600 dark:text-slate-300 mb-6 text-lg font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Vainqueur: {winner ? playerNameById.get(winner.playerId) ?? winner.playerId : 'N/A'}
          </motion.p>

          <div className="space-y-2 mb-6 relative">
            {scores
              .slice()
              .sort((left, right) => right.totalScore - left.totalScore)
              .map((score, index) => (
                <motion.div
                  key={score.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`rounded-xl border p-3 flex items-center justify-between ${
                    index === 0
                      ? 'border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400 w-6">#{index + 1}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {playerNameById.get(score.playerId) ?? score.playerId}
                    </span>
                  </div>
                  <motion.span
                    className="text-lg font-black text-slate-700 dark:text-slate-200 tabular-nums"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1, type: 'spring' }}
                  >
                    {score.totalScore} pts
                  </motion.span>
                </motion.div>
              ))}
          </div>

          <motion.button
            onClick={resetGame}
            className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 text-white font-black shadow-lg relative"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Nouvelle partie
          </motion.button>
        </div>
      </motion.div>
    )
  }

  switch (phase) {
    case null:
      return LandingView()
    case 'lobby':
      return LobbyView()
    case 'dealing':
    case 'playerTurn':
    case 'colorChoice':
    case 'challengeWD4':
      return GameBoardView()
    case 'roundOver':
      return RoundOverView()
    case 'gameOver':
      return GameOverView()
    default:
      return LandingView()
  }
}
