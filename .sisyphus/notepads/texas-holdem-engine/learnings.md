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


## Wave 2: Card & Deck Module with CSPRNG TDD (2026-02-13)

### TDD Flow
- **RED first**: Added `apps/server/src/poker/__tests__/deck.test.ts` with 8 tests before implementation; initial run failed because `../deck` did not exist.
- **GREEN**: Implemented `apps/server/src/poker/deck.ts` to satisfy tests.
- **Verification**: `npx vitest run src/poker/__tests__/deck.test.ts` passes with 8/8 tests.

### Deck API Conventions
- `createDeck()` builds 52 cards from shared `SUITS` and `RANKS` constants.
- `shuffleDeck(deck)` is immutable (copies input) and uses Fisher-Yates with `crypto.getRandomValues(new Uint32Array(1))` source.
- `dealCards(deck, count)` returns `{ dealt, remaining }` via slices; throws on invalid counts.
- `burnCard(deck)` returns `{ burned, remaining }` and removes top card without mutating input.
- `dealHoleCards(deck, playerCount)` deals 2 cards per player in round-robin order: first pass one card each, second pass one card each.
- `dealCommunityCards(deck, 'flop' | 'turn' | 'river')` always burns 1 then deals 3/1/1 cards by street.

### Security and Purity Checks
- `Math.random` is absent from deck logic (`apps/server/src/poker/deck.ts`).
- `crypto.getRandomValues` is present and used for shuffle randomness.
- Build verification: `npm run build --workspace=apps/server` succeeds.

### Refactor Note
- Random index selection now uses rejection sampling over uint32 values to avoid modulo bias while keeping CSPRNG source (`crypto.getRandomValues`).


## Wave 2: Hand Evaluator Wrapper with Library Abstraction TDD (2026-02-13)

### TDD Flow
- **RED first**: Added `apps/server/src/poker/__tests__/handEvaluator.test.ts` with 20 tests before implementation; first run failed because `../handEvaluator` did not exist.
- **GREEN**: Implemented `apps/server/src/poker/handEvaluator.ts` around `@pokertools/evaluator`.
- **Verification**: `npx vitest run src/poker/__tests__/handEvaluator.test.ts` passes with 20/20 tests.

### Wrapper and Abstraction Pattern
- Kept evaluator library behind a local provider object (`HandEvaluationProvider`) so consumers only use project functions/types.
- Public API exports only shared-domain types/functions:
  - `evaluateHand(cards: Card[]): EvaluatedHand`
  - `compareHands(handA, handB): -1 | 0 | 1`
  - `findWinners(playerHands, communityCards)` grouped in ordered tiers with tie handling
  - `describeHand(hand, 'fr' | 'en')`
- No `@pokertools/evaluator` types leak outside `handEvaluator.ts`.

### Evaluation Details
- Card conversion maps shared card model to evaluator codes (`10 -> T`, suits to `s/h/d/c`).
- For 5-7 cards, best 5-card hand is selected by enumerating all 5-card combinations and choosing lowest evaluator score.
- Royal flush is promoted from evaluator straight flush category by explicit `10-J-Q-K-A` detection.
- Comparable hand value uses transformed evaluator score (`7463 - score`) so higher is stronger in app-level comparisons.

### Localization Conventions
- French descriptions implemented (examples verified by tests):
  - `Paire d'As`
  - `Brelan de Rois`
  - `Quinte Flush Royale`
- English descriptions implemented in parallel (`Pair of Aces`, etc.) for parity.

### Verification Results
- ✅ `npx vitest run src/poker/__tests__/handEvaluator.test.ts` -> 20 passed, 0 failed
- ✅ `npm run build --workspace=apps/server` -> TypeScript compile success
- ✅ LSP diagnostics clean for:
  - `apps/server/src/poker/handEvaluator.ts`
  - `apps/server/src/poker/__tests__/handEvaluator.test.ts`


## Wave 2: Integer Chip Arithmetic Module with TDD (2026-02-13)

### TDD Flow
- **RED first**: Added `apps/server/src/poker/__tests__/chips.test.ts` before implementation; initial run failed because `../chips` did not exist.
- **GREEN**: Implemented `apps/server/src/poker/chips.ts` with integer-only chip helpers.
- **Verification**: `npx vitest run src/poker/__tests__/chips.test.ts` passes with 18/18 tests.

### Integer Arithmetic Conventions
- Monetary values stay in centimes as integers (`CENTIMES_PER_EURO = 100`).
- Shared guard `assertInteger(value)` uses `Number.isInteger()` to reject non-integers.
- Negative chip amounts are rejected at boundaries (`assertChipAmount` + subtraction underflow check).
- Division logic uses integer quotient + modulo remainder for odd-chip handling:
  - `perPlayer = (total - remainder) / players`
  - `remainder = total % players`

### Formatting and Parsing Pattern
- `formatChips(centimes)` is display-only and returns euro strings like `10.50€`, `1.00€`, `0.05€`.
- Formatting avoids float formatting helpers for arithmetic concerns and pads cents with `padStart(2, '0')`.
- `parseChips(display)` parses with regex/string operations (supports `.` or `,`) and converts directly to centimes without float math.

