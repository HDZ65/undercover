# Empire du Commerce — Conception Technique

Version 1.0 — Février 2026

---

## 1. Architecture globale

### Stack technique

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                           │
│  React 18 + TypeScript + Vite + Tailwind CSS v4             │
│  Framer Motion (animations) + XState v5 (UI state local)    │
│  Socket.io-client → namespace /economic-war                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket (Socket.io)
┌──────────────────────▼──────────────────────────────────────┐
│                     SERVEUR NODE.JS                         │
│  Express + Socket.io (namespace /economic-war)              │
│  XState v5 (machine d'état par room = source de vérité)     │
│  Pas de BDD — état 100 % en mémoire (éphémère)             │
└─────────────────────────────────────────────────────────────┘
```

### Pourquoi pas de BDD

Les parties sont éphémères (45min–2h), l'état complet vit dans le context XState côté serveur. Comme pour Undercover, Poker et UNO, aucune persistence n'est nécessaire. Avantages :
- Zéro latence I/O pour la résolution des tours
- Pas de migration de schéma
- Cohérence parfaite (XState = single source of truth)
- Simplicité de déploiement (Render, pas besoin de managed DB)

Si une persistence est souhaitée plus tard (replays, stats), on pourra ajouter un snapshot JSON du context XState en fin de partie vers un fichier ou une BDD légère (SQLite via sql.js, même pattern que Poker).

### Authentification

Pas de comptes utilisateurs. Identification par **token aléatoire** (UUID v4) généré à la création/join de room, stocké en `localStorage`. Le serveur associe `{ roomCode, playerId, playerToken }`. La reconnexion utilise le token pour retrouver l'identité du joueur.

### Communication temps réel

Socket.io namespace `/economic-war` sur le serveur principal (`apps/server`). Même serveur que Undercover (`/`), Poker (`/poker`) et UNO (`/uno`). Le client se connecte au namespace dédié via :

```typescript
const socket = io(`${SERVER_URL}/economic-war`, { transports: ['websocket'] })
```

### Monorepo — Fichiers cibles

```
packages/shared/src/economic-war/   ← Types partagés (contrat client↔serveur)
  types.ts                          ← Interfaces, enums, constantes du jeu
  events.ts                         ← Socket.io event types (C→S et S→C)
  index.ts                          ← Barrel export

apps/server/src/economic-war/       ← Logique serveur
  constants.ts                      ← Toutes les constantes numériques du GDD
  countryProfiles.ts                ← Profils asymétriques des pays
  production.ts                     ← Calculs de production, revenus, PIB
  population.ts                     ← Croissance, migration, bonheur, révoltes
  commerce.ts                       ← Résolution des trades, frais, sanctions
  research.ts                       ← Arbre techno, brevets, éducation
  military.ts                       ← Forces armées, armement, bombardement, nucléaire
  espionage.ts                      ← Sabotage (réussite + visibilité), renseignement
  organizations.ts                  ← Création, votes, cotisations, expulsion
  marketEvents.ts                   ← Pool pondéré d'événements aléatoires
  journal.ts                        ← Génération des titres satiriques
  scoring.ts                        ← Score tri-axe, leaderboard, victoire
  resolution.ts                     ← Orchestration de la résolution (8 étapes)
  guards.ts                         ← Guards XState (validations)
  actions.ts                        ← Actions XState (assign)
  machine.ts                        ← Machine XState v5 principale
  roomManager.ts                    ← EcoWarRoomManager (namespace, rooms, broadcast)

apps/client/src/components/screens/economic-war/   ← UI client
  hooks/useEcoWarSocket.ts          ← Hook Socket.io (connexion, state, actions)
  components/                       ← Composants UI réutilisables
  EcoWarLobby.tsx                   ← Composant principal (switch sur phase)
  index.ts                          ← Barrel export
```

---

## 2. État du jeu (State Management)

### Principe : Serveur = Source de vérité, Client = Miroir

Il n'y a **pas** de Zustand, Redux ou Context API pour l'état du jeu. Le pattern est identique à UNO/Poker :

1. **Serveur** : XState v5 machine context = état complet du jeu
2. **Client** : un seul hook React (`useEcoWarSocket`) reçoit l'état via Socket.io et le stocke dans `useState`/`useReducer`
3. Les composants UI lisent l'état depuis le hook (passé en props ou via un Context léger)

### Côté serveur — XState Context

```typescript
interface EcoWarContext {
  // --- Room & Meta ---
  roomCode: string
  hostId: string
  config: GameConfig
  currentRound: number
  phase: GamePhase

  // --- Joueurs ---
  players: Map<string, ServerPlayerState>
  // ServerPlayerState contient TOUT : ressources, entreprises, armée,
  // recherche, brevets, population, bonheur, santé, pollution,
  // régions, organisations, relations diplomatiques, armes, bombes...

  // --- Tour en cours ---
  submittedActions: Map<string, PlayerTurnActions>  // playerId → actions soumises
  readyPlayers: Set<string>

  // --- Résolution ---
  resolutionLog: ResolutionEntry[]       // Log ordonné de tout ce qui s'est passé
  marketEvent: MarketEvent | null        // Événement aléatoire du tour
  journalHeadlines: string[]             // Titres satiriques du tour

  // --- Guerres & Diplomatie ---
  activeWars: War[]
  activeTreaties: Treaty[]
  organizations: Organization[]
  pendingTrades: Trade[]
  pendingThreats: Threat[]               // Menaces de bombardement en attente

  // --- Historique ---
  leaderboard: LeaderboardEntry[]
  roundHistory: RoundSummary[]           // Résumé de chaque tour passé
}
```

### Côté serveur — Public vs Private State

Le serveur ne broadcast **jamais** le context entier. Il projette deux vues :

```typescript
// Envoyé à TOUS les joueurs de la room
interface PublicGameState {
  phase: GamePhase
  currentRound: number
  config: GameConfig
  timer: number | null
  players: PublicPlayerInfo[]        // id, nom, pays, score, richesse tier, connecté
  leaderboard: LeaderboardEntry[]
  activeWars: PublicWarInfo[]
  organizations: PublicOrgInfo[]
  marketEvent: MarketEvent | null
  journalHeadlines: string[]
  pendingThreats: PublicThreatInfo[]  // Menaces publiques visibles par tous
}

// Envoyé UNIQUEMENT au joueur concerné
interface PrivatePlayerState {
  playerId: string
  resources: ResourceState           // Pétrole, minerais, agri, eau (quantités exactes)
  money: number
  population: PopulationState
  happiness: number
  health: number
  pollution: number
  regions: Region[]
  businesses: BusinessState          // Usines par type et tier
  research: ResearchState            // Niveaux par branche
  patents: Patent[]
  military: MilitaryState            // Forces armées, renseignement, armes, bombes
  infrastructure: InfraState         // Électricité, télécom, eau
  tourism: TourismState
  finance: FinanceState
  tools: ToolsState
  espionageResults: EspionageResult[] // Résultats de sabotage/espionnage
  availableActions: number            // Actions restantes ce tour
  submittedActions: PlayerTurnActions | null
  organizationMemberships: string[]   // IDs des orgas
  incomingTradeOffers: Trade[]
  notifications: Notification[]       // Alertes (sabotage détecté, etc.)
}
```

### Côté client — Hook useEcoWarSocket

Le hook maintient 3 pièces d'état :

```typescript
const [publicState, setPublicState] = useState<PublicGameState | null>(null)
const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null)
const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
  connected: false,
  playerId: null,
  roomCode: null,
  isHost: false,
})
```

Les composants UI ne font **aucun** appel serveur direct. Ils appellent des fonctions du hook qui émettent des événements Socket.io :

```typescript
// Le hook expose des actions typées
const {
  publicState, privateState, connectionInfo,
  createRoom, joinRoom, leaveRoom,
  setConfig, startGame,
  submitActions, markReady,
  proposeTrade, respondToTrade,
  createOrganization, voteInOrganization,
  respondToThreat,
} = useEcoWarSocket()
```

### Pourquoi pas Zustand/Redux ?

- L'état vient du serveur via Socket.io → un `useState` dans le hook suffit
- Pas de mutations locales optimistes (toute action passe par le serveur)
- La hiérarchie de composants est plate (EcoWarLobby distribue les props)
- Pattern identique à UNO/Poker qui fonctionnent déjà en production

### Context React léger (optionnel)

Si le prop drilling devient profond (>3 niveaux), on peut ajouter un `EcoWarContext` :

```typescript
const EcoWarContext = createContext<{
  publicState: PublicGameState | null
  privateState: PrivatePlayerState | null
  actions: EcoWarActions
}>()
```

Mais ce n'est pas un state manager — c'est un passeur de props.

---

## 3. Composants React principaux

### Arborescence des composants

```
EcoWarLobby.tsx (composant racine, switch sur phase)
├── views/
│   ├── LandingView.tsx           ← Créer/Rejoindre une room
│   ├── LobbyView.tsx             ← Salle d'attente, config, joueurs
│   ├── CountrySelectionView.tsx  ← Choix du pays (draft ou attribution)
│   ├── GameView.tsx              ← Vue principale en jeu (layout)
│   │   ├── TopBar.tsx            ← Tour, timer, boutons chat/settings
│   │   ├── WorldMap.tsx          ← Carte hexagonale interactive
│   │   ├── DashboardPanel.tsx    ← Dashboard national (sidebar droite)
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── ResourceBars.tsx
│   │   │   ├── LeaderboardMini.tsx
│   │   │   └── OrgBadges.tsx
│   │   ├── ActionBar.tsx         ← Barre d'actions en bas
│   │   └── NotificationStack.tsx ← Alertes empilées
│   ├── ResolutionView.tsx        ← Overlay de résolution animée
│   ├── MarketEventView.tsx       ← Carte événement marché
│   ├── RoundSummaryView.tsx      ← Résumé du tour
│   └── VictoryView.tsx           ← Écran de victoire / classement final
│
├── modals/
│   ├── InvestModal.tsx           ← Investir (usine, infra, énergie, recherche)
│   ├── TradeModal.tsx            ← Proposition commerciale
│   ├── SabotageModal.tsx         ← Opération de sabotage
│   ├── WarModal.tsx              ← Déclarer la guerre / armistice
│   ├── BombardmentModal.tsx      ← Bombardement / menace
│   ├── NuclearModal.tsx          ← Bombe nucléaire
│   ├── OrganizationModal.tsx     ← Créer/gérer/voter dans une orga
│   ├── DefenseModal.tsx          ← Options défensives
│   ├── DiplomacyModal.tsx        ← Accords bilatéraux
│   ├── CountryDetailModal.tsx    ← Fiche pays (clic sur la carte)
│   ├── SpyResultModal.tsx        ← Résultat d'espionnage
│   └── SanctionModal.tsx         ← Voter/appliquer des sanctions
│
├── components/ (réutilisables)
│   ├── JournalFeed.tsx           ← « Le Monde en Bref » (fil satirique)
│   ├── ChatPanel.tsx             ← Chat public + canaux privés
│   ├── ResolutionTimeline.tsx    ← Timeline animée des résolutions
│   ├── PlayerCard.tsx            ← Carte joueur (avatar, nom, pays, statut)
│   ├── ResourceBar.tsx           ← Barre de ressource (pétrole, eau, etc.)
│   ├── WealthTierBadge.tsx       ← Badge coloré selon le tier de richesse
│   ├── ActionButton.tsx          ← Bouton d'action avec coût et icône
│   ├── CountdownTimer.tsx        ← Timer animé (cercle qui se vide)
│   ├── ConfirmDialog.tsx         ← Dialogue de confirmation
│   └── Tooltip.tsx               ← Tooltip informatif
│
└── hooks/
    └── useEcoWarSocket.ts        ← Hook Socket.io principal
