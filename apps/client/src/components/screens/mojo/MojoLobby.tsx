import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useMojoSocket } from './useMojoSocket'
import { MojoRulesModal } from './MojoRulesModal'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import type { MojoCard, MojoPublicState, MojoPrivateState, MojoColor } from '@undercover/shared'

interface MojoLobbyProps { onBack: () => void }

const COLOR_BG: Record<MojoColor, string> = { blue: 'bg-blue-600', green: 'bg-emerald-600', yellow: 'bg-yellow-500', orange: 'bg-orange-500', red: 'bg-red-600' }
const COLOR_BORDER: Record<MojoColor, string> = { blue: 'border-blue-400', green: 'border-emerald-400', yellow: 'border-yellow-300', orange: 'border-orange-400', red: 'border-red-400' }
const COLOR_TEXT: Record<MojoColor, string> = { blue: 'text-white', green: 'text-white', yellow: 'text-slate-900', orange: 'text-white', red: 'text-white' }

function CardView({ card, onClick, highlight, small }: { card: MojoCard; onClick?: () => void; highlight?: boolean; small?: boolean }) {
  const sz = small ? 'w-10 h-14 text-xs' : 'w-14 h-20 text-sm'
  const ring = highlight ? 'ring-2 ring-fuchsia-400' : ''
  return (
    <button
      onClick={onClick} disabled={!onClick}
      className={`${sz} rounded-lg ${COLOR_BG[card.color]} ${COLOR_BORDER[card.color]} border-2 ${COLOR_TEXT[card.color]} ${ring} flex flex-col items-center justify-center font-black shadow-md select-none ${onClick ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'} transition-transform`}
    >
      <span className={small ? 'text-sm' : 'text-lg'}>{card.value}</span>
    </button>
  )
}

function CardBackView({ onClick, small, label }: { onClick?: () => void; small?: boolean; label?: string }) {
  const sz = small ? 'w-10 h-14' : 'w-14 h-20'
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`${sz} rounded-lg bg-gradient-to-br from-fuchsia-700 to-purple-900 border-2 border-fuchsia-500 flex items-center justify-center shadow-md select-none ${onClick ? 'hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-fuchsia-400/50' : 'cursor-default'} transition-transform`}
    >
      <span className="text-fuchsia-300/60 text-xs font-bold">{label || '?'}</span>
    </button>
  )
}

