# UNO Game - Learnings & Patterns

## Task 1: Create `packages/uno-shared/` - COMPLETED ✓

### Key Patterns Established

#### 1. Package Structure
- **Name**: `@uno/shared` (follows `@undercover/shared` pattern)
- **Type**: `module` (ES modules)
- **Build**: TypeScript compilation with `tsc`
- **Exports**: Conditional imports with `.js` extensions for ES module resolution

#### 2. TypeScript Configuration
- **Target**: ES2022
- **Module**: ESNext
- **ModuleResolution**: bundler
- **Declaration**: true (generates .d.ts files)
- **Strict**: true (strict type checking enabled)
- Matches exactly with `packages/shared/tsconfig.json`

#### 3. Barrel Export Pattern
- **Critical**: ES module imports require `.js` extensions
- `export * from './types.js'` (NOT `'./types'`)
- This ensures proper module resolution in Node.js ES module environment

#### 4. Type Organization
- **types.ts**: Pure type definitions (no imports, no logic)
  - Card types: CardColor, CardValue, WildCardValue, Card
  - Game types: UnoGamePhase, PlayDirection
  - Player types: Player, PublicPlayer, HouseRules, PlayerScore
  
- **events.ts**: Socket.io event interfaces
  - Imports types from types.ts
  - ClientToServerEvents: 15 events (room, game actions)
  - ServerToClientEvents: 7 events (state, round, game over)
  - PublicGameState: No secrets (handSize only, not hand contents)
  - PrivatePlayerState: Secrets (actual hand cards, canPlayCards, etc.)
  
- **constants.ts**: Game constants
  - CARD_POINTS: Record mapping card values to points
  - 8 numeric constants (timers, sizes, grace periods)

#### 5. Anti-Cheat Pattern (Dual-State)
- **PublicGameState**: Broadcast to all players
  - `players: PublicPlayer[]` with `handSize` (not `hand`)
  - `discardTop: Card | null` (visible to all)
  - `drawPileSize: number` (not actual cards)
  
- **PrivatePlayerState**: Sent only to specific player
  - `hand: Card[]` (actual cards, secret)
  - `canPlayCards: Card[]` (computed valid moves)
  - `canDraw`, `canCallUno`, `canCatchUno`, `mustChooseColor` (action flags)

### Build Verification
- ✓ `npx tsc --noEmit` passes (zero type errors)
- ✓ `npm run build --workspace=packages/uno-shared` succeeds
- ✓ `dist/index.js` and `dist/index.d.ts` generated
- ✓ All 14 types exported via .d.ts files
- ✓ All 9 constants exported at runtime

### Files Created
1. `packages/uno-shared/package.json` - Package metadata
2. `packages/uno-shared/tsconfig.json` - TypeScript config
3. `packages/uno-shared/src/types.ts` - Type definitions (9 exports)
4. `packages/uno-shared/src/events.ts` - Socket.io events (4 interfaces)
5. `packages/uno-shared/src/constants.ts` - Game constants (9 exports)
6. `packages/uno-shared/src/index.ts` - Barrel export

### Commit
- Message: `feat(uno-shared): create shared types, events, and constants package`
- Files: 6 new files, 180 insertions
- Hash: c9d1948

## Task 3: Create `apps/uno-client/` - React + Vite Client - COMPLETED ✓

### Key Patterns Matched
1. **Package naming**: `@uno/client` (mirrors `@undercover/client`)
2. **React 19 + Vite 7 + Tailwind 4 stack** (exact versions from existing client)
3. **Port assignment**: 5174 (Undercover uses 5173, no conflicts)
4. **TypeScript**: Composite config pattern (tsconfig.json + tsconfig.app.json + tsconfig.node.json)
5. **Tailwind CSS**: CSS-first approach with `@import "tailwindcss"` + `@theme {}` block

### Tailwind Theme Colors
```css
@theme {
  --color-uno-red: #ef4444;
  --color-uno-blue: #3b82f6;
  --color-uno-green: #22c55e;
  --color-uno-yellow: #eab308;
}
```

### Directory Structure Created
```
apps/uno-client/
├── src/
│   ├── components/
│   │   ├── screens/     (game screens - ready for implementation)
│   │   ├── cards/       (card components)
│   │   └── ui/          (reusable UI components)
│   ├── hooks/           (custom React hooks)
│   ├── context/         (React context providers)
│   ├── App.tsx          (root component with placeholder)
│   ├── main.tsx         (React 19 root render)
│   └── index.css        (Tailwind + theme variables)
├── index.html           (entry point with meta tags)
├── vite.config.ts       (Vite config, port 5174)
├── tsconfig.json        (composite config)
├── tsconfig.app.json    (app TypeScript config)
├── tsconfig.node.json   (Vite config TypeScript)
├── package.json         (@uno/client)
└── eslint.config.js     (flat ESLint config)
```

### Dependencies Installed
- React 19.2.0, React-DOM 19.2.0
- Vite 7.3.1, @vitejs/plugin-react 5.1.1
- Tailwind CSS 4.1.18, @tailwindcss/vite 4.1.18
- Socket.io-client 4.8.3 (multiplayer)
- Framer Motion 12.34.0 (animations)
- Motion 12.34.0 (motion library)
- XState 5.27.0, @xstate/react 6.0.0 (state management)
- Canvas-confetti 1.9.4 (celebrations)
- TypeScript 5.9.3, ESLint 9.39.1

### Verification Results
- ✅ Build succeeds: `npm run build --workspace=apps/uno-client`
- ✅ dist/index.html created (0.88 kB)
- ✅ dist/assets/index-*.css created (7.10 kB)
- ✅ dist/assets/index-*.js created (193.38 kB)
- ✅ Dev server runs on port 5174 (verified with curl)
- ✅ No TypeScript diagnostics errors
- ✅ Workspace integration ready (npm scripts in root package.json)