```

### Détail des vues principales

#### LandingView
- Input pseudo (pré-rempli depuis localStorage)
- Bouton « Créer une partie » → émet `room:create`
- Input code room + bouton « Rejoindre » → émet `room:join`
- Même design que le lobby Undercover

#### LobbyView
- Liste des joueurs connectés avec statut (host badge, prêt/pas prêt)
- Configuration partie (host seulement) :
  - Nombre de tours (10-50, défaut 50)
  - Timer par tour (30s-180s, défaut 90s)
  - Capital de départ
  - Actions par tour (4-8, défaut 6)
  - Victoire anticipée (on/off + seuil)
- Bouton « Copier le code » pour inviter
- Bouton « Lancer la partie » (host, minimum 4 joueurs)

#### CountrySelectionView
- Grille de pays avec profils résumés (forces/faiblesses)
- Draft à tour de rôle OU attribution aléatoire (configurable)
- Timer de sélection (30s)

#### GameView (layout principal)
- Layout 3 colonnes : carte (centre-gauche) | dashboard (droite)
- Barre supérieure fixe : tour, timer, chat toggle, journal toggle, settings
- Barre d'actions en bas : 8 boutons d'action + compteur actions restantes + bouton PRÊT
- La carte et le dashboard sont toujours visibles
- Les modales s'ouvrent en overlay au-dessus

#### ResolutionView
- Overlay plein écran semi-transparent
- Timeline verticale animée (Framer Motion) :
  1. Défenses → icônes boucliers
  2. Sabotages → explosion si réussi, neutralisé si raté
  3. Guerres → progression de la ligne de front
  4. Production → chiffres qui incrémentent
  5. Commerce → flèches entre pays
  6. Événements → carte spéciale
  7. Bonheur/santé → jauges animées
  8. Score → leaderboard animé
- Chaque étape dure 2-3 secondes, total ~20s
- Bouton « Passer » pour skip l'animation

---

## 4. Backend / Socket.io

### Événements Socket.io

#### Client → Serveur (C2S)

**Room Management**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `room:create` | `{ playerName }` | Créer une room |
| `room:join` | `{ roomCode, playerName, playerToken? }` | Rejoindre / reconnecter |
| `room:leave` | `{}` | Quitter la room |

**Lobby**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `game:setConfig` | `{ config: Partial<GameConfig> }` | Modifier la config (host) |
| `game:selectCountry` | `{ countryId }` | Choisir son pays |
| `game:startGame` | `{}` | Lancer la partie (host) |

**Gameplay — Actions de tour**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `game:submitActions` | `{ actions: PlayerAction[] }` | Soumettre toutes ses actions |
| `game:ready` | `{}` | Marquer prêt (phase validation) |

**Commerce**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `trade:propose` | `{ targetId, offer, request }` | Proposer un échange |
| `trade:respond` | `{ tradeId, accepted }` | Accepter/refuser un trade |

**Diplomatie & Organisations**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `org:create` | `{ name, type, memberIds }` | Proposer création d'orga |
| `org:vote` | `{ orgId, voteId, vote }` | Voter dans une orga |
| `org:leave` | `{ orgId }` | Quitter une orga |
| `org:proposeVote` | `{ orgId, proposal }` | Soumettre un vote |
| `sanction:apply` | `{ targetId, type }` | Sanctionner un joueur |

**Menaces & Bombardement**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `threat:declare` | `{ targetId, demand, infrastructure }` | Menacer de bombarder |
| `threat:respond` | `{ threatId, accepted }` | Répondre à une menace |
| `threat:execute` | `{ threatId }` | Exécuter le bombardement |
| `threat:withdraw` | `{ threatId }` | Retirer la menace (bluff) |

**Chat**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `chat:message` | `{ channel, message }` | Envoyer un message |

#### Serveur → Client (S2C)

**Room**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `room:created` | `{ roomCode, playerId, playerToken }` | Room créée |
| `room:joined` | `{ playerId, playerToken }` | Joueur rejoint |
| `room:playerList` | `{ players: PublicPlayerInfo[] }` | Liste des joueurs |
| `room:error` | `{ message }` | Erreur |
| `room:hostChanged` | `{ hostId }` | Changement d'hôte |

**Game State**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `game:publicState` | `PublicGameState` | État public (broadcast all) |
| `game:privateState` | `PrivatePlayerState` | État privé (unicast) |
| `game:phaseChanged` | `{ phase, timer? }` | Transition de phase |
| `game:timerTick` | `{ remaining }` | Timer countdown (chaque seconde) |

**Résolution**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `resolution:step` | `{ step, entries[] }` | Étape de résolution (animable) |
| `resolution:complete` | `{ roundSummary }` | Résolution terminée |

**Diplomatie**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `trade:incoming` | `{ trade }` | Offre commerciale reçue |
| `trade:result` | `{ tradeId, accepted }` | Résultat d'un trade |
| `org:updated` | `{ org }` | Mise à jour d'une orga |
| `org:voteStarted` | `{ orgId, vote }` | Nouveau vote dans une orga |
| `threat:received` | `{ threat }` | Menace reçue |
| `threat:resolved` | `{ threatId, outcome }` | Résultat d'une menace |

**Notifications**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `notification:alert` | `{ type, message, data }` | Alerte (sabotage, sanction, etc.) |
| `journal:headlines` | `{ headlines[] }` | Titres du journal satirique |

**Chat**
| Événement | Payload | Description |
|-----------|---------|-------------|
| `chat:message` | `{ from, channel, message, timestamp }` | Message reçu |

### Synchronisation des tours

```
     SERVEUR (XState)                    CLIENT (React)
     ================                    ==============

  ┌→ preparation                         Affiche revenus du tour
  │  • collectIncome()                   Dashboard s'anime
  │  • emit game:publicState             ← reçoit état
  │  • emit game:privateState            ← reçoit état privé
  │  • auto-advance après 5s
  │
  │  actionSelection                     Barre d'actions active
  │  • démarrer timer (90s)              Timer visible
  │  • emit game:timerTick chaque 1s     ← countdown
  │  • reçoit game:submitActions         → soumet ses actions
  │  • reçoit game:ready                 → clique PRÊT
  │  • SI tous prêts OU timer expire
  │    → transition vers resolution
  │
  │  resolution                          Overlay résolution
  │  • resolveDefenses()                 ← resolution:step (défense)
  │  • resolveSabotage()                 ← resolution:step (sabotage)
  │  • resolveWars()                     ← resolution:step (guerre)
  │  • resolveProduction()               ← resolution:step (production)
  │  • resolveCommerce()                 ← resolution:step (commerce)
  │  • resolveEvents()                   ← resolution:step (événements)
  │  • updatePopulation()                ← resolution:step (population)
  │  • calculateScores()                 ← resolution:step (scores)
  │  • emit resolution:complete
  │  • emit game:publicState
  │  • emit game:privateState
  │
  │  marketEvent                         Carte événement animée
  │  • applyMarketEvent()
  │  • emit journal:headlines
  │  • auto-advance après 5s
  │
  │  roundSummary                        Résumé cliquable
  │  • buildRoundSummary()
  │  • checkVictory()
  │  • SI victoire → victory
  │  • SINON tous joueurs cliquent
  │    "Tour suivant" → preparation
  └──────────────────────────────────

     victory                             Écran victoire
     • classement final                  Confetti + podium
     • stats détaillées                  Bouton rejouer
