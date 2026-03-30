import { useState } from 'react'
import { motion } from 'motion/react'
import { useCodenamesSocket } from './useCodenamesSocket'
import type { CodenamesTeam, CodenamesPublicCard } from '@undercover/shared'

interface CodenamesLobbyProps {
  onBack: () => void
}

export function CodenamesLobby({ onBack }: CodenamesLobbyProps) {
  const {
    connected,
    publicState,
    privateState,
    error,
    roomCode,
    createRoom,
    joinRoom,
    leaveRoom,
    joinTeam,
    setSpymaster,
    startGame,
    giveClue,
    guessWord,
    passTurn,
    resetGame,
  } = useCodenamesSocket()

  const handleBack = () => {
    leaveRoom()
    onBack()
  }

  // Not in a room → Landing
  if (!roomCode || !publicState) {
    return <LandingView connected={connected} error={error} onCreate={createRoom} onJoin={joinRoom} onBack={onBack} />
  }

  // In a room → render based on phase
  switch (publicState.phase) {
    case 'lobby':
      return (
        <LobbyView
          publicState={publicState}
          privateState={privateState!}
          error={error}
          onJoinTeam={joinTeam}
          onSetSpymaster={setSpymaster}
          onStart={startGame}
          onBack={handleBack}
        />
      )
    case 'clueGiving':
    case 'guessing':
      return (
        <GameBoardView
          publicState={publicState}
          privateState={privateState!}
          onGiveClue={giveClue}
          onGuess={guessWord}
          onPass={passTurn}
          onBack={handleBack}
        />
      )
    case 'victory':
      return (
        <VictoryView
          publicState={publicState}
          privateState={privateState!}
          onReset={resetGame}
          onBack={handleBack}
        />
      )
    default:
      return <LandingView connected={connected} error={error} onCreate={createRoom} onJoin={joinRoom} onBack={onBack} />
  }
}

// ── Landing View ──

