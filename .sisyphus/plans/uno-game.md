# UNO Multiplayer Card Game

## TL;DR

> **Quick Summary**: Build a complete multiplayer UNO card game as separate apps (`apps/uno-server`, `apps/uno-client`, `packages/uno-shared`) within the existing undercover-game monorepo, following the exact same architectural patterns (RoomManager, XState v5, Socket.io, anti-cheat dual-state broadcasting).
> 
> **Deliverables**:
> - `packages/uno-shared/` — TypeScript types, Socket.io event interfaces, card constants
> - `apps/uno-server/` — Express + Socket.io server with XState game machine, room management, bot AI
> - `apps/uno-client/` — React 19 + Vite 7 + Tailwind 4 client with pure CSS cards, French UI
> - Full standard UNO rules (108 cards, 2-8 players, all action/wild cards)
> - Configurable house rules (stacking +2/+4, WD4 bluff challenge, force play)
> - Cumulative multi-round scoring (configurable target, default 500)
> - Bot replacement for disconnected players
> - UNO call enforcement with catch mechanic
> 
> **Estimated Effort**: XL (18 tasks across 5 waves)
> **Parallel Execution**: YES — 5 waves with parallel groups
> **Critical Path**: Task 1 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 12 → Task 17

---

## Context

### Original Request
Build a complete multiplayer UNO card game within the existing undercover-game monorepo with full multiplayer via Socket.io + rooms, 2-8 players, cumulative multi-round scoring (first to 500 wins), AI bot replacement for disconnected players, all standard UNO rules, configurable house rules, and pure CSS card rendering.

### Interview Summary
**Key Discussions**:
- **Architecture**: Separate apps (`apps/uno-client/`, `apps/uno-server/`) with shared package (`packages/uno-shared/`), following existing RoomManager/XState patterns exactly
- **Game Rules**: Standard 108-card UNO deck, all action cards (Skip, Reverse, Draw Two, Wild, Wild Draw Four)
- **Scoring**: Cumulative multi-round — winner scores sum of opponents' remaining cards. First to target score (default 500) wins
- **House Rules**: Stacking +2 on +2, stacking +4 on +4, WD4 bluff challenge, force play (must play if able)
- **Anti-Cheat**: Server is single source of truth, clients send intentions only, public state has hand sizes only
- **Cards**: Pure CSS rendering (no images), solid color backgrounds with white text
- **Bots**: Replace disconnected players with simple AI (play first legal card, draw if none, auto-call UNO)
- **Tech Stack**: React 19, Vite 7, Tailwind 4, Socket.io 4.8, XState 5.27, Express 5, Framer Motion
- **Language**: French UI (matching existing game)
- **Shuffle**: Fisher-Yates with `crypto.randomInt()` (NOT `Math.random()`)

**Research Findings**:
- Existing monorepo supports `apps/*` and `packages/*` workspaces
- RoomManager pattern at `apps/server/src/roomManager.ts` (646 lines): rooms Map, socketPresence Map, 90s disconnect grace, per-player broadcasting
- XState v5 machine at `apps/server/src/gameMachine.ts` (904 lines): `setup({types, guards, actions}).createMachine()` pattern
- Event forwarding at `apps/server/src/index.ts`: flat `socket.on()` handlers delegating to `roomManager.handleGameEvent()` switch-case
- Client hook at `apps/client/src/hooks/useSocket.ts` (355 lines): single mega-hook owning socket lifecycle, reconnection, all state and emit wrappers
- Phase routing at `apps/client/src/App.tsx`: simple `switch(socket.phase)` → screen component
- No test infrastructure exists anywhere in the codebase

### Metis Review
**Identified Gaps** (all addressed):
- **Turn timer missing**: Added 30s default turn timer, configurable in lobby. Auto-draw on expiry.
- **2-player Reverse rule**: Reverse acts as Skip with 2 players. Explicitly handled.
- **Draw pile exhaustion**: Reshuffle discard pile (minus top card) into new draw pile. If both empty, force pass.
- **Target score configurable**: Default 500, configurable in lobby (200, 300, 500, custom).
- **UNO call enforcement**: Required when playing to 1 card. Other players can catch within 5s. Penalty: draw 2.
- **Bot hand takeover**: Bot inherits hand seamlessly. On reconnect, player resumes with current hand (bot actions are permanent).
- **First discard edge cases**: WD4 → bury and redraw. Skip/Reverse/DrawTwo → apply effect to first player. Wild → first player picks color.
- **Draw rule**: Draw one card (official). Can play it if legal, else pass. No draw-until-playable in MVP.
- **XState complexity**: Machine split into 4 files (`unoMachine.ts`, `unoActions.ts`, `unoGuards.ts`, `deck.ts`) to stay maintainable.
- **Card IDs**: Unique per instance using format `{color}-{value}-{index}` (e.g., `red-5-0`, `red-5-1`).
- **Framer Motion**: Included for page transitions (matching existing pattern), no card animations in V1.

---

## Work Objectives

### Core Objective
Deliver a fully playable multiplayer UNO card game following the exact architectural patterns of the existing Undercover game, with server-authoritative game state, anti-cheat broadcasting, and room-based multiplayer.

### Concrete Deliverables
- `packages/uno-shared/` — Shared TypeScript package with types, events, constants
- `apps/uno-server/src/index.ts` — Express + Socket.io entry point
- `apps/uno-server/src/roomManager.ts` — Room lifecycle and state broadcasting
- `apps/uno-server/src/unoMachine.ts` — XState v5 game state machine
- `apps/uno-server/src/unoActions.ts` — XState assign actions
- `apps/uno-server/src/unoGuards.ts` — XState guard functions
- `apps/uno-server/src/deck.ts` — Deck creation, shuffle, validation, recycling
- `apps/uno-server/src/scoring.ts` — Point calculation
- `apps/uno-server/src/bot.ts` — Bot AI logic
- `apps/uno-client/src/App.tsx` — Phase-based routing
- `apps/uno-client/src/hooks/useSocket.ts` — Socket hook
- `apps/uno-client/src/components/screens/*.tsx` — All game screens (Landing, Lobby, GameBoard, RoundOver, Victory)
- `apps/uno-client/src/components/cards/*.tsx` — CSS card components

### Definition of Done
- [ ] `npm run build:uno` succeeds (shared + server + client)
- [ ] `npm run build` still succeeds (existing undercover game unaffected)
- [ ] 2-player game completable from lobby to victory via Playwright
- [ ] 108-card deck verified (correct composition)
- [ ] Anti-cheat verified (client never receives opponent hand contents)
- [ ] House rules toggleable in lobby and functional in gameplay
- [ ] Bot replaces disconnected player and plays valid moves
- [ ] UNO call/catch mechanic works with 2-card penalty
- [ ] Score accumulates across rounds, game ends at target score

### Must Have
- 108-card standard UNO deck with correct composition
- All standard card effects (Skip, Reverse, Draw Two, Wild, Wild Draw Four)
- 2-8 player room-based multiplayer
- Server-authoritative game state (XState v5)
- Anti-cheat dual-state broadcasting (PublicGameState + PrivatePlayerState)
- Cumulative multi-round scoring (configurable target: 200/300/500/custom)
- Turn timer (configurable: 15/30/60s, auto-draw on expiry)
- Bot replacement for disconnected players (90s grace → bot takeover)
- 4 house rule toggles: stacking +2, stacking +4, bluff challenge, force play
- UNO call enforcement with 5s catch window and 2-card penalty
- Pure CSS card rendering (solid colors, white text, no images)
- French UI throughout
- First-discard edge cases handled (WD4 bury/redraw, action card effects on first player)
- 2-player Reverse-as-Skip rule
- Draw pile recycling from discard pile
- Reconnection via playerToken + localStorage
- `crypto.randomInt()` for all randomness

### Must NOT Have (Guardrails)
- **G1**: MUST NOT import from or depend on `@undercover/shared` or undercover app code. Complete isolation.
- **G2**: MUST NOT modify any file in `apps/server/`, `apps/client/`, or `packages/shared/`
- **G3**: MUST NOT modify existing `vercel.json` or `render.yaml`
- **G4**: MUST NOT break existing undercover `dev`/`build` commands in root `package.json`
- **G5**: MUST NOT send any player's hand contents in `PublicGameState` — only hand sizes
- **G6**: MUST NOT let client determine card legality — server validates ALL plays
- **G7**: MUST NOT use `Math.random()` anywhere — use `crypto.randomInt()` only
- **G8**: MUST NOT implement card dealing/play animations in V1 (functional CSS only)
- **G9**: MUST NOT implement sound effects, chat, spectator mode, tournament mode, 7-0 rule
- **G10**: MUST NOT put house rule logic inside action functions — store config in context, read in guards
- **G11**: MUST NOT create a single-file XState machine — split into unoMachine.ts, unoActions.ts, unoGuards.ts
- **G12**: MUST NOT add mobile-specific gestures (swipe), card dealing animations, score graphs, or player avatars beyond DiceBear reuse
- **G13**: MUST NOT allow cross-type stacking (+2 on +4 or vice versa) — same type only

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion is verified by the agent using tools (Playwright, Bash, curl, tmux).

### Test Decision
- **Infrastructure exists**: NO (zero tests in existing codebase)
- **Automated tests**: NO (no TDD — but integration test script in Task 17)
- **Framework**: None (no test framework setup)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Every task includes Agent-Executed QA Scenarios as the PRIMARY verification method. The executing agent directly runs the deliverable and verifies it.

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **Shared Package** | Bash (tsc) | `tsc --noEmit`, verify exports |
| **Server Logic** | Bash (tsx) | Start server, curl health check, Socket.io client script |
| **Client UI** | Playwright | Navigate, interact, assert DOM, screenshot |
| **Game Rules** | Bash (automated Socket.io script) | Simulate game events, verify state transitions |
| **Build/Deploy** | Bash | Run build commands, verify output files |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation):
├── Task 1: packages/uno-shared/ [no dependencies]
├── Task 2: apps/uno-server/ scaffold [no dependencies]
├── Task 3: apps/uno-client/ scaffold [no dependencies]
└── Task 4: Root package.json scripts [no dependencies]

Wave 2 (After Wave 1 — Server Game Engine):
├── Task 5: Deck module + scoring [depends: 1]
├── Task 6: XState game machine [depends: 1, 5]
├── Task 7: Room Manager [depends: 1, 6]
└── Task 8: Server entry + socket wiring [depends: 1, 7]

Wave 3 (After Wave 2 — Client UI):
├── Task 9: useSocket hook + App routing [depends: 1, 8]
├── Task 10: Landing + Lobby screens [depends: 9]
├── Task 11: CSS Card components [depends: 3]  ← can start early
├── Task 12: Game Board screen [depends: 9, 11]
└── Task 13: Round Over + Victory screens [depends: 9, 11]

Wave 4 (After Wave 3 — Advanced Features):
├── Task 14: House rules implementation [depends: 6, 12]
├── Task 15: Bot replacement [depends: 7, 12]
└── Task 16: UNO call enforcement [depends: 6, 12]