```

### Résolution — Ordre déterministe (8 étapes)

La résolution est le cœur du serveur. Le fichier `resolution.ts` orchestre les 8 étapes dans l'ordre exact du GDD :

```typescript
function resolveRound(context: EcoWarContext): ResolutionResult {
  const log: ResolutionEntry[] = []

  // 1. Défenses activées — marquer les joueurs défensifs
  log.push(...resolveDefenses(context))

  // 2. Sabotages — jet réussite puis jet visibilité
  log.push(...resolveSabotage(context))

  // 3. Guerres — progression des conflits, bombardements exécutés
  log.push(...resolveWars(context))

  // 4. Production — usines × outils × recherche × infra
  log.push(...resolveProduction(context))

  // 5. Commerce — trades acceptés, frais, sanctions
  log.push(...resolveCommerce(context))

  // 6. Événements aléatoires — 1-2 tirés du pool pondéré
  log.push(...resolveRandomEvents(context))

  // 7. Population — croissance, migration, bonheur, santé
  log.push(...resolvePopulation(context))

  // 8. Score — PIB + Bonheur×Pop + Influence
  log.push(...calculateScores(context))

  return { log, marketEvent, journalHeadlines }
}
```

### Timers serveur

Le serveur gère 3 types de timers :

1. **Timer d'action** (90s configurable) : `setInterval` de 1s émettant `game:timerTick`. À expiration, les joueurs n'ayant pas soumis "passent" (aucune action).

2. **Timer d'auto-avancement** (5s) : entre les phases `preparation`, `marketEvent` et `roundSummary`, le serveur attend 5 secondes puis avance automatiquement (les joueurs peuvent cliquer pour passer plus vite).

3. **Timer de menace** (1 tour) : quand une menace de bombardement est déclarée, la cible a jusqu'à la fin du tour suivant pour répondre.

---

## 5. Base de données

### Pas de BDD — État en mémoire

Comme spécifié en section 1, **aucune base de données n'est utilisée**. L'état complet de chaque partie est stocké dans le context XState de la machine d'état côté serveur. Chaque room possède sa propre instance de machine (acteur XState).

### Structure en mémoire

```typescript
// Le RoomManager maintient une Map de rooms actives
class EcoWarRoomManager {
  private rooms: Map<string, {
    actor: Actor<typeof ecoWarMachine>    // Machine XState (état complet)
    players: Map<string, {
      socketId: string | null              // null si déconnecté
      token: string                        // Token d'authentification
      name: string
      disconnectedAt: number | null        // Timestamp déconnexion
    }>
    actionTimer: NodeJS.Timeout | null
    phaseTimer: NodeJS.Timeout | null
  }>