function LandingView({
  connected,
  error,
  onCreate,
  onJoin,
  onBack,
}: {
  connected: boolean
  error: string | null
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onBack: () => void
}) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Retour
      </button>

      <h1 className="text-4xl font-black text-center mb-6">
        <span className="bg-gradient-to-r from-rose-500 to-sky-500 bg-clip-text text-transparent">CODENAMES</span>
      </h1>

      {!connected && (
        <div className="text-center text-amber-400 text-sm mb-4">Connexion au serveur...</div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('create')}
          className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
            tab === 'create' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Creer un salon
        </button>
        <button
          onClick={() => setTab('join')}
          className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
            tab === 'join' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Rejoindre
        </button>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Ton pseudo"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />

        {tab === 'join' && (
          <input
            type="text"
            placeholder="Code du salon"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase tracking-widest text-center font-mono text-lg"
          />
        )}

        <button
          onClick={() => {
            if (!name.trim()) return
            if (tab === 'create') onCreate(name.trim())
            else if (code.length >= 4) onJoin(code, name.trim())
          }}
          disabled={!connected || !name.trim() || (tab === 'join' && code.length < 4)}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {tab === 'create' ? 'Creer' : 'Rejoindre'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Lobby View ──

function LobbyView({
  publicState,
  privateState,
  error,
  onJoinTeam,
  onSetSpymaster,
  onStart,
  onBack,
}: {
  publicState: NonNullable<ReturnType<typeof useCodenamesSocket>['publicState']>
  privateState: NonNullable<ReturnType<typeof useCodenamesSocket>['privateState']>
  error: string | null
  onJoinTeam: (team: CodenamesTeam) => void
  onSetSpymaster: () => void
  onStart: () => void
  onBack: () => void
}) {
  const redPlayers = publicState.players.filter(p => p.team === 'red')
  const bluePlayers = publicState.players.filter(p => p.team === 'blue')
  const unassigned = publicState.players.filter(p => !p.team)

  const redHasSpymaster = redPlayers.some(p => p.isSpymaster)
  const blueHasSpymaster = bluePlayers.some(p => p.isSpymaster)
  const canStart = redPlayers.length >= 2 && bluePlayers.length >= 2 && redHasSpymaster && blueHasSpymaster

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Quitter
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Salon Codenames</h2>
        <div className="inline-block bg-slate-800 px-4 py-1.5 rounded-lg font-mono text-lg tracking-widest text-slate-300 select-all">
          {publicState.roomCode}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Sans equipe :</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(p => (
              <span key={p.id} className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
                {p.name} {p.id === publicState.hostId && '(hote)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Teams side by side */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <TeamPanel
          team="red"
          players={redPlayers}
          myTeam={privateState.team}
          amSpymaster={privateState.isSpymaster}
          hostId={publicState.hostId}
          onJoin={() => onJoinTeam('red')}
          onSetSpymaster={onSetSpymaster}
        />
        <TeamPanel
          team="blue"
          players={bluePlayers}
          myTeam={privateState.team}
          amSpymaster={privateState.isSpymaster}
          hostId={publicState.hostId}
          onJoin={() => onJoinTeam('blue')}
          onSetSpymaster={onSetSpymaster}
        />
      </div>

      {/* Start button (host only) */}
      {privateState.isHost && (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {canStart ? 'Lancer la partie' : 'Il faut 2+ joueurs par equipe avec un maitre-espion chacune'}
        </button>
      )}
    </motion.div>
  )
}

function TeamPanel({
  team,
  players,
  myTeam,
  amSpymaster,
  hostId,
  onJoin,
  onSetSpymaster,
}: {
  team: CodenamesTeam
  players: { id: string; name: string; isSpymaster: boolean; connected: boolean }[]
  myTeam: CodenamesTeam | null
  amSpymaster: boolean
  hostId: string
  onJoin: () => void
  onSetSpymaster: () => void
}) {
  const isRed = team === 'red'
  const bg = isRed ? 'bg-rose-500/10 border-rose-500/30' : 'bg-sky-500/10 border-sky-500/30'
  const accent = isRed ? 'text-rose-400' : 'text-sky-400'
  const btnBg = isRed ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500'
  const spymaster = players.find(p => p.isSpymaster)
  const agents = players.filter(p => !p.isSpymaster)

  return (
    <div className={`p-4 rounded-xl border ${bg}`}>
      <h3 className={`text-lg font-bold ${accent} mb-3`}>
        {isRed ? 'Equipe Rouge' : 'Equipe Bleue'}
        <span className="text-sm font-normal text-slate-400 ml-2">({players.length})</span>
      </h3>

      {/* Spymaster slot */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Maitre-espion</p>
        {spymaster ? (
          <div className={`px-3 py-1.5 rounded-lg ${isRed ? 'bg-rose-500/20' : 'bg-sky-500/20'} ${accent} font-semibold text-sm flex items-center gap-2`}>
            <span className="text-base">🕵️</span>
            {spymaster.name}
            {!spymaster.connected && <span className="text-slate-500 text-xs">(deconnecte)</span>}
          </div>
        ) : (
          myTeam === team && !amSpymaster ? (
            <button
              onClick={onSetSpymaster}
              className={`w-full px-3 py-1.5 rounded-lg border-2 border-dashed ${isRed ? 'border-rose-500/40 text-rose-400' : 'border-sky-500/40 text-sky-400'} text-sm hover:bg-white/5 transition-colors`}
            >
              Devenir maitre-espion
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-lg border-2 border-dashed border-slate-700 text-slate-600 text-sm text-center">
              En attente...
            </div>
          )
        )}
      </div>

      {/* Agents */}
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Agents</p>
      <div className="space-y-1 mb-3">
        {agents.map(p => (
          <div key={p.id} className="px-3 py-1 rounded-lg bg-slate-800/50 text-sm text-slate-300 flex items-center gap-2">
            {p.name}
            {!p.connected && <span className="text-slate-500 text-xs">(deconnecte)</span>}
            {p.id === hostId && <span className="text-amber-400 text-xs">(hote)</span>}
          </div>
        ))}
        {agents.length === 0 && (
          <div className="text-xs text-slate-600 italic">Aucun agent</div>
        )}
      </div>

      {/* Join button */}
      {myTeam !== team && (
        <button onClick={onJoin} className={`w-full py-2 rounded-lg text-sm font-semibold text-white ${btnBg} transition-colors`}>
          Rejoindre
        </button>
      )}
    </div>
  )
}

// ── Game Board View ──

function GameBoardView({
  publicState,
  privateState,
  onGiveClue,
  onGuess,
  onPass,
  onBack,
}: {
  publicState: NonNullable<ReturnType<typeof useCodenamesSocket>['publicState']>
  privateState: NonNullable<ReturnType<typeof useCodenamesSocket>['privateState']>
  onGiveClue: (word: string, count: number) => void
  onGuess: (cardIndex: number) => void
  onPass: () => void
  onBack: () => void
}) {
  const [clueWord, setClueWord] = useState('')
  const [clueCount, setClueCount] = useState(1)

  const isMyTeamTurn = privateState.team === publicState.currentTeam
  const isSpymaster = privateState.isSpymaster
  const isCluePhase = publicState.phase === 'clueGiving'
  const isGuessPhase = publicState.phase === 'guessing'
  const canGiveClue = isMyTeamTurn && isSpymaster && isCluePhase
  const canGuess = isMyTeamTurn && !isSpymaster && isGuessPhase
  const canPass = canGuess

  const cards = isSpymaster && privateState.spymasterCards
    ? privateState.spymasterCards
    : publicState.cards

  const currentTeamLabel = publicState.currentTeam === 'red' ? 'Rouge' : 'Bleue'
  const currentTeamColor = publicState.currentTeam === 'red' ? 'text-rose-400' : 'text-sky-400'

  return (
    <motion.div
      className="w-full max-w-4xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Quitter
        </button>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-rose-400 font-bold">{publicState.scores.red}/{publicState.targets.red}</span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-400 font-bold">{publicState.scores.blue}/{publicState.targets.blue}</span>
        </div>

        <div className="font-mono text-xs text-slate-500">{publicState.roomCode}</div>
      </div>

      {/* Turn indicator */}
      <div className="text-center mb-4">
        <p className={`text-lg font-bold ${currentTeamColor}`}>
          {isCluePhase && (
            isMyTeamTurn && isSpymaster
              ? 'A vous de donner un indice !'
              : `Le maitre-espion ${currentTeamLabel} reflechit...`
          )}
          {isGuessPhase && (
            <>
              Indice : <span className="text-white font-black text-xl">{publicState.currentClue?.word}</span>
              {' '}
              <span className="text-slate-400">({publicState.currentClue?.count})</span>
              {' — '}
              <span className="text-slate-300">{publicState.remainingGuesses} essai{publicState.remainingGuesses > 1 ? 's' : ''} restant{publicState.remainingGuesses > 1 ? 's' : ''}</span>
            </>
          )}
        </p>
        {isGuessPhase && canGuess && (
          <p className="text-sm text-emerald-400 mt-1">Cliquez sur un mot pour deviner</p>
        )}
        {isGuessPhase && isSpymaster && isMyTeamTurn && (
          <p className="text-sm text-amber-400 mt-1">Votre equipe devine...</p>
        )}
      </div>

      {/* Clue input for spymaster */}
      {canGiveClue && (
        <motion.div
          className="flex items-center gap-3 mb-4 justify-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <input
            type="text"
            placeholder="Votre indice (1 mot)"
            value={clueWord}
            onChange={e => setClueWord(e.target.value.replace(/\s/g, ''))}
            className="px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 w-48"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setClueCount(Math.max(1, clueCount - 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center"
            >-</button>
            <span className="w-8 text-center text-white font-bold">{clueCount}</span>
            <button
              onClick={() => setClueCount(Math.min(9, clueCount + 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center"
            >+</button>
          </div>
          <button
            onClick={() => {
              if (clueWord.trim()) {
                onGiveClue(clueWord.trim(), clueCount)
                setClueWord('')
                setClueCount(1)
              }
            }}
            disabled={!clueWord.trim()}
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Envoyer
          </button>
        </motion.div>
      )}

      {/* Card grid 5x5 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {cards.map((card, index) => (
          <CardButton
            key={index}
            card={card}
            index={index}
            isSpymaster={isSpymaster}
            canGuess={canGuess}
            onGuess={onGuess}
          />
        ))}
      </div>

      {/* Pass turn button */}
      {canPass && (
        <div className="text-center">
          <button
            onClick={onPass}
            className="px-6 py-2.5 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Passer mon tour
          </button>
        </div>
      )}

      {/* Spymaster legend */}
      {isSpymaster && (
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Rouge</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> Bleu</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-700 inline-block" /> Neutre</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-900 inline-block border border-slate-600" /> Assassin</span>
        </div>
      )}
    </motion.div>
  )
}

function CardButton({
  card,
  index,
  isSpymaster,
  canGuess,
  onGuess,
}: {
  card: CodenamesPublicCard | { word: string; color: string; revealed: boolean }
  index: number
  isSpymaster: boolean
  canGuess: boolean
  onGuess: (index: number) => void
}) {
  const color = 'color' in card ? card.color : null
  const revealed = card.revealed

  // Determine styling
  let bg = 'bg-slate-800 border-slate-600'
  let textColor = 'text-white'
  let hoverEffect = ''

  if (revealed) {
    // Revealed card
    switch (color) {
      case 'red': bg = 'bg-rose-600/80 border-rose-500'; textColor = 'text-white'; break
      case 'blue': bg = 'bg-sky-600/80 border-sky-500'; textColor = 'text-white'; break
      case 'neutral': bg = 'bg-amber-800/50 border-amber-700/50'; textColor = 'text-amber-200/60'; break
      case 'assassin': bg = 'bg-slate-950 border-slate-600'; textColor = 'text-red-400'; break
    }
  } else if (isSpymaster && color) {
    // Spymaster sees unrevealed colors
    switch (color) {
      case 'red': bg = 'bg-rose-500/20 border-rose-500/40'; textColor = 'text-rose-300'; break
      case 'blue': bg = 'bg-sky-500/20 border-sky-500/40'; textColor = 'text-sky-300'; break
      case 'neutral': bg = 'bg-amber-700/15 border-amber-600/30'; textColor = 'text-amber-200'; break
      case 'assassin': bg = 'bg-slate-900 border-red-600/40'; textColor = 'text-red-400'; break
    }
  } else if (canGuess && !revealed) {
    hoverEffect = 'hover:bg-slate-700 hover:border-slate-500 cursor-pointer hover:scale-[1.03] active:scale-95'
  }

  return (
    <motion.button
      onClick={() => canGuess && !revealed && onGuess(index)}
      disabled={revealed || !canGuess}
      className={`relative aspect-[4/3] rounded-xl border ${bg} ${textColor} ${hoverEffect} flex items-center justify-center p-1 text-xs sm:text-sm font-semibold transition-all select-none disabled:cursor-default`}
      layout
      whileTap={canGuess && !revealed ? { scale: 0.95 } : {}}
    >
      <span className={`text-center break-words leading-tight ${revealed && color === 'neutral' ? 'line-through opacity-60' : ''}`}>
        {card.word}
      </span>
      {revealed && (
        <motion.div
          className="absolute inset-0 rounded-xl ring-2 ring-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.button>
  )
}

// ── Victory View ──

function VictoryView({
  publicState,
  privateState,
  onReset,
  onBack,
}: {
  publicState: NonNullable<ReturnType<typeof useCodenamesSocket>['publicState']>
  privateState: NonNullable<ReturnType<typeof useCodenamesSocket>['privateState']>
  onReset: () => void
  onBack: () => void
}) {
  const winnerIsRed = publicState.winner === 'red'
  const winnerColor = winnerIsRed ? 'text-rose-400' : 'text-sky-400'
  const winnerLabel = winnerIsRed ? 'Rouge' : 'Bleue'
  const reasonText = publicState.winReason === 'assassin'
    ? `L'equipe ${publicState.loser === 'red' ? 'Rouge' : 'Bleue'} a touche l'assassin !`
    : `Tous les mots ont ete trouves !`

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.h1
        className={`text-5xl font-black mb-3 ${winnerColor}`}
        initial={{ y: -20 }}
        animate={{ y: 0 }}
      >
        Victoire {winnerLabel} !
      </motion.h1>

      <p className="text-slate-400 mb-6">{reasonText}</p>

      <div className="flex items-center justify-center gap-8 mb-8">
        <div className="text-center">
          <p className="text-rose-400 text-3xl font-black">{publicState.scores.red}</p>
          <p className="text-sm text-slate-500">Rouge</p>
        </div>
        <div className="text-4xl text-slate-600">-</div>
        <div className="text-center">
          <p className="text-sky-400 text-3xl font-black">{publicState.scores.blue}</p>
          <p className="text-sm text-slate-500">Bleu</p>
        </div>
      </div>

      {/* Show full board revealed */}
      <div className="grid grid-cols-5 gap-2 mb-6 max-w-3xl mx-auto">
        {(privateState.spymasterCards || publicState.cards).map((card, i) => {
          const color = 'color' in card ? card.color : null
          let bg = 'bg-slate-800'
          switch (color) {
            case 'red': bg = card.revealed ? 'bg-rose-600/80' : 'bg-rose-500/30'; break
            case 'blue': bg = card.revealed ? 'bg-sky-600/80' : 'bg-sky-500/30'; break
            case 'neutral': bg = 'bg-amber-800/30'; break
            case 'assassin': bg = 'bg-slate-950 border border-red-600/40'; break
          }
          return (
            <div key={i} className={`${bg} rounded-lg p-2 text-xs font-semibold text-center ${card.revealed ? 'text-white' : 'text-slate-400'}`}>
              {card.word}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 justify-center">
        {privateState.isHost && (
          <button
            onClick={onReset}
            className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 transition-all"
          >
            Nouvelle partie
          </button>
        )}
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          Quitter
        </button>
      </div>
    </motion.div>
  )
}
