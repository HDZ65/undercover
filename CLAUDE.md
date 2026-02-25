# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multiplayer board game platform (French UI) with three games — Undercover, Poker, UNO — in an npm workspaces monorepo. All games use XState v5 state machines for game logic and Socket.io for real-time multiplayer.

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

# Test (vitest, configured at root)
npm test                              # Run all tests
npx vitest run apps/server/src/poker  # Run specific test directory
npx vitest run path/to/file.test.ts   # Run single test file
npm run test:watch                    # Watch mode (if configured in workspace)

# Lint (per-workspace)
npm run lint --workspace=apps/client
npm run lint --workspace=apps/uno-client
```

## Architecture

### Monorepo Layout

```
apps/client/         → Undercover React frontend (Vite + Tailwind)
apps/server/         → Backend for ALL games (Express + Socket.io + XState)
apps/uno-client/     → UNO React frontend
apps/uno-server/     → UNO backend (separate from main server)
packages/shared/     → Undercover types + Socket.io event contracts
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

### XState State Machine Pattern

Each game's logic lives in an XState v5 machine (`gameMachine.ts`, `pokerMachine.ts`, `unoMachine.ts`). The event flow is:

1. Client emits Socket.io event (kebab-case): `socket.emit('game:castVote', { targetId })`
2. Server room manager receives event, sends XState event (UPPERCASE): `machine.send({ type: 'CAST_VOTE', ... })`
3. Machine transitions state, updates context via `assign()` actions
4. Server broadcasts updated public state to all players in room
5. Clients re-render based on new phase/state

**Public vs Private state**: `publicState` is broadcast to all players (phases, alive players). `privateState` is sent only to individual players (their role, word).

### Room-Based Architecture

Games use 6-character alphanumeric room codes. Players authenticate via randomly-generated tokens stored in localStorage, enabling reconnection after disconnect.

### Where to Add Things

- **Game logic/rules**: XState machine in `apps/server/src/` (guards, actions, transitions)
- **Socket.io events**: Define types in `packages/shared/src/events.ts`, handle in server's room manager, emit from client hooks
- **UI screens**: `apps/client/src/components/screens/` — one component per game phase
- **Hooks**: `apps/client/src/hooks/` — export via barrel `index.ts`
- **Poker subsystem**: `apps/server/src/poker/` (has its own machine, room manager, SQLite DB via sql.js)
- **UNO subsystem**: `apps/server/src/uno/`

## Code Conventions

- **TypeScript strict mode** with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **ESM only** — no CommonJS `require()`
- **Naming**: Components PascalCase `.tsx`, hooks camelCase `.ts`, constants UPPERCASE, types PascalCase
- **Typed imports**: `import type { Role } from '@undercover/shared'` separate from value imports
- **Barrel exports**: Folders use `index.ts` for re-exports
- **Tailwind CSS v4** utility-first styling with CSS variables for theming (dark/light mode)
- **Framer Motion** for animations (fade, scale, slide transitions)

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SERVER_URL` | Client | Backend URL (default: `http://localhost:3001`) |
| `CLIENT_URL` | Server | Frontend URL for CORS |
| `PORT` | Server | Server port |
| `NODE_ENV` | Server | `development` or `production` |

## Deployment

- **Client**: Vercel (config in `vercel.json`, outputs `apps/client/dist`)
- **Server**: Render (config in `render.yaml`, Frankfurt region)
- **Build order is critical**: shared packages must build before apps that depend on them
