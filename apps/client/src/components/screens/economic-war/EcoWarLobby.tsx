import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useEcoWarSocket } from './hooks/useEcoWarSocket'
import type { GameConfig, CountryProfile } from '@undercover/shared'
import { ResourcePanel } from './components/ResourcePanel'
import { Leaderboard } from './components/Leaderboard'
import { ActionSelector } from './components/ActionSelector'
import { MarketEventCard } from './components/MarketEventCard'
import { CountryCard } from './components/CountryCard'
import { JournalPanel } from './components/JournalPanel'
import { NotificationPanel } from './components/NotificationPanel'
import { ResolutionTimeline } from './components/ResolutionTimeline'
import { TradeModal } from './components/TradeModal'
import { OrganizationPanel } from './components/OrganizationPanel'
import { ThreatModal } from './components/ThreatModal'
import { ChatPanel } from './components/ChatPanel'

interface EcoWarLobbyProps {
  onBack: () => void
}

export function EcoWarLobby({ onBack }: EcoWarLobbyProps) {
  const game = useEcoWarSocket()
  const pub = game.publicState

  const renderView = () => {
    if (!pub) {
      return <LandingView game={game} onBack={onBack} />
    }

    switch (pub.phase) {
      case 'lobby':
        return <LobbyView game={game} onBack={onBack} />
      case 'countrySelection':
        return <CountrySelectionView game={game} />
      case 'preparation':
        return <PreparationView game={game} />
      case 'actionSelection':
        return <ActionSelectionView game={game} />
      case 'resolution':
        return <ResolutionView game={game} />
      case 'marketEvent':
        return <MarketEventView game={game} />
      case 'roundSummary':
        return <RoundSummaryView game={game} />
      case 'victory':
        return <VictoryView game={game} onBack={onBack} />
      default:
        return <LandingView game={game} onBack={onBack} />
    }
  }

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
    >
      {renderView()}
    </motion.div>
  )
}

// ─── Types ───────────────────────────────────────────────────

type GameHook = ReturnType<typeof useEcoWarSocket>

// ─── Landing View ────────────────────────────────────────────

function LandingView({ game, onBack }: { game: GameHook; onBack: () => void }) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [tab, setTab] = useState<'create' | 'join'>('create')

  const handleCreate = () => {
    if (!playerName.trim()) return
    game.createRoom(playerName)
  }

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return
    game.joinRoom(roomCode, playerName)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <h1 className="text-2xl font-black">
          <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            Empire du Commerce
          </span>
        </h1>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Bâtissez un empire économique. Gérez vos ressources, votre armée, votre recherche et votre diplomatie pour dominer le monde.
      </p>

      <input
        type="text"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Votre nom"
        maxLength={24}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      <div className="flex gap-2">
        <button
          onClick={() => setTab('create')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
            tab === 'create' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          Créer
        </button>
        <button
          onClick={() => setTab('join')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
            tab === 'join' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          Rejoindre
        </button>
      </div>

      {tab === 'create' ? (
        <button
          onClick={handleCreate}
          disabled={!playerName.trim() || !game.connectionInfo.connected}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          Créer une salle
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Code de la salle"
            maxLength={6}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase tracking-widest text-center font-mono text-lg"
          />
          <button
            onClick={handleJoin}
            disabled={!playerName.trim() || !roomCode.trim() || !game.connectionInfo.connected}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            Rejoindre
          </button>
        </div>
      )}

      {game.error && (
        <p className="text-sm text-red-500 text-center font-medium">{game.error}</p>
      )}

      {!game.connectionInfo.connected && (
        <p className="text-sm text-slate-500 text-center">Connexion au serveur...</p>
      )}
    </div>
  )
}

// ─── Lobby View ──────────────────────────────────────────────