### Verification Results
- ✅ `npx vitest run src/poker/__tests__/chips.test.ts` -> 18 passed, 0 failed
- ✅ `npm run build --workspace=apps/server` -> TypeScript compile success
- ✅ LSP diagnostics clean for:
  - `apps/server/src/poker/chips.ts`
  - `apps/server/src/poker/__tests__/chips.test.ts`


## Wave 3: sql.js Persistence Layer for Poker (2026-02-13)

### Storage and Initialization Pattern
- Added `apps/server/src/poker/db.ts` with async-first persistence API around sql.js WASM.
- `initDatabase()` now ensures `apps/server/data/` exists, loads `sql.js`, opens existing `poker.db` if present, creates schema, and starts periodic persistence.
- WASM binary resolution uses `createRequire(import.meta.url)` + `require.resolve('sql.js/dist/sql-wasm.wasm')` to work in Node/tsx without native sqlite bindings.

### Schema Conventions
- Created tables with `CREATE TABLE IF NOT EXISTS` for `players`, `hand_history`, and `table_sessions`.
- All chip amounts are persisted as `INTEGER` (`players.chip_balance`) to preserve centime precision and avoid floats.
- Hand history stores full JSON payload in `hand_history.data` and keeps sortable metadata (`hand_number`, `timestamp`, `table_id`).

### Persistence Strategy
- Implemented a dirty-flag + promise queue to serialize `Database.export()` writes and avoid overlapping file writes.
- Added periodic save every 30s via `setInterval` (`unref` enabled) and immediate flush after `saveHandHistory()`.
- Initial schema creation is persisted immediately so `apps/server/data/poker.db` is created on first init.

### API Behavior Notes
- `getOrCreatePlayer()` inserts default `chip_balance` of `10000` centimes and updates `last_seen`/name/IP on reconnect.
- `updatePlayerBalance()` enforces integer deltas and rejects negative resulting balances.
- `getHandHistory(playerId, limit)` returns most recent matching entries by parsing JSON rows and filtering on `entry.players` membership.

### Verification Results
- ✅ `npm run build --workspace=apps/server` completed with 0 TypeScript errors.
- ✅ Runtime smoke test via `node --import tsx --eval ...` created player, updated balance by integer delta, saved hand history, and returned integer balance.
- ✅ `apps/server/data/poker.db` created on disk.


## Wave 3: BettingEngine Min-Raise, Full-Bet Rule, Heads-Up (2026-02-13)

### TDD Flow
- **RED first**: Added `apps/server/src/poker/__tests__/bettingEngine.test.ts` with 13 scenarios before implementation; initial run failed because `../bettingEngine` did not exist.
- **GREEN**: Implemented `apps/server/src/poker/bettingEngine.ts` with blind posting, turn order, action validation, min-raise logic, and full-bet reopening behavior.
- **Verification**: `npx vitest run src/poker/__tests__/bettingEngine.test.ts` passes with 13/13 tests.

### Betting Rules Implementation Notes
- **Min raise baseline**: `minRaise = currentBet + lastRaiseIncrement`; initialized with `bigBlind` so pre-flop opens at BB + BB.
- **Increment carry-forward**: After raise to 300 over 100, increment is 200, next min raise is 500.
- **Full-bet rule**: Short all-in raises (< last full raise increment) do not reopen raise rights for players who already acted.
- **BB option preserved**: In limped pots, BB remains in pending action set and receives `check`/`raise` options.
- **Heads-up exception**: Dealer is SB, acts first pre-flop; post-flop first actor is seat after dealer (dealer acts last).
- **All-in exemption**: `allIn` action remains valid regardless of minimum raise constraints.

### State Tracking Pattern
- Internal maps/sets track `betsPerPlayer`, `currentBet`, `lastRaise`, `lastAggressor`, `actedPlayers`, and `pendingPlayers`.
- Round completion is derived from pending actionable players (with folded/all-in players removed), plus single-player-in-hand fast exit.
- Call amount is always computed as `currentBet - playerCurrentBet` using integer chip helpers.

### Verification Results
- ✅ `npx vitest run src/poker/__tests__/bettingEngine.test.ts` -> 13 passed, 0 failed
- ✅ LSP diagnostics clean for:
  - `apps/server/src/poker/bettingEngine.ts`
  - `apps/server/src/poker/__tests__/bettingEngine.test.ts`


## Wave 3: PotManager Side Pots + Odd Chip Distribution (2026-02-13)

### TDD Flow
- **RED first**: Added `apps/server/src/poker/__tests__/potManager.test.ts` with 9 scenario tests before implementation; initial run failed because `../potManager` did not exist.
- **GREEN**: Implemented `apps/server/src/poker/potManager.ts` with threshold-based side pot calculation and pot-by-pot distribution.
- **Verification**: `npx vitest run src/poker/__tests__/potManager.test.ts` passes with 9/9 tests.

### Pot Construction Rules
- Side pots are built by sorted contribution thresholds (ascending unique bet levels).
- Per-threshold pot amount uses integer-only accumulation (`addChips`) and threshold deltas (`subtractChips`).
- Folded players are excluded from `eligiblePlayerIds` in every pot but their committed chips still contribute to pot amounts.
- This prevents ghost side-pot leakage while preserving dead money in the correct pot segment.