export function MojoLobby({ onBack }: MojoLobbyProps) {
  const sock = useMojoSocket()
  const [showRules, setShowRules] = useState(false)
  const { setConnected } = useConnectionStatus()
  useEffect(() => { setConnected(sock.connected) }, [sock.connected, setConnected])

  const handleBack = () => { sock.leaveRoom(); onBack() }
  const rulesBtn = (
    <button onClick={() => setShowRules(true)} className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-fuchsia-600/80 hover:bg-fuchsia-500 text-white text-xs font-bold transition-colors">? Regles</button>
  )

  return (
    <>
      {rulesBtn}
      <AnimatePresence>{showRules && <MojoRulesModal onClose={() => setShowRules(false)} />}</AnimatePresence>
      {(!sock.roomCode || !sock.publicState) ? (
        <Landing connected={sock.connected} error={sock.error} onCreate={sock.createRoom} onJoin={sock.joinRoom} onBack={onBack} />
      ) : sock.publicState.phase === 'lobby' ? (
        <Lobby pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : sock.publicState.phase === 'roundEnd' ? (
        <RoundEnd pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : sock.publicState.phase === 'gameOver' ? (
        <GameOver pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      ) : (
        <Game pub={sock.publicState} priv={sock.privateState!} sock={sock} onBack={handleBack} />
      )}
    </>
  )
}

type Sock = ReturnType<typeof useMojoSocket>

// ── Landing ──

function Landing({ connected, error, onCreate, onJoin, onBack }: { connected: boolean; error: string | null; onCreate: (n: string) => void; onJoin: (c: string, n: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState(''); const [code, setCode] = useState('')
  return (
    <motion.div className="w-full max-w-md mx-auto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Retour</button>
      <h1 className="text-4xl font-black text-center mb-6"><span className="bg-gradient-to-r from-fuchsia-400 to-purple-500 bg-clip-text text-transparent">MOJO</span></h1>
      {!connected && <div className="text-center text-amber-400 text-sm mb-4">Connexion...</div>}
      {error && <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('create')} className={`flex-1 py-2 rounded-lg font-semibold text-sm ${tab === 'create' ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Creer</button>
        <button onClick={() => setTab('join')} className={`flex-1 py-2 rounded-lg font-semibold text-sm ${tab === 'join' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Rejoindre</button>
      </div>
      <div className="space-y-3">
        <input type="text" placeholder="Ton pseudo" value={name} onChange={e => setName(e.target.value)} maxLength={20} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
        {tab === 'join' && <input type="text" placeholder="Code du salon" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase tracking-widest text-center font-mono text-lg" />}
        <button onClick={() => { if (!name.trim()) return; tab === 'create' ? onCreate(name.trim()) : code.length >= 4 && onJoin(code, name.trim()) }} disabled={!connected || !name.trim() || (tab === 'join' && code.length < 4)} className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">{tab === 'create' ? 'Creer' : 'Rejoindre'}</button>
      </div>
    </motion.div>
  )
}

// ── Lobby ──

function Lobby({ pub, priv, sock, onBack }: { pub: MojoPublicState; priv: MojoPrivateState; sock: Sock; onBack: () => void }) {
  return (
    <motion.div className="w-full max-w-md mx-auto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Quitter</button>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Salon Mojo</h2>
        <div className="inline-block bg-slate-800 px-4 py-1.5 rounded-lg font-mono text-lg tracking-widest text-slate-300 select-all">{pub.roomCode}</div>
      </div>
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-4">
        <p className="text-sm text-slate-400 mb-2">Joueurs ({pub.players.length})</p>
        <div className="flex flex-wrap gap-2">
          {pub.players.map(p => (
            <span key={p.id} className={`px-3 py-1 rounded-full text-sm ${p.id === pub.hostId ? 'bg-fuchsia-600/20 text-fuchsia-400 font-semibold' : 'bg-slate-700 text-slate-300'}`}>
              {p.name} {p.id === pub.hostId && '(hote)'}
            </span>
          ))}
        </div>
      </div>
      {priv.isHost && (
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={pub.doubleDiscard} onChange={e => sock.setDoubleDiscard(e.target.checked)} className="w-5 h-5 rounded accent-fuchsia-500" />
            <span className="text-sm text-slate-300">Variante 2 defausses</span>
          </label>
        </div>
      )}
      {priv.isHost && (
        <button onClick={() => sock.startGame()} disabled={pub.players.length < 2} className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {pub.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer la partie'}
        </button>
      )}
    </motion.div>
  )
}

// ── Game ──

function Game({ pub, priv, sock, onBack }: { pub: MojoPublicState; priv: MojoPrivateState; sock: Sock; onBack: () => void }) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const isMyTurn = pub.currentPlayerId === priv.playerId
  const meInMojo = pub.players.find(p => p.id === priv.playerId)?.inMojoTime ?? false
  const currentName = pub.players.find(p => p.id === pub.currentPlayerId)?.name || ''

  const canPlay = isMyTurn && !meInMojo && !pub.mustDraw
  const canDraw = isMyTurn && pub.mustDraw
  const canReveal = isMyTurn && meInMojo && priv.mojoCards.length > 0
  const mustReplay = isMyTurn && pub.equalChainActive
  const isDouble = pub.doubleDiscard && pub.discardTops.length > 1

  // In equal chain, forced to play on same pile
  const forcedPileIndex = mustReplay ? pub.activeDiscardIndex : null
  // When drawing after higher card, can draw from OTHER pile
  const otherPileIndex = canDraw && isDouble ? (pub.activeDiscardIndex === 0 ? 1 : 0) : null

  // Clear selection when turn changes
  useEffect(() => { setSelectedCardId(null) }, [pub.currentPlayerId, pub.playedThisTurn])

  const handlePlayOnPile = (dIdx: number) => {
    if (!canPlay) return
    if (isDouble) {
      // Need a selected card first
      if (selectedCardId === null) return
      sock.playCard(selectedCardId, dIdx)
      setSelectedCardId(null)
    }
  }

  const handleCardClick = (cardId: number) => {
    if (!canPlay) return
    if (!isDouble) {
      // Single discard: play directly
      sock.playCard(cardId, 0)
    } else if (forcedPileIndex !== null) {
      // Equal chain: play directly on forced pile
      sock.playCard(cardId, forcedPileIndex)
    } else {
      // Double discard: select card, then click pile
      setSelectedCardId(prev => prev === cardId ? null : cardId)
    }
  }

  return (
    <motion.div className="w-full max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Quitter</button>
        <div className="text-sm text-slate-400">Manche {pub.round}</div>
        <div className="font-mono text-xs text-slate-500">{pub.roomCode}</div>
      </div>

      {/* Turn indicator */}
      <div className="text-center mb-4">
        {isMyTurn ? (
          <p className="text-lg font-bold text-emerald-400">
            {canDraw && !isDouble && 'Piochez une carte !'}
            {canDraw && isDouble && 'Piochez depuis la pioche ou l\'autre defausse !'}
            {canPlay && !pub.playedThisTurn && !mustReplay && !isDouble && 'Jouez une carte sur la defausse'}
            {canPlay && !pub.playedThisTurn && !mustReplay && isDouble && selectedCardId === null && 'Selectionnez une carte puis choisissez une defausse'}
            {canPlay && !pub.playedThisTurn && !mustReplay && isDouble && selectedCardId !== null && 'Cliquez sur une defausse pour jouer'}
            {mustReplay && 'Egalite ! Rejouez une carte'}
            {canReveal && 'Revelez une carte Mojo'}
          </p>
        ) : (
          <p className="text-slate-400">Tour de <span className="text-white font-semibold">{currentName}</span></p>
        )}
      </div>

      {/* Discard + Draw area */}
      <div className="flex justify-center items-end gap-4 mb-6">
        {/* Draw pile */}
        <div className="text-center">
          <button
            onClick={() => canDraw && sock.draw('pile')}
            disabled={!canDraw}
            className={`w-14 h-20 rounded-lg bg-gradient-to-br from-fuchsia-700 to-purple-900 border-2 border-fuchsia-500 flex items-center justify-center shadow-lg ${canDraw ? 'ring-2 ring-emerald-400/50 hover:scale-105 cursor-pointer' : 'cursor-default'} transition-transform`}
          >
            <span className="text-fuchsia-300/60 text-xs font-bold">{pub.drawPileCount}</span>
          </button>
          <p className="text-xs text-slate-500 mt-1">Pioche</p>
        </div>

        {/* Discard pile(s) */}
        {pub.discardTops.map((top, dIdx) => {
          // Can click discard to play a card on it?
          const canPlayHere = canPlay && selectedCardId !== null && isDouble && forcedPileIndex === null
          // Can draw from this pile? (only the OTHER pile, not the one we played on)
          const canDrawHere = canDraw && isDouble && otherPileIndex === dIdx && top !== null
          const isClickable = canPlayHere || canDrawHere
          const isActivePile = pub.playedThisTurn && dIdx === pub.activeDiscardIndex

          return (
            <div key={dIdx} className="text-center">
              {top ? (
                <CardView
                  card={top}
                  onClick={isClickable ? () => {
                    if (canDrawHere) sock.draw('discard', dIdx)
                    else if (canPlayHere) handlePlayOnPile(dIdx)
                  } : undefined}
                  highlight={isClickable || (canPlay && !isDouble)}
                />
              ) : (
                <div className={`w-14 h-20 rounded-lg border-2 border-dashed ${canPlayHere ? 'border-fuchsia-400 cursor-pointer hover:bg-fuchsia-500/10' : 'border-slate-600'} flex items-center justify-center`}
                  onClick={() => canPlayHere && handlePlayOnPile(dIdx)}
                >
                  <span className="text-slate-600 text-xs">Vide</span>
                </div>
              )}
              <p className={`text-xs mt-1 ${isActivePile ? 'text-fuchsia-400 font-semibold' : 'text-slate-500'}`}>
                Defausse{isDouble ? ` ${dIdx + 1}` : ''}
                {canDrawHere && <span className="text-emerald-400 ml-1">(piocher)</span>}
              </p>
            </div>
          )
        })}
      </div>

      {/* My hand */}
      {priv.hand.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-2 text-center">Vos cartes ({priv.hand.length})</p>
          <div className="flex flex-wrap justify-center gap-2">
            {priv.hand.map(card => (
              <CardView
                key={card.id}
                card={card}
                highlight={canPlay && (selectedCardId === card.id || !isDouble || forcedPileIndex !== null)}
                onClick={canPlay ? () => handleCardClick(card.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mojo cards (face-down, mine) */}
      {priv.mojoCards.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-fuchsia-400 mb-2 text-center font-semibold">Vos cartes Mojo (face cachee)</p>
          <div className="flex justify-center gap-2">
            {priv.mojoCards.map(card => (
              <CardBackView key={card.id} onClick={canReveal ? () => sock.revealMojoCard(card.id) : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* My revealed mojo cards */}
      {(pub.players.find(p => p.id === priv.playerId)?.revealedMojoCards.length ?? 0) > 0 && (
        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-2 text-center">Vos cartes revelees</p>
          <div className="flex justify-center gap-2">
            {pub.players.find(p => p.id === priv.playerId)!.revealedMojoCards.map(c => <CardView key={c.id} card={c} small />)}
          </div>
        </div>
      )}

      {/* Opponents */}
      <div className="space-y-3 mt-4">
        {pub.players.filter(p => p.id !== priv.playerId).map(opp => (
          <div key={opp.id} className={`bg-slate-800/50 rounded-xl border border-slate-700 p-3 ${!opp.connected ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-300">
                {opp.name}
                {opp.id === pub.currentPlayerId && <span className="ml-2 text-emerald-400 text-xs">(joue)</span>}
                {opp.hasMojo && <span className="ml-2 text-fuchsia-400 text-xs">(mojo)</span>}
              </span>
              <span className="text-xs text-slate-500">{(pub.scores[opp.id] || []).reduce((a, b) => a + b, 0)} pts</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {!opp.inMojoTime && Array.from({ length: opp.handCount }, (_, i) => <CardBackView key={i} small />)}
              {opp.mojoCardsCount > 0 && Array.from({ length: opp.mojoCardsCount }, (_, i) => <CardBackView key={`m${i}`} small label="M" />)}
              {opp.revealedMojoCards.map(c => <CardView key={c.id} card={c} small />)}
            </div>
          </div>
        ))}
      </div>

      {/* Scores */}
      <div className="mt-4 bg-slate-800/30 rounded-xl border border-slate-700/50 p-3">
        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Scores</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {pub.players.map(p => (
            <div key={p.id} className="flex justify-between">
              <span className={p.id === priv.playerId ? 'text-fuchsia-400' : 'text-slate-300'}>{p.name}</span>
              <span className="text-slate-400 font-mono">{(pub.scores[p.id] || []).reduce((a, b) => a + b, 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Round End ──

function RoundEnd({ pub, priv, sock }: { pub: MojoPublicState; priv: MojoPrivateState; sock: Sock; onBack: () => void }) {
  const mojoPlayer = pub.players.find(p => p.hasMojo)
  return (
    <motion.div className="w-full max-w-2xl mx-auto text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <h2 className="text-2xl font-black text-fuchsia-400 mb-4">Fin de la manche {pub.round}</h2>

      {mojoPlayer && (
        <div className="mb-4">
          {pub.mojoScoreZero ? (
            <p className="text-emerald-400 font-bold">{mojoPlayer.name} a le Mojo et le meilleur score ! (0 points)</p>
          ) : pub.mojoPenalty ? (
            <p className="text-red-400 font-bold">{mojoPlayer.name} a le Mojo mais pas le meilleur score (+10 penalite)</p>
          ) : null}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {pub.players.map(p => {
          const hand = pub.revealedHands?.[p.id] || []
          const score = pub.roundScores?.[p.id] ?? 0
          return (
            <div key={p.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">
                  {p.name} {p.hasMojo && <span className="text-fuchsia-400">(mojo)</span>}
                </span>
                <span className={`font-bold ${score === 0 ? 'text-emerald-400' : 'text-red-400'}`}>+{score}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {hand.map((c, i) => <CardView key={i} card={c} small />)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-3 mb-4">
        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Score total</p>
        {pub.players.map(p => (
          <div key={p.id} className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">{p.name}</span>
            <span className="text-slate-400 font-mono">{(pub.scores[p.id] || []).reduce((a, b) => a + b, 0)} / 50</span>
          </div>
        ))}
      </div>

      {priv.isHost && (
        <button onClick={() => sock.nextRound()} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 transition-all">Manche suivante</button>
      )}
    </motion.div>
  )
}

// ── Game Over ──

function GameOver({ pub, priv, sock, onBack }: { pub: MojoPublicState; priv: MojoPrivateState; sock: Sock; onBack: () => void }) {
  const winner = pub.players.find(p => p.id === pub.winnerId)
  const sorted = [...pub.players].sort((a, b) => {
    const sa = (pub.scores[a.id] || []).reduce((x, y) => x + y, 0)
    const sb = (pub.scores[b.id] || []).reduce((x, y) => x + y, 0)
    return sa - sb
  })
  return (
    <motion.div className="w-full max-w-md mx-auto text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <h1 className="text-4xl font-black text-fuchsia-400 mb-2">Partie terminee !</h1>
      {winner && <p className="text-lg text-emerald-400 font-bold mb-6">{winner.name} gagne !</p>}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6">
        {sorted.map((p, i) => {
          const total = (pub.scores[p.id] || []).reduce((a, b) => a + b, 0)
          return (
            <div key={p.id} className={`flex justify-between items-center py-2 ${i > 0 ? 'border-t border-slate-700/50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black ${i === 0 ? 'text-fuchsia-400' : 'text-slate-500'}`}>{i + 1}.</span>
                <span className="text-slate-300 font-semibold">{p.name}</span>
              </div>
              <span className="font-mono text-slate-400">{total} pts</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3 justify-center">
        {priv.isHost && <button onClick={() => sock.resetGame()} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 transition-all">Nouvelle partie</button>}
        <button onClick={onBack} className="px-6 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors">Quitter</button>
      </div>
    </motion.div>
  )
}
