# Learnings — texas-holdem-engine

Convention and pattern discoveries from implementation.

---

## Wave 1: Vitest Setup (2026-02-13)

### Vitest Configuration
- **Installation**: `npm install -D vitest` at root installs for all workspaces
- **Config location**: `apps/server/vitest.config.ts` with `globals: true` enables describe/it/expect without imports
- **Pattern matching**: `include: ['src/**/*.test.ts']` catches all test files in src tree
- **Test scripts**: Added `"test": "vitest run"` and `"test:watch": "vitest"` to apps/server/package.json
- **Execution**: `npm test --workspace=apps/server` runs vitest correctly with exit code 0

### Directory Structure
- Created `apps/server/src/poker/__tests__/` directory for test files
- Follows convention: `__tests__` folder at module level (poker module)
- Example test: `example.test.ts` with trivial passing test (1 + 1 = 2)

### Verification Results
- ✅ 1 test file discovered and executed
- ✅ 1 test passed
- ✅ No TypeScript errors in test files
- ✅ Vitest v4.0.18 running successfully
- ✅ Test execution time: 2ms (very fast)

### Next Steps
- Ready for TDD implementation of poker game logic
- Test infrastructure blocks tasks 4-9 (all require vitest)
- Can now write tests for game machine, hand evaluation, etc.


## Wave 1: Shared Poker Types & Constants (2026-02-13)

### Type Definitions Architecture
- **File**: `packages/shared/src/poker/types.ts` (150+ lines)
- **Pattern**: Follows existing Undercover types.ts style (union types, interfaces, enums)
- **Key types**:
  - `Suit` and `Rank` as union types (not enums) for flexibility
  - `Card` interface with suit + rank
  - `HandRank` enum (0-9) for all poker hand rankings
  - `PokerAction` union: fold | check | call | raise | allIn
  - `PokerPhase` union: lobby | preFlop | flop | turn | river | showdown | handComplete
  - `PlayerStatus` union: active | folded | allIn | sitOut | disconnected

### Information Hiding Pattern
- **PublicPokerPlayer** vs **PokerPlayer**: Critical security distinction
  - PublicPokerPlayer has NO holeCards field (only `hasCards: boolean`)
  - PokerPlayer (server-side) includes `holeCards: Card[] | null`
  - Prevents accidental exposure of opponent cards to clients
- **PokerPublicState** vs **PokerPrivateState**: Separate state objects
  - Public: phase, community cards, pots, players (public info only)
  - Private: playerId, holeCards, hand strength, available actions

### Monetary Values Convention
- **All chip values in centimes (integers)**: 1 cent = 1 unit
  - 100 centimes = 1€
  - 10000 centimes = 100€
  - Documented in JSDoc comments on every monetary field
  - Prevents IEEE 754 floating-point errors (0.1 + 0.2 ≠ 0.3)

### Constants File
- **File**: `packages/shared/src/poker/constants.ts`
- **Exports**:
  - SUITS: ['hearts', 'diamonds', 'clubs', 'spades']
  - RANKS: ['2', '3', ..., 'K', 'A']
  - DECK_SIZE: 52
  - DEFAULT_TABLE_CONFIG: 6-max, 5/10 blinds, 30s timeout
  - ACTION_TIMEOUT_MS: 30000
  - RECONNECT_GRACE_MS: 90000
  - MIN_PLAYERS: 2, MAX_PLAYERS: 6
  - STARTING_CHIPS: 10000 (100€)

### Barrel Export Pattern
- **File**: `packages/shared/src/poker/index.ts`
- **Pattern**: `export * from './types'` and `export * from './constants'`
- **Main index.ts**: Updated to `export * from './poker'`
- **Result**: All poker types importable as `import { Card, PokerPhase } from '@undercover/shared'`

### Build Verification
- ✅ `npm run build --workspace=packages/shared` → exit code 0
- ✅ `dist/poker/types.d.ts` generated (3659 bytes)
- ✅ `dist/poker/constants.d.ts` generated (1108 bytes)
- ✅ `dist/poker/index.d.ts` generated (barrel export)
- ✅ All TypeScript compilation successful
- ✅ No type errors in existing Undercover types

### Design Decisions
1. **Union types over enums for Suit/Rank**: More flexible for string literals, matches existing pattern
2. **Separate public/private player types**: Enforces information hiding at type level
3. **SidePot array (not single pot)**: Supports multi-way all-in scenarios
4. **HandHistoryEntry interface**: Enables persistence and replay (blocks Task 11)
5. **TableConfig as interface**: Allows partial overrides per table

