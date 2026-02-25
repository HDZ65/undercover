import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CardColor, PlayerScore, PublicPlayer } from '@uno/shared'
import { UnoCard } from './UnoCard'
import { useUnoSocket } from './hooks/useUnoSocket'

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

const COLOR_BUTTONS: Record<CardColor, string> = {
  red: 'from-red-500 to-rose-600',
  blue: 'from-blue-500 to-indigo-600',
  green: 'from-emerald-500 to-green-600',
  yellow: 'from-yellow-400 to-amber-500',
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

export function UnoLobby({ onBack }: UnoLobbyProps) {
  const [mode, setMode] = useState<LandingMode>('create')
  const [playerName, setPlayerName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')

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
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playCard,
    drawCard,
    callUno,
    catchUno,
    chooseColor,
    challengeWD4,
    acceptWD4,
    continueNextRound,
    resetGame,
  } = useUnoSocket()

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

  const turnTimeLabel = useMemo(() => {
    const seconds = publicState?.turnTimeRemaining ?? 0
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  }, [publicState?.turnTimeRemaining])

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
          {(publicState?.players ?? []).map((player) => (
            <div
              key={player.id}
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
            </div>
          ))}
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

    return (
      <motion.div
        className="w-full max-w-7xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl border border-slate-200/50 dark:border-slate-700/70 bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 p-[1px] shadow-2xl">
          <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/90 text-white backdrop-blur-md p-4 md:p-6 min-h-[76vh] flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Salle</p>
                <p className="text-2xl font-black tracking-wider">{publicState?.roomCode ?? roomCode}</p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
                <span className="text-xs uppercase tracking-wider text-white/70">Direction</span>
                <span className="text-xl leading-none">
                  {publicState?.playDirection === 'counterclockwise' ? '↺' : '↻'}
                </span>
              </div>

              <div className="rounded-2xl border border-white/20 bg-black/30 px-4 py-2 text-right">
                <p className="text-xs uppercase tracking-wider text-white/60">Tour actuel</p>
                <p className="font-bold">{currentPlayer?.name ?? 'En attente...'}</p>
                <p className="text-sm text-white/70">{turnTimeLabel}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 items-start">
              <div className="rounded-2xl border border-white/20 bg-black/25 p-3 space-y-2">
                <p className="text-sm font-semibold text-white/80">Joueurs</p>
                {players.map((player: PublicPlayer) => {
                  const isCurrent = publicState?.currentPlayerId === player.id
                  const isSelf = player.id === playerId
                  return (
                    <div
                      key={player.id}
                      className={`rounded-xl px-3 py-2 border transition-all ${
                        isCurrent
                          ? 'border-yellow-300/90 bg-yellow-300/15'
                          : 'border-white/15 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">
                          {player.name}
                          {isSelf ? ' (vous)' : ''}
                        </p>
                        <span className="text-xs text-white/70">{player.handSize} cartes</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/75">
                        {player.id === publicState?.hostId && <span>Hote</span>}
                        {player.hasCalledUno && <span className="text-yellow-200 font-semibold">UNO!</span>}
                        {!player.isConnected && <span className="text-rose-300">Hors ligne</span>}
                      </div>
                    </div>
                  )
                })}

                {canCatchUno && catchablePlayers.length > 0 && (
                  <div className="pt-2 border-t border-white/15 space-y-2">
                    <p className="text-xs uppercase tracking-wider text-white/60">Attraper UNO</p>
                    {catchablePlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => catchUno(player.id)}
                        className="w-full rounded-lg bg-rose-500/80 hover:bg-rose-500 px-3 py-2 text-sm font-semibold"
                      >
                        Penaliser {player.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-white/15 bg-black/25 p-4 md:p-6">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Pioche</p>
                    <motion.button
                      onClick={drawCard}
                      disabled={!canDraw}
                      whileHover={canDraw ? { y: -3, scale: 1.03 } : undefined}
                      whileTap={canDraw ? { scale: 0.98 } : undefined}
                      className={`w-24 h-36 rounded-2xl border-2 shadow-lg ${
                        canDraw
                          ? 'border-white bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900'
                          : 'border-white/20 bg-slate-900/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <p className="font-black text-xl">UNO</p>
                      <p className="text-xs text-white/75 mt-1">{publicState?.drawPileSize ?? 0} cartes</p>
                    </motion.button>
                  </div>

                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Defausse</p>
                    <div className="flex items-center gap-3">
                      <UnoCard card={discardTop} disabled className="pointer-events-none" />
                      <div className="min-w-20 text-left">
                        <p className="text-xs uppercase tracking-wider text-white/60 mb-2">Couleur</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full border border-white/40 ${
                              activeColor ? COLOR_BADGES[activeColor] : 'bg-slate-500'
                            }`}
                          />
                          <span className="text-sm font-semibold capitalize">{activeColor ?? 'wild'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm font-semibold text-white/85">Votre main ({myHand.length})</p>
                    <div className="flex items-center gap-2">
                      {canCallUno && (
                        <motion.button
                          onClick={callUno}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 px-4 py-2 text-sm font-black text-white shadow-lg"
                        >
                          Dire UNO
                        </motion.button>
                      )}
                      <span className={`text-sm font-semibold ${isMyTurn ? 'text-yellow-200' : 'text-white/65'}`}>
                        {isMyTurn ? 'A vous de jouer' : 'En attente de votre tour'}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-2 md:gap-3 min-w-max">
                      {myHand.map((card) => {
                        const playable = playableCardIds.has(card.id)
                        return (
                          <UnoCard
                            key={card.id}
                            card={card}
                            playable={playable}
                            disabled={!playable || !isMyTurn}
                            onClick={playable && isMyTurn ? () => playCard(card.id) : undefined}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {phase === 'challengeWD4' && (
              <div className="rounded-2xl border border-amber-300/60 bg-amber-500/15 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-wider text-amber-100/80">Wild +4</p>
                  <p className="font-semibold">Choisissez: contester ou accepter la penalite.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={challengeWD4}
                    className="rounded-lg bg-rose-500 hover:bg-rose-400 px-4 py-2 text-sm font-semibold"
                  >
                    Contester
                  </button>
                  <button
                    onClick={acceptWD4}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold"
                  >
                    Accepter
                  </button>
                </div>
              </div>
            )}

            {mustChooseColor && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950 p-5"
                >
                  <p className="text-sm uppercase tracking-wider text-white/60 mb-3">Choisir une couleur</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CARD_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => chooseColor(color)}
                        className={`rounded-xl bg-gradient-to-r ${COLOR_BUTTONS[color]} px-4 py-4 text-sm font-black uppercase shadow-lg`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {renderConnectionInfo()}
              <button
                onClick={handleLeave}
                className="rounded-lg border border-white/25 px-3 py-1.5 text-white/80 hover:text-white hover:border-white/50"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  const RoundOverView = () => {
    const scores = publicState?.scores ?? []
    const roundWinner = getRoundWinner(scores)

    return (
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-2 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent">
            Manche terminee
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-300 mb-6">
            {roundWinner
              ? `${playerNameById.get(roundWinner.playerId) ?? 'Joueur'} gagne ${roundWinner.roundScore} points`
              : 'Aucun point attribue sur cette manche'}
          </p>

          <div className="space-y-2 mb-6">
            {scores
              .slice()
              .sort((left, right) => right.totalScore - left.totalScore)
              .map((score) => (
                <div
                  key={score.playerId}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {playerNameById.get(score.playerId) ?? score.playerId}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    +{score.roundScore} | Total {score.totalScore}
                  </span>
                </div>
              ))}
          </div>

          {isHost && (
            <motion.button
              onClick={continueNextRound}
              className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 text-white font-black shadow-lg"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl p-6 md:p-8">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-2 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent">
            Partie terminee
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-300 mb-6">
            Vainqueur: {winner ? playerNameById.get(winner.playerId) ?? winner.playerId : 'N/A'}
          </p>

          <div className="space-y-2 mb-6">
            {scores
              .slice()
              .sort((left, right) => right.totalScore - left.totalScore)
              .map((score) => (
                <div
                  key={score.playerId}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {playerNameById.get(score.playerId) ?? score.playerId}
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{score.totalScore} pts</span>
                </div>
              ))}
          </div>

          <motion.button
            onClick={resetGame}
            className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 text-white font-black shadow-lg"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
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