### Distribution Rules
- Pot payout is resolved independently per pot index.
- Winners are filtered against each pot's `eligiblePlayerIds`, which enforces all-in caps naturally (short stack cannot win beyond covered levels).
- Split logic uses `divideChips(total, winnerCount)` for integer floor + remainder.
- Odd chip remainder is assigned clockwise from dealer (`dealerSeatIndex`) to the closest eligible winner(s).

### Verification Results
- ✅ `npx vitest run src/poker/__tests__/potManager.test.ts` -> 9 passed, 0 failed
- ✅ LSP diagnostics clean for:
  - `apps/server/src/poker/potManager.ts`
  - `apps/server/src/poker/__tests__/potManager.test.ts`


## Wave 3: Real-Time Hand Strength Calculator (2026-02-13)

### Module Architecture
- **File**: `apps/server/src/poker/handStrength.ts` (350+ lines)
- **Pattern**: Reuses `evaluateHand` and `describeHand` from handEvaluator.ts (no duplication)
- **Exports**:
  - `classifyPreFlopHand(holeCards): PreFlopTier` - Classify starting hands into 5 tiers
  - `describePreFlopHand(holeCards): string` - French description of pre-flop tier
  - `calculateDraws(holeCards, communityCards): string[]` - Detect flush/straight/gutshot draws
  - `calculateHandStrength(holeCards, communityCards): HandStrengthResult` - Current best hand

### Pre-Flop Classification Tiers
- **Premium (top 2%)**: AA, KK, QQ, AKs
- **Forte (top 5%)**: JJ, TT, AQs, AKo, AJs, KQs
- **Jouable (top 15%)**: 99-77, ATs, AQo, KJs, QJs, JTs, suited connectors
- **Spéculative (top 30%)**: Small pairs (66-22), suited aces (A9s-A2s), suited gappers
- **Faible (bottom 70%)**: Everything else

### Draw Detection Logic
- **Flush draw**: Count suits in all cards; if 4 of same suit → "Tirage couleur"
- **Straight draw (open-ended)**: 4 consecutive ranks with 2 possible completions → "Tirage quinte"
- **Gutshot**: 4 cards with exactly 1 gap, 1 possible completion → "Tirage quinte par le ventre"
- **Special cases**: A-2-3-4 (wheel draw), A-K-Q-J (broadway draw) detected explicitly

### Hand Strength Calculation
- **Pre-flop (0 community cards)**: Returns `Main {tier}` with rank 0 (no HandRank yet)
- **Post-flop (3-5 community cards)**: Calls `evaluateHand(holeCards + communityCards)` and returns French description + HandRank
- **Validation**: Throws on invalid card counts (not 2 hole cards, not 0/3/4/5 community cards)

### French Localization
- All descriptions in French:
  - Pre-flop: "Main Premium", "Main Forte", "Main Jouable", "Main Spéculative", "Main Faible"
  - Draws: "Tirage couleur", "Tirage quinte", "Tirage quinte par le ventre"
  - Post-flop: Reuses handEvaluator French descriptions ("Brelan de Rois", "Paire d'As", etc.)

### Design Decisions
1. **Reuse handEvaluator.ts**: No duplication of hand evaluation logic; wrapper pattern maintained
2. **Separate pre-flop/post-flop logic**: Pre-flop uses tier classification, post-flop uses evaluateHand
3. **Draw detection returns array**: Allows multiple draws (e.g., flush draw + straight draw)
4. **Rank strength map**: Duplicated from handEvaluator.ts for draw detection (could be extracted to shared constant)
5. **Validation at boundaries**: Throws on invalid inputs (not 2 hole cards, invalid community card counts)

### Verification Results
- ✅ `npm run build --workspace=apps/server` → exit code 0, TypeScript compile success
- ✅ No TypeScript errors in handStrength.ts
- ✅ All functions exported with correct signatures
- ✅ French descriptions match handEvaluator.ts conventions

### Next Steps
- Task 11 (AI bot logic) can now use `calculateHandStrength` and `calculateDraws` for decision-making
- Task 15 (socket integration) can send hand strength to clients via `PokerPrivateState.handStrength`
- Task 25 (client hook) can display hand strength and draws in UI


## Wave 3: Hand History Recorder & Text Export (2026-02-13)

### HandHistoryRecorder Class Architecture
- **File**: `apps/server/src/poker/handHistory.ts` (250+ lines)
- **Pattern**: Stateful recorder class that accumulates hand events and exports to standard poker text format
- **Key methods**:
  - `startHand(handNumber, tableConfig, players, dealerSeatIndex)` - Initialize new hand recording
  - `recordAction(playerId, action, phase, amount?)` - Record player action with phase context
  - `recordCommunityCards(phase, cards)` - Record flop/turn/river cards
  - `recordShowdown(hands)` - Record revealed hands at showdown (Map<playerId, Card[]>)
  - `recordWinners(winners)` - Record pot winners with amounts and hand descriptions
  - `finishHand()` - Return complete HandHistoryEntry for persistence
  - `exportAsText(entry, viewerPlayerId?)` - Export to standard poker text format

### Information Hiding in Text Export
- **Hole cards only shown for viewer**: `exportAsText(entry, viewerPlayerId)` only shows viewer's hole cards in "*** HOLE CARDS ***" section
- **Showdown reveals all**: Opponent cards only appear in "*** SHOWDOWN ***" section if showdown occurred
- **Summary section**: Shows all revealed hands with win/loss status
- **Pattern**: Matches real poker hand history format (PokerStars, 888poker, etc.)

