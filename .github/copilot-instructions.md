# AI Agent Workspace Guidelines

This is a **multiplayer board game platform** with separate games (Undercover, Poker, UNO) using a monorepo structure. An AI agent should understand the state-machine architecture and multiplayer patterns before making changes.

## Code Style

### TypeScript Configuration
- **Target**: ES2022, ESNext modules, strict mode enabled
  - Enforces `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
  - Very strict—code must be clean and properly typed
- **JSX**: React 19 with JSX-as-expressions (`jsx: 'react-jsx'`)

### Naming Conventions
- **Components**: PascalCase with `.tsx` extension (`GameMenu.tsx`, `ErrorBoundary.tsx`)
- **Hooks/Utilities**: camelCase with `.ts` extension (`useSocket.ts`, `useTheme.ts`)
- **Constants**: UPPERCASE (`ROLE_COLORS`, `ACTION_TIMEOUT_MS`)
- **Types/Interfaces**: PascalCase (`UndercoverMachineContext`, `PokerPlayer`)

### Import/Export Patterns
- **ESM modules exclusively** using `import`/`export` (never CommonJS)
- **Barrel exports**: Use `index.ts` files in folders for cleaner imports
  ```typescript
  // components/index.ts
  export * from './ui'
  export * from './screens'
  ```
- **Typed imports**: Always import types separately when possible
  ```typescript
  import type { Role, GamePhase } from '@undercover/shared'
  import { useSocket } from './hooks'
  ```

### Code Comments
- **JSDoc blocks** for hooks and non-trivial functions (document parameters and return types)
- **Inline comments** for complex logic (XState actions, cryptographic operations)
- Prefer self-documenting code over comments when possible

## Architecture

### Monorepo Structure (`npm workspaces`)
```
apps/
├── client/              ← Main Undercover game UI (React + Vite)
├── server/              ← Undercover backend + multiplayer logic (Express + Socket.io + XState)
├── uno-client/          ← UNO game UI
└── uno-server/          ← UNO game backend
packages/
├── shared/              ← Undercover: types, Socket.io events (no implementation)
└── uno-shared/          ← UNO: types and events
```

### Dependency Flow
- `apps/client` → `packages/shared` (types/events) + connects to `apps/server`
- `apps/server` → `packages/shared` + handles all game logic via XState machines
- Separate namespaces for different games; UNO uses `/uno` Socket.io namespace

### When Adding Features
- **Game logic**: Implement in `apps/server/src/` (XState machines, room managers)
- **UI/Display**: Implement in `apps/client/src/` (React components, hooks)
- **Shared contracts**: Define in `packages/shared/src/` (types and event interfaces)
- **Each game is isolated**: Changes to Undercover don't affect Poker/UNO

## State Management (XState v5)

### Machine Architecture Pattern
XState machines define game flow with strict transitions using states, guards, and actions.

**Key machine structure** (see `apps/server/src/gameMachine.ts`, `pokerMachine.ts`, `unoMachine.ts`):
```typescript
interface UndercoverMachineContext {
  players: Player[]
  alivePlayers: string[]
  currentRound: number
  votes: Record<string, string>
  // ... additional context
}

type UndercoverMachineEvent = 
  | { type: 'START_GAME'; players?: Player[] }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  // ... more events

export const gameMachine = setup({
  types: {
    context: {} as UndercoverMachineContext,
    events: {} as UndercoverMachineEvent,
  },
  guards: {
    hasEnoughPlayers: ({ context }) => context.players.length >= 3,
  },
  actions: {
    assignRoles: assign(({ context }) => ({ /* update context */ })),
  },
}).createMachine({
  initial: 'lobby',
  states: {
    lobby: { /* ... */ },
    distribution: { /* ... */ },
    discussion: { /* ... */ },
    voting: { /* ... */ },
    elimination: { /* ... */ },
    victory: { /* ... */ },
  },
})
```

### React Integration
- **useSocket hook** centralizes multiplayer state:
  ```typescript
  const { publicState, privateState, castVote } = useContext(SocketContext)
  ```
- Components subscribe via `useContext(SocketContext)` and render based on `phase`
- All game updates flow through Socket.io events → server state machine → broadcast to clients

### Event Flow
1. **Client** emits Socket.io event (kebab-case): `socket.emit('game:castVote', { targetId })`
2. **Server** routes to room manager, converts to XState event (UPPERCASE): `machine.send({ type: 'CAST_VOTE', ... })`
3. **Machine** transitions states and updates context via `assign()` actions
4. **Server** broadcasts new public state to all players
5. **Clients** receive updates and re-render React components

## Build & Test Commands

### Development
```bash
# Install dependencies (run once)
npm install

# Start both server and client together
npm run dev

# Or separately:
npm run dev:server      # Runs on http://localhost:3001
npm run dev:client      # Runs on http://localhost:5173

# UNO-specific:
npm run dev:uno         # Start UNO server + client
```

### Production Build
```bash
# Build all packages in dependency order
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Run all vitest suites
npm run test