  private socketToRoom: Map<string, string>  // socketId → roomCode
}
```

### Durée de vie des données

| Donnée | Durée de vie | Stockage |
|--------|-------------|----------|
| État de la partie | Durée de la room | XState context (RAM serveur) |
| Identité joueur | Durée de la session navigateur | localStorage client |
| Token reconnexion | Durée de la room | Map serveur (RAM) |
| Room vide | 10 minutes après le dernier départ | Puis supprimée |
| Joueur déconnecté | 90 secondes | Puis marqué « parti » |

### Si on veut de la persistence plus tard

On pourra ajouter un module `persistence.ts` qui :
1. Sérialise le context XState en JSON à chaque fin de tour
2. Stocke dans SQLite (via sql.js, même pattern que Poker) ou écrit un fichier JSON
3. Permet de recharger une partie en cas de crash serveur
4. Permet le replay post-partie

Ceci n'est pas dans le scope de la V1.

---

## 6. Flux complet d'une partie

### Phase 0 — Landing & Room

```
Joueur A ouvre le jeu
  → LandingView : entre son pseudo "Napoleon"
  → Clique "Créer une partie"
  → Client émet room:create { playerName: "Napoleon" }
  → Serveur crée room "ABC123", génère playerId + token
  → Serveur instancie acteur XState en état "lobby"
  → Serveur émet room:created { roomCode: "ABC123", playerId, playerToken }
  → Client stocke { roomCode, playerId, playerToken } en localStorage
  → Client affiche LobbyView avec code "ABC123" à partager

