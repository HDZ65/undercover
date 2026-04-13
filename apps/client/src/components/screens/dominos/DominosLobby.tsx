import { useState } from 'react'
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
          <button onClick={() => setMode('create')} className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
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
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-400"
            maxLength={20}
          />
          <button
            onClick={() => name.trim() && onCreateRoom(name.trim())}
            disabled={!name.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl disabled:opacity-50"
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
            {p.id === pub.hostId && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">Hôte</span>}
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
                    ? 'bg-amber-500 text-white'
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
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
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
      <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 italic text-lg">
        Plateau vide — posez le premier domino !
      </div>
    )
  }

  // Each horizontal tile is ~60px wide. Calculate tiles per row based on container.
  const tileW = 62 // approx width of a horizontal tile at size=28
  const maxPerRow = Math.max(4, Math.floor((typeof window !== 'undefined' ? window.innerWidth - 40 : 800) / tileW))

  // Split tiles into rows (snake: even rows L→R, odd rows R→L visually)
  const rows: (typeof board.tiles[number])[][] = []
  for (let i = 0; i < board.tiles.length; i += maxPerRow) {
    const row = board.tiles.slice(i, i + maxPerRow)
    rows.push(row)
  }

  return (
    <div className="py-2 px-2 space-y-1 overflow-x-auto">
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`flex items-center gap-0.5 ${rowIdx % 2 === 1 ? 'flex-row-reverse' : ''}`}
        >
          {row.map((bt, i) => {
            // flipped controls which pip faces which direction on the board
            const displayTile = bt.flipped
              ? { ...bt.tile, top: bt.tile.bottom, bottom: bt.tile.top }
              : bt.tile

            return (
              <motion.div
                key={`${bt.tile.id}-${rowIdx}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <DominoTileComponent tile={displayTile} size={28} horizontal />
              </motion.div>
            )
          })}
          {/* Arrow indicator for row continuation */}
          {rowIdx < rows.length - 1 && (
            <span className="text-slate-400 text-lg px-1">
              {rowIdx % 2 === 0 ? '↓' : '↓'}
            </span>
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
    <div className="flex flex-wrap gap-2 justify-center py-2">
      {hand.map(tile => (
        <DominoTileComponent
          key={tile.id}
          tile={tile}
          playable={playableIds.includes(tile.id)}
          selected={selectedTileId === tile.id}
          onClick={() => playableIds.includes(tile.id) && onSelectTile(tile.id)}
          size={36}
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

  // Auto-choose if only one option
  if (canLeft && !canRight) { onChoose('left'); return null }
  if (canRight && !canLeft) { onChoose('right'); return null }
  if (board.leftEnd === -1) { onChoose('left'); return null }

  return (
    <motion.div
      className="flex gap-3 justify-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => onChoose('left')}
        disabled={!canLeft}
        className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg disabled:opacity-30 hover:bg-blue-600 active:scale-95 transition-all"
      >
        ← Gauche ({board.leftEnd})
      </button>
      <button onClick={onCancel} className="px-3 py-2 text-slate-400 hover:text-slate-600">
        Annuler
      </button>
      <button
        onClick={() => onChoose('right')}
        disabled={!canRight}
        className="px-4 py-2 bg-purple-500 text-white font-bold rounded-lg disabled:opacity-30 hover:bg-purple-600 active:scale-95 transition-all"
      >
        Droite ({board.rightEnd}) →
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

  // Compute HP: my HP = 100% minus OPPONENT's total score percentage
  // If opponent has 0 points → my bar is full. If opponent reaches targetScore → I'm dead.
  const getHpForPlayer = (playerId: string) => {
    const opponents = pub.players.filter(p => p.id !== playerId)
    const maxOpponentScore = Math.max(0, ...opponents.map(p => p.totalScore))
    return Math.max(0, 100 - (maxOpponentScore / pub.targetScore) * 100)
  }

  return (
    <div className="w-full h-full flex flex-col gap-3 px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">Manche {pub.round} • Score cible : {pub.targetScore}</span>
        <span className="text-sm text-slate-500">Pioche : {pub.boneyardCount}</span>
      </div>

      {/* Characters bar */}
      <div className="flex justify-around items-end px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        {pub.players.map(p => {
          const hp = getHpForPlayer(p.id)
          const isCurrent = pub.currentPlayerId === p.id
          return (
            <div key={p.id} className={`relative ${isCurrent ? 'ring-2 ring-amber-400 rounded-xl p-2' : 'p-2'}`}>
              <PixelCharacter
                characterIndex={p.characterIndex}
                hp={hp}
                name={p.name}
                score={p.totalScore}
                size={5}
              />
              <div className="text-center text-xs text-slate-400 mt-1">{p.tileCount} tuiles</div>
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="flex-1 bg-emerald-800/10 dark:bg-emerald-900/20 rounded-2xl border border-emerald-700/20 min-h-[100px] flex items-center overflow-hidden">
        <BoardView board={pub.board} />
      </div>

      {/* Turn indicator */}
      <div className="text-center">
        {isMyTurn ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">C'est votre tour !</span>
        ) : (
          <span className="text-slate-500">Au tour de {pub.players.find(p => p.id === pub.currentPlayerId)?.name ?? '...'}</span>
        )}
      </div>

      {/* End chooser */}
      {selectedTile && isMyTurn && (
        <EndChooser
          board={pub.board}
          tile={selectedTile}
          onChoose={(end) => {
            game.placeTile(selectedTile.id, end)
            setSelectedTileId(null)
          }}
          onCancel={() => setSelectedTileId(null)}
        />
      )}

      {/* Your hand */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
        <p className="text-xs text-slate-400 mb-2 text-center">Votre main ({priv.hand.length} tuiles)</p>
        <PlayerHand
          hand={priv.hand}
          playableIds={isMyTurn ? priv.playableTileIds : []}
          onSelectTile={id => setSelectedTileId(id === selectedTileId ? null : id)}
          selectedTileId={selectedTileId}
        />
      </div>

      {/* Action buttons */}
      {isMyTurn && (
        <div className="flex gap-3 justify-center">
          {priv.canDraw && (
            <button
              onClick={game.drawTile}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Piocher
            </button>
          )}
          {priv.canPass && (
            <button
              onClick={game.pass}
              className="px-6 py-3 bg-gradient-to-r from-slate-500 to-slate-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Passer
            </button>
          )}
        </div>
      )}

      {/* Last action */}
      {pub.lastAction && (
        <p className="text-center text-xs text-slate-400">
          {pub.players.find(p => p.id === pub.lastAction?.playerId)?.name}
          {pub.lastAction.action === 'placed' && ' a posé un domino'}
          {pub.lastAction.action === 'drew' && ' a pioché'}
          {pub.lastAction.action === 'passed' && ' a passé'}
        </p>
      )}
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
          <p className="text-amber-500 font-bold">{winner.totalScore} points</p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            <span className="text-lg font-bold text-slate-400 w-6">{i + 1}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{p.totalScore} pts</span>
          </div>
        ))}
      </div>

      {priv.isHost && (
        <button onClick={onReset} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg">
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
    <div className={isGamePhase ? 'fixed inset-0 z-10 flex flex-col overflow-auto bg-gradient-to-b from-stone-100 to-amber-50 dark:from-slate-900 dark:to-slate-950' : 'w-full'}>
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