Wave 5 (After Wave 4 — Integration & Deployment):
├── Task 17: Integration testing + non-regression [depends: all]
└── Task 18: Deployment preparation [depends: 17]
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2,5,6,7,8,9 | 2, 3, 4 |
| 2 | None | 5,6,7,8 | 1, 3, 4 |
| 3 | None | 11 | 1, 2, 4 |
| 4 | None | — | 1, 2, 3 |
| 5 | 1 | 6 | — |
| 6 | 1, 5 | 7, 14, 16 | — |
| 7 | 1, 6 | 8, 15 | — |
| 8 | 1, 7 | 9 | — |
| 9 | 1, 8 | 10, 12, 13 | 11 |
| 10 | 9 | — | 11, 12, 13 |
| 11 | 3 | 12, 13 | 9, 10 |
| 12 | 9, 11 | 14, 15, 16 | 10, 13 |
| 13 | 9, 11 | — | 10, 12 |
| 14 | 6, 12 | 17 | 15, 16 |
| 15 | 7, 12 | 17 | 14, 16 |
| 16 | 6, 12 | 17 | 14, 15 |
| 17 | All prior | 18 | — |
| 18 | 17 | — | — |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2, 3, 4 | 4 parallel `task(category="quick")` — simple scaffolding |
| 2 | 5, 6, 7, 8 | Sequential `task(category="ultrabrain")` — complex game logic |
| 3 | 9, 10, 11, 12, 13 | Mix: 9 ultrabrain, 10+13 quick, 11+12 visual-engineering |
| 4 | 14, 15, 16 | 3 parallel `task(category="ultrabrain")` — rule logic |
| 5 | 17, 18 | Sequential `task(category="unspecified-high")` |

---

## TODOs

### Wave 1: Foundation

- [x] 1. Create `packages/uno-shared/` — Types, Events, Constants

  **What to do**:
  - Create `packages/uno-shared/package.json` with name `@uno/shared`, TypeScript build config
  - Create `packages/uno-shared/tsconfig.json` matching `packages/shared/tsconfig.json` pattern
  - Create `packages/uno-shared/src/types.ts` with all UNO types:
    - `CardColor = 'red' | 'blue' | 'green' | 'yellow'`
    - `CardValue = '0' | '1' | ... | '9' | 'skip' | 'reverse' | 'draw2'`
    - `WildCardValue = 'wild' | 'wild-draw4'`
    - `Card = { id: string; color: CardColor | null; value: CardValue | WildCardValue }`
    - `PlayDirection = 'clockwise' | 'counterclockwise'`
    - `UnoGamePhase = 'lobby' | 'dealing' | 'playerTurn' | 'colorChoice' | 'challengeWD4' | 'roundOver' | 'gameOver'`
    - `Player = { id: string; name: string; avatar?: string; handSize: number; hasCalledUno: boolean }`
    - `HouseRules = { stackDrawTwo: boolean; stackDrawFour: boolean; bluffChallenge: boolean; forcePlay: boolean }`
    - `PlayerScore = { playerId: string; roundScore: number; totalScore: number }`
  - Create `packages/uno-shared/src/events.ts` with:
    - `ClientToServerEvents`: room:create, room:join, room:leave, game:startGame, game:playCard, game:drawCard, game:callUno, game:catchUno, game:chooseColor, game:challengeWD4, game:acceptWD4, game:setHouseRules, game:setTargetScore, game:setTurnTimer, game:continueNextRound, game:resetGame
    - `ServerToClientEvents`: room:created, room:joined, room:error, room:hostChanged, game:state, game:roundOver, game:gameOver
    - `PublicGameState`: phase, players (with handSize, NOT hand contents), currentPlayerId, playDirection, discardTop (top card visible to all), drawPileSize, turnTimeRemaining, houseRules, targetScore, turnTimer, scores, roomCode, hostId
    - `PrivatePlayerState`: playerId, playerToken, hand (Card[]), isHost, canPlayCards (Card[]), canDraw, canCallUno, canCatchUno, mustChooseColor
    - `PublicPlayer`: id, name, avatar, handSize, hasCalledUno, isConnected
  - Create `packages/uno-shared/src/constants.ts` with:
    - `CARD_POINTS`: Record mapping card values to points (0-9 face value, skip/reverse/draw2=20, wild/wild-draw4=50)
    - `DEFAULT_TARGET_SCORE = 500`
    - `DEFAULT_TURN_TIMER = 30`
    - `INITIAL_HAND_SIZE = 7`
    - `UNO_CATCH_WINDOW_MS = 5000`
    - `UNO_PENALTY_CARDS = 2`
    - `DISCONNECT_GRACE_MS = 90_000`
    - `BOT_PLAY_DELAY_MS = 1000`
    - `DECK_SIZE = 108`
  - Create `packages/uno-shared/src/index.ts` barrel export

  **Must NOT do**:
  - Do NOT import from `@undercover/shared`
  - Do NOT add game logic (deck creation, validation) — that goes in server
  - Do NOT add UI-specific types — keep it pure data contracts

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward type definitions following existing pattern
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: TypeScript type design expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/shared/package.json` — Package naming pattern (`@undercover/shared`), build scripts, TypeScript config. Follow same structure but use `@uno/shared`.
  - `packages/shared/tsconfig.json` — TypeScript compiler options for shared package.
  - `packages/shared/src/types.ts` — Type definition pattern: pure type exports, no logic, no imports from other packages. UNO types should mirror this simplicity.
  - `packages/shared/src/events.ts` — Socket.io event interface pattern: `ClientToServerEvents` and `ServerToClientEvents` interfaces with typed payloads. `PublicGameState` and `PrivatePlayerState` separation pattern. This is the most important reference — UNO events follow same dual-state structure.
  - `packages/shared/src/index.ts` — Barrel export pattern: `export * from './types'` + `export * from './events'`

  **Acceptance Criteria**:
  - [ ] `packages/uno-shared/package.json` exists with name `@uno/shared`
  - [ ] `npx tsc --noEmit` passes in `packages/uno-shared/` directory
  - [ ] `npm run build --workspace=packages/uno-shared` succeeds
  - [ ] All types exported: Card, CardColor, CardValue, UnoGamePhase, HouseRules, PublicGameState, PrivatePlayerState, ClientToServerEvents, ServerToClientEvents
  - [ ] Constants exported: CARD_POINTS, DEFAULT_TARGET_SCORE, DECK_SIZE, DISCONNECT_GRACE_MS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Shared package builds and exports correctly
    Tool: Bash
    Preconditions: packages/uno-shared/ created with all files
    Steps:
      1. Run: npm run build --workspace=packages/uno-shared
      2. Assert: exit code 0
      3. Verify dist/index.js exists
      4. Verify dist/index.d.ts exists
      5. Run: node -e "const s = require('./packages/uno-shared/dist/index.js'); console.log(Object.keys(s))"
      6. Assert: output includes CARD_POINTS, DEFAULT_TARGET_SCORE, DECK_SIZE
    Expected Result: Package builds and all exports accessible
    Evidence: Build output captured

  Scenario: TypeScript types are valid
    Tool: Bash
    Preconditions: packages/uno-shared/ created
    Steps:
      1. Run: npx tsc --noEmit --project packages/uno-shared/tsconfig.json
      2. Assert: exit code 0, no errors
    Expected Result: Zero type errors
    Evidence: tsc output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-shared): create shared types, events, and constants package`
  - Files: `packages/uno-shared/**`

---

- [x] 2. Create `apps/uno-server/` scaffold

  **What to do**:
  - Create `apps/uno-server/package.json` with name `@uno/server`, dependencies matching `apps/server/package.json` pattern:
    - `@uno/shared: "*"`, `express: "^5.1.0"`, `socket.io: "^4.8.0"`, `xstate: "^5.27.0"`, `cors: "^2.8.5"`, `tsx: "^4.0.0"`
    - devDeps: `@types/express: "^5.0.0"`, `@types/cors: "^2.8.17"`, `typescript: "~5.9.3"`
    - Scripts: `dev: "tsx watch src/index.ts"`, `build: "tsc"`, `start: "tsx src/index.ts"`
  - Create `apps/uno-server/tsconfig.json` matching `apps/server/tsconfig.json`
  - Create `apps/uno-server/src/index.ts` with minimal Express + Socket.io setup (placeholder, no game logic yet):
    ```typescript
    import express from 'express'
    import { createServer } from 'http'
    import { Server } from 'socket.io'
    import cors from 'cors'
    
    const app = express()
    app.use(cors())
    const httpServer = createServer(app)
    const PORT = process.env.PORT || 3002
    httpServer.listen(PORT, () => {
      console.log(`[Server] UNO game server running on port ${PORT}`)
    })
    ```

  **Must NOT do**:
  - Do NOT implement game logic yet — just scaffold
  - Do NOT use port 3001 (reserved for undercover server) — use 3002

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file creation following existing pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/server/package.json` — Exact dependency versions and script patterns to replicate. Use same versions but `@uno/shared` instead of `@undercover/shared`.
  - `apps/server/tsconfig.json` — TypeScript config for server app.
  - `apps/server/src/index.ts:1-23` — Express + Socket.io initialization pattern (imports, CORS setup, httpServer creation).

  **Acceptance Criteria**:
  - [ ] `apps/uno-server/package.json` exists with name `@uno/server`
  - [ ] `apps/uno-server/tsconfig.json` exists
  - [ ] `npx tsx apps/uno-server/src/index.ts` starts and logs "UNO game server running on port 3002"
  - [ ] Port 3002 used (not 3001)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: UNO server starts successfully
    Tool: Bash
    Preconditions: apps/uno-server/ scaffold created, npm install completed
    Steps:
      1. Run: npx tsx apps/uno-server/src/index.ts &
      2. Wait 3 seconds
      3. Assert: stdout contains "UNO game server running on port 3002"
      4. Run: curl -s http://localhost:3002/ (expect 404 or empty — just testing it's listening)
      5. Kill background process
    Expected Result: Server starts on port 3002
    Evidence: Server stdout captured
  ```

  **Commit**: YES (group with Tasks 1, 3, 4)
  - Message: `feat(uno): scaffold server, client, shared packages and root scripts`
  - Files: `apps/uno-server/**`

---