Joueurs B, C, D... rejoignent
  → Chacun entre le code "ABC123" + son pseudo
  → Client émet room:join { roomCode: "ABC123", playerName: "Bismarck" }
  → Serveur ajoute le joueur, émet room:joined
  → Serveur broadcast room:playerList à tous
  → LobbyView se met à jour en temps réel
```

### Phase 1 — Lobby & Configuration

```
Joueur A (host) configure la partie :
  → Tours : 50 (par défaut)
  → Timer : 90s
  → Actions/tour : 6
  → Capital départ : 5000
  → Victoire anticipée : désactivée
  → Client émet game:setConfig { config }
  → Serveur valide et broadcast la config

Quand 4+ joueurs sont présents :
  → Host clique "Lancer la partie"
  → Client émet game:startGame
  → Serveur XState : lobby → countrySelection
  → Serveur broadcast game:phaseChanged { phase: "countrySelection" }
```

### Phase 2 — Sélection de pays

```
Chaque joueur voit la grille des pays disponibles :
  → 12-16 pays avec profils asymétriques
  → Forces et faiblesses résumées (icônes)
  → Draft à tour de rôle (30s par joueur) ou aléatoire

Joueur sélectionne un pays :
  → Client émet game:selectCountry { countryId: "japan" }
  → Serveur valide (pas déjà pris), assigne le pays
  → Serveur broadcast la mise à jour