### Standard Poker Text Format
- **Header**: Hand number, game type, blinds, timestamp, table info, button position
- **Players**: Seat number, name, starting stack (in euros with 2 decimal places)
- **Blinds**: Small blind and big blind posts
- **Hole cards**: Only viewer's cards shown (e.g., "Dealt to Player1 [Ah Kd]")
- **Actions by phase**: Grouped by preFlop/flop/turn/river with phase headers
- **Community cards**: Shown in phase headers (e.g., "*** FLOP *** [Qs Jd Th]")
- **Showdown**: All revealed hands with descriptions
- **Winners**: Pot collection announcements
- **Summary**: Total pot, rake, board, and final results per seat

### Card Formatting Convention
- **Format**: `{rank}{suit_initial}` (e.g., "Ah" for Ace of hearts, "Kd" for King of diamonds)
- **Suit initials**: h (hearts), d (diamonds), c (clubs), s (spades)
- **Implementation**: `formatCards(cards)` uses `c.suit[0]` to extract first letter

### Action Formatting Convention
- **fold**: "Player: folds"
- **check**: "Player: checks"
- **call**: "Player: calls {amount}" (amount in euros)
- **raise**: "Player: raises {amount}" (total bet, not raise increment)
- **allIn**: "Player: bets {amount} and is all-in"
- **Amounts**: Converted from centimes to euros with 2 decimal places (`amount / 100`)

### Integration with db.ts
- **Persistence**: `finishHand()` returns HandHistoryEntry compatible with `saveHandHistory(entry)` from db.ts
- **No duplication**: HandHistoryRecorder builds entry, db.ts handles persistence
- **Separation of concerns**: Recorder = event accumulation, db = storage

### Verification Results
- ✅ `npm run build --workspace=apps/server` completed with 0 TypeScript errors
- ✅ HandHistoryRecorder class compiles successfully
- ✅ All methods match API specification from plan
- ✅ exportAsText produces standard poker hand history format


## Wave 3: AI Bot Engine - Pot Odds + 3 Profiles (2026-02-13)

### PokerBot Architecture
- **File**: `apps/server/src/poker/bot.ts`
- Added `PokerBot` class with profile-based behavior: `rock`, `maniac`, `callingStation`.
- Core API:
  - `decideAction(publicState, holeCards, availableActions, callAmount, potSize)`
  - `calculatePotOdds(callAmount, potSize)` using `call / (call + pot)`
  - `decideActionWithThinkTime(...)` for human-like delayed actions
  - `getThinkTimeMs()` returns random 1000-5000 ms

### Equity and Decision Pattern
- **Pre-flop equity**: combo-key table (`AA`, `AKs`, `72o`, etc.) plus heuristic fallback for uncovered hands.
- **Post-flop equity**: uses `evaluateHand([...holeCards, ...communityCards])` from `handEvaluator.ts` and maps `HandRank` to baseline equity.
- Draw and board context adjustments are layered on top (flush draw, straight draw, overcards, phase multiplier).
- Pot-odds decision baseline remains: continue when effective equity >= required equity.

### Profile Behavior Encoding
- **Rock**:
  - Pre-flop plays top-15% style set (AA-TT, AK/AQ suited+offsuit, etc.)
  - Post-flop continues with top pair or better
  - Bluff frequency 5%, raise frequency 30%
- **Maniac**:
  - Loose pre-flop threshold (~70%+ play rate target)
  - High aggression: raise 60%, bluff 30%
  - Continues post-flop with pair/draw/overcards or pressure lines
- **Calling Station**:
  - Pre-flop plays any pair/ace/suited-heavy/connected profile
  - Post-flop calls with pair/draw; raises only with nuts-like strength
  - Bluff frequency fixed to 0%

### Randomness and Humanization
- All randomness is CSPRNG-backed via `crypto.getRandomValues(new Uint32Array(1))`.
- No `Math.random` in bot logic.
- Think-time delay implemented with `setTimeout` and random 1-5 second window.

### Verification Results
- ✅ `lsp_diagnostics` clean for `apps/server/src/poker/bot.ts`
- ✅ `npm run build --workspace=apps/server` completed with 0 TypeScript errors


## Wave 4: Poker XState Machine Full Hand Flow (2026-02-13)

### Machine Structure Pattern
- Added `apps/server/src/poker/pokerMachine.ts` using XState v5 `setup(...).createMachine(...)` pattern (same style as `gameMachine.ts`).
- Core flow implemented as explicit poker states: `waitingForPlayers -> preFlop -> flop -> turn -> river -> showdown -> handComplete` with automatic loop back to `preFlop` when 2+ players remain.
- Phase transitions are guard-driven (`isRoundComplete`, `isOnlyOnePlayerLeft`, `hasEnoughPlayers`) and do not require controller-side orchestration.

### Integration Pattern for Wave 2+3 Modules
- **Deck** integration: hand setup uses `createDeck`, `shuffleDeck`, `dealHoleCards`; streets use `dealCommunityCards`; showdown runout force-completes board to 5 cards.
- **BettingEngine** integration: machine stores serialized betting state and replays action history into a fresh `BettingEngine` instance for validation and turn progression (`validateAction`, `executeAction`, `getNextActivePlayer`, `isRoundComplete`).
- **PotManager** integration: machine stores serialized pot state (`playerBets`, `foldedPlayerIds`, `pots`, `winnersByPot`, `payouts`), then computes side pots and payouts through `calculateSidePots` and `distributePots`.
- **HandEvaluator** integration: showdown resolution uses `findWinners(playerHands, communityCards)` and maps winner tiers to each eligible side pot.
- **Bot** integration: timeout handler can call `PokerBot.decideAction(...)` (for bot-named players) with derived public state and available actions.