# Watch mode (for development)
npm run test:watch     # If configured
```

**Build output**: Client → `dist/`, server uses `tsx` for runtime compilation

## UI/Component Patterns

### Component Organization
- **Screens** (`src/components/screens/`): Full-page components for game phases
  - `GameMenu.tsx`, `Lobby.tsx`, `Distribution.tsx`, `Vote.tsx`, `Victory.tsx`
  - One screen per major game state
- **Layout** (`src/components/layout/`): Page structure wrappers
  - `GameLayout.tsx` wraps screens with header/footer
- **UI** (`src/components/ui/`): Reusable small components
  - `ThemeToggle.tsx`, `WordPeek.tsx`, generic form elements

### Styling Approach
- **Tailwind CSS v4** utility-first (no CSS files usually)
- **CSS variables** for theme colors (dark/light mode):
  ```css
  :root { --color-civil: #10b981; }
  :root.dark { --bg-primary: #0a0a0f; }
  ```
- **Theme detection**: `useTheme()` hook with localStorage persistence and system preference fallback

### Animations & Effects
- **Framer Motion**: For component animations (fade-in, scale, slide)
  ```typescript
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} />
  ```
- **Canvas Confetti**: Celebration effects on victory
- **Haptic feedback**: Optional device vibration on actions

### State Persistence
- **localStorage hooks** (`useLocalStorage`):
  - Player token, room code, theme preference
  - Automatically handles JSON serialization/corruption
- **Auto-rejoin**: Persisted room code + token enable reconnection

## Integration Points

### Socket.io Multiplayer
- **Type-safe events**: Socket.io event signatures defined in `packages/shared/src/events.ts`
- **Reconnection logic**: Built into `useSocket` hook with exponential backoff
- **Public vs Private state**:
  - `publicState`: All players see (game phases, alive players)
  - `privateState`: Only current player sees (their role, word)

### External APIs/Libraries
| Library | Purpose | Notes |
|---------|---------|-------|
| **@dicebear/core** | Avatar generation | Lorelei style avatars, deterministic |
| **framer-motion** | UI animations | Version 12.x, use Motion component for better performance |
| **canvas-confetti** | Victory effects | Lightweight, canvas-based particle system |
| **@pokertools/evaluator** | Poker hand evaluation | Used for determining winning hands (Poker game) |
| **sql.js** | In-memory database | Used by server for persistence (if needed) |

## Project Conventions

### Error Handling
- **ErrorBoundary** wraps entire app (catches React errors and displays fallback UI)
- **Try/catch** for Socket.io events and state machine updates
- Network errors trigger auto-reconnect; UX shows loading states

### Role Distribution Logic
```typescript
// Example from gameMachine.ts
const roleConfig: Record<number, { civils: number; undercovers: number; mrWhites: number }> = {
  3: { civils: 2, undercovers: 1, mrWhites: 0 },
  5: { civils: 3, undercovers: 1, mrWhites: 1 },
  7: { civils: 4, undercovers: 2, mrWhites: 1 },
  // ... see source for full configuration
}
```

### Room Code Generation
- 6-character alphanumeric codes (case-insensitive)
- Socket.io room names = room codes (enables direct broadcast to rooms)

## Security & Authentication

### Authentication Flow
1. Player enters name → Client generates random token (stored in localStorage)
2. Client sends `{ name, token }` to server on connection
3. Server associates socket with player via token
4. Disconnect then reconnect with same token → rejoin room

### Sensitive Data
- **Word pairs** never exposed to client until endgame or role reveal
- **Private state** (role, word) sent separately from `publicState`
- **Mr. White word**: Guessed by eliminated Mr. White → sent via separate event to give chance to win

## Deployment

### Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_SERVER_URL` | Client's server connection URL | `http://localhost:3001` |
| `NODE_ENV` | Deployment context | `development` |
| `CLIENT_URL` | Deployed client URL (for server CORS) | None (uses localhost in dev) |

### Deployment Platforms
- **Client**: Static hosting (Vercel, Netlify)
- **Server**: Node.js hosting (Render, Railway, Heroku)
- See `DEPLOYMENT-GUIDE.md` for detailed deployment steps

## Quick Reference: File Locations

| Task | Files |
|------|-------|
| Add game phase | `apps/server/src/gameMachine.ts` (state definition) + `apps/client/src/components/screens/` (UI screen) |
| Add Socket.io event | `packages/shared/src/events.ts` (type definition) + `apps/server/src/index.ts` (handler) + client code |
| Fix styling issue | Look in component's `className` + `apps/client/index.css` + `tailwind.config.ts` |
| Add new hook | Create in `apps/client/src/hooks/` and export from `apps/client/src/hooks/index.ts` |
| Change game rules | Edit XState machine (`gameMachine.ts`) guards and actions |
| Debug multiplayer sync | Check Socket.io events in browser DevTools → server `console.log` output |