Quand tous ont choisi :
  → XState : countrySelection → preparation (Tour 1)
```

### Phase 3 — Boucle de jeu (Tours 1-50)

#### 3a. Preparation (5s)

```
Serveur :
  → Collecte les revenus (production, brevets, tourisme, cotisations orgas)
  → Applique les coûts récurrents (entretien militaire, armes, bombes, usines)
  → Applique les effets temporaires (sabotage en cours, guerre, reconstruction)
  → Broadcast game:publicState + game:privateState à chaque joueur

Client :
  → Affiche les revenus/coûts du tour avec animations
  → Dashboard national se met à jour
  → Auto-avance après 5s → actionSelection
```

#### 3b. Action Selection (90s)

```
Chaque joueur a 4-6 actions (configurable) :

Investir (1 action) :
  → Ouvre InvestModal : choisir secteur, sous-type, tier
  → Affiche coût, entretien, effet, prérequis recherche
  → Confirmer → ajouté à la liste d'actions locales

Sabotage (1 action) :
  → Ouvre SabotageModal : choisir cible, infrastructure
  → Affiche estimation réussite, visibilité, coût
  → Confirmer

Commerce (1 action) :
  → Ouvre TradeModal : choisir partenaire, offre/demande
  → L'offre est envoyée immédiatement au partenaire (trade:propose)
  → Le partenaire peut accepter/refuser pendant la phase (trade:respond)

Diplomatie (1 action) :
  → Ouvre DiplomacyModal ou OrganizationModal
  → Créer/voter dans une orga, proposer un accord bilatéral

Guerre (1 action) :
  → Ouvre WarModal : choisir cible, voir estimations
  → Ou BombardmentModal : menacer/bombarder

Défense (1 action) :
  → Active le bouclier anti-sabotage pour ce tour

Quand le joueur a utilisé ses actions :
  → Clique PRÊT
  → Client émet game:submitActions { actions: [...] }
  → Client émet game:ready

Si timer expire :
  → Joueurs n'ayant pas soumis → 0 actions (passe le tour)
  → XState : actionSelection → resolution
```

#### 3c. Resolution (~20s d'animation)

```
Serveur exécute resolveRound() :

1. DÉFENSES
   → Marquer les joueurs ayant choisi "Défendre"
   → Serveur émet resolution:step { step: "defense", entries: [...] }
   → Client anime : boucliers apparaissent sur les pays défensifs

2. SABOTAGES
   → Pour chaque sabotage :
     a) Jet de réussite (20-90% selon différentiel renseignement)
     b) Si réussi : jet de visibilité (invisible/soupçon/preuve)
        - Si cible défend : sabotage annulé
     c) Si raté : 30-60% chance d'identifier l'attaquant
   → Serveur émet resolution:step { step: "sabotage", entries: [...] }
   → Client anime : explosions ou boucliers

3. GUERRES
   → Progression des conflits actifs (1 tour de combat)
   → Bombardements exécutés (si menace non satisfaite)
   → Vérification armistice
   → Serveur émet resolution:step { step: "war", entries: [...] }

4. PRODUCTION
   → Usines × outils × recherche × infrastructure × bonheur workforce
   → PIB calculé
   → Serveur émet resolution:step { step: "production", entries: [...] }

5. COMMERCE
   → Trades mutuellement acceptés sont exécutés
   → Frais de transaction appliqués (réduits par orga)
   → Sanctions vérifées (commerce bloqué si sanctionné)
   → Serveur émet resolution:step { step: "commerce", entries: [...] }

6. ÉVÉNEMENTS
   → 1-2 événements tirés du pool pondéré
   → Effets appliqués (global ou local)
   → Serveur émet resolution:step { step: "events", entries: [...] }

7. POPULATION
   → Croissance naturelle (+1-3% selon bonheur/santé)
   → Migration vers les pays à haut bonheur
   → Bonheur mis à jour (industrie, pollution, guerre, sanctions...)
   → Santé mise à jour (investissement santé, pollution, eau)
   → Serveur émet resolution:step { step: "population", entries: [...] }

8. SCORE
   → Score = 50% PIB + 30% (Bonheur × Population) + 20% Influence
   → Leaderboard recalculé et trié
   → Serveur émet resolution:step { step: "score", entries: [...] }