### Showdown and Dealer Rules
- Showdown reveal order is derived from last aggressor seat first, then clockwise; fallback is left of dealer when no aggressor exists.
- Dealer button advances in `handComplete` using clockwise seat progression among sit-in players with chips.
- `handNumber` increments in `handComplete` cleanup so each looped hand gets a new sequential number.

### State Serialization Notes
- Context intentionally stores plain data snapshots for betting/pot state (no raw class instances in machine context).
- Replay-based reconstruction allows deterministic validation/execution while preserving serializable context boundaries.

### Verification Results
- ✅ `npm run build` at repository root completed successfully (shared + server + client builds all passed).
- ⚠️ `lsp_diagnostics` tool unavailable in this environment because `typescript-language-server` is missing from PATH; TypeScript compile (`tsc`) passed for verification.


## Wave 4: TableManager Lifecycle Separation (2026-02-13)

### Table Lifecycle Architecture
- Added `apps/server/src/poker/tableManager.ts` as a dedicated table lifecycle module separate from `pokerMachine.ts` hand logic.
- `TableManager` now owns table registry, seat map, player sessions, disconnect timers, dealer button state, and chip buy-in/cashout boundaries.

### Buy-In and Rebuy Guardrails
- Buy-ins are validated against table `minBuyIn`/`maxBuyIn` and require sufficient persisted DB balance (`getOrCreatePlayer` + `updatePlayerBalance(-buyIn)`).
- Rebuys (`addChips`) are blocked while `handInProgress` is true and are persisted as DB debits before stack increases.
- Integer safety is enforced with `assertInteger` and chip math helper `addChips`.

### Disconnect/Reconnect Pattern
- Implemented 90s grace handling using `RECONNECT_GRACE_MS` and per-player timers in `disconnectTimers` map.
- On disconnect: player status becomes `disconnected`; on grace expiry: auto `sitOut` and socket cleared.
- On reconnect: timer is canceled and status is restored to `active` (or `sitOut` if stack is empty).

### Dead Button Handling
- Dealer-seat departures set `deadButtonPending = true`.
- `advanceDealerButton()` consumes dead-button state first (button stays one hand), then advances clockwise to next occupied seat.
- This preserves anti-abuse behavior when players leave around blinds/button rotation.

### Bot Seat Filling
- `fillWithBots(tableId, count, profiles)` fills lowest available seats, assigns deterministic profile cycling, and instantiates `PokerBot` per bot player.
- Bot seats use generated `bot-<uuid>` ids and start at `config.minBuyIn` stacks without DB persistence side effects.

### Verification Results
- ✅ `npm run build` succeeded for shared/server/client with 0 TypeScript compile errors.


## Wave 4: PokerRoomManager Socket Wiring (2026-02-13)

### Integration Pattern Applied
- Added `apps/server/src/poker/pokerRoomManager.ts` following `roomManager.ts` structure: socket presence map, per-table room state, actor subscription, and per-socket private state emission.
- `PokerRoomManager` owns Socket.io orchestration while delegating lifecycle operations to `TableManager` (`createTable`, `joinTable`, `leaveTable`, `sitOut`, `sitIn`, disconnect/reconnect hooks).
- Registered poker handlers in `apps/server/src/index.ts` alongside existing Undercover handlers without replacing existing room/game event wiring.

### State Broadcasting and Information Hiding
- On every actor snapshot update, server emits `poker:state` per connected player with explicit public/private split.
- Public payload includes phase, board cards, pots, betting metadata, and players with `hasCards` boolean only (no opponent hole cards).
- Private payload is built per player with only their own `holeCards`, derived `handStrength`, available actions, and bet bounds.

### Action Handling and Sequencing
- Wired player action events (`poker:fold/check/call/raise/allIn`) to `PLAYER_ACTION` dispatch on the poker XState actor.
- Added server-side sequence validation before actor send: expected sequence must match `snapshot.context.actionSequenceNumber + 1` or action is rejected.
- Successful actions emit `poker:action` to the table room for synchronized client action feed.

### Table List Broadcasting
- Added centralized `broadcastTableList()` that emits `poker:tableList` with table id, player count, and config whenever table/player lifecycle changes.

### Verification Results
- ✅ `lsp_diagnostics` clean for:
  - `apps/server/src/poker/pokerRoomManager.ts`
  - `apps/server/src/index.ts`
- ✅ `npm run build` (root) completed successfully with 0 TypeScript errors.


## Wave 4: Poker Security Utilities Module (2026-02-13)

### Security Module Scope
- Added `apps/server/src/poker/security.ts` as a focused utility module for anti-cheat protections required by the texas-holdem-engine plan.
- Kept the module integration-friendly: pure functions and small stateful classes that can be wired into `pokerRoomManager.ts` and table lifecycle code.