- [x] 3. Create `apps/uno-client/` scaffold

  **What to do**:
  - Create `apps/uno-client/package.json` with name `@uno/client`, dependencies matching `apps/client/package.json`:
    - `@uno/shared: "*"`, `react: "^19.2.0"`, `react-dom: "^19.2.0"`, `socket.io-client: "^4.8.3"`, `tailwindcss: "^4.1.18"`, `@tailwindcss/vite: "^4.1.18"`, `framer-motion: "^12.34.0"`, `canvas-confetti: "^1.9.4"`, `xstate: "^5.27.0"`
    - devDeps: `@vitejs/plugin-react`, `typescript`, `vite: "^7.3.1"`, `@types/react`, `@types/react-dom`, `@types/canvas-confetti`
    - Scripts: `dev: "vite"`, `build: "tsc -b && vite build"`, `preview: "vite preview"`
  - Create `apps/uno-client/tsconfig.json` and `apps/uno-client/tsconfig.app.json` matching client pattern
  - Create `apps/uno-client/vite.config.ts` with React + Tailwind plugins, port 5174 (undercover uses 5173)
  - Create `apps/uno-client/index.html` with root div
  - Create `apps/uno-client/src/main.tsx` with React root render
  - Create `apps/uno-client/src/App.tsx` with placeholder "UNO Game" text
  - Create `apps/uno-client/src/index.css` with Tailwind setup:
    ```css
    @import "tailwindcss";
    @theme {
      --color-uno-red: #ef4444;
      --color-uno-blue: #3b82f6;
      --color-uno-green: #22c55e;
      --color-uno-yellow: #eab308;
    }
    ```
  - Create directory structure: `src/components/screens/`, `src/components/cards/`, `src/components/ui/`, `src/hooks/`, `src/context/`

  **Must NOT do**:
  - Do NOT copy DiceBear avatar dependencies (not needed for UNO MVP)
  - Do NOT use port 5173 (reserved for undercover client) — use 5174

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Scaffolding following existing pattern
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Vite/Tailwind/React project setup expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 11
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/client/package.json` — Exact dependency versions and build scripts pattern.
  - `apps/client/vite.config.ts` — Vite config with React + Tailwind plugins.
  - `apps/client/tsconfig.json` + `apps/client/tsconfig.app.json` — TypeScript config structure.
  - `apps/client/index.html` — HTML entry point structure.
  - `apps/client/src/main.tsx` — React root render pattern.
  - `apps/client/src/index.css` — Tailwind CSS-first config with `@import "tailwindcss"` and `@theme {}` block.

  **Acceptance Criteria**:
  - [ ] `apps/uno-client/` scaffold exists with all config files
  - [ ] `npm run dev --workspace=apps/uno-client` starts Vite on port 5174
  - [ ] `npm run build --workspace=apps/uno-client` succeeds
  - [ ] Tailwind CSS processes without errors
  - [ ] UNO color theme variables defined (red, blue, green, yellow)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: UNO client dev server starts
    Tool: Bash
    Preconditions: apps/uno-client/ scaffold created, npm install completed
    Steps:
      1. Run: npm run dev --workspace=apps/uno-client &
      2. Wait 5 seconds
      3. Assert: stdout contains "Local:" and "5174"
      4. Run: curl -s http://localhost:5174/ | head -20
      5. Assert: Response contains "<div id=\"root\">"
      6. Kill background process
    Expected Result: Vite dev server running on 5174
    Evidence: Vite output captured
  ```

  **Commit**: YES (group with Tasks 1, 2, 4)
  - Message: `feat(uno): scaffold server, client, shared packages and root scripts`
  - Files: `apps/uno-client/**`

---

- [x] 4. Update root `package.json` with UNO scripts

  **What to do**:
  - Add to root `package.json` scripts:
    - `"dev:uno": "npm run dev --workspace=apps/uno-server & npm run dev --workspace=apps/uno-client"`
    - `"dev:uno:client": "npm run dev --workspace=apps/uno-client"`
    - `"dev:uno:server": "npm run dev --workspace=apps/uno-server"`
    - `"build:uno": "npm run build --workspace=packages/uno-shared && npm run build --workspace=apps/uno-server && npm run build --workspace=apps/uno-client"`
  - Do NOT modify existing `dev`, `build`, `dev:client`, `dev:server` scripts

  **Must NOT do**:
  - Do NOT modify existing scripts
  - Do NOT rename the package
  - Do NOT change workspaces config (already supports `apps/*` and `packages/*`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file edit, adding 4 lines
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: None (convenience scripts)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `package.json:8-13` — Existing script pattern to follow. New scripts use same `--workspace=` pattern.

  **Acceptance Criteria**:
  - [ ] Root `package.json` has `dev:uno`, `build:uno`, `dev:uno:client`, `dev:uno:server` scripts
  - [ ] Existing `dev` and `build` scripts unchanged
  - [ ] `npm run build:uno` succeeds (after Tasks 1-3 complete)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Root scripts work without breaking existing
    Tool: Bash
    Preconditions: All Wave 1 tasks complete, npm install done
    Steps:
      1. Run: node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts))"
      2. Assert: output contains "dev:uno" AND "dev" AND "build:uno" AND "build"
      3. Assert: "dev" value is unchanged (still references apps/server & apps/client)
    Expected Result: New scripts added, existing untouched
    Evidence: Script output captured
  ```

  **Commit**: YES (group with Tasks 1, 2, 3)
  - Message: `feat(uno): scaffold server, client, shared packages and root scripts`
  - Files: `package.json`

---

### Wave 2: Server Game Engine

- [x] 5. Deck module + scoring — `apps/uno-server/src/deck.ts` + `apps/uno-server/src/scoring.ts`

  **What to do**:
  - Create `apps/uno-server/src/deck.ts`:
    - `createDeck(): Card[]` — Generates 108-card deck with unique IDs:
      - Per color (red, blue, green, yellow): 1× "0", 2× "1"-"9", 2× skip, 2× reverse, 2× draw2 = 25 cards × 4 = 100
      - 4× wild, 4× wild-draw4 = 8 cards
      - Card IDs: `{color}-{value}-{index}` for colored, `wild-{index}` / `wild-draw4-{index}` for wilds
    - `shuffleDeck(deck: Card[]): Card[]` — Fisher-Yates shuffle using `crypto.randomInt()`
    - `isValidPlay(card: Card, discardTop: Card, currentColor: CardColor, houseRules: HouseRules, pendingDrawStack: number): boolean` — Validates if a card can be played:
      - Same color as currentColor, OR same value as discardTop, OR wild/wild-draw4
      - With stacking: +2 playable on +2 only if stacking enabled and pending draw stack exists
      - Wild Draw Four: playable anytime (bluff challenge is separate mechanic)
      - Force play: determined by caller, not this function
    - `recycleDeck(discardPile: Card[]): Card[]` — Takes discard pile (minus top card), shuffles into new draw pile
    - `drawCards(drawPile: Card[], discardPile: Card[], count: number): { drawn: Card[]; newDrawPile: Card[]; newDiscardPile: Card[] }` — Draws N cards, handles recycling if pile exhausted
    - `getValidPlays(hand: Card[], discardTop: Card, currentColor: CardColor, houseRules: HouseRules, pendingDrawStack: number): Card[]` — Returns all legal plays from hand
    - `dealInitialHands(deck: Card[], playerCount: number, handSize: number): { hands: Card[][]; remainingDeck: Card[] }` — Deals 7 cards to each player
    - `getStartingDiscard(drawPile: Card[]): { discard: Card; newDrawPile: Card[] }` — Draws first discard, handles edge cases:
      - If Wild Draw Four: bury it back in random position, draw again (loop until non-WD4)
      - If Wild: normal, first player picks color
      - If action card (Skip/Reverse/DrawTwo): card stands, effect applied to first player
  - Create `apps/uno-server/src/scoring.ts`:
    - `calculateRoundScore(loserHands: Card[][]): number` — Sum of all opponents' remaining card point values
    - `getCardPoints(card: Card): number` — Uses CARD_POINTS from shared constants

  **Must NOT do**:
  - Do NOT use `Math.random()` — use `crypto.randomInt()` exclusively
  - Do NOT include game state management (that's the machine's job)
  - Do NOT make deck mutable — return new arrays

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex algorithmic logic (shuffle, validation, recycling, edge cases)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 2)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/server/src/roles.ts` — Existing distribution algorithm pattern. UNO deck creation follows similar "generate all combinations" approach.
  - `apps/server/src/gameMachine.ts:288-310` — `assignWordPair` action shows existing randomness pattern (but uses `Math.random()` — UNO MUST use `crypto.randomInt()` instead).

  **API/Type References**:
  - `packages/uno-shared/src/types.ts:Card` — Card interface to implement against.
  - `packages/uno-shared/src/types.ts:HouseRules` — House rules config that affects validation.
  - `packages/uno-shared/src/constants.ts:CARD_POINTS` — Point values for scoring.

  **External References**:
  - Node.js crypto docs: `crypto.randomInt(min, max)` for unbiased random integers.
  - Official UNO rules: 108-card deck composition and first-card rules.

  **Acceptance Criteria**:
  - [ ] `createDeck()` returns exactly 108 cards
  - [ ] Deck composition verified: 25 per color × 4 = 100 colored + 4 wild + 4 wild-draw4 = 108
  - [ ] All card IDs unique (no duplicates in 108 cards)
  - [ ] `shuffleDeck()` uses `crypto.randomInt()`, not `Math.random()`
  - [ ] `isValidPlay()` correctly validates: same color, same value, wild always valid
  - [ ] `getStartingDiscard()` never returns Wild Draw Four (buries and redraws)
  - [ ] `recycleDeck()` shuffles discard pile minus top card
  - [ ] `calculateRoundScore()` correctly sums card points
  - [ ] `npx tsc --noEmit` passes for `apps/uno-server/`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Deck creation produces correct 108 cards
    Tool: Bash
    Preconditions: deck.ts implemented
    Steps:
      1. Create a test script: apps/uno-server/src/_verify-deck.ts
         import { createDeck } from './deck'
         const deck = createDeck()
         console.log('Total cards:', deck.length)
         const ids = deck.map(c => c.id)
         const uniqueIds = new Set(ids)
         console.log('Unique IDs:', uniqueIds.size)
         const colors = { red: 0, blue: 0, green: 0, yellow: 0, wild: 0 }
         deck.forEach(c => { if (c.color) colors[c.color]++; else colors.wild++ })
         console.log('By color:', JSON.stringify(colors))
      2. Run: npx tsx apps/uno-server/src/_verify-deck.ts
      3. Assert: "Total cards: 108"
      4. Assert: "Unique IDs: 108"
      5. Assert: colors.red=25, colors.blue=25, colors.green=25, colors.yellow=25, colors.wild=8
      6. Delete _verify-deck.ts after verification
    Expected Result: 108 unique cards with correct distribution
    Evidence: Script output captured

  Scenario: Shuffle uses crypto.randomInt
    Tool: Bash (grep)
    Preconditions: deck.ts implemented
    Steps:
      1. Run: grep -n "Math.random" apps/uno-server/src/deck.ts
      2. Assert: No matches (exit code 1)
      3. Run: grep -n "crypto.randomInt\|randomInt" apps/uno-server/src/deck.ts
      4. Assert: At least 1 match
    Expected Result: No Math.random usage, crypto.randomInt present
    Evidence: grep output captured

  Scenario: Starting discard never returns Wild Draw Four
    Tool: Bash
    Preconditions: deck.ts implemented
    Steps:
      1. Create test script that calls getStartingDiscard() 100 times
      2. Assert: None of the 100 results has value 'wild-draw4'
    Expected Result: WD4 always buried and redrawn
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-server): implement deck creation, shuffle, validation, and scoring`
  - Files: `apps/uno-server/src/deck.ts`, `apps/uno-server/src/scoring.ts`

---

- [x] 6. XState game machine — `unoMachine.ts`, `unoActions.ts`, `unoGuards.ts`

  **What to do**:
  - Create `apps/uno-server/src/unoGuards.ts` with all guard functions:
    - `hasEnoughPlayers`: 2-8 players
    - `isCurrentPlayer`: event sender is the current turn player
    - `isValidCardPlay`: card is in player's hand AND passes `isValidPlay()` validation
    - `canDraw`: it's player's turn and they haven't drawn this turn
    - `roundOver`: a player has 0 cards
    - `gameOver`: a player's total score >= target score
    - `hasCalledUno`: player called UNO before playing to 1 card
    - `canCatchUno`: target player has 1 card, hasn't called UNO, within catch window
    - `isBluffChallenge`: house rule enabled and card is WD4
    - `wasBluffing`: challenged player HAD a matching color card when they played WD4
    - `canStack`: stacking house rule enabled and player has matching draw card
    - `mustForcePlay`: force play enabled and player has a legal play in hand
    - `turnTimerExpired`: turn timer reached 0
    - `isDrawTwoActive`: there's a pending +2 stack
    - `isDrawFourActive`: there's a pending +4 stack
  - Create `apps/uno-server/src/unoActions.ts` with all assign actions:
    - `dealCards`: deal 7 cards to each player, set first discard, handle edge cases
    - `playCard`: remove card from player's hand, add to discard, update currentColor
    - `drawCard`: move card(s) from draw pile to player's hand, handle recycling
    - `skipNextPlayer`: advance turn past next player
    - `reverseDirection`: flip play direction (with 2 players, acts as skip)
    - `applyDrawTwo`: add 2 to pending draw stack OR force next player to draw 2
    - `applyWildDrawFour`: add 4 to pending draw stack OR force next player to draw 4
    - `chooseColor`: set current color for wild cards
    - `resolveChallenge`: handle WD4 bluff challenge resolution
    - `advanceTurn`: move to next player (respecting direction)
    - `calculateScores`: compute round winner's score, accumulate totals
    - `callUno`: mark player as having called UNO
    - `catchUno`: apply 2-card penalty to uncaught player
    - `startTurnTimer`: set turn timer countdown
    - `autoDrawOnTimeout`: auto-draw when timer expires
    - `initBotTimer`: schedule bot action with delay
    - `addPlayer`, `removePlayer`, `resetRound`, `resetGame`
  - Create `apps/uno-server/src/unoMachine.ts` with XState v5 machine:
    - Use `setup({ types, guards, actions }).createMachine({...})` pattern
    - Machine context (`UnoMachineContext`):
      ```
      players: MachinePlayer[]          // {id, name, hand: Card[], hasCalledUno, unoCallTime}
      drawPile: Card[]
      discardPile: Card[]
      currentColor: CardColor
      currentPlayerId: string
      playDirection: PlayDirection
      pendingDrawStack: number          // accumulated +2/+4 draws
      turnTimer: number                 // configured seconds per turn
      targetScore: number               // configured target score
      houseRules: HouseRules
      scores: Record<string, number>    // persistent across rounds
      roundNumber: number
      winner: string | null             // round winner player ID
      gameWinner: string | null         // overall game winner
      lastPlayedCard: Card | null
      challengeState: { challengerId: string; challengedId: string; wasBluffing: boolean } | null
      botTimers: Map<string, NodeJS.Timeout>  // or store in room manager
      ```
    - State hierarchy:
      ```
      lobby → dealing (transient) → playerTurn → [effects branch]:
        - colorChoice (after wild/WD4) → playerTurn
        - challengeWD4 (if bluff challenge enabled) → applyChallenge → playerTurn
        - applyEffect (skip/reverse/draw) → playerTurn
      → checkRoundEnd (transient):
        - roundOver → checkGameEnd (transient):
          - gameOver
          - lobby (next round, via continueNextRound event)
        - playerTurn (round continues)
      ```
    - `dealing` state: transient (`always`) — entry action deals cards, auto-transitions to `playerTurn`
    - `checkRoundEnd` state: transient — checks if any player has 0 cards
    - `checkGameEnd` state: transient — checks if winner reached target score

  **Must NOT do**:
  - Do NOT put all code in one file — split into unoMachine.ts, unoActions.ts, unoGuards.ts
  - Do NOT branch house rules inside actions — store in context, check in guards
  - Do NOT handle socket/room logic — machine is pure game state
  - Do NOT include bot scheduling (room manager handles timing) — just accept BOT_PLAY events
  - Do NOT use `Math.random()` in any action

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Most complex task — full game state machine with 15+ guards, 18+ actions, hierarchical states
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 5)
  - **Blocks**: Tasks 7, 14, 16
  - **Blocked By**: Tasks 1, 5

  **References**:

  **Pattern References**:
  - `apps/server/src/gameMachine.ts:114-657` — XState v5 `setup({types, guards, actions}).createMachine()` pattern. This is THE critical reference. Copy the structural pattern exactly: guards as pure functions, actions using `assign()`, machine with hierarchical states and `always` transitions for transient routing.
  - `apps/server/src/gameMachine.ts:658-903` — State hierarchy pattern showing `gameRound.discussion`/`gameRound.voting` nested states, `always` transitions with guards for automatic routing (see `vote` state, `checkGameEnd` state), entry actions.
  - `apps/server/src/gameMachine.ts:8-30` — Context structure pattern: flat object with arrays and records, no nested objects beyond one level.
  - `apps/server/src/gameMachine.ts:114-150` — Guard function pattern: `guardName: ({ context }) => boolean` or `({ context, event }) => boolean`.
  - `apps/server/src/gameMachine.ts:151-450` — Action function pattern: `actionName: assign(({ context, event }) => ({ ...partial context update }))`.

  **API/Type References**:
  - `packages/uno-shared/src/types.ts` — Card, CardColor, HouseRules, UnoGamePhase types.
  - `apps/uno-server/src/deck.ts` — `isValidPlay()`, `getValidPlays()`, `dealInitialHands()`, `getStartingDiscard()`, `drawCards()` functions used by actions.
  - `apps/uno-server/src/scoring.ts` — `calculateRoundScore()` used by `calculateScores` action.

  **Acceptance Criteria**:
  - [ ] Three files created: `unoMachine.ts`, `unoActions.ts`, `unoGuards.ts`
  - [ ] Machine has states: lobby, dealing, playerTurn, colorChoice, challengeWD4, roundOver, gameOver
  - [ ] `dealing` is transient (uses `always` transition)
  - [ ] All guards are pure boolean functions
  - [ ] All actions use `assign()`
  - [ ] House rules stored in context, checked in guards (not branched in actions)
  - [ ] `npx tsc --noEmit` passes for `apps/uno-server/`
  - [ ] Machine can be created with `createActor(unoMachine)` without runtime errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Machine compiles and creates actor
    Tool: Bash
    Preconditions: Machine files created
    Steps:
      1. Create test script: apps/uno-server/src/_verify-machine.ts
         import { createActor } from 'xstate'
         import { unoMachine } from './unoMachine'
         const actor = createActor(unoMachine)
         actor.start()
         const snap = actor.getSnapshot()
         console.log('Initial state:', snap.value)
         console.log('Context keys:', Object.keys(snap.context))
         actor.stop()
      2. Run: npx tsx apps/uno-server/src/_verify-machine.ts
      3. Assert: "Initial state: lobby"
      4. Assert: Context keys include players, drawPile, discardPile, currentColor, houseRules, scores
      5. Delete _verify-machine.ts
    Expected Result: Machine starts in lobby state with correct context
    Evidence: Script output captured

  Scenario: Basic game flow: lobby → deal → play → round end
    Tool: Bash
    Preconditions: Machine files created
    Steps:
      1. Create test script that:
         - Creates actor, starts it
         - Sends ADD_PLAYER for 2 players
         - Sends START_GAME
         - Verifies state transitions to playerTurn
         - Sends PLAY_CARD with a valid card (find one from player's hand that matches)
         - Verifies turn advances
      2. Run script
      3. Assert: State goes lobby → dealing → playerTurn successfully
    Expected Result: Basic game flow works
    Evidence: Script output captured

  Scenario: Guards file has no Math.random
    Tool: Bash (grep)
    Steps:
      1. grep -rn "Math.random" apps/uno-server/src/unoGuards.ts apps/uno-server/src/unoActions.ts apps/uno-server/src/unoMachine.ts
      2. Assert: No matches
    Expected Result: Zero Math.random usage
  ```

  **Commit**: YES
  - Message: `feat(uno-server): implement XState game machine with guards, actions, and state hierarchy`
  - Files: `apps/uno-server/src/unoMachine.ts`, `apps/uno-server/src/unoActions.ts`, `apps/uno-server/src/unoGuards.ts`