### Next Steps
- Task 3 (Socket events) can now reference these types
- Tasks 4-9 (game logic) depend on these type definitions
- All downstream tasks can import from @undercover/shared


## Wave 1: Shared Poker Socket Events (2026-02-13)

### Event Architecture
- **File**: `packages/shared/src/poker/events.ts` (200+ lines)
- **Pattern**: Follows Socket.io typed events pattern from existing Undercover events.ts
- **Two interfaces**:
  - `PokerClientToServerEvents`: 13 events (createTable, joinTable, fold, check, call, raise, allIn, sitOut, sitIn, addChips, toggleStraddle, acceptRunItTwice, leaveTable)
  - `PokerServerToClientEvents`: 11 events (state, action, newHand, dealCards, communityCards, showdown, potWon, handHistory, tableList, error, timer)

### Client → Server Events (13 total)
1. **poker:createTable** - Create new table with optional config
2. **poker:joinTable** - Join table with buyIn amount and optional seat
3. **poker:leaveTable** - Leave current table
4. **poker:fold** - Fold current hand
5. **poker:check** - Check (pass without betting)
6. **poker:call** - Call current bet
7. **poker:raise** - Raise with amount (total bet, not raise amount)
8. **poker:allIn** - Go all-in with remaining chips
9. **poker:sitOut** - Sit out temporarily
10. **poker:sitIn** - Sit back in after sitting out
11. **poker:addChips** - Rebuy chips (amount in centimes)
12. **poker:toggleStraddle** - Enable/disable straddle variant
13. **poker:acceptRunItTwice** - Accept/decline run-it-twice variant

### Server → Client Events (11 total)
1. **poker:state** - Send publicState + privateState (private only to recipient)
2. **poker:action** - Notify of player action (playerId, action, optional amount)
3. **poker:newHand** - New hand starting (handNumber, dealerSeatIndex)
4. **poker:dealCards** - Deal hole cards (ONLY to specific player, not broadcast)
5. **poker:communityCards** - Reveal community cards (cards, phase)
6. **poker:showdown** - All remaining hands revealed (playerHands array)
7. **poker:potWon** - Pot winners announced (winners array with amounts)
8. **poker:handHistory** - Hand history entry after completion
9. **poker:tableList** - Available tables list
10. **poker:error** - Error message (message, code)
11. **poker:timer** - Action timer countdown (playerId, remainingMs)

### Information Hiding Implementation
- **poker:dealCards** event has explicit comment: "ONLY to specific player, not broadcast"
- **poker:state** sends PokerPublicState (no opponent hole cards) + PokerPrivateState (only to recipient)
- Type system enforces this: PublicPokerPlayer has no holeCards field
- Server-side enforcement required (types declare intent, not enforcement)

### Event Extension Pattern
- **Main events.ts** updated to extend poker events:
  - `ClientToServerEvents extends PokerClientToServerEvents`
  - `ServerToClientEvents extends PokerServerToClientEvents`
- **Result**: Both Undercover and Poker events coexist without conflicts
- **Socket.io generics**: `io.on<ClientToServerEvents, ServerToClientEvents>()` now includes all events

### Monetary Convention
- All amounts in centimes (integers): poker:raise, poker:addChips, poker:potWon
- Documented in JSDoc for each event
- Prevents float arithmetic errors

### Build Verification
- ✅ `npm run build --workspace=packages/shared` → exit code 0
- ✅ `dist/poker/events.d.ts` generated (6041 bytes)
- ✅ `dist/events.d.ts` updated with extended interfaces
- ✅ Both Undercover and Poker events compile without conflicts
- ✅ No TypeScript errors

### Design Decisions
1. **Separate PokerClientToServerEvents/PokerServerToClientEvents interfaces**: Allows clean extension pattern
2. **poker:raise takes total amount, not raise increment**: Simpler for client (no need to calculate min raise)
3. **poker:dealCards as separate event**: Allows server to send only to specific player (not broadcast)
4. **poker:state sends both public + private**: Matches Undercover pattern (game:state)
5. **domain:action naming**: Consistent with existing poker:* pattern (not game:poker:*)

### Next Steps
- Task 4-9 (game logic) can now import and use these event types
- Task 15 (socket integration) will implement server-side event handlers
- Task 25 (client hook) will implement client-side event listeners
- All event payloads typed with poker types from Task 2