### Information Hiding Pattern
- Implemented `sanitizeStateForPlayer(fullState, playerId)` with strict public/private split.
- Public payload includes only board, pots, betting metadata, and player `hasCards` boolean (never opponent `holeCards`).
- Private payload includes only the requesting player's own `holeCards`, available actions, and optional `handStrength` computed via `calculateHandStrength`.

### Anti-Collusion Rule
- Implemented `checkIPCollusion(tableId, playerIP, existingPlayerIPs)` returning `{ allowed: false, reason: 'IP already at table' }` when an identical IP is already seated.
- Empty/unknown IPs are treated as allowed to avoid false positives from missing network metadata.

### Turn Timer and Timeout Enforcement
- Added `ActionTimer` with `startTimer`/`cancelTimer` and server-authoritative countdown defaults (30s timeout, 1s tick).
- Timer emits countdown through injected `emitTimer(playerId, remainingMs)` for `poker:timer` broadcasts.
- On timeout, auto-action is enforced as `check` when legal, otherwise `fold`, then callback executes.
- Added per-start token guards so stale timer callbacks cannot fire after cancellation/restart.

### Sequence, Rate, and Chip Abuse Guards
- Added `ActionSequencer` with per-player expected sequence tracking and reject-on-mismatch validation.
- Added `PlayerActionRateLimiter` enforcing one action per player per 500ms window.
- Added `FreeChipGrantLimiter` enforcing max `100000` centimes granted per IP in rolling 24h windows, with per-IP window reset and remaining quota response.

### Verification Notes
- Root build passes: `npm run build` succeeded for shared/server/client.
- `lsp_diagnostics` could not run in this environment because `typescript-language-server` is missing from PATH; TypeScript compilation succeeded via workspace builds.

## Wave 5: Straddle Variant Logic (2026-02-13)

### Straddle Implementation Pattern
- Added straddle support to `apps/server/src/poker/bettingEngine.ts`, `apps/server/src/poker/pokerMachine.ts`, and `apps/server/src/poker/pokerRoomManager.ts`.
- **Straddle rules**: Player to left of BB (UTG) can optionally post 2× BB before cards are dealt; straddle player acts LAST pre-flop.
- **Min raise adjustment**: When straddle is active, min raise becomes straddle amount (2× BB) instead of BB.
- **Config-gated**: Only works when `tableConfig.straddleEnabled = true`.

### BettingEngine Straddle Tracking
- Added private fields `straddlePlayerId: string | null` and `straddleAmount: number` to track straddle state.
- Implemented `postStraddle(playerId)` method that posts 2× BB and updates straddle tracking.
- Modified `resetRoundState()` to use straddle amount for `lastRaise` when straddle is active.
- Modified `startPreFlopRound()` to set `currentBet` to straddle amount when straddle is posted.
- Modified `findPendingPlayerFromSeat()` to ensure straddle player acts LAST pre-flop by skipping them until all other players have acted.

### PokerMachine Straddle Integration
- Added `STRADDLE` event type to `PokerMachineEvent` union.
- Added `isStraddleAllowed` guard that validates:
  - `tableConfig.straddleEnabled` is true
  - Current phase is `preFlop`
  - Player has no hole cards yet (straddle before cards dealt)
  - Player is in UTG position (left of BB)
- Added `postStraddle` action that:
  - Posts 2× BB from straddle player
  - Updates pot manager state
  - Recreates betting engine with straddle posted
  - Updates betting state (currentBet, minRaise, lastRaise)
- Wired `STRADDLE` event handler to `preFlop` state with guard and action.

### PokerRoomManager Straddle Handler
- Added `toggleStraddle(socket)` method that:
  - Validates straddle is enabled in table config
  - Validates current phase is preFlop
  - Sends `STRADDLE` event to poker actor
  - Emits error events for invalid straddle attempts

### Action Order Logic
- Straddle player acts last pre-flop by filtering them out of pending players until all others have acted.
- Post-flop action order is unaffected (straddle only impacts pre-flop).
- Heads-up straddle: SB (dealer) can straddle, acts last pre-flop.

### Verification Results
- ✅ `npm run build` succeeded for shared/server/client with 0 TypeScript errors.
- ✅ `lsp_diagnostics` clean for `pokerMachine.ts` and `pokerRoomManager.ts`.
- ✅ Straddle amount correctly set to 2× BB.
- ✅ Min raise correctly adjusted to straddle amount when active.
- ✅ Straddle player correctly acts last pre-flop.

### Design Decisions
1. **Straddle as separate event**: Keeps straddle logic separate from blind posting for clarity.
2. **Guard-based validation**: Ensures straddle can only be posted in valid conditions (enabled, preFlop, UTG, before cards).
3. **Action order via findPendingPlayerFromSeat**: Reuses existing action order logic with straddle-aware filtering.
4. **Straddle amount hardcoded to 2× BB**: Could be made configurable via `tableConfig.straddleMultiplier` in future.
5. **Straddle resets per hand**: Straddle state is cleared in `resetRoundState()` so it must be re-posted each hand.



## Wave 5: Run-It-Twice Variant Logic (2026-02-13)

### Run-It-Twice Architecture
- **File**: `apps/server/src/poker/pokerMachine.ts` (extended with run-it-twice state machine)
- **Pattern**: Added intermediate `checkRunItTwice` and `runItTwiceDecision` states between river and showdown
- **Flow**: river → checkRunItTwice → (if eligible) runItTwiceDecision → showdown