### Files Created
1. `apps/uno-client/package.json` - Package metadata with @uno/client
2. `apps/uno-client/tsconfig.json` - Composite TypeScript config
3. `apps/uno-client/tsconfig.app.json` - App TypeScript config
4. `apps/uno-client/tsconfig.node.json` - Vite config TypeScript
5. `apps/uno-client/vite.config.ts` - Vite config with React + Tailwind plugins
6. `apps/uno-client/index.html` - HTML entry point
7. `apps/uno-client/src/main.tsx` - React root render
8. `apps/uno-client/src/App.tsx` - Root component with placeholder
9. `apps/uno-client/src/index.css` - Tailwind + UNO theme colors
10. `apps/uno-client/eslint.config.js` - ESLint flat config
11. Directories: src/components/screens, src/components/cards, src/components/ui, src/hooks, src/context

## Next Tasks (Wave 1)
- Task 2: Create `apps/uno-server/` - Game logic & Socket.io handlers
- Task 4: Create root `apps/uno/` - Monorepo app entry point

## Blockers Resolved
- None - Task 3 had no dependencies (Task 1 @uno/shared declared but not required for scaffold)

## Task 5: Deck Module + Scoring - COMPLETED ✓

### Fisher-Yates Shuffle Implementation
- Used `crypto.randomInt(0, i + 1)` for unbiased random
- Verified no Math.random usage via grep

### Card ID Generation Pattern
- Colored cards: `{color}-{value}-{index}` (e.g., red-5-0, red-5-1)
- Wild cards: `wild-{index}`, `wild-draw4-{index}`
- All 108 IDs unique (verified)

### Edge Cases Handled
- Wild Draw Four: Buried and redrawn if selected as starting discard
- Action cards (Skip/Reverse/DrawTwo): Stand as first discard, effect applies to first player
- Wild: Normal start, first player chooses color

### Validation Logic
- Same color as currentColor -> Valid
- Same value as discardTop -> Valid
- Wild/WildDrawFour -> Always valid
- Stacking: +2 on +2 only if pendingDrawStack > 0 AND stackDrawTwo enabled
- Stacking: +4 on +4 only if pendingDrawStack > 0 AND stackDrawFour enabled

## Task 7: Room Manager - COMPLETED ✓

### Room Lifecycle Pattern
- createRoom: Generate unique 6-char code -> create actor -> subscribe -> start -> add host player -> broadcast
- joinRoom: Validate room/state/capacity -> add player -> send ADD_PLAYER -> broadcast
- Reconnection: Restore socketId -> cancel disconnect timer -> disable bot control -> broadcast
- Disconnect: 90s grace timer -> on expiry switch to bot and schedule bot action if turn is active

### Anti-Cheat Broadcasting
- PublicGameState only includes `handSize` and never includes full hand contents
- PrivatePlayerState includes `hand: Card[]` and action flags for the specific player only
- Broadcast is per-player (`game:state` emitted individually with shared public + player-specific private state)

### Bot AI Logic
- Decision order: matching color -> matching value -> wild -> wild-draw4
- Auto-call UNO when bot is about to play down to one card
- Wild color selection uses most common color in remaining hand
- Bot actions run with `BOT_PLAY_DELAY_MS` delay and only while player is marked bot-controlled

### Turn Timer
- Per-room interval runs every 1000ms while in `playerTurn`
- Timer state tracked server-side and rebroadcast on each tick
- Emits `TURN_TIMEOUT` when timer reaches zero, then clears active interval
- Interval is restarted automatically on turn changes and stopped outside turn phase

## Task 8: Server Entry + Socket Wiring - COMPLETED ✓

### Socket.io Event Wiring Pattern
- Flat socket.on() handlers (no nesting)
- room:* events call roomManager methods directly
- game:* events forward to roomManager.handleGameEvent()
- disconnect event calls roomManager.handleDisconnect()

### CORS Configuration
- Allowed origins: localhost:5174 (UNO client), localhost:3000 (dev), process.env.CLIENT_URL (prod)
- credentials: true for cookie support
- Filter out undefined values with `.filter(Boolean) as string[]`

### Port Assignment
- UNO server: 3002 (Undercover uses 3001)
- Environment override: PORT env var with parseInt fallback
- Default: 3002 if PORT not set

### Event Handler Count
- 3 room events: room:create, room:join, room:leave
- 13 game events: startGame, playCard, drawCard, callUno, catchUno, chooseColor, challengeWD4, acceptWD4, setHouseRules, setTargetScore, setTurnTimer, continueNextRound, resetGame
- 1 disconnect event
- Total: 17 event handlers wired

### Type Safety
- Socket.io typed with `Server<ClientToServerEvents, ServerToClientEvents>`
- All event handlers receive properly typed data from @uno/shared
- No avatar field in room:create or room:join events (not in ClientToServerEvents)

### Implementation Details
- Express app created but no routes (Socket.io only)
- HTTP server wraps Express for Socket.io integration
- RoomManager instantiated with io reference
- Connection handler logs socket.id for debugging
- Disconnect handler logs socket.id for debugging

### Build Verification
- ✓ `npx tsc --noEmit --project apps/uno-server/tsconfig.json` passes
- ✓ No TypeScript errors
- ✓ All imports resolve correctly
- ✓ Socket.io types properly applied

### Files Modified
1. `apps/uno-server/src/index.ts` - Complete server entry point (106 lines)

### Commit
- Message: `feat(uno-server): wire Socket.io events and complete server entry point`
- Files: 1 modified, ~92 insertions