function LobbyView({ game, onBack }: { game: GameHook; onBack: () => void }) {
  const pub = game.publicState!
  const config = pub.config

  const handleConfigChange = (partial: Partial<GameConfig>) => {
    game.setConfig(partial)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <BackButton onClick={onBack} />
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Code de salle</p>
          <p className="text-2xl font-black tracking-widest text-slate-900 dark:text-slate-100 font-mono">
            {game.connectionInfo.roomCode}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Players */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Joueurs ({pub.players.length}/{config.maxPlayers})
        </p>
        <div className="space-y-1">
          {pub.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
              {p.id === pub.hostId && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  Hôte
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Config (host only) */}
      {game.connectionInfo.isHost && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Configuration</p>

          <ConfigSlider label="Actions par tour" value={config.actionsPerTurn} min={3} max={10} step={1}
            onChange={(v) => handleConfigChange({ actionsPerTurn: v })} />
          <ConfigSlider label="Capital de départ" value={config.startingCapital} min={2000} max={10000} step={1000}
            onChange={(v) => handleConfigChange({ startingCapital: v })} />
          {config.countryDraftMode === 'draft' && (
            <ConfigSlider label="Temps par pays en draft (s)" value={config.draftTimerSeconds} min={15} max={60} step={5}
              onChange={(v) => handleConfigChange({ draftTimerSeconds: v })} />
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mode draft pays</span>
            <button
              onClick={() => handleConfigChange({
                countryDraftMode: config.countryDraftMode === 'draft' ? 'random' : 'draft',
              })}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                config.countryDraftMode === 'draft'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {config.countryDraftMode === 'draft' ? 'Draft' : 'Aléatoire'}
            </button>
          </div>
        </div>
      )}

      {/* Start button */}
      {game.connectionInfo.isHost ? (
        <button
          onClick={game.startGame}
          disabled={pub.players.length < config.minPlayers}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {pub.players.length < config.minPlayers
            ? `${config.minPlayers - pub.players.length} joueur(s) manquant(s)`
            : 'Lancer la partie'}
        </button>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">En attente du lancement par l'hôte...</p>
      )}
    </div>
  )
}

// ─── Country Selection View ──────────────────────────────────

function CountrySelectionView({ game }: { game: GameHook }) {
  const pub = game.publicState!
  const countryList = game.countryList
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!countryList) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Chargement des pays...</p>
      </div>
    )
  }

  const handleSelect = (country: CountryProfile) => {
    if (countryList.takenIds.includes(country.id)) return
    setSelectedId(country.id)
    game.selectCountry(country.id)
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Choisissez votre pays</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Sélectionnez un pays pour commencer votre empire
        </p>
        {game.timer !== null && (
          <p className={`text-2xl font-black tabular-nums mt-2 ${game.timer <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-slate-100'}`}>
            {game.timer}s
          </p>
        )}
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {countryList.countries.map((country) => (
          <CountryCard
            key={country.id}
            country={country}
            selected={selectedId === country.id}
            taken={countryList.takenIds.includes(country.id)}
            onClick={() => handleSelect(country)}
          />
        ))}
      </div>

      {/* Who has picked */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-3">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Joueurs</p>
        <div className="flex flex-wrap gap-2">
          {pub.players.map((p) => {
            const hasCountry = p.countryId && p.countryId.length > 0
            return (
              <span
                key={p.id}
                className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  hasCountry
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.countryFlag && `${p.countryFlag} `}
                {p.name}
                {hasCountry ? ' ✓' : ' ...'}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Preparation View ────────────────────────────────────────

function PreparationView({ game }: { game: GameHook }) {
  const pub = game.publicState!
  const priv = game.privateState

  return (
    <div className="space-y-4">
      <PhaseHeader round={pub.currentRound} title="Préparation" subtitle="Revenus collectés, état de votre empire" />

      {priv && <ResourcePanel state={priv} />}
      {priv && <NotificationPanel notifications={priv.notifications} />}

      <Leaderboard entries={pub.leaderboard} currentPlayerId={game.connectionInfo.playerId} />

      {pub.journalHeadlines.length > 0 && (
        <JournalPanel headlines={pub.journalHeadlines} />
      )}

      <DiplomacyBar game={game} />

      <div className="flex gap-2">
        <button
          onClick={game.markReady}
          className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg active:scale-[0.98] transition-transform"
        >
          Prêt
        </button>
        <button
          onClick={game.abandon}
          className="px-4 py-3 rounded-xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-transform"
        >
          Abandonner
        </button>
      </div>
    </div>
  )
}

// ─── Action Selection View ───────────────────────────────────

function ActionSelectionView({ game }: { game: GameHook }) {
  const pub = game.publicState!
  const priv = game.privateState

  const submittedCount = pub.players.filter((p) => p.actionsSubmitted).length
  const hasSubmitted = priv?.submittedActions !== null && priv?.submittedActions !== undefined

  return (
    <div className="space-y-4">
      <PhaseHeader
        round={pub.currentRound}
        title="Phase d'action"
        subtitle={`${submittedCount}/${pub.players.filter(p => !p.abandoned).length} joueurs ont soumis`}
      />

      {priv && <ResourcePanel state={priv} compact />}

      <ActionSelector
        players={pub.players}
        currentPlayerId={game.connectionInfo.playerId}
        maxActions={pub.config.actionsPerTurn}
        timeRemaining={game.timer}
        onSubmit={game.submitActions}
        hasSubmitted={hasSubmitted}
        activeWars={pub.activeWars}
      />

      {/* Active wars & threats summary */}
      {pub.activeWars.length > 0 && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/20 p-3">
          <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Guerres actives</p>
          {pub.activeWars.map((w) => (
            <p key={w.id} className="text-xs text-red-800 dark:text-red-200">
              ⚔️ {w.attackerName} vs {w.defenderName} (tour {w.duration})
            </p>
          ))}
        </div>
      )}

      {pub.pendingThreats.length > 0 && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/20 p-3">
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Menaces</p>
          {pub.pendingThreats.map((t) => (
            <p key={t.id} className="text-xs text-amber-800 dark:text-amber-200">
              💣 {t.attackerName} menace {t.targetName}: {t.demand}
            </p>
          ))}
        </div>
      )}

      <DiplomacyBar game={game} />
    </div>
  )
}

// ─── Resolution View ─────────────────────────────────────────

function ResolutionView({ game }: { game: GameHook }) {
  const pub = game.publicState!
  const entries = game.resolutionLog

  return (
    <div className="space-y-5">
      <PhaseHeader round={pub.currentRound} title="Résolution" subtitle="Les actions sont en cours de traitement..." />

      {entries.length > 0 ? (
        <ResolutionTimeline entries={entries} />
      ) : (
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            className="text-5xl block mb-4"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          >
            ⚙️
          </motion.span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Défense, sabotage, guerres, production, commerce, événements, population, scores...
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Market Event View ───────────────────────────────────────

function MarketEventView({ game }: { game: GameHook }) {
  const pub = game.publicState!

  return (
    <div className="space-y-5">
      <PhaseHeader round={pub.currentRound} title="" subtitle="" />

      {pub.marketEvent ? (
        <MarketEventCard event={pub.marketEvent} />
      ) : (
        <div className="text-center py-8">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Pas d'événement ce tour</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Le marché reste stable.</p>
        </div>
      )}
    </div>
  )
}

// ─── Round Summary View ──────────────────────────────────────

function RoundSummaryView({ game }: { game: GameHook }) {
  const pub = game.publicState!
  const priv = game.privateState

  return (
    <div className="space-y-4">
      <PhaseHeader
        round={pub.currentRound}
        title="Bilan de la manche"
        subtitle=""
      />

      {priv && <ResourcePanel state={priv} />}
      {priv && <NotificationPanel notifications={priv.notifications} />}

      {/* Espionage results */}
      {priv && priv.espionageResults.length > 0 && (
        <div className="rounded-xl border border-purple-200/80 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/20 p-3 space-y-1">
          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Renseignements
          </p>
          {priv.espionageResults.map((spy) => (
            <p key={spy.id} className="text-xs text-slate-800 dark:text-slate-200">
              🕵️ {spy.targetDescription} — {spy.outcome.replace(/_/g, ' ')}
              {spy.damagePercent > 0 && ` (${spy.damagePercent}% dégâts, ${spy.damageDuration} tours)`}
            </p>
          ))}
        </div>
      )}

      <Leaderboard entries={pub.leaderboard} currentPlayerId={game.connectionInfo.playerId} showDetails />

      {pub.journalHeadlines.length > 0 && (
        <JournalPanel headlines={pub.journalHeadlines} />
      )}

      <DiplomacyBar game={game} />

      <div className="flex gap-2">
        <button
          onClick={game.markReady}
          className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg active:scale-[0.98] transition-transform"
        >
          Prêt pour la manche suivante
        </button>
        <button
          onClick={game.abandon}
          className="px-4 py-3 rounded-xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-transform"
        >
          Abandonner
        </button>
      </div>
    </div>
  )
}

// ─── Victory View ────────────────────────────────────────────

function VictoryView({ game, onBack }: { game: GameHook; onBack: () => void }) {
  const pub = game.publicState!
  const winner = pub.leaderboard[0]
  const isWinner = winner?.playerId === game.connectionInfo.playerId

  return (
    <div className="space-y-5">
      <div className="text-center py-4">
        <motion.span
          className="text-6xl block mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {isWinner ? '🏆' : '🏁'}
        </motion.span>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
          {isWinner ? 'Victoire !' : 'Fin de partie'}
        </h2>
        {winner && (
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            {winner.countryFlag} {winner.playerName} ({winner.countryName}) remporte la partie !
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Score final: {winner?.score.toLocaleString('fr-FR')}
        </p>
      </div>

      <Leaderboard entries={pub.leaderboard} currentPlayerId={game.connectionInfo.playerId} showDetails />

      {pub.journalHeadlines.length > 0 && (
        <JournalPanel headlines={pub.journalHeadlines} />
      )}

      <div className="space-y-2">
        <button
          onClick={game.resetGame}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg active:scale-[0.98] transition-transform"
        >
          Nouvelle partie
        </button>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 active:scale-[0.98] transition-transform"
        >
          Retour au menu
        </button>
      </div>
    </div>
  )
}

// ─── Diplomacy Bar ──────────────────────────────────────────

function DiplomacyBar({ game }: { game: GameHook }) {
  const [openModal, setOpenModal] = useState<'trade' | 'org' | 'threat' | 'chat' | null>(null)
  const pub = game.publicState!

  const tradeCount = game.incomingTrades.length
  const threatCount = game.incomingThreats.length
  const unreadChat = game.chatMessages.filter(m => m.from !== game.connectionInfo.playerId).length

  return (
    <>
      <div className="flex gap-2">
        <DiplomacyButton icon="📦" label="Commerce" badge={tradeCount} onClick={() => setOpenModal('trade')} />
        <DiplomacyButton icon="🏛️" label="Orgs" badge={0} onClick={() => setOpenModal('org')} />
        <DiplomacyButton icon="💣" label="Menaces" badge={threatCount} onClick={() => setOpenModal('threat')} />
        <DiplomacyButton icon="💬" label="Chat" badge={unreadChat > 0 ? unreadChat : 0} onClick={() => setOpenModal('chat')} />
      </div>

      <AnimatePresence>
        {openModal === 'trade' && (
          <TradeModal
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            incomingTrades={game.incomingTrades}
            onPropose={game.proposeTrade}
            onRespond={game.respondToTrade}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'org' && (
          <OrganizationPanel
            organizations={pub.organizations}
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            onCreate={game.createOrganization}
            onVote={game.voteInOrganization}
            onLeave={game.leaveOrganization}
            onProposeVote={game.proposeOrgVote}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'threat' && (
          <ThreatModal
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            incomingThreats={game.incomingThreats}
            pendingThreats={pub.pendingThreats}
            onDeclare={game.declareThreat}
            onRespond={game.respondToThreat}
            onExecute={game.executeThreat}
            onWithdraw={game.withdrawThreat}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'chat' && (
          <ChatPanel
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            messages={game.chatMessages}
            onSend={game.sendChatMessage}
            onClose={() => setOpenModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function DiplomacyButton({ icon, label, badge, onClick }: { icon: string; label: string; badge: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 relative flex flex-col items-center gap-0.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/90 transition-colors active:scale-[0.98]"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black">
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Shared Components ───────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

function PhaseHeader({ round, title, subtitle }: { round: number; title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
        Manche {round}
      </p>
      {title && <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{title}</h2>}
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ConfigSlider({ label, value, min, max, step, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value.toLocaleString('fr-FR')}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  )
}
