# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multiplayer board game platform (French UI) with four games — Undercover, Poker, UNO, and Empire du Commerce (Economic War) — in an npm workspaces monorepo. All games use XState v5 state machines for game logic and Socket.io for real-time multiplayer.

## Commands

```bash
# Development
npm run dev              # Start Undercover server (3001) + client (5173)
npm run dev:server       # Server only
npm run dev:client       # Client only
npm run dev:uno          # Start UNO server + client

# Build (order matters: shared packages first)
npm run build            # All: shared → uno-shared → server → client
npm run build:uno        # UNO only: uno-shared → uno-server → uno-client

# Test (vitest, configured at apps/server/vitest.config.ts, globals: true)
npm test                              # Run all tests
npx vitest run apps/server/src/poker  # Run specific test directory
npx vitest run path/to/file.test.ts   # Run single test file

# Lint (per-workspace)
npm run lint --workspace=apps/client
npm run lint --workspace=apps/uno-client
```

## Architecture

### Monorepo Layout

```
apps/client/         → Main React frontend (Vite + Tailwind + Leaflet for maps)
apps/server/         → Backend for ALL games (Express + Socket.io + XState)
apps/uno-client/     → UNO React frontend
apps/uno-server/     → UNO backend (separate from main server)
packages/shared/     → Undercover + Poker + Economic War types & Socket.io event contracts
packages/uno-shared/ → UNO types + event contracts
```

### Dependency Flow

Shared packages define the type-safe contract between client and server. Client and server never import each other directly — they communicate through Socket.io events typed in shared packages.

```
apps/client ──→ packages/shared ←── apps/server
apps/uno-client ──→ packages/uno-shared ←── apps/uno-server
```

### Socket.io Namespaces

The main server (`apps/server`) hosts multiple games on separate namespaces:
- `/` — Undercover
- `/poker` — Poker
- `/uno` — UNO
- `/economic-war` — Empire du Commerce

### XState State Machine Pattern

Each game's logic lives in an XState v5 machine (`gameMachine.ts`, `pokerMachine.ts`, `unoMachine.ts`, `ecoWarMachine.ts`). The event flow is:

1. Client emits Socket.io event (kebab-case): `socket.emit('game:castVote', { targetId })`
2. Server room manager receives event, sends XState event (UPPERCASE): `machine.send({ type: 'CAST_VOTE', ... })`
3. Machine transitions state, updates context via `assign()` actions
4. Server broadcasts updated public state to all players in room
5. Clients re-render based on new phase/state

**Public vs Private state**: `publicState` is broadcast to all players (phases, scores, leaderboard). `privateState` is sent only to individual players (their role/word in Undercover, their resources/money in Economic War).

### Room-Based Architecture

Games use 6-character alphanumeric room codes. Players authenticate via randomly-generated tokens stored in localStorage, enabling reconnection after disconnect.

### Economic War (Empire du Commerce)

A complex economic strategy game in `apps/server/src/economic-war/` with 25+ server modules:

- **Machine phases**: lobby → countrySelection → preparation → actionSelection → resolution → marketEvent → roundSummary → victory
- **Key modules**: `production.ts`, `agriculture.ts`, `mining.ts`, `military.ts`, `manufacturing.ts`, `transport.ts`, `organizations.ts`, `commerce.ts`, `scoring.ts`, `population.ts`, `livestock.ts`, `marine.ts`, `marketEvents.ts`, `resolution.ts`, `espionage.ts`, `research.ts`, `journal.ts`, `adjacency.ts`
- **Room manager**: `roomManager.ts` (EcoWarRoomManager) handles socket events and actor lifecycle
- **Types**: Server-only types in `apps/server/src/economic-war/types.ts`, shared types in `packages/shared/src/economic-war/types.ts`
- **Client panels**: `useEcoWarSocket` hook, WorldMap (Leaflet), ActionSelector, FactoryPanel, TransportPanel, WarPanel, MiningPanel, TerritoryPanel, JournalPanel, TradeModal, ThreatModal, OrganizationPanel, ResourcePanel, StatsPanel
- **Config**: 4–12 players, no elimination, 50 turns max
- **Design docs**: `docs/empire-du-commerce-gdd.md` (game design), `docs/empire-du-commerce-technical-spec.md` (technical spec)

