import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { DominoTile, DominosPublicState, DominosPrivateState, BoardState } from '@undercover/shared'
import { useDominosSocket } from './useDominosSocket'
import { DominoTileComponent } from './DominoTile'
import { PixelCharacter } from './PixelCharacter'
import { CombatOverlay } from './CombatOverlay'

// ─── Landing ─────────────────────────────────────────────────────

function Landing({ onCreateRoom, onJoinRoom }: {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')

  return (
    <motion.div
      className="w-full max-w-md mx-auto space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100">Dominos</h1>
        <p className="text-slate-500 dark:text-slate-400">Posez, piochez, combattez !</p>
      </div>

      {mode === 'menu' && (
        <div className="space-y-3">
          <button onClick={() => setMode('create')} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
            Créer une partie
          </button>
          <button onClick={() => setMode('join')} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
            Rejoindre une partie
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Votre pseudo"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400"
            maxLength={20}
          />
          <button
            onClick={() => name.trim() && onCreateRoom(name.trim())}
            disabled={!name.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-50"
          >
            Créer
          </button>
          <button onClick={() => setMode('menu')} className="w-full py-2 text-slate-500">Retour</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Votre pseudo"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400"
            maxLength={20}
          />
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Code du salon"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-400 tracking-widest text-center font-mono text-xl"
            maxLength={6}
          />
          <button
            onClick={() => name.trim() && joinCode.trim() && onJoinRoom(joinCode.trim(), name.trim())}
            disabled={!name.trim() || joinCode.length < 4}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-50"
          >
            Rejoindre
          </button>
          <button onClick={() => setMode('menu')} className="w-full py-2 text-slate-500">Retour</button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Lobby ────────────────────────────────────────────────────────

function LobbyPhase({ pub, priv, onStart, onSetTarget, onLeave }: {
  pub: DominosPublicState
  priv: DominosPrivateState
  onStart: () => void
  onSetTarget: (v: number) => void
  onLeave: () => void
}) {
  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Salon {pub.roomCode}</h2>
        <p className="text-sm text-slate-500">{pub.players.length}/4 joueurs</p>
      </div>

      <div className="space-y-2">
        {pub.players.map(p => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${p.connected ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-900 opacity-50'} border border-slate-200 dark:border-slate-700`}>
            <PixelCharacter characterIndex={p.characterIndex} hp={100} name="" size={3} />
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            {p.id === pub.hostId && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">Hôte</span>}
          </div>
        ))}
      </div>

      {priv.isHost && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Score cible</span>
            <div className="flex gap-2">
              {[50, 100, 150, 200].map(v => (
                <button
                  key={v}
                  onClick={() => onSetTarget(v)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${pub.targetScore === v
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onStart}
            disabled={pub.players.length < 2}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Lancer la partie ({pub.players.length}/2 min)
          </button>
        </div>
      )}

      <button onClick={onLeave} className="w-full py-2 text-red-500 font-medium">Quitter</button>
    </motion.div>
  )
}

// ─── Board View ──────────────────────────────────────────────────
// Dominos displayed horizontally. When the board is too wide, tiles wrap
// and continue on the next row going the opposite direction (snake pattern).

function BoardView({ board }: { board: BoardState }) {
  if (board.tiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400/60 dark:text-slate-500/60 italic text-lg opacity-70">
        <div className="text-4xl mb-4">🀱</div>
        Plateau vide — posez le premier domino !
      </div>
    )
  }

  // Each horizontal tile is ~60px wide. Calculate tiles per row based on container.
  const tileW = 66 // approx width of a horizontal tile at new larger sizes
  const maxPerRow = Math.max(4, Math.floor((typeof window !== 'undefined' ? window.innerWidth - 60 : 800) / tileW))

  // Split tiles into rows (snake: even rows L→R, odd rows R→L visually)
  const rows: (typeof board.tiles[number])[][] = []
  for (let i = 0; i < board.tiles.length; i += maxPerRow) {
    const row = board.tiles.slice(i, i + maxPerRow)
    rows.push(row)
  }

  return (
    <div className="py-6 px-4 space-y-3 w-full h-full flex flex-col justify-center bg-slate-800/80 dark:bg-slate-900/80 shadow-[inset_0_10px_30px_rgba(0,0,0,0.4)] rounded-3xl relative overflow-hidden border border-slate-700/50">
      {/* Subtle table texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
      
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`flex items-center justify-center gap-1 z-10 ${rowIdx % 2 === 1 ? 'flex-row-reverse' : ''}`}
        >
          {row.map((bt, i) => {
            // flipped controls which pip faces which direction on the board
            const displayTile = bt.flipped
              ? { ...bt.tile, top: bt.tile.bottom, bottom: bt.tile.top }
              : bt.tile

            return (
              <motion.div
                key={`${bt.tile.id}-${rowIdx}-${i}`}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <DominoTileComponent tile={displayTile} size={28} horizontal />
              </motion.div>
            )
          })}
          {/* Arrow indicator for row continuation */}
          {rowIdx < rows.length - 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-500 text-xl px-1">
              {rowIdx % 2 === 0 ? '↘' : '↙'}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Player Hand ─────────────────────────────────────────────────

function PlayerHand({ hand, playableIds, onSelectTile, selectedTileId }: {
  hand: DominoTile[]
  playableIds: number[]
  onSelectTile: (id: number) => void
  selectedTileId: number | null
}) {
  return (
    <div className="flex flex-wrap gap-3 justify-center py-4 px-2">
      {hand.map(tile => (
        <DominoTileComponent
          key={tile.id}
          tile={tile}
          playable={playableIds.includes(tile.id)}
          selected={selectedTileId === tile.id}
          onClick={() => playableIds.includes(tile.id) && onSelectTile(tile.id)}
          size={40}
        />
      ))}
    </div>
  )
}

// ─── End Chooser (left/right) ────────────────────────────────────

function EndChooser({ board, tile, onChoose, onCancel }: {
  board: BoardState
  tile: DominoTile
  onChoose: (end: 'left' | 'right') => void
  onCancel: () => void
}) {
  const canLeft = board.leftEnd === -1 || tile.top === board.leftEnd || tile.bottom === board.leftEnd
  const canRight = board.leftEnd === -1 || tile.top === board.rightEnd || tile.bottom === board.rightEnd

  // Auto-choose if only one option (in useEffect to avoid calling during render)
  useEffect(() => {
    if (canLeft && !canRight) { onChoose('left'); return }
    if (canRight && !canLeft) { onChoose('right'); return }
    if (board.leftEnd === -1) { onChoose('left'); return }
  }, [canLeft, canRight, board.leftEnd, onChoose])

  // Don't render buttons if auto-choosing
  if ((canLeft && !canRight) || (canRight && !canLeft) || board.leftEnd === -1) {
    return null
  }

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 bg-slate-900/95 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-slate-700 w-[90%] max-w-sm"
      initial={{ opacity: 0, scale: 0.9, y: '-45%' }}
      animate={{ opacity: 1, scale: 1, y: '-50%' }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="text-white font-bold text-lg mb-2">Où placer la tuile ?</div>
      <div className="flex justify-between w-full gap-4">
        <button
          onClick={() => onChoose('left')}
          disabled={!canLeft}
          className="flex-1 py-4 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-blue-600 to-blue-800 text-white font-bold rounded-2xl disabled:opacity-20 hover:ring-4 hover:ring-blue-400 active:scale-95 transition-all shadow-lg"
        >
          <span className="text-2xl">←</span>
          <span>Côté {board.leftEnd}</span>
        </button>
        <button
          onClick={() => onChoose('right')}
          disabled={!canRight}
          className="flex-1 py-4 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-purple-600 to-purple-800 text-white font-bold rounded-2xl disabled:opacity-20 hover:ring-4 hover:ring-purple-400 active:scale-95 transition-all shadow-lg"
        >
          <span className="text-2xl">→</span>
          <span>Côté {board.rightEnd}</span>
        </button>
      </div>
      <button onClick={onCancel} className="mt-2 text-slate-400 hover:text-white font-medium transition-colors">
        Annuler
      </button>
    </motion.div>
  )
}

// ─── Game Phase ──────────────────────────────────────────────────

function GamePhase({ pub, priv, game }: {
  pub: DominosPublicState
  priv: DominosPrivateState
  game: ReturnType<typeof useDominosSocket>
}) {
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null)
  const isMyTurn = pub.currentPlayerId === priv.playerId

  const selectedTile = selectedTileId !== null ? priv.hand.find(t => t.id === selectedTileId) : null

  const handleChooseEnd = useCallback((end: 'left' | 'right') => {
    if (selectedTileId === null) return
    game.placeTile(selectedTileId, end)
    setSelectedTileId(null)
  }, [selectedTileId, game])

  // Compute HP: my HP = 100% minus OPPONENT's total score percentage
  const getHpForPlayer = (playerId: string) => {
    const opponents = pub.players.filter(p => p.id !== playerId)
    const maxOpponentScore = Math.max(0, ...opponents.map(p => p.totalScore))
    return Math.max(0, 100 - (maxOpponentScore / pub.targetScore) * 100)
  }

  return (
    <div className="w-full h-full flex flex-col relative bg-[#0f172a] text-slate-200">
      {/* Header Info */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 shadow-md z-10 border-b border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Manche {pub.round}</span>
          <span className="text-sm font-medium text-slate-300">Objectif : {pub.targetScore} pts</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1 border border-slate-700">
          <span className="text-xs text-slate-400 font-medium">Pioche</span>
          <span className="font-bold text-white bg-slate-700 rounded px-2 py-0.5 shadow-inner">{pub.boneyardCount}</span>
        </div>
      </div>

      {/* Board & Characters Area */}
      <div className="flex-1 flex flex-col p-4 relative overflow-hidden">
        {/* Opponents/Players HUD */}
        <div className="flex justify-between items-start mb-2 z-10">
          {pub.players.map(p => {
            const hp = getHpForPlayer(p.id)
            const isCurrent = pub.currentPlayerId === p.id
            const isMe = p.id === priv.playerId
            return (
              <motion.div 
                key={p.id} 
                className={`relative flex items-center gap-3 bg-slate-800/80 backdrop-blur-md rounded-2xl p-2 pr-4 border shadow-lg transition-all ${
                  isCurrent ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-slate-700/50'
                }`}
                animate={isCurrent ? { y: [0, -4, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="bg-slate-900 rounded-xl p-1 relative shadow-inner">
                  <PixelCharacter
                    characterIndex={p.characterIndex}
                    hp={hp}
                    name={""} // name shown outside
                    score={p.totalScore}
                    size={3}
                  />
                  {/* Dominos count badge */}
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center border border-slate-800 shadow-sm">
                    {p.tileCount}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold truncate max-w-[80px] ${isMe ? 'text-amber-400' : 'text-slate-100'}`}>
                    {isMe ? 'Vous' : p.name}
                  </span>
                  {isCurrent && <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider">Joue</span>}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* The Table View */}
        <div className="flex-1 w-full min-h-[150px] flex items-center justify-center relative">
          <BoardView board={pub.board} />
        </div>

        {/* Turn indicator & Action Text */}
        <div className="h-8 flex justify-center items-center mt-3 z-10">
          <AnimatePresence mode="wait">
            {pub.lastAction ? (
               <motion.div
                 initial={{ opacity: 0, y: 10, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 key={pub.lastAction.playerId + pub.lastAction.action + pub.round}
                 className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 backdrop-blur-sm shadow-md"
               >
                 <span className="text-sm font-bold text-slate-300">
                   {pub.players.find(p => p.id === pub.lastAction?.playerId)?.name}
                 </span>
                 <span className="text-sm text-slate-400">
                   {pub.lastAction.action === 'placed' && 'a posé une tuile'}
                   {pub.lastAction.action === 'drew' && 'a pioché'}
                   {pub.lastAction.action === 'passed' && 'a passé son tour'}
                 </span>
               </motion.div>
            ) : (
               <motion.span 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                 className="text-slate-500/70 text-sm italic bg-slate-800/30 px-4 py-1 rounded-full"
               >
                 Que le combat commence !
               </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Your Hand (Dock) */}
      <div className="bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-slate-700/80 p-4 pb-8 z-20">
        <div className="flex justify-between items-center mb-3 px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isMyTurn ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-slate-600'}`} />
            <span className={`text-sm font-black tracking-wide ${isMyTurn ? 'text-amber-400' : 'text-slate-400'}`}>
              {isMyTurn ? "C'EST À VOUS !" : "EN ATTENTE..."}
            </span>
          </div>
          
          <div className="flex gap-2">
            {isMyTurn && priv.canDraw && (
              <button
                onClick={game.drawTile}
                className="px-4 py-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                Piocher (+1)
              </button>
            )}
            {isMyTurn && priv.canPass && (
              <button
                onClick={game.pass}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 font-bold text-sm rounded-xl transition-all shadow-sm"
              >
                Passer
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#1e293b]/50 rounded-2xl min-h-[140px] flex items-center justify-center border border-slate-700/50 shadow-inner overflow-x-auto w-full">
           <PlayerHand
             hand={priv.hand}
             playableIds={isMyTurn ? priv.playableTileIds : []}
             onSelectTile={id => setSelectedTileId(id === selectedTileId ? null : id)}
             selectedTileId={selectedTileId}
           />
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {selectedTile && isMyTurn && (
          <EndChooser
            board={pub.board}
            tile={selectedTile}
            onChoose={handleChooseEnd}
            onCancel={() => setSelectedTileId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Game Over ───────────────────────────────────────────────────

function GameOverPhase({ pub, priv, onReset }: {
  pub: DominosPublicState
  priv: DominosPrivateState
  onReset: () => void
}) {
  const winner = pub.players.find(p => p.id === pub.winnerId)
  const sorted = [...pub.players].sort((a, b) => b.totalScore - a.totalScore)

  return (
    <motion.div className="w-full max-w-md mx-auto space-y-6 text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <h1 className="text-3xl font-black text-amber-500">Victoire !</h1>
      {winner && (
        <div className="flex flex-col items-center gap-2">
          <PixelCharacter characterIndex={winner.characterIndex} hp={100} name={winner.name} isVictorious size={6} />
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{winner.name} remporte la partie !</p>
          <p className="text-blue-500 font-bold">{winner.totalScore} points</p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${i === 0 ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            <span className="text-lg font-bold text-slate-400 w-6">{i + 1}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{p.totalScore} pts</span>
          </div>
        ))}
      </div>

      {priv.isHost && (
        <button onClick={onReset} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg">
          Nouvelle partie
        </button>
      )}
    </motion.div>
  )
}

// ─── Main ────────────────────────────────────────────────────────

export function DominosLobby({ onBack }: { onBack: () => void }) {
  const game = useDominosSocket()
  const { publicState: pub, privateState: priv, combatAnimation, clearCombatAnimation } = game

  // No room — show landing
  if (!pub || !priv) {
    return (
      <>
        <Landing
          onCreateRoom={game.createRoom}
          onJoinRoom={game.joinRoom}
        />
        <button onClick={onBack} className="mt-8 text-sm text-slate-400 hover:text-slate-600">← Retour au menu</button>
        {game.error && <p className="mt-4 text-red-500 font-medium">{game.error}</p>}
      </>
    )
  }

  const isGamePhase = pub.phase === 'playerTurn'

  return (
    <div className={isGamePhase ? 'fixed inset-0 z-10 flex flex-col overflow-auto bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-blue-950' : 'w-full'}>
      <AnimatePresence mode="wait">
        {pub.phase === 'lobby' && (
          <LobbyPhase
            key="lobby"
            pub={pub}
            priv={priv}
            onStart={game.startGame}
            onSetTarget={game.setTargetScore}
            onLeave={game.leaveRoom}
          />
        )}

        {pub.phase === 'playerTurn' && (
          <GamePhase key="game" pub={pub} priv={priv} game={game} />
        )}

        {pub.phase === 'roundEnd' && !combatAnimation && (
          <motion.div key="roundEnd-wait" className="text-center text-slate-400">
            Résolution de la manche...
          </motion.div>
        )}

        {pub.phase === 'gameOver' && (
          <GameOverPhase key="gameOver" pub={pub} priv={priv} onReset={game.resetGame} />
        )}
      </AnimatePresence>

      {/* Combat overlay */}
      <AnimatePresence>
        {combatAnimation && pub.phase === 'roundEnd' && (
          <CombatOverlay
            data={combatAnimation}
            players={pub.players}
            targetScore={pub.targetScore}
            onComplete={() => {
              clearCombatAnimation()
              game.nextRound()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