---

- [x] 7. Room Manager — `apps/uno-server/src/roomManager.ts`

  **What to do**:
  - Create `apps/uno-server/src/roomManager.ts` following `apps/server/src/roomManager.ts` pattern exactly:
    - `Room` interface: code, actor (XState UNO actor), players Map, hostId, disconnectTimers Map, emptyRoomTimer, botTimers Map
    - `RoomPlayer` interface: id, name, socketId (null when disconnected), playerToken, avatar, isBot
    - Class `RoomManager` with constructor taking `Server` instance
    - `rooms` Map and `socketPresence` Map (same pattern)
    - Room lifecycle: `createRoom()`, `joinRoom()`, `leaveRoom()`, `handleDisconnect()`
    - Generate 6-char room codes (existing pattern)
    - 90s disconnect grace → bot takeover: on disconnect, start timer. On timeout, mark player as bot-controlled, start bot play loop
    - Bot play logic: when it's a bot's turn, `setTimeout` with `BOT_PLAY_DELAY_MS` (1000ms), then:
      - Get valid plays from hand
      - Play first legal card (prefer matching color, then matching value, then wild, then WD4)
      - If no plays, draw a card. If drawn card is playable, play it.
      - Auto-call UNO when hand reaches 1 card
      - For wild cards, pick most common color in hand
    - `handleGameEvent()` switch-case forwarding (same pattern as existing):
      - `PLAY_CARD`: validate it's player's turn, forward to machine
      - `DRAW_CARD`: validate it's player's turn, forward to machine
      - `CALL_UNO`: forward with player ID
      - `CATCH_UNO`: forward with catcher and target IDs
      - `CHOOSE_COLOR`: validate player needs to choose, forward
      - `CHALLENGE_WD4` / `ACCEPT_WD4`: forward challenge decision
      - `START_GAME`: host-only check, forward
      - `SET_HOUSE_RULES`: host-only, forward
      - `SET_TARGET_SCORE`: host-only, forward
      - `SET_TURN_TIMER`: host-only, forward
      - `CONTINUE_NEXT_ROUND`: host-only, forward
      - `RESET_GAME`: forward
    - `broadcastState()` — Per-player loop (same pattern as existing):
      - `PublicGameState`: phase, players with handSize (NOT hand contents), currentPlayerId, playDirection, discardTop, drawPileSize, scores, etc.
      - `PrivatePlayerState`: playerId, playerToken, hand (actual Card[]), isHost, canPlayCards, canDraw, canCallUno, canCatchUno, mustChooseColor
    - Reconnection: on `room:join` with valid playerToken, restore socketId, cancel disconnect timer, cancel bot control
    - Host reassignment on disconnect (existing pattern)
    - Empty room cleanup: 10min TTL (existing pattern)
    - Turn timer: track per-room with `setInterval`, decrement, broadcast remaining time. On expiry, auto-draw for current player.

  **Must NOT do**:
  - Do NOT send hand contents in PublicGameState — hand sizes only
  - Do NOT trust client card plays — validate against server hand
  - Do NOT let non-current-turn players play cards
  - Do NOT let non-host players change settings

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex room management with bot AI, timer management, anti-cheat broadcasting
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 6)
  - **Blocks**: Task 8, 15
  - **Blocked By**: Tasks 1, 6

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts:38-54` — Room and RoomPlayer interface pattern. Copy structure, adapt fields for UNO.
  - `apps/server/src/roomManager.ts:60-61` — `rooms` Map and `socketPresence` Map pattern.
  - `apps/server/src/roomManager.ts:65-100` — `createRoom()` pattern: leave existing room, generate code, create player, create XState actor, subscribe to state changes, broadcast.
  - `apps/server/src/roomManager.ts:194-220` — Disconnect handling with grace period timer pattern.
  - `apps/server/src/roomManager.ts:222-346` — `handleGameEvent()` switch-case pattern with host validation and payload type checking.
  - `apps/server/src/roomManager.ts:411-448` — `broadcastState()` per-player loop: get snapshot, compute public state, compute private state per player, emit individually.
  - `apps/server/src/roomManager.ts:450-516` — `getPublicState()` pattern: expose only non-secret information.
  - `apps/server/src/roomManager.ts:519-544` — `getPrivateState()` pattern: expose player-specific secrets (hand, role, token).

  **API/Type References**:
  - `packages/uno-shared/src/events.ts:PublicGameState` — Public state contract.
  - `packages/uno-shared/src/events.ts:PrivatePlayerState` — Private state contract with hand (Card[]).
  - `packages/uno-shared/src/constants.ts` — DISCONNECT_GRACE_MS, BOT_PLAY_DELAY_MS, UNO_CATCH_WINDOW_MS.
  - `apps/uno-server/src/deck.ts:getValidPlays()` — Used by broadcastState to compute canPlayCards for private state.

  **Acceptance Criteria**:
  - [ ] `roomManager.ts` exports `RoomManager` class
  - [ ] Room creation generates 6-char codes
  - [ ] `broadcastState()` sends PublicGameState + PrivatePlayerState per-player
  - [ ] PublicGameState contains `handSize` for each player, NOT `hand`
  - [ ] PrivatePlayerState contains `hand: Card[]` only for the target player
  - [ ] Disconnect starts 90s grace timer
  - [ ] Bot takes over after grace period expires
  - [ ] Bot plays with 1000ms artificial delay
  - [ ] Reconnection cancels disconnect timer and bot control
  - [ ] Host-only events validated (startGame, setHouseRules, etc.)
  - [ ] `npx tsc --noEmit` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Anti-cheat verification — PublicGameState never contains hand contents
    Tool: Bash (grep)
    Preconditions: roomManager.ts created
    Steps:
      1. grep -n "hand:" apps/uno-server/src/roomManager.ts | grep -i "public"
      2. Verify that getPublicState never includes card arrays
      3. Search for "handSize" in getPublicState — should be present
      4. Search for "hand:" in getPrivateState — should be present
    Expected Result: Hand contents only in private state, sizes only in public
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-server): implement room manager with broadcasting, bot AI, and disconnect handling`
  - Files: `apps/uno-server/src/roomManager.ts`