#### Economic War — Resolution Order

Each turn resolves in this sequence (critical for adding new systems in the right place):

1. Agriculture/livestock/mining/marine production
2. Manufacturing (`tickWeaponProduction`, `tickMaintenanceParts`)
3. Vehicle queue → weapon production → maintenance parts → combat units
4. Transport fleet ops → `tickAutoMaintenance` (auto-applies parts with ≤3 turns left)
5. Unit maintenance upkeep (disbands if player can't pay)
6. Income
7. Commerce (trade resolution)

#### Economic War — Military & Manufacturing

- **4 unit types**: `infantry`, `tanks`, `planes`, `warships` (each T1/T2/T3)
- **Infantry**: recruited via `war:recruitInfantry` socket; **tanks/planes/warships**: auto-produced by `tankFactory`/`militaryAirbase`/`navalBase` factories consuming money + steel
- **Maintenance parts**: `MaintenancePart {tier, manufacturerId, quantity}` in `player.maintenanceParts[]` — only the original manufacturer's parts can maintain their vehicles/weapons
- **`vehicle.createdBy`**: preserved through trades so maintenance origin is always tracked
- **War system**: `war:allocate` submits `WarAllocationSubmission`; `resolveWars()` in `military.ts` applies terrain modifiers (plains/mountain/urban/coast) + ±15% random factor; `Region.warIntegrity` 0–100, region captured at 0
- **17 `IndustrySectors`** including `tankFactory`, `militaryAirbase`, `navalBase`; production choices stored as `productionChoices: Partial<Record<IndustrySector, {vehicleType?, vehicleTier?, weaponTier?, partTier?}>>`

### Where to Add Things

- **Game logic/rules**: XState machine + action modules in `apps/server/src/<game>/`
- **Socket.io events**: Define types in `packages/shared/src/events.ts` (or `packages/shared/src/economic-war/events.ts`), handle in server's room manager, emit from client hooks
- **UI screens**: `apps/client/src/components/screens/` — one component per game phase
- **Hooks**: `apps/client/src/hooks/` — export via barrel `index.ts`
- **Poker subsystem**: `apps/server/src/poker/` (has its own machine, room manager, SQLite DB via sql.js)
- **UNO subsystem**: `apps/server/src/uno/`

## Code Conventions

- **TypeScript strict mode** — target ES2022, ESNext modules, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **ESM only** — no CommonJS `require()`
- **Naming**: Components PascalCase `.tsx`, hooks camelCase `.ts`, constants UPPERCASE, types PascalCase
- **Typed imports**: `import type { Role } from '@undercover/shared'` separate from value imports
- **Barrel exports**: Folders use `index.ts` for re-exports
- **Tailwind CSS v4** utility-first styling with CSS variables for theming (dark/light mode)
- **Framer Motion** for animations (fade, scale, slide transitions)
- **React 19** with JSX-as-expressions (`jsx: 'react-jsx'`)

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SERVER_URL` | Client | Backend URL (default: `http://localhost:3001`) |
| `CLIENT_URL` | Server | Frontend URL for CORS |
| `PORT` | Server | Server port (default: 3001) |
| `NODE_ENV` | Server | `development` or `production` |

## Deployment

- **Client**: Vercel (config in `vercel.json`, outputs `apps/client/dist`)
- **Server**: Render (config in `render.yaml`, Frankfurt region, free tier — sleeps after 15 min inactivity, runs via `npx tsx apps/server/src/index.ts`)
- **Build order is critical**: shared packages must build before apps that depend on them