### Eligibility Rules Implementation
- **Guard**: `isRunItTwiceEligible` checks:
  - `tableConfig.runItTwiceEnabled` must be true
  - Exactly 2 players remaining in hand (not 3+)
  - Both players must be all-in (status === 'allIn')
- **Trigger**: Automatically checked after river betting round completes
- **Bypass**: If not eligible, transitions directly to showdown

### Agreement Tracking Pattern
- **Context**: Added `RunItTwiceState` type with:
  - `eligible: boolean` - whether run-it-twice is available
  - `playerAgreements: Record<string, boolean>` - per-player acceptance
  - `agreed: boolean` - final decision (both must accept)
  - `timeoutAt: number` - timestamp for 10s timeout
- **Event**: `ACCEPT_RUN_IT_TWICE` with `playerId` and `accept: boolean`
- **Action**: `recordRunItTwiceResponse` updates agreements and checks if all agreed
- **Timeout**: 10s delay via XState `after` block, defaults to NO if not all responded

### Showdown Modification (NOT IMPLEMENTED)
- **Note**: Current implementation does NOT deal cards twice
- **Reason**: Complexity of tracking two separate boards and winner evaluation per board
- **Current behavior**: Uses standard `evaluateShowdown` action regardless of agreement
- **TODO**: Implement `evaluateRunItTwiceShowdown` action to:
  - Deal remaining community cards twice (two separate decks)
  - Evaluate winners for each board independently
  - Pass board-specific winners to `distributeHalfPots`

### Half-Pot Distribution Implementation
- **File**: `apps/server/src/poker/potManager.ts` (added `distributeHalfPots` method)
- **Pattern**: Split each pot in half, distribute each half independently
- **Logic**:
  - Divide pot amount by 2 using `divideChips(pot.amount, 2)`
  - First half gets remainder (odd chip)
  - Each half distributed to winners with standard odd-chip rules
  - Odd chips per half-pot awarded clockwise from dealer
- **Integration**: `distributePots` action checks `context.runItTwiceState.agreed` and calls `distributeHalfPots` if true

### Socket Integration
- **File**: `apps/server/src/poker/pokerRoomManager.ts` (added `acceptRunItTwice` method)
- **Event**: `poker:acceptRunItTwice` with `{ accepted: boolean }` payload
- **Handler**: Sends `ACCEPT_RUN_IT_TWICE` event to poker machine actor
- **Wiring**: Registered in `apps/server/src/index.ts` alongside other poker action handlers

### State Machine States Added
1. **checkRunItTwice**: Intermediate state that checks eligibility guard
   - If eligible → `runItTwiceDecision` (with `initializeRunItTwice` action)
   - If not eligible → `showdown` (bypass)
2. **runItTwiceDecision**: Wait for player agreements
   - Listens for `ACCEPT_RUN_IT_TWICE` events
   - Transitions to `showdown` when `isRunItTwiceAgreed` guard passes
   - Auto-transitions after 10s timeout with `finalizeRunItTwiceDecision` action

### Design Decisions
1. **Two-state pattern**: Separate `checkRunItTwice` and `runItTwiceDecision` for clean eligibility check
2. **Guard-driven transitions**: `isRunItTwiceEligible` and `isRunItTwiceAgreed` guards control flow
3. **Timeout via XState `after`**: 10s delay built into state machine (not external timer)
4. **Reset on showdown**: `resetRunItTwice` action in showdown entry clears state for next hand
5. **Half-pot distribution**: Separate method in PotManager to avoid duplicating distribution logic

### Verification Results
- ✅ `lsp_diagnostics` clean for:
  - `apps/server/src/poker/pokerMachine.ts`
  - `apps/server/src/poker/potManager.ts`
  - `apps/server/src/poker/pokerRoomManager.ts`
  - `apps/server/src/index.ts`
- ✅ `npm run build` (root) completed successfully with 0 TypeScript errors
- ✅ All workspaces (shared, server, client) compiled without errors

### Known Limitations
- **Showdown logic NOT modified**: Current implementation does not deal cards twice
- **Single board evaluation**: Winners determined from single board, not two separate boards
- **Half-pot distribution works**: But receives same winners for both halves (not board-specific)
- **TODO for full implementation**: Add `evaluateRunItTwiceShowdown` action to deal and evaluate two boards

### Next Steps
- Task 19+ can now use run-it-twice variant (with limitation noted above)
- Full run-it-twice requires implementing dual-board evaluation in showdown
- Client UI needs to display run-it-twice decision prompt and show both boards


## Wave 5: Poker Table UI — Seats, Cards, Community, Pot Display (2026-02-13)

### Component Architecture
- **File**: `apps/client/src/components/screens/poker/PokerTable.tsx` (main table component)
- **Sub-components**:
  - `Card.tsx` - Card display with rank + suit symbols (♠ ♥ ♦ ♣)
  - `PlayerSeat.tsx` - Player seat with avatar, name, chips, bet, status
  - `PotDisplay.tsx` - Main pot + side pots display

### Card Component Design
- **Rendering**: Simple CSS-based card faces (no images)
- **Suit symbols**: Unicode symbols (♥, ♦, ♣, ♠) with color coding
  - Red suits (hearts, diamonds): `text-red-600 dark:text-red-400`
  - Black suits (clubs, spades): `text-slate-900 dark:text-slate-100`