---

- [x] 8. Server entry + socket wiring — `apps/uno-server/src/index.ts`

  **What to do**:
  - Update `apps/uno-server/src/index.ts` (replacing the scaffold from Task 2):
    - Import `RoomManager` and set up event forwarding
    - Same pattern as `apps/server/src/index.ts`: Express + CORS + Socket.io typed with `ClientToServerEvents`/`ServerToClientEvents` from `@uno/shared`
    - ALLOWED_ORIGINS: localhost:5174, localhost:3000, process.env.CLIENT_URL
    - `io.on('connection')` with flat `socket.on()` handlers:
      - `room:create` → `roomManager.createRoom()`
      - `room:join` → `roomManager.joinRoom()`
      - `room:leave` → `roomManager.leaveRoom()`
      - `game:startGame` → `roomManager.handleGameEvent(socket, 'START_GAME')`
      - `game:playCard` → `roomManager.handleGameEvent(socket, 'PLAY_CARD', data)`
      - `game:drawCard` → `roomManager.handleGameEvent(socket, 'DRAW_CARD')`
      - `game:callUno` → `roomManager.handleGameEvent(socket, 'CALL_UNO')`
      - `game:catchUno` → `roomManager.handleGameEvent(socket, 'CATCH_UNO', data)`
      - `game:chooseColor` → `roomManager.handleGameEvent(socket, 'CHOOSE_COLOR', data)`
      - `game:challengeWD4` → `roomManager.handleGameEvent(socket, 'CHALLENGE_WD4')`
      - `game:acceptWD4` → `roomManager.handleGameEvent(socket, 'ACCEPT_WD4')`
      - `game:setHouseRules` → `roomManager.handleGameEvent(socket, 'SET_HOUSE_RULES', data)`
      - `game:setTargetScore` → `roomManager.handleGameEvent(socket, 'SET_TARGET_SCORE', data)`
      - `game:setTurnTimer` → `roomManager.handleGameEvent(socket, 'SET_TURN_TIMER', data)`
      - `game:continueNextRound` → `roomManager.handleGameEvent(socket, 'CONTINUE_NEXT_ROUND')`
      - `game:resetGame` → `roomManager.handleGameEvent(socket, 'RESET_GAME')`
      - `disconnect` → `roomManager.handleDisconnect(socket)`
    - Port: 3002 (env override with PORT)

  **Must NOT do**:
  - Do NOT add API routes (REST endpoints) — Socket.io only
  - Do NOT use port 3001

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward wiring following exact existing pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 7)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 7

  **References**:

  **Pattern References**:
  - `apps/server/src/index.ts:1-56` — THE reference. Copy this file's structure exactly, change: port to 3002, allowed origins to include 5174, import from `@uno/shared`, game events to UNO events.

  **Acceptance Criteria**:
  - [ ] Server starts on port 3002
  - [ ] Socket.io accepts connections from localhost:5174
  - [ ] All 17 game events wired to roomManager.handleGameEvent()
  - [ ] `npx tsc --noEmit` passes
  - [ ] `npx tsx apps/uno-server/src/index.ts` runs without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Server accepts Socket.io connection
    Tool: Bash
    Preconditions: Full server implemented (Tasks 5-8)
    Steps:
      1. Start server: npx tsx apps/uno-server/src/index.ts &
      2. Wait 3 seconds
      3. Create a test script that connects via socket.io-client to ws://localhost:3002
      4. Assert: connection established (connected = true)
      5. Emit room:create with { playerName: "TestPlayer" }
      6. Assert: receive room:created event with roomCode and playerToken
      7. Kill server
    Expected Result: Socket.io connection works, room creation succeeds
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-server): wire Socket.io events and complete server entry point`
  - Files: `apps/uno-server/src/index.ts`

---

### Wave 3: Client UI

- [ ] 9. useSocket hook + App routing + Context

  **What to do**:
  - Create `apps/uno-client/src/context/SocketContext.tsx` — React context for socket data
  - Create `apps/uno-client/src/hooks/useLocalStorage.ts` — Copy from `apps/client/src/hooks/useLocalStorage.ts` pattern
  - Create `apps/uno-client/src/hooks/useSocket.ts` following `apps/client/src/hooks/useSocket.ts` pattern:
    - Connect to `SERVER_URL` (localhost:3002 in dev, env var in prod)
    - State: `connected`, `error`, `publicState`, `privateState`, `playerId`, `playerToken`, `roomCode`
    - Auto-reconnect: on connect, if roomCode + playerToken in localStorage, emit `room:join`
    - Event listeners: `room:created`, `room:joined`, `room:error`, `room:hostChanged`, `game:state`, `game:roundOver`, `game:gameOver`
    - Action methods: `createRoom()`, `joinRoom()`, `leaveRoom()`, `startGame()`, `playCard(cardId)`, `drawCard()`, `callUno()`, `catchUno(targetId)`, `chooseColor(color)`, `challengeWD4()`, `acceptWD4()`, `setHouseRules(rules)`, `setTargetScore(score)`, `setTurnTimer(seconds)`, `continueNextRound()`, `resetGame()`
    - Computed: `phase`, `isHost`, `isMyTurn`, `myHand`, `canPlay`, `canDraw`
    - Return memoized with `useMemo()`
  - Update `apps/uno-client/src/App.tsx` with phase-based routing:
    - No roomCode/publicState → `<Landing />`
    - `lobby` → `<Lobby />`
    - `playerTurn` / `colorChoice` / `challengeWD4` → `<GameBoard />`
    - `roundOver` → `<RoundOver />`
    - `gameOver` → `<Victory />`
    - Wrap in `<SocketContext.Provider>` + `<AnimatePresence>` + `<GameLayout>`

  **Must NOT do**:
  - Do NOT import from `@undercover/shared` — use `@uno/shared` only
  - Do NOT implement screen components here — just placeholder imports

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex hook with reconnection logic, state management, and computed properties
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React hook patterns, context API, memoization

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 11)
  - **Parallel Group**: Wave 3 start
  - **Blocks**: Tasks 10, 12, 13
  - **Blocked By**: Tasks 1, 8

  **References**:

  **Pattern References**:
  - `apps/client/src/hooks/useSocket.ts:1-355` — THE critical client reference. Copy structure exactly: socketRef, reconnectRef, all useState, auto-reconnect in useEffect, emit wrapper, action methods, memoized return.
  - `apps/client/src/App.tsx:1-58` — Phase routing pattern with SocketContext.Provider, AnimatePresence, switch on socket.phase.
  - `apps/client/src/hooks/useLocalStorage.ts` — localStorage hook pattern for token/roomCode persistence.

  **API/Type References**:
  - `packages/uno-shared/src/events.ts` — ClientToServerEvents, ServerToClientEvents, PublicGameState, PrivatePlayerState.

  **Acceptance Criteria**:
  - [ ] `useSocket()` hook returns all action methods and state
  - [ ] Auto-reconnect works (roomCode + playerToken in localStorage)
  - [ ] Phase routing maps all UNO phases to correct screen placeholders
  - [ ] SocketContext provides hook value to all children
  - [ ] `npx tsc --noEmit` passes for client
  - [ ] `npm run build --workspace=apps/uno-client` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Client builds with hook and routing
    Tool: Bash
    Preconditions: Hook and App.tsx implemented
    Steps:
      1. Run: npm run build --workspace=apps/uno-client
      2. Assert: exit code 0
      3. Verify: apps/uno-client/dist/index.html exists
    Expected Result: Client builds successfully
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-client): implement useSocket hook, app routing, and context`
  - Files: `apps/uno-client/src/hooks/useSocket.ts`, `apps/uno-client/src/hooks/useLocalStorage.ts`, `apps/uno-client/src/App.tsx`, `apps/uno-client/src/context/SocketContext.tsx`

---