→ Serveur émet resolution:complete { roundSummary }
→ XState : resolution → marketEvent
```

#### 3d. Market Event (5s)

```
Serveur :
  → L'événement a déjà été tiré en étape 6
  → Génère 1-3 titres satiriques pour "Le Monde en Bref"
  → Émet journal:headlines { headlines }

Client :
  → Affiche MarketEventView avec animation (carte qui apparaît)
  → Affiche les titres du journal en bas (défilant ou popup)
  → Auto-avance après 5s → roundSummary
```

#### 3e. Round Summary

```
Client :
  → Affiche RoundSummaryView : résumé cliquable de tous les événements
  → Leaderboard mis à jour
  → Notifications empilées (sabotage détecté, guerre déclarée, etc.)
  → Bouton "Tour suivant"

Quand tous les joueurs cliquent "Tour suivant" :
  → XState : roundSummary → preparation (Tour N+1)
  → OU roundSummary → victory (si tour 50 atteint ou seuil dépassé)
```

### Phase 4 — Victoire

```
XState : → victory

Serveur :
  → Calcul du classement final
  → Stats détaillées par joueur (PIB max atteint, sabotages réussis, guerres gagnées...)
  → Broadcast game:publicState { phase: "victory" }

Client :
  → VictoryView : podium animé (confetti Framer Motion)
  → Classement complet avec scores décomposés
  → Stats fun ("Plus gros saboteur", "Plus pacifique", etc.)
  → Boutons : "Rejouer" (nouvelle partie, même room) / "Quitter"
```

---

## 7. Points techniques

### 7.1. Anti-triche

Le serveur est la **seule source de vérité**. Le client n'a aucun pouvoir décisionnel.

| Risque | Protection |
|--------|-----------|
| Modifier ses ressources | Le client ne modifie jamais l'état. Toute mutation passe par un événement XState côté serveur qui valide les guards. |
| Soumettre plus d'actions que permis | Guard `validActionCount` vérifie `actions.length <= config.actionsPerTurn` |
| Investir sans assez d'argent | Guard `canAfford` vérifie le solde avant chaque investissement |
| Espionner l'état privé d'un autre | L'événement `game:privateState` n'est envoyé qu'au socket du joueur concerné (`socket.emit`, pas `io.emit`) |
| Soumettre des actions hors phase | Guard `isCorrectPhase` vérifie que la machine est en `actionSelection` |
| Usurper l'identité d'un joueur | Le token (UUID v4) est vérifié à chaque événement. Impossible à deviner (122 bits d'entropie). |
| Modifier les votes d'orga | Les votes sont stockés côté serveur, le client ne peut voter qu'une fois par proposition. |
| Spam d'événements | Rate limiting : max 10 événements/seconde par socket. Au-delà, les événements sont ignorés avec un warning. |

### 7.2. Reconnexion

```
Déconnexion détectée (Socket.io disconnect)
  → Serveur marque le joueur comme déconnecté { disconnectedAt: Date.now() }
  → Serveur broadcast room:playerList (joueur grisé)
  → Timer de grâce : 90 secondes

Pendant la grâce :
  → Le joueur reste dans la partie
  → Ses actions en cours sont conservées
  → En phase actionSelection : s'il n'a pas soumis et que le timer expire,
    il "passe" (0 actions)
  → La partie continue normalement

Reconnexion dans les 90s :
  → Client émet room:join { roomCode, playerName, playerToken }
  → Serveur reconnaît le token → réassocie le socketId
  → Serveur envoie game:publicState + game:privateState (rattrapage)
  → Le joueur retrouve sa session exactement là où il l'avait laissée

