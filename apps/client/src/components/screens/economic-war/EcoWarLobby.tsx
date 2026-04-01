import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useEcoWarSocket } from './hooks/useEcoWarSocket'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
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
import { ChatPanel } from './components/ChatPanel'
import { WorldMap } from './components/WorldMap'
import { StatsPanel } from './components/StatsPanel'
import { MiningPanel } from './components/MiningPanel'
import { FactoryPanel } from './components/FactoryPanel'
import { TerritoryPanel } from './components/TerritoryPanel'
import { TransportPanel } from './components/TransportPanel'
import WarPanel from './components/WarPanel'

interface EcoWarLobbyProps {
  onBack: () => void
}

export function EcoWarLobby({ onBack }: EcoWarLobbyProps) {
  const game = useEcoWarSocket()
  const pub = game.publicState
  const { setConnected } = useConnectionStatus()
  useEffect(() => { setConnected(game.connectionInfo.connected) }, [game.connectionInfo.connected, setConnected])
  // Lifted here so they survive phase transitions (DiplomacyBar would remount otherwise)
  const [lastReadChatTs, setLastReadChatTs] = useState(() => Date.now())
  const [seenOrgItemIds, setSeenOrgItemIds] = useState<Set<string>>(new Set())

  // Quitter la salle avant de retourner au menu principal
  const handleBack = () => {
    game.leaveRoom()
    onBack()
  }

  const gamePhases = ['preparation', 'actionSelection', 'roundSummary']
  const showDiplomacyBar = pub && gamePhases.includes(pub.phase)
  const showMapBanner = pub && !['lobby', 'countrySelection'].includes(pub.phase)

  const myPlayer = pub?.players.find(p => p.id === game.connectionInfo.playerId)
  const showCountryBadge = pub && gamePhases.includes(pub.phase) && myPlayer?.countryId

  const renderView = () => {
    if (!pub) {
      return <LandingView game={game} onBack={handleBack} />
    }

    switch (pub.phase) {
      case 'lobby':
        return <LobbyView game={game} onBack={handleBack} />
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
        return <VictoryView game={game} onBack={handleBack} />
      default:
        return <LandingView game={game} onBack={handleBack} />
    }
  }

  return (
    <>
      {showMapBanner && (
        <div className="fixed top-0 left-0 right-0 z-10">
          <WorldMap
            publicState={pub!}
            privateState={game.privateState ?? null}
            inline
            onAttackProvince={game.attackProvince}
            onOccupyNeutral={game.occupyNeutral}
            onTransferTroops={game.transferTroops}
            onFortifyProvince={game.fortifyProvince}
          />
        </div>
      )}
      <motion.div
        className="w-full max-w-2xl mx-auto"
        style={{ paddingTop: showMapBanner ? '33vh' : 0 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35 }}
      >
      {showCountryBadge && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-2xl">{myPlayer!.countryFlag}</span>
          <div>
            <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">{myPlayer!.countryName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Manche {pub!.currentRound}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-sm font-black text-amber-600 dark:text-amber-400">{(myPlayer!.score ?? 0).toLocaleString('fr-FR')} pts</p>
          </div>
        </div>
      )}
      {renderView()}
      {showDiplomacyBar && (
        <DiplomacyBar
          game={game}
          lastReadChatTs={lastReadChatTs}
          setLastReadChatTs={setLastReadChatTs}
          seenOrgItemIds={seenOrgItemIds}
          setSeenOrgItemIds={setSeenOrgItemIds}
        />
      )}
    </motion.div>
    </>
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
  const [search, setSearch] = useState('')

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

  const q = search.trim().toLowerCase()
  const filtered = q
    ? countryList.countries.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.flag.includes(search.trim()) ||
        c.id.includes(q)
      )
    : countryList.countries

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Choisissez votre pays</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {countryList.countries.length} pays disponibles
        </p>
        {game.timer !== null && (
          <p className={`text-2xl font-black tabular-nums mt-2 ${game.timer <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-slate-100'}`}>
            {game.timer}s
          </p>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un pays..."
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
      />

      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-4">Aucun pays trouvé</p>
        )}
        {filtered.map((country) => (
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

  const activePlayers = pub.players.filter(p => !p.abandoned && p.connected)
  const readyCount = activePlayers.filter(p => p.ready).length
  const totalCount = activePlayers.length
  const myPlayer = pub.players.find(p => p.id === game.connectionInfo.playerId)
  const alreadyReady = myPlayer?.ready ?? false
  const alreadyAbandoned = myPlayer?.abandoned ?? false

  return (
    <div className="space-y-4">
      <PhaseHeader round={pub.currentRound} title="Préparation" subtitle="Revenus collectés, état de votre empire" />

      {priv && <ResourcePanel state={priv} />}
      {priv && <NotificationPanel notifications={priv.notifications} />}

      <Leaderboard entries={pub.leaderboard} currentPlayerId={game.connectionInfo.playerId} />

      {pub.journalHeadlines.length > 0 && (
        <JournalPanel headlines={pub.journalHeadlines} />
      )}

      {/* Ready counter */}
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{readyCount}</span>
        <span>/</span>
        <span>{totalCount}</span>
        <span>joueurs prêts</span>
        <div className="flex gap-1 ml-1">
          {activePlayers.map(p => (
            <span key={p.id} title={p.name} className={`text-base ${p.ready ? 'grayscale-0' : 'grayscale opacity-40'}`}>
              {p.countryFlag || '🏴'}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={game.markReady}
          disabled={alreadyReady}
          className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
            alreadyReady
              ? 'bg-emerald-600/70 cursor-default opacity-80'
              : 'bg-gradient-to-r from-amber-500 to-orange-600'
          }`}
        >
          {alreadyReady ? '✓ En attente des autres joueurs...' : 'Prêt'}
        </button>
        {!alreadyAbandoned && (
          <button
            onClick={game.abandon}
            className="px-4 py-3 rounded-xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-transform"
          >
            Abandonner
          </button>
        )}
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
        researchBranches={priv?.research?.branches}
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

  const activePlayers = pub.players.filter(p => !p.abandoned && p.connected)
  const readyCount = activePlayers.filter(p => p.ready).length
  const totalCount = activePlayers.length
  const myPlayer = pub.players.find(p => p.id === game.connectionInfo.playerId)
  const alreadyReady = myPlayer?.ready ?? false
  const alreadyAbandoned = myPlayer?.abandoned ?? false

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

      {/* Ready counter */}
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{readyCount}</span>
        <span>/</span>
        <span>{totalCount}</span>
        <span>joueurs prêts pour la manche suivante</span>
        <div className="flex gap-1 ml-1">
          {activePlayers.map(p => (
            <span key={p.id} title={p.name} className={`text-base ${p.ready ? 'grayscale-0' : 'grayscale opacity-40'}`}>
              {p.countryFlag || '🏴'}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={game.markReady}
          disabled={alreadyReady}
          className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
            alreadyReady
              ? 'bg-emerald-600/70 cursor-default opacity-80'
              : 'bg-gradient-to-r from-amber-500 to-orange-600'
          }`}
        >
          {alreadyReady ? '✓ En attente des autres joueurs...' : 'Prêt pour la manche suivante'}
        </button>
        {!alreadyAbandoned && (
          <button
            onClick={game.abandon}
            className="px-4 py-3 rounded-xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-transform"
          >
            Abandonner
          </button>
        )}
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

function DiplomacyBar({
  game,
  lastReadChatTs,
  setLastReadChatTs,
  seenOrgItemIds,
  setSeenOrgItemIds,
}: {
  game: GameHook
  lastReadChatTs: number
  setLastReadChatTs: (ts: number) => void
  seenOrgItemIds: Set<string>
  setSeenOrgItemIds: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const [openModal, setOpenModal] = useState<'trade' | 'org' | 'chat' | 'map' | 'stats' | 'mining' | 'factory' | 'territory' | 'transport' | null>(null)
  const pub = game.publicState!
  const playerId = game.connectionInfo.playerId

  const tradeCount = game.incomingTrades.filter(t => t.toId === playerId).length
    + (game.incomingRegionPurchases?.length ?? 0)
  const unreadChat = game.chatMessages.filter(m => m.from !== playerId && m.timestamp > lastReadChatTs).length

  // Compute org pending items that need this player's attention
  const orgPendingIds: string[] = []
  for (const po of pub.pendingOrgs) {
    if (po.pendingIds.includes(playerId ?? '')) orgPendingIds.push(po.id)
  }
  for (const org of pub.organizations) {
    if (!org.memberIds.includes(playerId ?? '')) continue
    for (const req of org.joinRequests) {
      if (req.result === 'pending' && req.votes[playerId ?? ''] === null) {
        orgPendingIds.push(req.id)
      }
    }
    for (const vote of org.activeVotes) {
      if (vote.result === 'pending' && vote.type === 'expelMember' && vote.votes[playerId ?? ''] === null) {
        orgPendingIds.push(vote.id)
      }
    }
  }
  const orgBadge = orgPendingIds.filter(id => !seenOrgItemIds.has(id)).length

  useEffect(() => {
    if (openModal === 'chat') {
      setLastReadChatTs(Date.now())
    }
  }, [openModal, setLastReadChatTs])

  useEffect(() => {
    if (openModal === 'org') {
      setSeenOrgItemIds(prev => {
        const next = new Set(prev)
        for (const id of orgPendingIds) next.add(id)
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal])

  return (
    <>
      <div className="flex gap-2">
        <DiplomacyButton icon="📦" label="Commerce" badge={tradeCount} onClick={() => setOpenModal('trade')} />
        <DiplomacyButton icon="🏛️" label="Orgs" badge={orgBadge} onClick={() => setOpenModal('org')} />
        <DiplomacyButton icon="💬" label="Chat" badge={unreadChat > 0 ? unreadChat : 0} onClick={() => setOpenModal('chat')} />
        <DiplomacyButton icon="📊" label="Stats" badge={0} onClick={() => setOpenModal('stats')} />
        <DiplomacyButton icon="🏭" label="Usines" badge={0} onClick={() => setOpenModal('factory')} />
        <DiplomacyButton icon="⛏️" label="Extraction" badge={0} onClick={() => setOpenModal('mining')} />
        <DiplomacyButton icon="🗺️" label="Territoire" badge={0} onClick={() => setOpenModal('territory')} />
        <DiplomacyButton icon="🚛" label="Flotte" badge={0} onClick={() => setOpenModal('transport')} />
        <WarPanel
          privateState={game.privateState ?? null}
          publicState={pub}
          onSubmitAllocation={game.submitWarAllocation}
          onRecruitInfantry={game.recruitInfantry}
          onTrainInfantry={game.trainInfantry}
          onDeployTroops={game.deployTroops}
          onTransferTroops={game.transferTroops}
        />
      </div>

      <AnimatePresence>
        {openModal === 'trade' && (
          <TradeModal
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            incomingTrades={game.incomingTrades}
            myPrivateState={game.privateState}
            organizations={pub.organizations}
            activeAuctions={pub.activeAuctions}
            onPropose={game.proposeTrade}
            onRespond={game.respondToTrade}
            onBid={game.bidOnAuction}
            incomingRegionPurchases={game.incomingRegionPurchases ?? []}
            onRespondRegionPurchase={game.respondToRegionPurchase}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'org' && (
          <OrganizationPanel
            organizations={pub.organizations}
            pendingOrgs={pub.pendingOrgs}
            players={pub.players}
            currentPlayerId={game.connectionInfo.playerId}
            onCreate={game.createOrganization}
            onVote={game.voteInOrganization}
            onLeave={game.leaveOrganization}
            onProposeEmbargo={game.proposeEmbargo}
            onProposeAidRequest={game.proposeAidRequest}
            onCastAmountVote={game.castAmountVote}
            onRespondInvite={game.respondToOrgInvite}
            onRequestJoin={game.requestJoinOrg}
            onVoteJoinRequest={game.voteJoinRequest}
            onProposeExpel={game.proposeExpelMember}
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
        {openModal === 'stats' && game.privateState && (
          <StatsPanel
            state={game.privateState}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'factory' && game.privateState && (
          <FactoryPanel
            state={game.privateState}
            isActionPhase={pub.phase === 'actionSelection'}
            onClose={() => setOpenModal(null)}
            onReconvertFactory={(factoryId, newSector) =>
              game.submitFreeAction({
                type: 'invest',
                factoryReconversion: { factoryId, newSector },
                isFreeAction: true,
              })
            }
            onUpgradeFactory={(factoryId) => game.upgradeFactory(factoryId)}
            onSetProductionChoice={(sector, opts) =>
              game.setProductionChoice(sector, opts)
            }
          />
        )}
        {openModal === 'territory' && (
          <TerritoryPanel
            pub={pub}
            myPlayerId={game.connectionInfo.playerId ?? ''}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'transport' && game.privateState && (
          <TransportPanel
            state={game.privateState}
            playerNames={Object.fromEntries(pub.players.map(p => [p.id, p.countryName]))}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'mining' && game.privateState && (
          <MiningPanel
            state={game.privateState}
            onClose={() => setOpenModal(null)}
            onInvestAction={({ resource, type }) =>
              game.submitFreeAction({
                type: 'invest',
                miningAction: { resource, type },
                isFreeAction: true,
              })
            }
            onFarmAction={(action) =>
              game.submitFreeAction({
                type: 'invest',
                farmAction: action,
                isFreeAction: true,
              })
            }
            onLivestockAction={(action) =>
              game.submitFreeAction({
                type: 'invest',
                livestockAction: action,
                isFreeAction: true,
              })
            }
            onMarineAction={(action) =>
              game.submitFreeAction({
                type: 'invest',
                marineAction: action,
                isFreeAction: true,
              })
            }
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