- [ ] 10. Landing + Lobby screens

  **What to do**:
  - Create `apps/uno-client/src/components/layout/GameLayout.tsx` — Wrapper with background, centered content (match existing pattern)
  - Create `apps/uno-client/src/components/screens/Landing.tsx`:
    - UNO logo/title in French ("UNO - Jeu de Cartes")
    - Player name input
    - "Créer une partie" button (creates room)
    - "Rejoindre" section: room code input + join button
    - Connection status indicator
    - Error display
    - Framer Motion entrance animation
  - Create `apps/uno-client/src/components/screens/Lobby.tsx`:
    - Room code display (large, copyable)
    - Player list with connected/disconnected status
    - Host controls (only visible to host):
      - House rules toggles: Stacking +2 (toggle), Stacking +4 (toggle), Bluff Challenge (toggle), Force Play (toggle)
      - Target score selector: 200 / 300 / 500 / custom input
      - Turn timer selector: 15s / 30s / 60s / Illimité
      - "Lancer la partie" button (min 2 players)
    - Non-host sees settings as read-only
    - Player count display ("2/8 joueurs")

  **Must NOT do**:
  - Do NOT implement card components here
  - Do NOT add animations beyond basic Framer Motion page transitions

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI screens with layout, forms, toggles, responsive design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component design, Tailwind styling, form UX

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/Landing.tsx` — Landing screen pattern: useContext(SocketContext), Framer Motion wrapper, Tailwind classes, French text, input validation.
  - `apps/client/src/components/screens/Lobby.tsx` — Lobby screen pattern: player list rendering, host-only controls, toggle switches, room code display.
  - `apps/client/src/components/layout/GameLayout.tsx` — Layout wrapper pattern.

  **Acceptance Criteria**:
  - [ ] Landing screen renders with title, name input, create/join buttons
  - [ ] Lobby screen shows player list, room code, host controls
  - [ ] House rules toggles visible to host only
  - [ ] Target score and turn timer selectors work
  - [ ] All text in French
  - [ ] `npm run build --workspace=apps/uno-client` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Landing screen allows room creation
    Tool: Playwright (playwright skill)
    Preconditions: Both UNO server (port 3002) and client (port 5174) running
    Steps:
      1. Navigate to: http://localhost:5174
      2. Wait for: input[name="playerName"] or equivalent (timeout: 5s)
      3. Fill: player name input → "Joueur1"
      4. Click: "Créer une partie" button
      5. Wait for: room code display visible (timeout: 5s)
      6. Assert: Room code is 6 characters
      7. Assert: Player list shows "Joueur1"
      8. Screenshot: .sisyphus/evidence/task-10-landing-create.png
    Expected Result: Room created, redirected to lobby
    Evidence: .sisyphus/evidence/task-10-landing-create.png

  Scenario: Lobby shows house rules toggles for host
    Tool: Playwright (playwright skill)
    Preconditions: Room created, on lobby screen
    Steps:
      1. Assert: 4 toggle switches visible (Stacking +2, Stacking +4, Bluff, Force Play)
      2. Assert: Target score selector visible
      3. Assert: Turn timer selector visible
      4. Toggle "Stacking +2" ON
      5. Assert: Toggle state changed
      6. Screenshot: .sisyphus/evidence/task-10-lobby-settings.png
    Expected Result: Host can see and toggle all settings
    Evidence: .sisyphus/evidence/task-10-lobby-settings.png
  ```

  **Commit**: YES
  - Message: `feat(uno-client): implement Landing and Lobby screens with house rules config`
  - Files: `apps/uno-client/src/components/screens/Landing.tsx`, `apps/uno-client/src/components/screens/Lobby.tsx`, `apps/uno-client/src/components/layout/GameLayout.tsx`

---