Après 90s :
  → Joueur marqué "parti" définitivement
  → Son pays continue en mode autopilot :
    - 0 actions par tour (passe)
    - Pas de défense automatique
    - Les trades en cours sont annulés
    - Le pays décline naturellement (pas d'investissement, entretien non payé)
  → Si l'hôte part, un autre joueur est promu hôte

Room vide :
  → Si tous les joueurs ont quitté, la room est gardée 10 minutes
  → Après 10 minutes sans aucun joueur → room supprimée, mémoire libérée
```

### 7.3. Sauvegarde d'état

**V1 : Pas de sauvegarde persistante.** Si le serveur redémarre, toutes les parties en cours sont perdues. C'est acceptable pour un jeu entre amis.

**V2 (future)** : On pourra ajouter :
- Snapshot du context XState en JSON à chaque fin de tour
- Écriture dans SQLite (sql.js) ou fichier JSON
- Restauration au redémarrage serveur : recréer les acteurs XState depuis les snapshots
- API de replay : relire les snapshots tour par tour

### 7.4. Sécurité

| Point | Mesure |
|-------|--------|
| **CORS** | Seul `CLIENT_URL` autorisé (variable d'environnement) |
| **Validation des inputs** | Tous les payloads Socket.io sont validés côté serveur (types, ranges, références existantes). Les chaînes sont sanitisées (pas de HTML/script). |
| **DoS Socket.io** | Rate limit par socket (10 events/s). Pas de broadcast amplification (le serveur contrôle ce qui est envoyé). |
| **Injection chat** | Messages de chat échappés (pas de HTML rendu). Longueur max 500 caractères. |
| **Token brute force** | UUID v4 = 2^122 combinaisons. Pas de mécanisme de lock-out nécessaire. |
| **Room code discovery** | 6 chars alphanumériques = 2.18 milliards de combinaisons. Rate limit sur `room:join` (3 tentatives/10s). |
| **Memory leak** | Rooms inactives supprimées après 10 min. Acteurs XState détruits. Timers clearés. |
| **État serveur incohérent** | XState garantit que seules les transitions valides sont possibles. Pas d'état intermédiaire corrompu. |

### 7.5. Performance

| Aspect | Approche |
|--------|----------|
| **Résolution CPU** | La résolution d'un tour est synchrone et rapide (~5ms pour 12 joueurs). Pas de I/O bloquant. |
| **Mémoire par room** | ~200-500 KB par room (12 joueurs, 50 tours d'historique). 100 rooms simultanées = ~50 MB. |
| **Broadcast** | `socket.emit` (unicast) pour l'état privé, `io.to(room).emit` (multicast room) pour l'état public. Pas de broadcast global. |
| **Payload size** | PublicGameState : ~5-10 KB. PrivatePlayerState : ~3-8 KB. Envoyé 1-3 fois par tour (pas en continu). |
| **Timer precision** | `setInterval(1000)` pour le countdown. Acceptable pour un jeu tour par tour (pas besoin de 60fps). |
| **Scalabilité** | Un serveur unique supporte ~100-200 rooms simultanées (limitation RAM principalement). Au-delà, on peut horizontaliser avec Redis adapter pour Socket.io, mais c'est hors scope V1. |

### 7.6. Anti-spam et rate limiting

```typescript
// Middleware Socket.io appliqué sur le namespace
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

namespace.use((socket, next) => {
  const now = Date.now()
  const entry = rateLimiter.get(socket.id) || { count: 0, resetAt: now + 1000 }

  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + 1000
  }

  entry.count++
  rateLimiter.set(socket.id, entry)

  if (entry.count > 10) {
    return next(new Error('Rate limit exceeded'))
  }

  next()
})
```

Actions spécifiquement limitées :
- `chat:message` : max 3 messages par seconde, cooldown global
- `trade:propose` : max 2 propositions simultanées par joueur
- `threat:declare` : max 1 menace active par joueur
- `room:join` : max 3 tentatives par 10 secondes (anti brute-force room code)

---

## Résumé des fichiers à créer/modifier

### À créer (nouveau)

| Fichier | Lignes estimées |
|---------|:-:|
| `packages/shared/src/economic-war/types.ts` | ~400 |
| `packages/shared/src/economic-war/events.ts` | ~150 |
| `packages/shared/src/economic-war/index.ts` | ~5 |
| `apps/server/src/economic-war/constants.ts` | ~150 |
| `apps/server/src/economic-war/countryProfiles.ts` | ~200 |
| `apps/server/src/economic-war/production.ts` | ~150 |
| `apps/server/src/economic-war/population.ts` | ~120 |
| `apps/server/src/economic-war/commerce.ts` | ~180 |
| `apps/server/src/economic-war/research.ts` | ~130 |
| `apps/server/src/economic-war/military.ts` | ~200 |
| `apps/server/src/economic-war/espionage.ts` | ~180 |
| `apps/server/src/economic-war/organizations.ts` | ~200 |
| `apps/server/src/economic-war/marketEvents.ts` | ~120 |
| `apps/server/src/economic-war/journal.ts` | ~100 |
| `apps/server/src/economic-war/scoring.ts` | ~80 |
| `apps/server/src/economic-war/resolution.ts` | ~150 |
| `apps/server/src/economic-war/guards.ts` | ~120 |
| `apps/server/src/economic-war/actions.ts` | ~250 |
| `apps/server/src/economic-war/machine.ts` | ~300 |
| `apps/server/src/economic-war/roomManager.ts` | ~350 |
| Client views (8 fichiers) | ~200 chacun |
| Client modals (12 fichiers) | ~150 chacun |
| Client components (10 fichiers) | ~100 chacun |
| Client hook | ~250 |
| **Total estimé** | **~6500-7500** |

### À modifier

| Fichier | Modification |
|---------|-------------|
| `packages/shared/src/index.ts` | Ajouter `export * from './economic-war'` |
| `apps/server/src/index.ts` | Remplacer l'intégration placeholder par les vrais événements |
| `apps/client/src/App.tsx` | Déjà fait (routing en place) |
| `apps/client/src/components/screens/GameMenu.tsx` | Mettre à jour la description |

---

*Fin du document — Conception technique Empire du Commerce v1.0*
