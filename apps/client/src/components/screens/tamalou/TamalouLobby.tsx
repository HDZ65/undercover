import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTamalouSocket } from './useTamalouSocket'
import { RulesModal } from './RulesModal'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import type {
  TamalouCard,
  TamalouPublicState,
  TamalouPrivateState,
} from '@undercover/shared'

interface TamalouLobbyProps {
  onBack: () => void
}

export function TamalouLobby({ onBack }: TamalouLobbyProps) {
  const sock = useTamalouSocket()
  const [showRules, setShowRules] = useState(false)
  const { setConnected } = useConnectionStatus()
  useEffect(() => { setConnected(sock.connected) }, [sock.connected, setConnected])

  const handleBack = () => { sock.leaveRoom(); onBack() }

  const rulesBtn = (
    <button
      onClick={() => setShowRules(true)}
      className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
    >
      ? Regles
    </button>
  )

  return (
    <>
      {rulesBtn}
      <AnimatePresence>{showRules && <RulesModal onClose={() => setShowRules(false)} />}</AnimatePresence>

      {(!sock.roomCode || !sock.publicState) ? (
        <LandingView connected={sock.connected} error={sock.error} onCreate={sock.createRoom} onJoin={sock.joinRoom} onBack={onBack} />
      ) : sock.publicState.phase === 'lobby' ? (
        <LobbyPhase pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : sock.publicState.phase === 'initialPeek' ? (
        <InitialPeekPhase pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : sock.publicState.phase === 'roundEnd' ? (
        <RoundEndPhase pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : sock.publicState.phase === 'gameOver' ? (
        <GameOverPhase pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : (
        <GamePhase pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      )}
    </>
  )
}

type Sock = ReturnType<typeof useTamalouSocket>

// ── Card display helpers ──

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS: Record<string, string> = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-slate-200', spades: 'text-slate-200' }

function CardFace({ card, small }: { card: TamalouCard; small?: boolean }) {
  const sz = small ? 'w-12 h-16 text-xs' : 'w-16 h-22 text-sm'
  return (
    <div className={`${sz} rounded-lg bg-white border border-slate-300 flex flex-col items-center justify-center font-bold shadow-md select-none`}>
      <span className={SUIT_COLORS[card.suit]}>{card.rank}</span>
      <span className={`${SUIT_COLORS[card.suit]} ${small ? 'text-sm' : 'text-lg'}`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

function CardBack({ small, highlight, onClick, label }: { small?: boolean; highlight?: boolean; onClick?: () => void; label?: string }) {
  const sz = small ? 'w-12 h-16' : 'w-16 h-22'
  const border = highlight ? 'ring-2 ring-amber-400' : ''
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`${sz} rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 border border-indigo-500 flex items-center justify-center shadow-md select-none ${border} ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} transition-transform`}
    >
      {label ? (
        <span className="text-white/70 text-[10px] font-bold">{label}</span>
      ) : (
        <span className="text-indigo-300/40 text-lg font-black">?</span>
      )}
    </button>
  )
}


// ── Landing ──

function LandingView({ connected, error, onCreate, onJoin, onBack }: {
  connected: boolean; error: string | null
  onCreate: (name: string) => void; onJoin: (code: string, name: string) => void; onBack: () => void
}) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  return (
    <motion.div className="w-full max-w-md mx-auto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Retour
      </button>

      <h1 className="text-4xl font-black text-center mb-6">
        <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">TAMALOU</span>
      </h1>

      {!connected && <div className="text-center text-amber-400 text-sm mb-4">Connexion au serveur...</div>}
      {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('create')} className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${tab === 'create' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>Creer</button>
        <button onClick={() => setTab('join')} className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${tab === 'join' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>Rejoindre</button>
      </div>

      <div className="space-y-3">
        <input type="text" placeholder="Ton pseudo" value={name} onChange={e => setName(e.target.value)} maxLength={20}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        {tab === 'join' && (
          <input type="text" placeholder="Code du salon" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase tracking-widest text-center font-mono text-lg" />
        )}
        <button
          onClick={() => { if (!name.trim()) return; tab === 'create' ? onCreate(name.trim()) : code.length >= 4 && onJoin(code, name.trim()) }}
          disabled={!connected || !name.trim() || (tab === 'join' && code.length < 4)}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {tab === 'create' ? 'Creer' : 'Rejoindre'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Lobby ──

function LobbyPhase({ pub, priv, sock, onBack }: { pub: TamalouPublicState; priv: TamalouPrivateState; sock: Sock; onBack: () => void }) {
  const [maxScore, setMaxScore] = useState(pub.maxScore)

  return (
    <motion.div className="w-full max-w-md mx-auto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Quitter
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Salon Tamalou</h2>
        <div className="inline-block bg-slate-800 px-4 py-1.5 rounded-lg font-mono text-lg tracking-widest text-slate-300 select-all">{pub.roomCode}</div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-4">
        <p className="text-sm text-slate-400 mb-2">Joueurs ({pub.players.length})</p>
        <div className="flex flex-wrap gap-2">
          {pub.players.map(p => (
            <span key={p.id} className={`px-3 py-1 rounded-full text-sm ${p.id === pub.hostId ? 'bg-amber-600/20 text-amber-400 font-semibold' : 'bg-slate-700 text-slate-300'}`}>
              {p.name} {p.id === pub.hostId && '(hote)'}
            </span>
          ))}
        </div>
      </div>

      {priv.isHost && (
        <div className="mb-4">
          <label className="text-sm text-slate-400 mb-1 block">Score maximum</label>
          <div className="flex items-center gap-2">
            {[50, 100, 150, 200].map(v => (
              <button
                key={v}
                onClick={() => { setMaxScore(v); sock.setMaxScore(v) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${maxScore === v ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {priv.isHost && (
        <button
          onClick={() => sock.startGame()}
          disabled={pub.players.length < 2}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {pub.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer la partie'}
        </button>
      )}
    </motion.div>
  )
}

// ── Initial Peek ──

function InitialPeekPhase({ pub, priv, sock, onBack }: { pub: TamalouPublicState; priv: TamalouPrivateState; sock: Sock; onBack: () => void }) {
  const [selected, setSelected] = useState<number[]>([])
  const [countdown, setCountdown] = useState<number | null>(null)
  const hasPeeked = priv.hand.some(c => c !== null)

  // All players peeked = all hands have visible cards = peekReveal phase
  const allPeeked = hasPeeked && pub.players.every(p => p.cardCount === 4)

  // Start countdown when all have peeked (peekReveal phase)
  useEffect(() => {
    if (!allPeeked) return
    setCountdown(7)
    const interval = setInterval(() => {
      setCountdown(prev => prev !== null && prev > 0 ? prev - 1 : 0)
    }, 1000)
    return () => clearInterval(interval)
  }, [allPeeked])

  const toggle = (idx: number) => {
    if (hasPeeked) return
    setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length < 2 ? [...prev, idx] : prev)
  }

  const confirm = () => {
    if (selected.length === 2) {
      sock.peekInitial(selected as [number, number])
    }
  }

  return (
    <motion.div className="w-full max-w-md mx-auto text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Quitter
      </button>

      <h2 className="text-xl font-bold text-amber-400 mb-2">
        {allPeeked ? `Memorisez vos cartes ! (${countdown ?? 0}s)` : hasPeeked ? 'Memorisez vos cartes...' : 'Choisissez 2 cartes a regarder'}
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        {allPeeked ? 'Les cartes vont se retourner...' : hasPeeked ? 'En attente des autres joueurs' : 'Selectionnez 2 de vos 4 cartes'}
      </p>

      <div className="flex justify-center gap-3 mb-6">
        {priv.hand.map((card, idx) => (
          <motion.div key={idx} whileTap={{ scale: 0.95 }}>
            {card ? (
              <CardFace card={card} />
            ) : (
              <CardBack
                highlight={selected.includes(idx)}
                onClick={() => toggle(idx)}
                label={selected.includes(idx) ? `${selected.indexOf(idx) + 1}` : undefined}
              />
            )}
          </motion.div>
        ))}
      </div>

      {!hasPeeked && (
        <button
          onClick={confirm}
          disabled={selected.length !== 2}
          className="px-6 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Regarder
        </button>
      )}
    </motion.div>
  )
}

// ── Main Game Phase ──

function GamePhase({ pub, priv, sock, onBack }: { pub: TamalouPublicState; priv: TamalouPrivateState; sock: Sock; onBack: () => void }) {
  const [swapTarget, setSwapTarget] = useState<{ playerId: string; cardIndex: number } | null>(null)
  const [ownSwapIndex, setOwnSwapIndex] = useState<number | null>(null)

  const isMyTurn = pub.currentPlayerId === priv.playerId
  const phase = pub.phase
  const power = pub.activePower

  // Determine sub-phase
  const needsDraw = isMyTurn && phase === 'playerTurn'
  const needsAction = isMyTurn && phase === 'drawnCard' && priv.drawnCard !== null
  const needsPower = isMyTurn && phase === 'usePower'
  const isPeeking = isMyTurn && priv.peekedCard !== null

  const currentPlayerName = pub.players.find(p => p.id === pub.currentPlayerId)?.name || ''

  return (
    <motion.div className="w-full max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Quitter
        </button>
        <div className="text-sm text-slate-400">Manche {pub.round} — Score max : {pub.maxScore}</div>
        <div className="font-mono text-xs text-slate-500">{pub.roomCode}</div>
      </div>

      {/* Tamalou banner */}
      {pub.tamalouCaller && (
        <div className="bg-amber-600/20 border border-amber-500/40 rounded-xl p-3 mb-3 text-center">
          <span className="text-amber-400 font-bold text-lg">TAMALOU !</span>
          <span className="text-slate-300 text-sm ml-2">
            {pub.players.find(p => p.id === pub.tamalouCaller)?.name} — dernier tour !
          </span>
        </div>
      )}

      {/* Turn indicator */}
      <div className="text-center mb-4">
        {isMyTurn ? (
          <p className="text-lg font-bold text-emerald-400">
            {needsDraw && "C'est votre tour — piochez !"}
            {needsAction && 'Echangez ou defaussez'}
            {needsPower && power === 'peekOwn' && 'Regardez une de vos cartes'}
            {needsPower && power === 'peekOpponent' && "Regardez une carte d'un adversaire"}
            {needsPower && power === 'blindSwap' && 'Echangez a l\'aveugle'}
            {isPeeking && 'Memorisez cette carte !'}
          </p>
        ) : (
          <p className="text-slate-400">Tour de <span className="text-white font-semibold">{currentPlayerName}</span></p>
        )}
      </div>

      {/* Peeked card overlay */}
      {isPeeking && priv.peekedCard && (
        <motion.div
          className="flex flex-col items-center mb-4 bg-slate-800/80 rounded-xl p-4 border border-amber-500/30"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <p className="text-sm text-amber-400 mb-2">
            Carte {priv.peekedCard.owner === priv.playerId ? 'a vous' : `de ${pub.players.find(p => p.id === priv.peekedCard!.owner)?.name}`} (position {priv.peekedCard.cardIndex + 1})
          </p>
          <CardFace card={priv.peekedCard.card} />
          <button onClick={() => sock.ackPeek()} className="mt-3 px-5 py-2 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors">
            Compris
          </button>
        </motion.div>
      )}

      {/* Draw area */}
      <div className="flex justify-center items-center gap-6 mb-6">
        {/* Draw pile */}
        <div className="text-center">
          <button
            onClick={() => needsDraw && sock.draw('pile')}
            disabled={!needsDraw}
            className={`w-16 h-22 rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 border-2 border-indigo-500 flex items-center justify-center shadow-lg ${needsDraw ? 'hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50' : 'cursor-default'} transition-transform`}
          >
            <span className="text-indigo-300/60 text-xs font-bold">{pub.drawPileCount}</span>
          </button>
          <p className="text-xs text-slate-500 mt-1">Pioche</p>
        </div>

        {/* Drawn card (if holding one) */}
        {needsAction && priv.drawnCard && (
          <motion.div className="text-center" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <CardFace card={priv.drawnCard} />
            <p className="text-xs text-emerald-400 mt-1">Carte piochee</p>
            <button onClick={() => sock.discardDrawn()} className="mt-1 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
              Defausser
            </button>
          </motion.div>
        )}

        {/* Discard pile */}
        <div className="text-center">
          {pub.discardTop ? (
            <button
              onClick={() => needsDraw && sock.draw('discard')}
              disabled={!needsDraw}
              className={`${needsDraw ? 'hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50' : 'cursor-default'} transition-transform`}
            >
              <CardFace card={pub.discardTop} />
            </button>
          ) : (
            <div className="w-16 h-22 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
              <span className="text-slate-600 text-xs">Vide</span>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">Defausse</p>
        </div>
      </div>

      {/* Tamalou button */}
      {isMyTurn && needsDraw && !pub.tamalouCaller && (
        <div className="text-center mb-4">
          <button
            onClick={() => sock.callTamalou()}
            className="px-5 py-2 rounded-xl font-black text-amber-900 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-lg transition-all hover:scale-105"
          >
            TAMALOU !
          </button>
        </div>
      )}

      {/* My hand */}
      <div className="mb-4">
        <p className="text-sm text-slate-400 mb-2 text-center">Vos cartes</p>
        <div className="flex justify-center gap-3">
          {priv.hand.map((card, idx) => (
            <motion.div key={idx} whileTap={{ scale: 0.95 }}>
              {card ? (
                <button
                  onClick={() => {
                    if (needsAction) sock.swapWithOwn(idx)
                    if (needsPower && power === 'peekOwn') sock.peekOwn(idx)
                    if (needsPower && power === 'blindSwap') {
                      if (swapTarget) { sock.blindSwap(idx, swapTarget.playerId, swapTarget.cardIndex); setSwapTarget(null) }
                      else setOwnSwapIndex(idx)
                    }
                  }}
                  disabled={!needsAction && !needsPower}
                  className={`${needsAction || (needsPower && (power === 'peekOwn' || power === 'blindSwap')) ? 'ring-2 ring-emerald-400/50 hover:scale-105 cursor-pointer' : 'cursor-default'} transition-transform rounded-lg ${ownSwapIndex === idx ? 'ring-2 ring-amber-400' : ''}`}
                >
                  <CardFace card={card} />
                </button>
              ) : (
                <CardBack
                  highlight={needsAction || (needsPower && (power === 'peekOwn' || power === 'blindSwap'))}
                  onClick={() => {
                    if (needsAction) sock.swapWithOwn(idx)
                    if (needsPower && power === 'peekOwn') sock.peekOwn(idx)
                    if (needsPower && power === 'blindSwap') {
                      if (swapTarget) { sock.blindSwap(idx, swapTarget.playerId, swapTarget.cardIndex); setSwapTarget(null) }
                      else setOwnSwapIndex(idx)
                    }
                  }}
                  label={`${idx + 1}`}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Skip power button */}
      {needsPower && !isPeeking && (
        <div className="text-center mb-4">
          <button onClick={() => sock.skipPower()} className="px-5 py-2 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors">
            Passer le pouvoir
          </button>
        </div>
      )}

      {/* Opponents */}
      <div className="space-y-3">
        {pub.players.filter(p => p.id !== priv.playerId).map(opp => (
          <div key={opp.id} className={`bg-slate-800/50 rounded-xl border border-slate-700 p-3 ${!opp.connected ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-300">
                {opp.name}
                {opp.id === pub.currentPlayerId && <span className="ml-2 text-emerald-400 text-xs">(joue)</span>}
                {opp.id === pub.tamalouCaller && <span className="ml-2 text-amber-400 text-xs">(tamalou)</span>}
              </span>
              <span className="text-xs text-slate-500">
                {(pub.scores[opp.id] || []).reduce((a, b) => a + b, 0)} pts
              </span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: opp.cardCount }, (_, idx) => (
                <CardBack
                  key={idx}
                  small
                  onClick={
                    (needsPower && power === 'peekOpponent')
                      ? () => sock.peekOpponent(opp.id, idx)
                      : (needsPower && power === 'blindSwap' && ownSwapIndex !== null)
                        ? () => { sock.blindSwap(ownSwapIndex!, opp.id, idx); setOwnSwapIndex(null) }
                        : undefined
                  }
                  highlight={needsPower && (power === 'peekOpponent' || (power === 'blindSwap' && ownSwapIndex !== null))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scoreboard */}
      <div className="mt-4 bg-slate-800/30 rounded-xl border border-slate-700/50 p-3">
        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Scores</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {pub.players.map(p => (
            <div key={p.id} className="flex justify-between">
              <span className={`${p.id === priv.playerId ? 'text-amber-400' : 'text-slate-300'}`}>{p.name}</span>
              <span className="text-slate-400 font-mono">{(pub.scores[p.id] || []).reduce((a, b) => a + b, 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Round End ──

function RoundEndPhase({ pub, priv, sock }: { pub: TamalouPublicState; priv: TamalouPrivateState; sock: Sock; onBack: () => void }) {
  return (
    <motion.div className="w-full max-w-2xl mx-auto text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <h2 className="text-2xl font-black text-amber-400 mb-4">Fin de la manche {pub.round}</h2>

      {/* Tamalou result */}
      {pub.tamalouCaller && pub.roundScores && (
        <div className="mb-4">
          {pub.roundScores[pub.tamalouCaller] === 0 ? (
            <p className="text-emerald-400 font-bold">
              {pub.players.find(p => p.id === pub.tamalouCaller)?.name} a reussi son Tamalou ! (0 points)
            </p>
          ) : (
            <p className="text-red-400 font-bold">
              {pub.players.find(p => p.id === pub.tamalouCaller)?.name} a rate son Tamalou ! (+20 penalite)
            </p>
          )}
        </div>
      )}

      {/* Revealed hands */}
      <div className="space-y-4 mb-6">
        {pub.players.map(p => {
          const hand = pub.revealedHands?.[p.id] || []
          const score = pub.roundScores?.[p.id] ?? 0
          return (
            <div key={p.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">
                  {p.name}
                  {p.id === pub.tamalouCaller && <span className="ml-2 text-amber-400">(tamalou)</span>}
                </span>
                <span className={`font-bold ${score === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  +{score}
                </span>
              </div>
              <div className="flex justify-center gap-2">
                {hand.map((card, i) => <CardFace key={i} card={card} small />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cumulative scores */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-3 mb-4">
        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Score total</p>
        {pub.players.map(p => (
          <div key={p.id} className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">{p.name}</span>
            <span className="text-slate-400 font-mono">{(pub.scores[p.id] || []).reduce((a, b) => a + b, 0)} / {pub.maxScore}</span>
          </div>
        ))}
      </div>

      {priv.isHost && (
        <button onClick={() => sock.nextRound()} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all">
          Manche suivante
        </button>
      )}
    </motion.div>
  )
}

// ── Game Over ──

function GameOverPhase({ pub, priv, sock, onBack }: { pub: TamalouPublicState; priv: TamalouPrivateState; sock: Sock; onBack: () => void }) {
  const winner = pub.players.find(p => p.id === pub.winnerId)

  // Sort by total score ascending
  const sorted = [...pub.players].sort((a, b) => {
    const sa = (pub.scores[a.id] || []).reduce((x, y) => x + y, 0)
    const sb = (pub.scores[b.id] || []).reduce((x, y) => x + y, 0)
    return sa - sb
  })

  return (
    <motion.div className="w-full max-w-md mx-auto text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.h1 className="text-4xl font-black text-amber-400 mb-2" initial={{ y: -20 }} animate={{ y: 0 }}>
        Partie terminee !
      </motion.h1>
      {winner && <p className="text-lg text-emerald-400 font-bold mb-6">{winner.name} gagne !</p>}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6">
        {sorted.map((p, i) => {
          const total = (pub.scores[p.id] || []).reduce((a, b) => a + b, 0)
          return (
            <div key={p.id} className={`flex justify-between items-center py-2 ${i > 0 ? 'border-t border-slate-700/50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i + 1}.</span>
                <span className="text-slate-300 font-semibold">{p.name}</span>
              </div>
              <span className="font-mono text-slate-400">{total} pts</span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 justify-center">
        {priv.isHost && (
          <button onClick={() => sock.resetGame()} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all">
            Nouvelle partie
          </button>
        )}
        <button onClick={onBack} className="px-6 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors">
          Quitter
        </button>
      </div>
    </motion.div>
  )
}