- [ ] 11. CSS Card components

  **What to do**:
  - Create `apps/uno-client/src/components/cards/Card.tsx`:
    - Pure CSS card rendering: 60×90px rectangle (scaled responsively)
    - Solid color backgrounds using UNO theme colors: red (#ef4444), blue (#3b82f6), green (#22c55e), yellow (#eab308)
    - Wild cards: black background with rainbow gradient border or multi-color indicator
    - White text for card value (numbers: large centered, action cards: icon/text)
    - Card back: dark pattern (for draw pile / opponent hands)
    - Action card indicators: "⊘" for Skip, "⇄" for Reverse, "+2" for Draw Two, "+4" for Wild Draw Four, "★" for Wild
    - Props: `card: Card`, `faceUp: boolean`, `onClick?`, `disabled?`, `selected?`, `size?: 'sm' | 'md' | 'lg'`
    - Hover state: slight lift (transform: translateY(-4px)) when playable
    - Selected state: raised border glow
    - Disabled state: opacity 0.5, no hover
  - Create `apps/uno-client/src/components/cards/CardHand.tsx`:
    - Renders player's hand as overlapping card fan
    - Cards overlap by ~40% horizontally
    - Scrollable horizontally if > 10 cards
    - Playable cards slightly elevated
    - Click on card → play it (calls socket.playCard)
  - Create `apps/uno-client/src/components/cards/DiscardPile.tsx`:
    - Shows top discard card face-up
    - Current color indicator (border or glow matching currentColor)
  - Create `apps/uno-client/src/components/cards/DrawPile.tsx`:
    - Stack of face-down cards
    - Shows remaining count
    - Clickable to draw (calls socket.drawCard when it's player's turn)

  **Must NOT do**:
  - Do NOT use images or SVGs for card faces — pure CSS only (text symbols OK)
  - Do NOT add dealing/play animations
  - Do NOT add gradients or shadows beyond minimal hover effect
  - Do NOT make cards smaller than readable on mobile (min 48×72px)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CSS-heavy card design, responsive layout, visual polish
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: CSS expertise, responsive design, visual component crafting

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10)
  - **Parallel Group**: Wave 3 (can start early — only depends on client scaffold)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Task 3

  **References**:

  **API/Type References**:
  - `packages/uno-shared/src/types.ts:Card` — Card interface with id, color, value.
  - `packages/uno-shared/src/types.ts:CardColor` — 'red' | 'blue' | 'green' | 'yellow'.
  - `apps/uno-client/src/index.css` — UNO theme colors: --color-uno-red, --color-uno-blue, --color-uno-green, --color-uno-yellow.

  **Acceptance Criteria**:
  - [ ] Card component renders all card types (numbers, skip, reverse, draw2, wild, wild-draw4)
  - [ ] Cards use correct colors (red, blue, green, yellow, black for wilds)
  - [ ] Cards are readable at 60×90px (text legible)
  - [ ] CardHand shows overlapping card fan
  - [ ] DrawPile shows face-down cards with count
  - [ ] DiscardPile shows top card face-up with color indicator
  - [ ] No image files used — pure CSS + text symbols
  - [ ] `npm run build --workspace=apps/uno-client` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: All card types render correctly
    Tool: Playwright (playwright skill)
    Preconditions: Client running with a card showcase page or game in progress
    Steps:
      1. Navigate to game board with cards in hand
      2. Screenshot hand area
      3. Assert: Cards visible with color backgrounds
      4. Assert: Card text (numbers/symbols) is legible
      5. Screenshot: .sisyphus/evidence/task-11-card-rendering.png
    Expected Result: All card types visually distinct and readable
    Evidence: .sisyphus/evidence/task-11-card-rendering.png

  Scenario: No image files in card components
    Tool: Bash (grep)
    Steps:
      1. grep -rn "src=\|url(" apps/uno-client/src/components/cards/
      2. Assert: No image references (no .png, .jpg, .svg src attributes)
    Expected Result: Pure CSS cards, no image assets
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-client): implement pure CSS card components (Card, CardHand, DiscardPile, DrawPile)`
  - Files: `apps/uno-client/src/components/cards/*.tsx`

---

- [ ] 12. Game Board screen

  **What to do**:
  - Create `apps/uno-client/src/components/screens/GameBoard.tsx`:
    - Layout: vertical stack on mobile, centered on desktop
    - Top: opponent info (names, hand sizes, UNO status, turn indicator)
    - Center: discard pile + draw pile side by side, current color indicator, play direction arrow
    - Bottom: player's hand (CardHand component)
    - Turn indicator: highlight current player name, show "Votre tour!" when it's your turn
    - Direction indicator: clockwise/counterclockwise arrow
    - UNO button: large red button, visible when player has 2 cards and it's their turn, calls `callUno()`
    - Turn timer display: countdown seconds, visual urgency when < 5s
    - Pending draw indicator: show "+2" or "+4" stack count when active
  - Create `apps/uno-client/src/components/ui/ColorPicker.tsx`:
    - 4 color buttons (red, blue, green, yellow) for wild card color choice
    - Modal/overlay that appears after playing a wild card
    - Calls `chooseColor(color)` on selection
  - Create `apps/uno-client/src/components/ui/ChallengeModal.tsx`:
    - Appears when opponent plays WD4 and bluff challenge is enabled
    - "Contester" (challenge) and "Accepter" (accept +4) buttons
    - Shows challenge result after decision
  - Create `apps/uno-client/src/components/ui/PlayerList.tsx`:
    - Horizontal list of opponents showing: name, hand size (card count), UNO badge, turn indicator, connected/bot status

  **Must NOT do**:
  - Do NOT show opponent hand contents — only hand sizes
  - Do NOT implement drag-and-drop for cards
  - Do NOT add card play animations beyond basic visual feedback

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex game board layout, responsive design, multiple interactive components
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Game board layout, modal design, responsive gaming UI

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 15, 16
  - **Blocked By**: Tasks 9, 11

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/GameMaster.tsx` — Game screen pattern: useContext(SocketContext), conditional rendering based on state, Tailwind responsive layout.
  - `apps/client/src/components/screens/Vote.tsx` — Interactive game screen pattern: button handlers calling socket methods.

  **API/Type References**:
  - `packages/uno-shared/src/events.ts:PublicGameState` — Public state fields to display (currentPlayerId, playDirection, discardTop, drawPileSize, etc.).
  - `packages/uno-shared/src/events.ts:PrivatePlayerState` — Private state fields (hand, canPlayCards, canDraw, canCallUno, mustChooseColor).

  **Acceptance Criteria**:
  - [ ] Game board shows: opponent info, discard pile, draw pile, player hand
  - [ ] Current player highlighted with "Votre tour!" text
  - [ ] Play direction shown with arrow
  - [ ] UNO button appears when player has 2 cards on their turn
  - [ ] Color picker appears after playing wild card
  - [ ] Challenge modal appears when opponent plays WD4 (if bluff challenge enabled)
  - [ ] Turn timer countdown visible
  - [ ] Opponent hand sizes shown (NOT hand contents)
  - [ ] Responsive: playable on mobile (min 360px width)
  - [ ] `npm run build --workspace=apps/uno-client` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Game board renders during active game
    Tool: Playwright (playwright skill)
    Preconditions: 2-player game started, both connected via browser tabs
    Steps:
      1. Navigate to: http://localhost:5174 (Player 1 tab)
      2. Create room, second tab joins
      3. Start game
      4. Wait for: game board visible (timeout: 10s)
      5. Assert: Discard pile shows one face-up card
      6. Assert: Player hand shows 7 cards
      7. Assert: Opponent section shows "7 cartes"
      8. Assert: Current player indicator visible
      9. Screenshot: .sisyphus/evidence/task-12-gameboard.png
    Expected Result: Full game board rendered with all elements
    Evidence: .sisyphus/evidence/task-12-gameboard.png

  Scenario: Player can play a valid card
    Tool: Playwright (playwright skill)
    Preconditions: It's Player 1's turn, has a playable card
    Steps:
      1. Find a playable card in hand (elevated/highlighted)
      2. Click on it
      3. Wait for: discard pile updates (timeout: 5s)
      4. Assert: Card removed from hand
      5. Assert: Turn indicator moves to next player
      6. Screenshot: .sisyphus/evidence/task-12-card-played.png
    Expected Result: Card played successfully, turn advances
    Evidence: .sisyphus/evidence/task-12-card-played.png
  ```

  **Commit**: YES
  - Message: `feat(uno-client): implement GameBoard screen with color picker, challenge modal, and player list`
  - Files: `apps/uno-client/src/components/screens/GameBoard.tsx`, `apps/uno-client/src/components/ui/ColorPicker.tsx`, `apps/uno-client/src/components/ui/ChallengeModal.tsx`, `apps/uno-client/src/components/ui/PlayerList.tsx`

---

- [ ] 13. Round Over + Victory screens

  **What to do**:
  - Create `apps/uno-client/src/components/screens/RoundOver.tsx`:
    - Round winner announcement: "[Name] a gagné cette manche!"
    - Scoreboard table: Player Name | Score de la manche | Score total
    - Show remaining cards of each loser (optional visual, hand sizes OK)
    - "Manche suivante" button (host only, calls continueNextRound)
    - If a player reached target score, show "Partie terminée!" instead
  - Create `apps/uno-client/src/components/screens/Victory.tsx`:
    - Game winner announcement: "[Name] remporte la partie!"
    - Final scoreboard with all rounds
    - Confetti animation (canvas-confetti, same as undercover)
    - "Nouvelle partie" button (calls resetGame, returns to lobby)
    - "Quitter" button (calls leaveRoom, returns to landing)

  **Must NOT do**:
  - Do NOT show detailed hand contents of other players on round over (just point values)
  - Do NOT add score graphs or charts

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI screens with scoreboard table, animations, responsive design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Scoreboard design, confetti animation, victory screen polish

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 12)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 9, 11

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/Victory.tsx` — Victory screen pattern: confetti trigger, winner display, play again button, French text.
  - `apps/client/src/components/screens/Elimination.tsx` — Results screen pattern showing player info after game event.

  **Acceptance Criteria**:
  - [ ] Round Over screen shows winner name and scoreboard
  - [ ] Scoreboard shows per-player: round score and total score
  - [ ] Host sees "Manche suivante" button
  - [ ] Victory screen shows game winner with confetti
  - [ ] "Nouvelle partie" returns to lobby, "Quitter" returns to landing
  - [ ] All text in French
  - [ ] `npm run build --workspace=apps/uno-client` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Round over shows scores correctly
    Tool: Playwright (playwright skill)
    Preconditions: A round has just ended (one player played all cards)
    Steps:
      1. Wait for: round over screen visible (timeout: 5s)
      2. Assert: Winner name displayed
      3. Assert: Scoreboard table visible with at least 2 rows
      4. Assert: Score values are numbers > 0
      5. Screenshot: .sisyphus/evidence/task-13-roundover.png
    Expected Result: Round over screen with correct scoreboard
    Evidence: .sisyphus/evidence/task-13-roundover.png
  ```

  **Commit**: YES
  - Message: `feat(uno-client): implement RoundOver and Victory screens with scoreboard and confetti`
  - Files: `apps/uno-client/src/components/screens/RoundOver.tsx`, `apps/uno-client/src/components/screens/Victory.tsx`

---

### Wave 4: Advanced Features

- [ ] 14. House rules implementation

  **What to do**:
  - Ensure server machine guards check `context.houseRules` for all rule-dependent behavior:
    - **Stacking +2**: Guard `canStack` checks `houseRules.stackDrawTwo`. When enabled, player receiving +2 can play their own +2 to stack. `pendingDrawStack` accumulates. When a player can't stack, they draw the full accumulated count.
    - **Stacking +4**: Guard `canStack` checks `houseRules.stackDrawFour`. Same mechanic for WD4.
    - **Bluff Challenge**: Guard `isBluffChallenge` checks `houseRules.bluffChallenge`. When enabled, after WD4 is played, next player can challenge. Server checks if the player HAD a matching color card. If bluffing: WD4 player draws 4. If not bluffing: challenger draws 6.
    - **Force Play**: Guard `mustForcePlay` checks `houseRules.forcePlay`. When enabled, if player draws a card that is playable, they MUST play it immediately (no option to keep it).
  - Update client Lobby toggles to emit `game:setHouseRules` when toggled
  - Update GameBoard to show challenge option when WD4 played and bluff challenge enabled
  - Update GameBoard to auto-play drawn card when force play enabled and card is legal

  **Must NOT do**:
  - Do NOT branch inside action functions — guards gate transitions, actions are rule-agnostic
  - Do NOT allow cross-type stacking (+2 on +4 or +4 on +2)
  - Do NOT implement 7-0 rule or draw-until-playable

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex rule interaction logic with guards and state transitions
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI updates for challenge modal and force-play behavior

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 15, 16)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 6, 12

  **References**:

  **Pattern References**:
  - `apps/server/src/gameMachine.ts:114-150` — Guard pattern: read context config, return boolean.
  - `apps/uno-server/src/unoGuards.ts` — Existing guard file (from Task 6) to update.
  - `apps/uno-server/src/unoMachine.ts` — Machine states to add challenge/force-play transitions.

  **API/Type References**:
  - `packages/uno-shared/src/types.ts:HouseRules` — Boolean toggles for each rule.

  **Acceptance Criteria**:
  - [ ] Stacking +2 works: player can stack +2 on pending +2, accumulated draw applies to next non-stacker
  - [ ] Stacking +4 works: same for WD4
  - [ ] Bluff challenge: challenger correctly wins/loses based on challenged player's hand
  - [ ] Force play: drawn playable card is auto-played
  - [ ] Disabling each rule reverts to default behavior
  - [ ] Rules stored in context, checked in guards (grep verification)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Stacking +2 accumulates draws
    Tool: Bash (automated Socket.io script)
    Preconditions: 3-player game with stacking +2 enabled
    Steps:
      1. Player A plays +2
      2. Player B plays +2 (stacking)
      3. Player C has no +2 → forced to draw 4
      4. Assert: Player C's hand size increased by 4
      5. Assert: pendingDrawStack reset to 0
    Expected Result: Stack of 4 applies to Player C
    Evidence: Script output captured

  Scenario: Bluff challenge succeeds (player was bluffing)
    Tool: Bash (automated Socket.io script)
    Preconditions: 2-player game with bluff challenge enabled
    Steps:
      1. Player A has matching color card AND WD4, plays WD4
      2. Player B challenges
      3. Assert: Server determines Player A was bluffing (had matching color)
      4. Assert: Player A draws 4 cards
      5. Assert: Player B does NOT draw
    Expected Result: Bluff caught, penalty applied to bluffer
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(uno): implement house rules (stacking, bluff challenge, force play)`
  - Files: `apps/uno-server/src/unoGuards.ts`, `apps/uno-server/src/unoMachine.ts`, `apps/uno-client/src/components/screens/GameBoard.tsx`

---

- [ ] 15. Bot replacement for disconnected players

  **What to do**:
  - In `roomManager.ts`, implement bot takeover logic:
    - After 90s disconnect grace period, mark player as bot-controlled (`isBot: true`)
    - Subscribe to machine state changes: when currentPlayerId is a bot player, schedule bot play
    - `scheduleBotPlay(room, playerId)`: `setTimeout` with BOT_PLAY_DELAY_MS (1000ms)
    - Bot logic function `getBotAction(hand, discardTop, currentColor, houseRules, pendingDrawStack)`:
      - Get valid plays from hand
      - Priority: matching color number → matching value → matching color action → wild → WD4 → draw
      - For wild/WD4 color choice: pick color with most cards in hand
      - Auto-call UNO when hand reaches 1 card
      - Never challenge WD4 bluffs (conservative bot)
      - When stacking enabled and bot has matching draw card, stack it
    - On reconnect: cancel bot timer, set `isBot: false`, player resumes with current hand
    - Bot actions are permanent (cards played by bot stay played)
  - Update `PublicPlayer` to include `isBot` flag so UI can show "🤖" indicator
  - Update client PlayerList to show bot badge

  **Must NOT do**:
  - Do NOT make bot play instantly — must have 1000ms delay
  - Do NOT implement strategic AI (minimax, card counting)
  - Do NOT allow bots to be added manually (only replace disconnected players)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Bot AI logic with timer management and reconnection handoff
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 16)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 7, 12

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts:194-220` — Disconnect handling pattern with grace timer. Extend to add bot takeover after timer expires.
  - `apps/uno-server/src/roomManager.ts` — Room manager from Task 7 to update.
  - `apps/uno-server/src/deck.ts:getValidPlays()` — Used by bot to find legal plays.

  **Acceptance Criteria**:
  - [ ] Player disconnect starts 90s grace timer
  - [ ] After 90s, player marked as bot-controlled
  - [ ] Bot plays valid cards with 1000ms delay
  - [ ] Bot auto-calls UNO at 1 card
  - [ ] Bot picks most common color for wild cards
  - [ ] Reconnection cancels bot, player resumes
  - [ ] Bot indicator visible in player list UI

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Bot takes over after disconnect
    Tool: Bash (automated Socket.io script)
    Preconditions: 2-player game in progress
    Steps:
      1. Player 2 disconnects
      2. Wait 90 seconds (or reduce DISCONNECT_GRACE_MS for testing)
      3. It becomes Player 2's turn
      4. Wait 2 seconds (bot delay + processing)
      5. Assert: Game state changed — bot played a card or drew
      6. Assert: Player 2 marked as isBot in player list
    Expected Result: Bot plays valid move on behalf of disconnected player
    Evidence: Script output captured

  Scenario: Player reconnects and resumes control
    Tool: Bash (automated Socket.io script)
    Preconditions: Player 2 is bot-controlled
    Steps:
      1. New socket connects with Player 2's playerToken
      2. Assert: Player 2 marked as isBot: false
      3. Assert: Player 2 receives their hand via PrivatePlayerState
      4. On Player 2's turn, they can play (not bot)
    Expected Result: Human control restored, hand intact
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(uno-server): implement bot replacement for disconnected players`
  - Files: `apps/uno-server/src/roomManager.ts`, `apps/uno-server/src/bot.ts`, `apps/uno-client/src/components/ui/PlayerList.tsx`

---

- [ ] 16. UNO call enforcement

  **What to do**:
  - Server-side: In machine context, track `unoCallState` per player:
    - When player plays a card reducing hand to 1: start 5s catch window (`unoCatchDeadline`)
    - If player called UNO before/during window: safe
    - If another player calls CATCH_UNO within window: penalized player draws 2 cards
    - After window expires without catch: player is safe
  - Machine events: `CALL_UNO` (player calls), `CATCH_UNO { targetId }` (other player catches)
  - Guards: `canCallUno` (player has exactly 2 cards and it's their turn), `canCatchUno` (target has 1 card, hasn't called UNO, within catch window)
  - Actions: `callUno` (mark player as having called), `catchUno` (penalize target with 2 cards from draw pile)
  - Client: UNO button in GameBoard (big red "UNO!" button), visible when canCallUno is true
  - Client: "Attraper!" button next to opponents who have 1 card and haven't called UNO (within catch window)
  - Private state: `canCallUno: boolean`, `canCatchUno: { targetId: string }[]`

  **Must NOT do**:
  - Do NOT require UNO call to go out (playing last card) — only when going TO 1 card
  - Do NOT make catch window configurable (fixed 5s)
  - Do NOT make penalty configurable (fixed 2 cards)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Timer-based mechanic with catch window, server-side enforcement
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UNO button design, catch button placement

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 15)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 6, 12

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts:194-220` — Timer pattern (disconnect timer) to follow for catch window timer.
  - `apps/uno-server/src/unoMachine.ts` — Machine to update with UNO call states.
  - `apps/uno-server/src/unoActions.ts` — Actions to add (callUno, catchUno).
  - `apps/uno-server/src/unoGuards.ts` — Guards to add (canCallUno, canCatchUno).

  **API/Type References**:
  - `packages/uno-shared/src/constants.ts:UNO_CATCH_WINDOW_MS` — 5000ms window.
  - `packages/uno-shared/src/constants.ts:UNO_PENALTY_CARDS` — 2 cards penalty.

  **Acceptance Criteria**:
  - [ ] UNO button visible when player has 2 cards on their turn
  - [ ] Calling UNO protects player from catch
  - [ ] Other players see "Attraper!" for 5 seconds if UNO not called
  - [ ] Successful catch forces target to draw 2 cards
  - [ ] After 5s window, player is safe even without calling
  - [ ] Server enforces all UNO logic (client cannot cheat)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: UNO call protects player
    Tool: Bash (automated Socket.io script)
    Preconditions: 2-player game, Player 1 has 2 cards
    Steps:
      1. Player 1 calls UNO (game:callUno)
      2. Player 1 plays card, going to 1 card
      3. Player 2 attempts catch (game:catchUno)
      4. Assert: Catch fails (Player 1 called UNO)
      5. Assert: Player 1 still has 1 card (no penalty)
    Expected Result: Called UNO protects from catch
    Evidence: Script output captured

  Scenario: Missed UNO caught by opponent
    Tool: Bash (automated Socket.io script)
    Preconditions: Player 1 has 2 cards
    Steps:
      1. Player 1 plays card going to 1 card WITHOUT calling UNO
      2. Within 5 seconds, Player 2 calls catch
      3. Assert: Player 1 draws 2 penalty cards (now has 3)
    Expected Result: Penalty applied for missed UNO
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(uno): implement UNO call enforcement with catch mechanic and penalty`
  - Files: `apps/uno-server/src/unoMachine.ts`, `apps/uno-server/src/unoActions.ts`, `apps/uno-server/src/unoGuards.ts`, `apps/uno-server/src/roomManager.ts`, `apps/uno-client/src/components/screens/GameBoard.tsx`

---

### Wave 5: Integration & Deployment

- [ ] 17. Integration testing + non-regression

  **What to do**:
  - Create `apps/uno-server/test/integration.ts` — Automated 2-player Socket.io game:
    - Connect 2 Socket.io clients to localhost:3002
    - Player 1 creates room, Player 2 joins
    - Player 1 starts game
    - Both players receive initial state (7 cards each)
    - Play alternating turns: find valid card in hand, play it. If no valid card, draw.
    - Continue until one player has 0 cards
    - Verify round over state with scores
    - Verify scores > 0 for winner
    - Clean up connections
  - Verify deck integrity: 108 cards, no duplicates, correct distribution
  - Verify anti-cheat: PublicGameState never contains hand Card arrays
  - Verify all first-discard edge cases (run getStartingDiscard many times)
  - Run non-regression checks:
    - `npm run build --workspace=packages/shared` — existing shared package
    - `npm run build --workspace=apps/server` — existing undercover server (may need `npm run build --workspace=packages/shared` first)
    - `npm run build --workspace=apps/client` — existing undercover client
    - `npm run build:uno` — new UNO build
    - All must succeed

  **Must NOT do**:
  - Do NOT modify any existing undercover files
  - Do NOT skip non-regression checks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration testing across multiple systems, automated game simulation
  - **Skills**: [`playwright`]
    - `playwright`: Browser-based end-to-end testing for client verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 5)
  - **Blocks**: Task 18
  - **Blocked By**: All prior tasks

  **References**:

  **Pattern References**:
  - All server files from Tasks 5-8 — integration target.
  - All client files from Tasks 9-13 — UI verification target.
  - `apps/server/` + `apps/client/` + `packages/shared/` — non-regression targets.

  **Acceptance Criteria**:
  - [ ] Integration script completes a full 2-player game to round end
  - [ ] Scores calculated correctly (winner > 0, losers at 0)
  - [ ] 108-card deck verified in integration test
  - [ ] Anti-cheat verified: PublicGameState has no Card[] for hands
  - [ ] `npm run build` succeeds (existing undercover build)
  - [ ] `npm run build:uno` succeeds (new UNO build)
  - [ ] Playwright: 2-player game playable from UI (create room → play → round end)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full 2-player game via Socket.io script
    Tool: Bash
    Preconditions: UNO server running on port 3002
    Steps:
      1. Run: npx tsx apps/uno-server/test/integration.ts
      2. Assert: "Game completed successfully" in output
      3. Assert: "Round winner:" in output
      4. Assert: "Score:" followed by number > 0
    Expected Result: Automated game completes without errors
    Evidence: Script output captured

  Scenario: Non-regression — existing undercover builds
    Tool: Bash
    Steps:
      1. Run: npm run build --workspace=packages/shared
      2. Assert: exit code 0
      3. Run: npm run build --workspace=apps/server
      4. Assert: exit code 0
      5. Run: npm run build --workspace=apps/client
      6. Assert: exit code 0
    Expected Result: All existing packages build without errors
    Evidence: Build output captured

  Scenario: Full game via Playwright
    Tool: Playwright (playwright skill)
    Preconditions: UNO server (3002) and client (5174) running
    Steps:
      1. Open 2 browser tabs
      2. Tab 1: Create room as "Alice"
      3. Copy room code
      4. Tab 2: Join room as "Bob" with room code
      5. Tab 1: Start game
      6. Both tabs: Verify game board appears with 7 cards each
      7. Play turns until round ends (click valid cards alternately)
      8. Verify round over screen with scores
      9. Screenshot: .sisyphus/evidence/task-17-full-game.png
    Expected Result: Complete game playable through UI
    Evidence: .sisyphus/evidence/task-17-full-game.png
  ```

  **Commit**: YES
  - Message: `test(uno): add integration test script and verify non-regression`
  - Files: `apps/uno-server/test/integration.ts`

---

- [ ] 18. Deployment preparation

  **What to do**:
  - Create `apps/uno-server/render.yaml` as reference for UNO server deployment:
    ```yaml
    services:
      - type: web
        name: uno-server
        runtime: node
        region: frankfurt
        plan: free
        buildCommand: npm install && npm run build --workspace=packages/uno-shared
        startCommand: npx tsx apps/uno-server/src/index.ts
        envVars:
          - key: NODE_ENV
            value: production
          - key: CLIENT_URL
            sync: false
    ```
  - Create `apps/uno-client/vercel.json` as reference for UNO client deployment:
    ```json
    {
      "buildCommand": "npm run build --workspace=packages/uno-shared && npm run build --workspace=apps/uno-client",
      "outputDirectory": "apps/uno-client/dist",
      "installCommand": "npm install",
      "framework": "vite"
    }
    ```
  - Add `VITE_SERVER_URL` environment variable handling in client (for production server URL)
  - Update `apps/uno-client/src/hooks/useSocket.ts` to read `import.meta.env.VITE_SERVER_URL` for server URL
  - Verify both deployment configs are valid by doing a dry-run build:
    - `npm run build:uno` with production env vars

  **Must NOT do**:
  - Do NOT modify root `vercel.json` or root `render.yaml`
  - Do NOT deploy (just prepare configs)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config file creation and minor env var update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 17)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 17

  **References**:

  **Pattern References**:
  - `render.yaml` — Existing Render deployment config. UNO server follows same structure but different name/paths.
  - `vercel.json` — Existing Vercel deployment config. UNO client follows same structure but different workspace paths.

  **Acceptance Criteria**:
  - [ ] `apps/uno-server/render.yaml` exists with correct config
  - [ ] `apps/uno-client/vercel.json` exists with correct config
  - [ ] Client reads `VITE_SERVER_URL` for production server URL
  - [ ] `npm run build:uno` succeeds with deployment configs in place
  - [ ] Root `vercel.json` and `render.yaml` unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Deployment configs are valid
    Tool: Bash
    Steps:
      1. Verify: apps/uno-server/render.yaml exists and is valid YAML
      2. Verify: apps/uno-client/vercel.json exists and is valid JSON
      3. Run: npm run build:uno
      4. Assert: exit code 0
      5. Verify: Root render.yaml unchanged (diff check)
      6. Verify: Root vercel.json unchanged (diff check)
    Expected Result: Deployment configs ready, existing configs untouched
    Evidence: Build output and diff output captured
  ```

  **Commit**: YES
  - Message: `feat(uno): add deployment configurations for Render and Vercel`
  - Files: `apps/uno-server/render.yaml`, `apps/uno-client/vercel.json`

---

## Commit Strategy

| After Task(s) | Message | Key Files | Verification |
|------------|---------|-------|--------------|
| 1, 2, 3, 4 | `feat(uno): scaffold server, client, shared packages and root scripts` | packages/uno-shared/**, apps/uno-server/**, apps/uno-client/**, package.json | tsc --noEmit on all packages |
| 5 | `feat(uno-server): implement deck creation, shuffle, validation, and scoring` | apps/uno-server/src/deck.ts, scoring.ts | Deck verification script |
| 6 | `feat(uno-server): implement XState game machine with guards, actions, and state hierarchy` | apps/uno-server/src/unoMachine.ts, unoActions.ts, unoGuards.ts | Machine creation test |
| 7 | `feat(uno-server): implement room manager with broadcasting, bot AI, and disconnect handling` | apps/uno-server/src/roomManager.ts | Anti-cheat grep check |
| 8 | `feat(uno-server): wire Socket.io events and complete server entry point` | apps/uno-server/src/index.ts | Server start + Socket.io connect |
| 9 | `feat(uno-client): implement useSocket hook, app routing, and context` | apps/uno-client/src/hooks/**, App.tsx, context/** | Client build |
| 10 | `feat(uno-client): implement Landing and Lobby screens with house rules config` | apps/uno-client/src/components/screens/Landing.tsx, Lobby.tsx | Playwright screenshots |
| 11 | `feat(uno-client): implement pure CSS card components` | apps/uno-client/src/components/cards/** | No-image grep check |
| 12 | `feat(uno-client): implement GameBoard screen with color picker and challenge modal` | apps/uno-client/src/components/screens/GameBoard.tsx, ui/** | Playwright game test |
| 13 | `feat(uno-client): implement RoundOver and Victory screens with scoreboard` | apps/uno-client/src/components/screens/RoundOver.tsx, Victory.tsx | Client build |
| 14 | `feat(uno): implement house rules (stacking, bluff challenge, force play)` | Server guards/machine + client GameBoard | Automated rule tests |
| 15 | `feat(uno-server): implement bot replacement for disconnected players` | roomManager.ts, bot.ts, PlayerList.tsx | Bot takeover test |
| 16 | `feat(uno): implement UNO call enforcement with catch mechanic` | Machine + client GameBoard | UNO call/catch tests |
| 17 | `test(uno): add integration test script and verify non-regression` | apps/uno-server/test/integration.ts | Full game test + build check |
| 18 | `feat(uno): add deployment configurations for Render and Vercel` | render.yaml, vercel.json | Build with configs |

---

## Success Criteria

### Verification Commands
```bash
# UNO build
npm run build:uno                           # Expected: exit code 0

# Non-regression
npm run build                               # Expected: exit code 0 (undercover still works)

# Server starts
npx tsx apps/uno-server/src/index.ts &      # Expected: "UNO game server running on port 3002"

# Client starts  
npm run dev --workspace=apps/uno-client &   # Expected: Vite on port 5174

# Integration test
npx tsx apps/uno-server/test/integration.ts # Expected: "Game completed successfully"

# Anti-cheat check
grep -rn "hand:" apps/uno-server/src/roomManager.ts | grep "Public"  # Expected: no matches

# No Math.random
grep -rn "Math.random" apps/uno-server/src/ # Expected: no matches
```

### Final Checklist
- [ ] All "Must Have" items present and functional
- [ ] All "Must NOT Have" guardrails respected (grep verifications)
- [ ] 108-card deck with correct composition
- [ ] Fisher-Yates shuffle with crypto.randomInt() only
- [ ] Server-authoritative anti-cheat broadcasting
- [ ] All card effects working (Skip, Reverse, DrawTwo, Wild, WD4)
- [ ] 2-player Reverse-as-Skip rule
- [ ] First-discard edge cases handled
- [ ] House rules toggleable and functional
- [ ] Bot replacement after 90s disconnect
- [ ] UNO call/catch with 2-card penalty
- [ ] Cumulative scoring to configurable target
- [ ] French UI throughout
- [ ] Client and server deploy configs ready
- [ ] Existing undercover game unaffected