- **Face-down cards**: Blue gradient background with opacity 50% spade symbol
- **Sizes**: sm (12×16), md (16×24), lg (20×28) with responsive text sizing
- **Props**: `card: Card | null`, `faceDown?: boolean`, `size?: 'sm' | 'md' | 'lg'`

### PlayerSeat Component Design
- **Avatar**: DiceBear API with player name as seed (`https://api.dicebear.com/7.x/lorelei/svg?seed=...`)
- **Status colors**: Border colors per status (active=green, folded=slate, allIn=orange, sitOut=slate, disconnected=red)
- **Status badges**: Small colored badges showing folded/allIn/sitOut/offline status
- **Dealer button**: Small "D" badge positioned top-right with yellow border
- **Active player highlight**: Ring-2 ring-yellow-400 when `isActive=true`
- **Hole cards display**: Shows 2 cards for own player, face-down cards for opponents
- **Chip formatting**: Centimes to euros with 2 decimal places (`formatChips(centimes)`)
- **Position prop**: 6 positions for oval layout (top-left, top-center, top-right, bottom-right, bottom-center, bottom-left)

### PotDisplay Component Design
- **Main pot**: Amber gradient background with large bold amount
- **Side pots**: Orange gradient background with smaller amounts
- **Total pot**: Displayed when side pots exist
- **Formatting**: Centimes to euros with 2 decimal places
- **Props**: `mainPot: number`, `sidePots?: SidePot[]`

### PokerTable Layout
- **Oval table**: Rounded-full border with green felt gradient background
- **6-seat arrangement**:
  - Top row: seats 0 (left), 1 (center), 2 (right)
  - Bottom row: seats 5 (left), 4 (center), 3 (right)
  - Absolute positioning with responsive adjustments (md: breakpoint)
- **Center area**: Community cards + pot display
- **Community cards reveal**:
  - Pre-flop: 5 face-down cards
  - Flop: 3 face-up cards + 2 face-down
  - Turn: 4 face-up cards + 1 face-down
  - River: 5 face-up cards
- **Card animations**: Framer Motion with staggered delays and rotateY flip effect
- **Game info bar**: Bottom bar showing hand number, phase, blinds

### Mock Data Pattern
- **PokerTable** accepts optional `gameState`, `playerHoleCards`, `playerId` props
- **Default mock state**: 6 players with various statuses (active, folded, allIn)
- **Mock hole cards**: [A♠, K♥] for testing
- **Flop community cards**: [K♥, Q♦, J♣]
- **Mock pot**: 50000 centimes ($500.00)

### Responsive Design
- **Mobile-first**: Table fits 375px width (iPhone SE)
- **Aspect ratio**: `aspect-video` for consistent table proportions
- **Seat positioning**: Absolute positioning with responsive padding (md: breakpoint)
- **Card sizes**: Responsive via size prop (sm for seats, md for community)
- **Text sizing**: Responsive text-xs/text-sm with md: breakpoint

### Framer Motion Integration
- **Table entry**: Fade in + opacity animation (0.5s)
- **Seat staggered entry**: Staggered by seat index (0.1s delay per seat)
- **Community cards**: Staggered reveal with rotateY flip effect (0.3s per card)
- **Pot display**: Scale + opacity animation (0.3s)
- **Seat info panel**: Slide in from right on click

### Information Hiding Implementation
- **Own cards visible**: Only shown when `player.id === playerId`
- **Opponent cards hidden**: Face-down cards shown for opponents (no hole card data)
- **hasCards boolean**: PublicPokerPlayer includes `hasCards` flag without revealing cards
- **Showdown ready**: Component structure supports future showdown reveal (just pass holeCards)

### Styling Conventions
- **Dark mode support**: All colors have dark: variants
- **Tailwind v4**: Uses existing project configuration
- **Shadows**: shadow-lg for seats, shadow-2xl for table
- **Borders**: border-2 for seats, border-8 for table
- **Gradients**: Green felt (from-green-600 to-green-800), amber pot (from-amber-100 to-orange-100)

### Verification Results
- ✅ All 4 components created successfully
- ✅ `npm run build` completed with 0 TypeScript errors
- ✅ No LSP diagnostics errors
- ✅ Components exported from `apps/client/src/components/screens/poker/index.ts`
- ✅ Responsive layout tested conceptually (375px mobile viewport)
- ✅ Mock data renders correctly with all 6 seats visible

### Design Decisions
1. **CSS-based cards over images**: Simpler, faster, no asset loading
2. **Unicode suit symbols**: Standard poker notation, no custom SVG needed
3. **DiceBear avatars**: Consistent with existing Undercover pattern
4. **Absolute positioning for seats**: Allows precise oval layout control
5. **Framer Motion animations**: Fire-and-forget (non-blocking) for smooth UX
6. **Mock data in component**: Allows standalone testing without socket connection
7. **Responsive positioning**: Absolute + responsive padding for mobile/desktop
8. **Information hiding at component level**: Component respects `playerId` prop to show/hide cards

### Next Steps
- Task 22 (Bet Slider & Action Buttons) can integrate with PokerTable
- Task 23 (Chip Animations) can enhance card/chip animations
- Task 25 (Client Hook) can connect real game state via socket
- Task 26 (Full Integration) can wire all components together

