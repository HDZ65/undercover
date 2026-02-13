# Texas Hold'em No-Limit Poker Engine

## TL;DR

> **Quick Summary**: Build a complete Texas Hold'em No-Limit multiplayer poker engine as an extension to the existing Undercover monorepo. Covers game engine (hand evaluation, CSPRNG deck), betting logic (side pots, min-raise, full-bet rule), security (information hiding, timers), AI bots (3 profiles), UI/UX (poker table, bet slider, animations), and variants (straddle, run-it-twice). Play money only, SQLite persistence, 6-max tables.
>
> **Deliverables**:
> - Server-side poker XState machine with full game logic
> - Hand evaluator wrapper around @pokertools/evaluator or poker-evaluator
> - PotManager with correct side pot, odd chip, and split pot logic
> - BettingEngine with min-raise, full-bet rule, BB option, heads-up rules
> - CSPRNG deck with Fisher-Yates + crypto.getRandomValues
> - SQLite persistence layer (hand history, chip balances)
> - Security layer (information hiding, IP check, sequence numbers, timers)
> - 3 AI bot profiles (Rock, Maniac, Calling Station) with pot odds
> - React poker table UI with bet slider, chip animations, hand strength
> - Hand history export (standard text format)
> - Straddle + Run-it-Twice variant support
> - Full Vitest test suite (TDD for critical modules)
>
> **Estimated Effort**: XL (40-60 tasks across 6 modules)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Test Infra → Shared Types → Game Engine → Betting → Security → State Machine → Socket Integration → Client UI

---

## Context

### Original Request
Build a complete Texas Hold'em No-Limit multiplayer poker engine covering 6 modules: game engine with hand evaluation, betting/pots with side pots, security/anti-cheat, AI bots, UI/UX immersion, and variants (straddle, run-it-twice). Detailed specification provided with 10+ known edge cases/bugs to prevent.

### Interview Summary
**Key Discussions**:
- **Architecture**: Extension of existing monorepo (not separate app) — poker module alongside Undercover
- **Economy**: Play money (free chips) — no real money, no regulatory compliance
- **Database**: SQLite via sql.js (WASM) for persistence — avoids native binding issues with tsx runtime
- **Scale**: Small (1-5 tables, 2-50 concurrent players)
- **Auth**: Anonymous (pseudo + socket session), matching existing Undercover pattern
- **Hand Evaluator**: Use existing library (@pokertools/evaluator preferred, poker-evaluator fallback)
- **Tests**: Vitest framework, TDD for critical modules (engine, betting, pots, deck)
- **Tables**: 6-max (2-6 players per table)

**Research Findings**:
- **@pokertools/evaluator**: 17M evals/sec, TypeScript native, Perfect Hash, zero GC — BEST FIT
- **poker-evaluator**: 22M evals/sec, TwoPlusTwo lookup, JS — FALLBACK
- **poker-ts** (GitHub): Full engine reference (52 stars, MIT, state machine pattern, active Sep 2025)
- **Existing codebase**: XState v5 machine (904 lines), room manager with per-room actors, public/private state split, domain:action event naming, reconnect with playerToken
- **Side pot algorithm**: Threshold-based (sort bets ascending, create sidepots per threshold, distribute smallest first)
- **CSPRNG**: Fisher-Yates + crypto.getRandomValues(Uint32Array) — standard approach

### Metis Review
**Identified Gaps** (addressed):
- **SQLite + tsx runtime conflict**: better-sqlite3 requires native bindings incompatible with tsx → USE sql.js (WASM) instead
- **Client routing**: Need game selector (Undercover vs Poker) in Landing page → Add game type selection
- **Evaluator wrapper needed**: Library handles raw eval, but we need kicker comparison, split pot logic, Ace-low wrapping → Create PokerHandEvaluator wrapper class
- **Chip economy exploit**: Anonymous auth + free chips = easy multi-accounting → Add IP-based chip limits and rate limiting
- **Dead button rule**: When player leaves mid-hand, button progression logic needed → Implement standard dead button rule
- **Mass disconnect**: If all players disconnect mid-hand → Auto-pause hand, resume on reconnect or cancel after timeout
- **Table lifecycle**: Need explicit join/leave/buy-in/stand-up flows → Define TableManager separate from game logic
- **Showdown order**: Which player shows first? → Standard: last aggressor shows first, clockwise from there

---

## Work Objectives

### Core Objective
Extend the existing Undercover monorepo with a fully-functional Texas Hold'em No-Limit poker module that handles all betting rules, side pots, hand evaluation, security, AI opponents, and immersive UI — with correctness guaranteed by TDD tests on all critical logic.

### Concrete Deliverables
- `packages/shared/src/poker/` — Poker type definitions, events, constants
- `apps/server/src/poker/` — Game engine, betting engine, pot manager, deck, hand evaluator, AI bots, state machine, table/room manager, DB layer
- `apps/client/src/components/poker/` — Poker table UI, screens, hooks
- `apps/server/src/poker/__tests__/` — Vitest test suites (TDD)
- SQLite database file for persistence

### Definition of Done
- [ ] `npx vitest run` → ALL tests pass (0 failures)
- [ ] Poker game playable end-to-end with 2-6 human players via browser
- [ ] Side pots calculated correctly for 3+ player all-in scenarios
- [ ] AI bots fill empty seats and play according to profiles
- [ ] Hand history exportable as standard text
- [ ] No float arithmetic anywhere in chip/pot logic
- [ ] Opponent cards shown as null until showdown
- [ ] Straddle and Run-it-Twice toggleable per table

### Must Have
- Correct side pot resolution (multi all-in)
- Correct kicker comparison (always 5 best cards)
- Wheel straight detection (A-2-3-4-5)
- Heads-up blind rules (dealer = SB, acts first pre-flop)
- Big Blind option (can check or raise when limped to)
- Full bet rule (incomplete raise doesn't reopen action)
- Integer arithmetic for all chip operations (centimes)
- Odd chip to player closest left of dealer
- CSPRNG deck shuffle (no Math.random)
- Burn cards before flop/turn/river
- Information hiding (server never sends opponent hole cards)
- 30s action timer with auto-check/fold
- Sequence number per action (prevent race conditions)
- Sit-out mode for disconnected players

### Must NOT Have (Guardrails)
- NO float/double for any monetary value — integers ONLY (centimes)
- NO sending full game state (including opponent cards) to clients
- NO Math.random() anywhere in deck/card logic
- NO single monolithic XState machine — decompose into sub-machines
- NO AI that uses hidden card information (must play from public state only)
- NO tournament mode (cash game only for v1)
- NO chat system
- NO leaderboards/rankings
- NO sound system
- NO multi-tabling (one table per player for v1)
- NO complex animation library beyond Framer Motion (already in project)
- NO hand history format beyond simple text (no PokerStars/HH format)
- NO "smart" AI (no Monte Carlo, no GTO solver — basic pot odds only)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task, regardless of test strategy.

### Test Decision
- **Infrastructure exists**: NO (setup required)
- **Automated tests**: TDD for critical modules, tests-after for UI/integration
- **Framework**: Vitest

### TDD Modules (RED-GREEN-REFACTOR)
- Deck (CSPRNG shuffle, burn cards, deal)
- HandEvaluator (wrapper: kickers, wheel, split detection)
- PotManager (side pots, odd chip, split pot)
- BettingEngine (min-raise, full bet rule, BB option, heads-up)
- ChipManager (integer arithmetic, buy-in, cashout)

### Tests-After Modules
- PokerMachine (XState state transitions)
- Socket events (integration)
- AI Bot profiles (behavioral)
- UI components (Playwright E2E)

### Agent-Executed QA Scenarios
Every task includes Playwright/bash/curl verification scenarios that the executing agent runs directly. No human testing required.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — Start Immediately):
├── Task 1: Vitest infrastructure setup
├── Task 2: Shared poker types & constants
└── Task 3: Shared poker socket events

Wave 2 (Core Engine — After Wave 1):
├── Task 4: Card & Deck module (CSPRNG + burn cards) [TDD]
├── Task 5: Hand evaluator wrapper [TDD]
├── Task 6: Integer chip arithmetic module [TDD]
└── Task 7: SQLite persistence layer (sql.js)

Wave 3 (Game Logic — After Wave 2):
├── Task 8: PotManager (side pots, odd chip, split) [TDD]
├── Task 9: BettingEngine (min-raise, full bet, BB option, heads-up) [TDD]
├── Task 10: Hand strength calculator (real-time equity)
├── Task 11: Hand history recorder & export
└── Task 12: AI Bot engine (pot odds + 3 profiles)

Wave 4 (State Machine & Network — After Wave 3):
├── Task 13: Poker XState machine (game flow)
├── Task 14: TableManager (join/leave/buy-in/sit-out)
├── Task 15: Poker room manager (socket integration)
├── Task 16: Security layer (info hiding, IP check, timers, sequence numbers)
├── Task 17: Straddle variant logic
└── Task 18: Run-it-Twice variant logic

Wave 5 (Client UI — After Wave 4):
├── Task 19: Game selector (Landing page: Undercover vs Poker)
├── Task 20: Poker lobby & table list UI
├── Task 21: Poker table UI (seats, cards, community, pot)
├── Task 22: Bet slider & action buttons
├── Task 23: Chip animations & dealer button
├── Task 24: Hand strength display & hand history viewer
├── Task 25: Poker client hook (usePokerSocket)
└── Task 26: Full E2E integration test
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|-----------|--------|---------------------|
| 1 | None | 4,5,6,7,8,9 | 2,3 |
| 2 | None | 4,5,8,9,13 | 1,3 |
| 3 | None | 15,25 | 1,2 |
| 4 | 1,2 | 8,10,13 | 5,6,7 |
| 5 | 1,2 | 8,10,13 | 4,6,7 |
| 6 | 1,2 | 8,9,14 | 4,5,7 |
| 7 | 1 | 11,14 | 4,5,6 |
| 8 | 4,5,6 | 13,18 | 9,10,11,12 |
| 9 | 6,2 | 13,17 | 8,10,11,12 |
| 10 | 4,5 | 24 | 8,9,11,12 |
| 11 | 7,4 | 24 | 8,9,10,12 |
| 12 | 2,5 | 13 | 8,9,10,11 |
| 13 | 8,9,12 | 15,16 | 14 |
| 14 | 6,7 | 15 | 13 |
| 15 | 3,13,14 | 16,25 | 17,18 |
| 16 | 15 | 26 | 17,18 |
| 17 | 9,13 | 26 | 16,18 |
| 18 | 8,13 | 26 | 16,17 |
| 19 | None | 20 | 20-25 (if mocked) |
| 20 | 3,19 | 26 | 21-25 |
| 21 | 2,3 | 26 | 19,20,22-25 |
| 22 | 2 | 26 | 19-21,23-25 |
| 23 | 21 | 26 | 24,25 |
| 24 | 10,11 | 26 | 23,25 |
| 25 | 3,15 | 26 | 19-24 |
| 26 | ALL | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2, 3 | 3× task(category="quick") — parallel |
| 2 | 4, 5, 6, 7 | 4× task(category="ultrabrain") — parallel |
| 3 | 8, 9, 10, 11, 12 | 5× task(category="ultrabrain") — parallel |
| 4 | 13, 14, 15, 16, 17, 18 | 6× task(category="deep") — parallel |
| 5 | 19-25 | 7× task(category="visual-engineering") — parallel |
| Final | 26 | 1× task(category="deep") — sequential |

---

## TODOs

---

### WAVE 1: FOUNDATION

---

- [x] 1. Setup Vitest Test Infrastructure

  **What to do**:
  - Install vitest as dev dependency in root and apps/server: `npm install -D vitest`
  - Create `vitest.config.ts` at `apps/server/` level:
    ```typescript
    import { defineConfig } from 'vitest/config'
    export default defineConfig({
      test: {
        include: ['src/**/*.test.ts'],
        globals: true,
      }
    })
    ```
  - Add test scripts to `apps/server/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
  - Create `apps/server/src/poker/__tests__/example.test.ts` with a trivial passing test
  - Verify: `npm test --workspace=apps/server` → 1 test passes

  **Must NOT do**:
  - Do NOT install vitest in client workspace yet (UI tests come later)
  - Do NOT configure coverage yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file config change, no complex logic
  - **Skills**: []
    - No special skills needed for npm install + config file

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/server/package.json` — Existing script patterns (dev, build, start) to follow for test script naming
  - `apps/server/tsconfig.json` — TypeScript config to ensure vitest respects same paths

  **External References**:
  - Vitest docs: https://vitest.dev/guide/ — Setup and configuration

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Vitest runs and passes example test
    Tool: Bash
    Preconditions: npm install completed
    Steps:
      1. Run: npm test --workspace=apps/server
      2. Assert: stdout contains "1 passed"
      3. Assert: exit code is 0
    Expected Result: Single example test passes
    Evidence: Terminal output captured

  Scenario: Vitest watch mode starts
    Tool: Bash
    Preconditions: Vitest installed
    Steps:
      1. Run: npx vitest --watch=false --workspace=apps/server (dry run check)
      2. Assert: No configuration errors
    Expected Result: Vitest can find and run tests
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `chore(server): setup vitest test infrastructure`
  - Files: `apps/server/vitest.config.ts`, `apps/server/package.json`, `apps/server/src/poker/__tests__/example.test.ts`
  - Pre-commit: `npm test --workspace=apps/server`

---

- [x] 2. Define Shared Poker Types & Constants

  **What to do**:
  - Create `packages/shared/src/poker/types.ts` with all poker type definitions:
    - `Suit`: `'hearts' | 'diamonds' | 'clubs' | 'spades'`
    - `Rank`: `'2' | '3' | ... | 'K' | 'A'`
    - `Card`: `{ suit: Suit; rank: Rank }`
    - `CardBitmask`: `number` (for evaluator)
    - `HandRank`: enum `{ HIGH_CARD, ONE_PAIR, TWO_PAIR, THREE_OF_A_KIND, STRAIGHT, FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH }`
    - `EvaluatedHand`: `{ rank: HandRank; value: number; cards: Card[]; description: string }`
    - `PokerAction`: `'fold' | 'check' | 'call' | 'raise' | 'allIn'`
    - `PokerPhase`: `'lobby' | 'preFlop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handComplete'`
    - `PlayerStatus`: `'active' | 'folded' | 'allIn' | 'sitOut' | 'disconnected'`
    - `PokerPlayer`: `{ id: string; name: string; chipStack: number; status: PlayerStatus; seatIndex: number; holeCards: Card[] | null; currentBet: number; avatar?: string }`
    - `SidePot`: `{ amount: number; eligiblePlayerIds: string[] }`
    - `TableConfig`: `{ maxPlayers: 6; smallBlind: number; bigBlind: number; minBuyIn: number; maxBuyIn: number; actionTimeoutMs: number; straddleEnabled: boolean; runItTwiceEnabled: boolean }`
    - `PokerPublicState`: `{ phase: PokerPhase; communityCards: Card[]; pots: SidePot[]; currentBet: number; minRaise: number; dealerSeatIndex: number; activeSeatIndex: number; players: PublicPokerPlayer[]; handNumber: number; tableConfig: TableConfig }`
    - `PublicPokerPlayer`: `{ id: string; name: string; chipStack: number; status: PlayerStatus; seatIndex: number; currentBet: number; hasCards: boolean; avatar?: string }` (NO hole cards)
    - `PokerPrivateState`: `{ playerId: string; holeCards: Card[]; handStrength?: string; availableActions: PokerAction[]; minBetAmount: number; maxBetAmount: number }`
    - `HandHistoryEntry`: `{ handNumber: number; timestamp: number; tableConfig: TableConfig; players: {...}[]; actions: {...}[]; communityCards: Card[][]; pots: SidePot[]; winners: {...}[] }`
  - Create `packages/shared/src/poker/constants.ts`:
    - `SUITS`, `RANKS`, `DECK_SIZE = 52`
    - `DEFAULT_TABLE_CONFIG`
    - `ACTION_TIMEOUT_MS = 30_000`
    - `RECONNECT_GRACE_MS = 90_000`
    - `MIN_PLAYERS = 2`, `MAX_PLAYERS = 6`
    - `STARTING_CHIPS = 10_000` (100.00€ in centimes)
  - Create `packages/shared/src/poker/index.ts` barrel export
  - Update `packages/shared/src/index.ts` to re-export poker types
  - Rebuild shared package: `npm run build --workspace=packages/shared`

  **Must NOT do**:
  - Do NOT add poker-specific server logic here — types only
  - Do NOT duplicate existing shared types (Player, etc.) — extend or import
  - Do NOT use `number` for chip values without documenting they are centimes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5, 8, 9, 13
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/shared/src/types.ts` — Follow existing type definition style (Role, GamePhase, Player, WordPair)
  - `packages/shared/src/index.ts` — Barrel export pattern to follow

  **API/Type References**:
  - `packages/shared/src/types.ts:Player` — Existing player type for structural reference
  - `packages/shared/src/types.ts:GamePhase` — Phase union type pattern

  **External References**:
  - poker-ts types: https://github.com/claudijo/poker-ts — Reference for poker type design

  **WHY Each Reference Matters**:
  - `types.ts` — Must follow same export/naming conventions so both apps/server and apps/client import cleanly
  - `index.ts` — Barrel pattern ensures clean public API surface

  **Acceptance Criteria**:
  - [ ] `npm run build --workspace=packages/shared` → succeeds with 0 errors
  - [ ] All poker types importable: `import { Card, PokerPhase, SidePot } from '@undercover/shared'`

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Shared package builds with poker types
    Tool: Bash
    Preconditions: packages/shared/src/poker/types.ts created
    Steps:
      1. Run: npm run build --workspace=packages/shared
      2. Assert: exit code 0
      3. Assert: dist/poker/types.d.ts exists
      4. Assert: dist/poker/types.js exists
    Expected Result: TypeScript compiles poker types to dist
    Evidence: Build output + file listing

  Scenario: Types are importable from shared package
    Tool: Bash
    Preconditions: Shared package built
    Steps:
      1. Create temp test file that imports: import { Card, PokerPhase, SidePot, HandRank } from '@undercover/shared'
      2. Run tsc --noEmit on test file
      3. Assert: No type errors
    Expected Result: All poker types resolve correctly
    Evidence: tsc output
  ```

  **Commit**: YES
  - Message: `feat(shared): add poker type definitions and constants`
  - Files: `packages/shared/src/poker/types.ts`, `packages/shared/src/poker/constants.ts`, `packages/shared/src/poker/index.ts`, `packages/shared/src/index.ts`
  - Pre-commit: `npm run build --workspace=packages/shared`

---

- [x] 3. Define Shared Poker Socket Events

  **What to do**:
  - Create `packages/shared/src/poker/events.ts` with typed Socket.io events:
    - **Client → Server**:
      - `'poker:createTable'`: `(data: { playerName: string; config?: Partial<TableConfig> }) => void`
      - `'poker:joinTable'`: `(data: { tableId: string; playerName: string; buyIn: number; seatIndex?: number; playerToken?: string }) => void`
      - `'poker:leaveTable'`: `() => void`
      - `'poker:fold'`: `() => void`
      - `'poker:check'`: `() => void`
      - `'poker:call'`: `() => void`
      - `'poker:raise'`: `(data: { amount: number }) => void` (amount in centimes)
      - `'poker:allIn'`: `() => void`
      - `'poker:sitOut'`: `() => void`
      - `'poker:sitIn'`: `() => void`
      - `'poker:addChips'`: `(data: { amount: number }) => void`
      - `'poker:toggleStraddle'`: `(data: { enabled: boolean }) => void`
      - `'poker:acceptRunItTwice'`: `(data: { accepted: boolean }) => void`
    - **Server → Client**:
      - `'poker:state'`: `(data: { publicState: PokerPublicState; privateState: PokerPrivateState }) => void`
      - `'poker:action'`: `(data: { playerId: string; action: PokerAction; amount?: number }) => void`
      - `'poker:newHand'`: `(data: { handNumber: number; dealerSeatIndex: number }) => void`
      - `'poker:dealCards'`: `(data: { holeCards: Card[] }) => void` (only to recipient)
      - `'poker:communityCards'`: `(data: { cards: Card[]; phase: PokerPhase }) => void`
      - `'poker:showdown'`: `(data: { playerHands: Array<{ playerId: string; cards: Card[]; handDescription: string }> }) => void`
      - `'poker:potWon'`: `(data: { winners: Array<{ playerId: string; amount: number; potIndex: number; handDescription: string }> }) => void`
      - `'poker:handHistory'`: `(data: { entry: HandHistoryEntry }) => void`
      - `'poker:tableList'`: `(data: { tables: Array<{ id: string; playerCount: number; config: TableConfig }> }) => void`
      - `'poker:error'`: `(data: { message: string; code: string }) => void`
      - `'poker:timer'`: `(data: { playerId: string; remainingMs: number }) => void`
  - Update existing event interfaces in `packages/shared/src/events.ts` to merge poker events (or re-export)
  - Rebuild shared package

  **Must NOT do**:
  - Do NOT break existing Undercover events
  - Do NOT include card data for other players in any event payload

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, event interfaces
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 15, 25
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/shared/src/events.ts` — Existing Socket.io event type pattern (ClientToServerEvents, ServerToClientEvents)

  **WHY Each Reference Matters**:
  - `events.ts` — MUST follow the exact same interface extension pattern so Socket.io generics work across both games

  **Acceptance Criteria**:
  - [ ] `npm run build --workspace=packages/shared` → 0 errors
  - [ ] Poker events extend (not replace) existing event interfaces

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Shared package builds with poker events
    Tool: Bash
    Preconditions: Event types created
    Steps:
      1. Run: npm run build --workspace=packages/shared
      2. Assert: exit code 0
      3. Assert: Existing Undercover events still compile
    Expected Result: Both Undercover and Poker events coexist
    Evidence: Build output
  ```

  **Commit**: YES
  - Message: `feat(shared): add poker socket event type definitions`
  - Files: `packages/shared/src/poker/events.ts`, `packages/shared/src/events.ts`
  - Pre-commit: `npm run build --workspace=packages/shared`

---

### WAVE 2: CORE ENGINE

---

- [x] 4. Card & Deck Module with CSPRNG Shuffle [TDD]

  **What to do**:
  - **RED**: Write tests first in `apps/server/src/poker/__tests__/deck.test.ts`:
    - `createDeck()` returns exactly 52 unique cards
    - `shuffleDeck()` uses crypto.getRandomValues (mock and verify call)
    - `shuffleDeck()` returns all 52 cards (no duplicates, no missing)
    - `shuffleDeck()` produces different orderings (statistical test, 10 shuffles)
    - `dealCards(deck, count)` removes cards from top, returns them
    - `burnCard(deck)` removes top card, does NOT return it
    - Dealing sequence: burn + deal flop (3), burn + deal turn (1), burn + deal river (1) → 5 community + 3 burned = 8 cards consumed from deck
    - After dealing 6 players (12 cards) + 5 community + 3 burns = 20 cards, deck has 32 remaining
  - **GREEN**: Create `apps/server/src/poker/deck.ts`:
    - `createDeck(): Card[]` — Returns ordered 52-card deck
    - `shuffleDeck(deck: Card[]): Card[]` — Fisher-Yates with `crypto.getRandomValues(new Uint32Array(1))` per swap
    - `dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] }` — Immutable, returns new arrays
    - `burnCard(deck: Card[]): { burned: Card; remaining: Card[] }` — Burns top card
    - `dealHoleCards(deck: Card[], playerCount: number): { hands: Card[][]; remaining: Card[] }` — Deals 2 cards to each player in round-robin order (as per real dealing)
    - `dealCommunityCards(deck: Card[], phase: 'flop' | 'turn' | 'river'): { cards: Card[]; remaining: Card[] }` — Burns 1, then deals 3/1/1
  - **REFACTOR**: Ensure all functions are pure (no mutation of input arrays)

  **Must NOT do**:
  - NEVER use Math.random() — ONLY crypto.getRandomValues()
  - Do NOT mutate the input deck array — always return new arrays
  - Do NOT store deck state in a class — pure functions with immutable data

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: CSPRNG correctness, statistical properties, pure functional design
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Tasks 8, 10, 13
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `apps/server/src/roles.ts` — Random selection pattern in existing codebase (but uses Math.random — replace)

  **External References**:
  - Fisher-Yates + CSPRNG: `crypto.getRandomValues(new Uint32Array(1))` pattern from research
  - Node.js crypto: https://nodejs.org/api/crypto.html#cryptogetrandomvaluestypedarray

  **WHY Each Reference Matters**:
  - `roles.ts` — Shows how current code does randomness (to explicitly NOT follow for poker deck)

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] Test file created: `apps/server/src/poker/__tests__/deck.test.ts`
  - [ ] Tests cover: deck creation, CSPRNG shuffle, deal, burn, hole cards, community cards
  - [ ] `npx vitest run src/poker/__tests__/deck.test.ts` → PASS (8+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Deck contains exactly 52 unique cards
    Tool: Bash (vitest)
    Preconditions: Vitest installed, deck module created
    Steps:
      1. Run: npx vitest run src/poker/__tests__/deck.test.ts --reporter=verbose
      2. Assert: "createDeck returns 52 unique cards" test passes
      3. Assert: 0 failures
    Expected Result: All deck tests pass
    Evidence: Vitest output captured

  Scenario: CSPRNG is actually used (not Math.random)
    Tool: Bash (grep)
    Preconditions: deck.ts created
    Steps:
      1. grep -r "Math.random" apps/server/src/poker/deck.ts
      2. Assert: No matches found
      3. grep -r "crypto.getRandomValues\|randomValues" apps/server/src/poker/deck.ts
      4. Assert: At least 1 match found
    Expected Result: No Math.random, crypto.getRandomValues present
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `feat(server): add CSPRNG deck module with burn cards [TDD]`
  - Files: `apps/server/src/poker/deck.ts`, `apps/server/src/poker/__tests__/deck.test.ts`
  - Pre-commit: `npx vitest run src/poker/__tests__/deck.test.ts`

---

- [x] 5. Hand Evaluator Wrapper [TDD]

  **What to do**:
  - **RED**: Write tests first in `apps/server/src/poker/__tests__/handEvaluator.test.ts`:
    - Royal flush beats straight flush
    - Straight flush beats four of a kind
    - Full house beats flush (etc. — all 10 hand ranks)
    - **Kicker test**: Pair of Aces with King kicker beats Pair of Aces with Queen kicker
    - **Wheel straight**: A-2-3-4-5 detected as straight (lowest)
    - **Ace-high straight**: 10-J-Q-K-A detected as straight (highest non-royal)
    - **Split pot detection**: Two identical hands → evaluateHands returns tie
    - **7-card evaluation**: Best 5 of 7 selected correctly
    - **Hand description**: Returns human-readable string ("Brelan de Rois", "Paire d'As")
  - **GREEN**: Create `apps/server/src/poker/handEvaluator.ts`:
    - Install evaluator library: `npm install @pokertools/evaluator` (or `poker-evaluator` as fallback)
    - `evaluateHand(cards: Card[]): EvaluatedHand` — Wrapper that converts our Card type to library format, evaluates, and returns our EvaluatedHand type
    - `compareHands(handA: EvaluatedHand, handB: EvaluatedHand): -1 | 0 | 1` — Full comparison including kickers
    - `findWinners(playerHands: Map<string, Card[]>, communityCards: Card[]): { winners: string[]; hand: EvaluatedHand }[]` — Returns ordered list of winners (handles ties)
    - `describeHand(hand: EvaluatedHand, locale: 'fr' | 'en'): string` — French/English hand descriptions
  - **REFACTOR**: Ensure evaluator library is behind abstraction (easy to swap)

  **Must NOT do**:
  - Do NOT implement a hand evaluator from scratch — use library
  - Do NOT expose library types to consumers — wrap everything
  - Do NOT forget kicker comparison in tie scenarios

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Correctness-critical, all 10 hand ranks + kickers + edge cases
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7)
  - **Blocks**: Tasks 8, 10, 13
  - **Blocked By**: Tasks 1, 2

  **References**:

  **External References**:
  - @pokertools/evaluator: https://github.com/aaurelions/pokertools — Primary evaluator library
  - poker-evaluator: https://www.npmjs.com/package/poker-evaluator — Fallback library
  - poker-ts hand ranking: https://github.com/claudijo/poker-ts — Reference for hand rank ordering

  **WHY Each Reference Matters**:
  - Evaluator library — Core dependency, need to understand its Card format to write converter
  - poker-ts — Reference for how a production engine wraps evaluation

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file: `apps/server/src/poker/__tests__/handEvaluator.test.ts`
  - [ ] Tests: All 10 hand ranks, kickers, wheel straight, split pot detection
  - [ ] `npx vitest run src/poker/__tests__/handEvaluator.test.ts` → PASS (15+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Kicker correctly breaks ties
    Tool: Bash (vitest)
    Preconditions: Hand evaluator module created
    Steps:
      1. Run: npx vitest run src/poker/__tests__/handEvaluator.test.ts --reporter=verbose
      2. Assert: "kicker breaks tie" test passes
      3. Assert: "wheel straight A-2-3-4-5" test passes
      4. Assert: 0 failures
    Expected Result: All hand evaluator tests pass
    Evidence: Vitest verbose output

  Scenario: Hand descriptions are in French
    Tool: Bash (vitest)
    Preconditions: describeHand function implemented
    Steps:
      1. Run: npx vitest run --reporter=verbose -t "describeHand"
      2. Assert: French description tests pass (e.g., "Brelan de Rois")
    Expected Result: Localized hand descriptions
    Evidence: Test output
  ```

  **Commit**: YES
  - Message: `feat(server): add hand evaluator wrapper with kicker & wheel support [TDD]`
  - Files: `apps/server/src/poker/handEvaluator.ts`, `apps/server/src/poker/__tests__/handEvaluator.test.ts`, `package.json` (new dep)
  - Pre-commit: `npx vitest run src/poker/__tests__/handEvaluator.test.ts`

---

- [x] 6. Integer Chip Arithmetic Module [TDD]

  **What to do**:
  - **RED**: Write tests in `apps/server/src/poker/__tests__/chips.test.ts`:
    - `addChips(1050, 250)` → 1300 (never floating point)
    - `subtractChips(1050, 250)` → 800
    - `subtractChips(100, 200)` → throws Error (can't go negative)
    - `divideChips(2500, 2)` → `{ perPlayer: 1250, remainder: 0 }`
    - `divideChips(2501, 2)` → `{ perPlayer: 1250, remainder: 1 }` (odd chip)
    - `formatChips(1050)` → "10.50€"
    - `formatChips(100)` → "1.00€"
    - `formatChips(5)` → "0.05€"
    - `parseChips("10.50")` → 1050
    - Verify: `0.1 + 0.2` float problem doesn't exist: `addChips(10, 20)` → exactly 30
  - **GREEN**: Create `apps/server/src/poker/chips.ts`:
    - All functions operate on integers (centimes)
    - `addChips(a: number, b: number): number`
    - `subtractChips(a: number, b: number): number` — throws if negative
    - `divideChips(total: number, players: number): { perPlayer: number; remainder: number }`
    - `formatChips(centimes: number): string` — Display only
    - `parseChips(display: string): number` — Input parsing
    - Type guard: `assertInteger(value: number)` — throws if not integer

  **Must NOT do**:
  - NEVER use float division for chip math
  - NEVER return a non-integer from any chip function
  - Do NOT use `toFixed()` for arithmetic — only for display formatting

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Financial precision, integer arithmetic guarantees
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)
  - **Blocks**: Tasks 8, 9, 14
  - **Blocked By**: Tasks 1, 2

  **References**:

  **External References**:
  - IEEE 754 float issues: JavaScript `0.1 + 0.2 !== 0.3` — This module prevents this problem entirely

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file: `apps/server/src/poker/__tests__/chips.test.ts`
  - [ ] Tests: add, subtract, divide with remainder, format, parse, integer assertion
  - [ ] `npx vitest run src/poker/__tests__/chips.test.ts` → PASS (10+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: No floating point errors in chip arithmetic
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run src/poker/__tests__/chips.test.ts --reporter=verbose
      2. Assert: "0.1 + 0.2 problem" test passes
      3. Assert: "odd chip remainder" test passes
      4. Assert: 0 failures
    Expected Result: All chip math is integer-exact
    Evidence: Vitest output
  ```

  **Commit**: YES
  - Message: `feat(server): add integer chip arithmetic module [TDD]`
  - Files: `apps/server/src/poker/chips.ts`, `apps/server/src/poker/__tests__/chips.test.ts`
  - Pre-commit: `npx vitest run src/poker/__tests__/chips.test.ts`

---

- [x] 7. SQLite Persistence Layer (sql.js)

  **What to do**:
  - Install sql.js: `npm install sql.js --workspace=apps/server`
  - Create `apps/server/src/poker/db.ts`:
    - `initDatabase(): Promise<Database>` — Initialize sql.js WASM, create/open DB file
    - Schema tables:
      - `players`: `id TEXT PK, name TEXT, chip_balance INTEGER DEFAULT 10000, created_at INTEGER, last_seen INTEGER, ip_address TEXT`
      - `hand_history`: `id INTEGER PK AUTOINCREMENT, hand_number INTEGER, table_id TEXT, timestamp INTEGER, data TEXT (JSON blob of HandHistoryEntry)`
      - `table_sessions`: `id TEXT PK, config TEXT (JSON), created_at INTEGER, status TEXT`
    - `getPlayerBalance(playerId: string): Promise<number>`
    - `updatePlayerBalance(playerId: string, delta: number): Promise<void>` — Add/subtract centimes
    - `saveHandHistory(entry: HandHistoryEntry): Promise<void>`
    - `getHandHistory(playerId: string, limit: number): Promise<HandHistoryEntry[]>`
    - `getOrCreatePlayer(id: string, name: string, ip: string): Promise<{id: string; chipBalance: number}>`
  - Create `apps/server/data/` directory for SQLite DB file
  - Periodic save to disk (every 30 seconds or after each hand)

  **Must NOT do**:
  - Do NOT use better-sqlite3 (native binding conflict with tsx runtime)
  - Do NOT store chips as float in the database — INTEGER column type only
  - Do NOT block the event loop on DB writes — use async

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Database schema design, WASM initialization, async patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Tasks 11, 14
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/server/src/index.ts` — Server initialization pattern (for DB init placement)

  **External References**:
  - sql.js docs: https://github.com/sql-js/sql.js — WASM SQLite for Node.js
  - sql.js API: https://sql-js.github.io/sql.js/documentation/

  **Acceptance Criteria**:
  - [ ] `npm run build --workspace=apps/server` → 0 errors
  - [ ] Database file created at `apps/server/data/poker.db`

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Database initializes and creates tables
    Tool: Bash
    Steps:
      1. Create test script that calls initDatabase()
      2. Run script with tsx
      3. Assert: No errors
      4. Assert: DB file created
      5. Query: SELECT name FROM sqlite_master WHERE type='table'
      6. Assert: players, hand_history, table_sessions tables exist
    Expected Result: Database ready with schema
    Evidence: Query output

  Scenario: Chip balance operations are integer-exact
    Tool: Bash
    Steps:
      1. Create player with 10000 balance
      2. updatePlayerBalance(id, -150)
      3. getPlayerBalance(id)
      4. Assert: returns exactly 9850 (not 9850.0 or similar)
    Expected Result: Integer precision maintained
    Evidence: Script output
  ```

  **Commit**: YES
  - Message: `feat(server): add SQLite persistence layer with sql.js`
  - Files: `apps/server/src/poker/db.ts`, `apps/server/data/.gitkeep`
  - Pre-commit: `npm run build --workspace=apps/server`

---

### WAVE 3: GAME LOGIC

---

- [x] 8. PotManager — Side Pots, Odd Chip, Split Pot [TDD]

  **What to do**:
  - **RED**: Write tests in `apps/server/src/poker/__tests__/potManager.test.ts`:
    - **Simple pot**: 3 players each bet 100 → main pot 300, winner gets 300
    - **Single side pot**: A(100 all-in), B(200), C(200) → Main pot 300 (all eligible), Side pot 200 (B,C only)
    - **Multi side pot**: A(50 all-in), B(100 all-in), C(200 all-in) → Main 150, Side1 100, Side2 100
    - **Ghost side pot prevention**: A(10 all-in), B(100), C(100), B folds → A wins main pot (30), C gets side pot (180). A must NOT get B's side pot money.
    - **Odd chip**: Pot 25 cents between 2 winners → Player closest left of dealer gets extra 1 cent
    - **Split pot**: Two identical hands → exact 50/50 split (with odd chip rule)
    - **Three-way split**: Pot 100 between 3 winners → 33, 33, 34 (odd chip to closest left of dealer)
    - **Folded players excluded**: If player folds, they are NOT eligible for any pot
    - **All-in player can't win more than contributed**: Player with 50 all-in can win max 50 from each opponent
  - **GREEN**: Create `apps/server/src/poker/potManager.ts`:
    - `class PotManager`:
      - `private pots: SidePot[]`
      - `addBet(playerId: string, amount: number): void`
      - `playerFolded(playerId: string): void`
      - `playerAllIn(playerId: string, amount: number): void`
      - `calculateSidePots(playerBets: Map<string, number>, foldedPlayerIds: Set<string>): SidePot[]` — Threshold-based algorithm
      - `distributePots(winners: Map<number, string[]>, dealerSeatIndex: number, playerSeatIndices: Map<string, number>): Map<string, number>` — Returns playerId → winnings (centimes). Applies odd chip rule.
      - `getTotalPot(): number`
      - `getPots(): SidePot[]`
    - All arithmetic uses `chips.ts` functions (integer only)

  **Must NOT do**:
  - NEVER use a single number for the pot — always `SidePot[]` array
  - NEVER include folded players in pot eligibility
  - NEVER use float division for splitting

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Most complex logic in the system — side pots, odd chip, multi-way split
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11, 12)
  - **Blocks**: Tasks 13, 18
  - **Blocked By**: Tasks 4, 5, 6

  **References**:

  **Pattern References**:
  - `apps/server/src/poker/chips.ts` (Task 6) — Use divideChips for split pot + remainder

  **External References**:
  - Side pot algorithm: https://github.com/brunoscopelliti/poker-holdem-engine/blob/master/domain/player/split-pot.js — Threshold-based approach
  - Odd chip rule: Robert's Rules of Poker — "The odd chip goes to the first player clockwise from the button"

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file: `apps/server/src/poker/__tests__/potManager.test.ts`
  - [ ] Tests: simple pot, single side pot, multi side pot, ghost pot, odd chip, 2-way split, 3-way split, folded exclusion, all-in cap
  - [ ] `npx vitest run src/poker/__tests__/potManager.test.ts` → PASS (9+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Multi all-in side pot scenario from user spec
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run src/poker/__tests__/potManager.test.ts -t "multi side pot" --reporter=verbose
      2. Assert: A(50), B(100), C(200) creates 3 pots correctly
      3. Assert: A eligible only for main pot, B for main+side1, C for all
    Expected Result: Side pots match spec exactly
    Evidence: Vitest output

  Scenario: Ghost side pot prevention
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run -t "ghost side pot" --reporter=verbose
      2. Assert: Folded player's money stays in correct pot
      3. Assert: All-in player doesn't receive opponent's unclaimed side pot
    Expected Result: No money leaks between pots
    Evidence: Vitest output
  ```

  **Commit**: YES
  - Message: `feat(server): add PotManager with side pots, odd chip, split pot [TDD]`
  - Files: `apps/server/src/poker/potManager.ts`, `apps/server/src/poker/__tests__/potManager.test.ts`
  - Pre-commit: `npx vitest run src/poker/__tests__/potManager.test.ts`

---

- [x] 9. BettingEngine — Min-Raise, Full Bet Rule, Heads-Up [TDD]

  **What to do**:
  - **RED**: Write tests in `apps/server/src/poker/__tests__/bettingEngine.test.ts`:
    - **Min raise**: After BB of 100, min raise is 200 (BB + BB). After raise to 300, min re-raise is 500 (300 + 200 increment)
    - **Incomplete raise / Full bet rule**: A bets 100, B all-in for 120 (raise of only 20 < min raise of 100). C can only call 120, cannot re-raise (action not reopened for players who already acted)
    - **BB option**: Everyone limps → BB can check OR raise. BB must NOT be skipped.
    - **Heads-up blinds**: With 2 players, dealer is SB and acts FIRST pre-flop, LAST post-flop
    - **Blind posting**: SB posts smallBlind, BB posts bigBlind. Players get correct actions based on position
    - **Check availability**: Can only check if no one has bet or you're BB with limps
    - **Call amount**: Always equals currentBet - playerCurrentBet
    - **All-in**: Player can always go all-in regardless of min raise (all-in exemption)
    - **Action validation**: Can't act out of turn, can't raise less than min (unless all-in)
    - **Round completion**: Round ends when all active players have acted and bets are equal (or all-in)
  - **GREEN**: Create `apps/server/src/poker/bettingEngine.ts`:
    - `class BettingEngine`:
      - `constructor(config: TableConfig, playerStacks: Map<string, number>, dealerSeatIndex: number)`
      - `startNewRound(phase: PokerPhase): void`
      - `getAvailableActions(playerId: string): { actions: PokerAction[]; minRaise: number; maxRaise: number; callAmount: number }`
      - `validateAction(playerId: string, action: PokerAction, amount?: number): { valid: boolean; error?: string }`
      - `executeAction(playerId: string, action: PokerAction, amount?: number): { bet: number; isAllIn: boolean }`
      - `isRoundComplete(): boolean`
      - `getNextActivePlayer(): string | null`
      - `getBlindsOrder(seatIndices: number[]): { sbSeat: number; bbSeat: number; firstToAct: number }`
      - Private: track `lastRaise`, `lastAggressor`, `actedPlayers`, `currentBet`, `betsPerPlayer`

  **Must NOT do**:
  - Do NOT allow re-raise after incomplete all-in raise (full bet rule)
  - Do NOT skip BB's option to raise when everyone limps
  - Do NOT use 3+ player blind order for heads-up (2 players)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex rule interactions, full bet rule is subtle, heads-up exception
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 10, 11, 12)
  - **Blocks**: Tasks 13, 17
  - **Blocked By**: Tasks 2, 6

  **References**:

  **External References**:
  - Robert's Rules of Poker: Full bet rule, min-raise, BB option
  - poker-ts betting: https://github.com/claudijo/poker-ts — State machine betting reference

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file: `apps/server/src/poker/__tests__/bettingEngine.test.ts`
  - [ ] Tests: min raise, incomplete raise (full bet), BB option, heads-up, blind posting, check availability, call amount, all-in, action validation, round completion
  - [ ] `npx vitest run src/poker/__tests__/bettingEngine.test.ts` → PASS (10+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Incomplete raise does not reopen action
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run -t "incomplete raise" --reporter=verbose
      2. Assert: After B's short all-in, A can only call (not re-raise)
    Expected Result: Full bet rule enforced
    Evidence: Vitest output

  Scenario: Heads-up blind order is correct
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run -t "heads-up" --reporter=verbose
      2. Assert: Dealer is SB
      3. Assert: Dealer acts first pre-flop
      4. Assert: Dealer acts last post-flop
    Expected Result: Heads-up exception handled
    Evidence: Vitest output
  ```

  **Commit**: YES
  - Message: `feat(server): add BettingEngine with min-raise, full bet rule, heads-up [TDD]`
  - Files: `apps/server/src/poker/bettingEngine.ts`, `apps/server/src/poker/__tests__/bettingEngine.test.ts`
  - Pre-commit: `npx vitest run src/poker/__tests__/bettingEngine.test.ts`

---

- [x] 10. Real-Time Hand Strength Calculator

  **What to do**:
  - Create `apps/server/src/poker/handStrength.ts`:
    - `calculateHandStrength(holeCards: Card[], communityCards: Card[]): { description: string; rank: HandRank }` — Uses handEvaluator to tell player their current best hand
    - Pre-flop: Classify starting hand ("Premium", "Forte", "Jouable", "Spéculative", "Faible") based on standard preflop charts
    - Post-flop: Evaluate current best 5 of available cards
    - `calculateDraws(holeCards: Card[], communityCards: Card[]): string[]` — Detect flush draws, straight draws, gutshot draws
    - Return French descriptions: "Brelan de Rois", "Tirage couleur", etc.

  **Must NOT do**:
  - Do NOT calculate equity/outs here (that's for AI bots)
  - Do NOT send strength of opponents' hands

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Wraps existing evaluator, mainly formatting/classification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 11, 12)
  - **Blocks**: Task 24
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `apps/server/src/poker/handEvaluator.ts` (Task 5) — describeHand function to reuse

  **Acceptance Criteria**:
  - [ ] Returns French hand descriptions
  - [ ] Pre-flop classification works for all starting hands
  - [ ] Draw detection identifies flush/straight/gutshot draws

  **Commit**: YES (groups with 11)
  - Message: `feat(server): add hand strength calculator and hand history recorder`

---

- [x] 11. Hand History Recorder & Text Export

  **What to do**:
  - Create `apps/server/src/poker/handHistory.ts`:
    - `class HandHistoryRecorder`:
      - `startHand(handNumber: number, tableConfig: TableConfig, players: PokerPlayer[]): void`
      - `recordAction(playerId: string, action: PokerAction, amount?: number): void`
      - `recordCommunityCards(phase: PokerPhase, cards: Card[]): void`
      - `recordShowdown(hands: Map<string, Card[]>): void`
      - `recordWinners(winners: Array<{playerId: string; amount: number; hand: string}>): void`
      - `finishHand(): HandHistoryEntry`
      - `exportAsText(entry: HandHistoryEntry): string` — Standard format:
        ```
        Main #12345 - Texas Hold'em No Limit (5/10) - 2026/02/13 14:30:00
        Table 'Table 1' 6-max Seat #3 is the button
        Seat 1: Player1 (1050 in chips)
        Seat 3: Player2 (2000 in chips)
        Player1: posts small blind 5
        Player2: posts big blind 10
        *** HOLE CARDS ***
        Dealt to Player1 [Ah Kd]
        Player1: raises 20 to 30
        Player2: calls 20
        *** FLOP *** [Qs Jd Th]
        ...
        ```
  - Save to SQLite via db.ts after each hand

  **Must NOT do**:
  - Do NOT include opponent's hole cards in export unless showdown occurred
  - Do NOT use proprietary format — keep it simple text

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Data recording and text formatting, straightforward logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: Tasks 4, 7

  **Acceptance Criteria**:
  - [ ] Hand history text export matches standard poker format
  - [ ] Entries saved to SQLite

  **Commit**: YES (groups with 10)
  - Message: `feat(server): add hand strength calculator and hand history recorder`
  - Files: `apps/server/src/poker/handStrength.ts`, `apps/server/src/poker/handHistory.ts`

---

- [x] 12. AI Bot Engine — Pot Odds & 3 Profiles

  **What to do**:
  - Create `apps/server/src/poker/bot.ts`:
    - `class PokerBot`:
      - `constructor(profile: 'rock' | 'maniac' | 'callingStation', playerId: string)`
      - `decideAction(publicState: PokerPublicState, holeCards: Card[], availableActions: PokerAction[], callAmount: number, potSize: number): { action: PokerAction; amount?: number }`
    - **Core calculation**: `calculatePotOdds(callAmount: number, potSize: number): number` — Returns ratio (e.g., 0.25 for 25%)
    - **Equity estimation**: Simplified — pre-flop hand strength tables, post-flop basic evaluation
    - **Decision logic**: If equity > potOdds → call/raise, else fold
    - **Profile modifiers**:
      - **Rock**: Only plays top 15% of hands pre-flop (AA, KK, QQ, JJ, AKs, AKo, AQs, TT, etc.). Tight post-flop. Rarely bluffs.
      - **Maniac**: Plays 70%+ of hands. Raises 60% of the time. Bluffs frequently (random bluff 30% of actions).
      - **Calling Station**: Calls with any draw or pair. Never raises unless nuts. Never bluffs.
    - Add slight randomness via CSPRNG to avoid perfectly predictable patterns
    - Bot think time: random 1-5 seconds delay before acting (feel more human)

  **Must NOT do**:
  - Do NOT give bots access to opponent hole cards (play from public info only)
  - Do NOT implement Monte Carlo simulation or GTO solver
  - Do NOT use Math.random for randomness — CSPRNG everywhere

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Pot odds math, profile behavior design, decision trees
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 2, 5

  **References**:

  **External References**:
  - Pre-flop hand rankings: Standard 169 starting hand chart
  - Pot odds formula: Call / (Call + Pot) = required equity

  **Acceptance Criteria**:
  - [ ] Rock only plays premium hands (verify with 100-hand simulation)
  - [ ] Maniac raises most hands
  - [ ] Calling Station never raises unprovoked
  - [ ] All 3 profiles use pot odds (not random)
  - [ ] No access to hidden information

  **Commit**: YES
  - Message: `feat(server): add AI bot engine with 3 profiles (rock, maniac, calling station)`
  - Files: `apps/server/src/poker/bot.ts`

---

### WAVE 4: STATE MACHINE & NETWORK

---

- [x] 13. Poker XState Machine (Full Game Flow)

  **What to do**:
  - Create `apps/server/src/poker/pokerMachine.ts` using XState v5 `setup()`:
    - **States**: `waitingForPlayers` → `preFlop` → `flop` → `turn` → `river` → `showdown` → `handComplete` → (loop back to preFlop or waitingForPlayers)
    - **Context**: `PokerMachineContext` containing:
      - `deck: Card[]`, `communityCards: Card[]`, `playerHands: Map<string, Card[]>`
      - `players: PokerPlayer[]`, `activePlayers: string[]`
      - `potManager: PotManager state`, `bettingEngine: BettingEngine state`
      - `dealerSeatIndex: number`, `handNumber: number`
      - `currentPhase: PokerPhase`, `actionSequenceNumber: number`
    - **Events**: `PLAYER_ACTION` (fold/check/call/raise/allIn), `START_HAND`, `TIMEOUT`, `PLAYER_DISCONNECT`, `PLAYER_RECONNECT`, `SIT_OUT`, `SIT_IN`
    - **Key Transitions**:
      - `preFlop` → entry: shuffle deck, deal hole cards, post blinds, start first action timer
      - Each betting phase → when round complete → if all but one folded → `handComplete`, else → next phase
      - `showdown` → evaluate all remaining hands, distribute pots, record history → `handComplete`
      - `handComplete` → entry: advance dealer button, cleanup → auto-transition to preFlop (if 2+ players) or waitingForPlayers
    - **Guards**: `isRoundComplete`, `isOnlyOnePlayerLeft`, `hasEnoughPlayers`, `isActionValid`
    - **Actions**: `dealHoleCards`, `dealCommunity`, `postBlinds`, `executePlayerAction`, `evaluateShowdown`, `distributePots`, `advanceDealer`, `startActionTimer`, `handleTimeout`
    - Wire in: Deck (Task 4), HandEvaluator (Task 5), PotManager (Task 8), BettingEngine (Task 9), Bot (Task 12)
    - Showdown order: Last aggressor shows first, then clockwise

  **Must NOT do**:
  - Do NOT create a monolithic 1000+ line machine — use invoke/spawn for sub-machines if needed
  - Do NOT store raw class instances in context — serialize state from PotManager/BettingEngine
  - Do NOT send hole cards through machine events (security)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Central orchestrator, complex state transitions, integrates all modules
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (integrates Waves 2+3)
  - **Parallel Group**: Wave 4 (with Task 14)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Tasks 8, 9, 12

  **References**:

  **Pattern References**:
  - `apps/server/src/gameMachine.ts` — Existing XState v5 machine pattern (setup, guards, actions, state hierarchy)
  - `apps/server/src/gameMachine.ts:1-50` — Machine setup pattern with types
  - `apps/server/src/gameMachine.ts:100-200` — Guard and action definitions

  **External References**:
  - XState v5 docs: https://stately.ai/docs/xstate — setup(), guards, actions, invoke
  - poker-ts state flow: https://github.com/claudijo/poker-ts — Reference game flow

  **WHY Each Reference Matters**:
  - `gameMachine.ts` — MUST follow same XState v5 patterns (setup, assign, guards) for consistency
  - poker-ts — Validates our state transition design against a working implementation

  **Acceptance Criteria**:
  - [ ] Machine compiles with 0 TypeScript errors
  - [ ] State transitions cover all game phases
  - [ ] Showdown correctly evaluates hands and distributes pots

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full hand simulation (no network)
    Tool: Bash
    Steps:
      1. Create test script that creates machine actor
      2. Send START_HAND event
      3. Send PLAYER_ACTION events for each player through all phases
      4. Assert: Machine reaches handComplete state
      5. Assert: Pot distributed to correct winner
      6. Assert: handNumber incremented
    Expected Result: Complete hand plays through state machine
    Evidence: Script output with state transitions logged
  ```

  **Commit**: YES
  - Message: `feat(server): add poker XState machine with full game flow`
  - Files: `apps/server/src/poker/pokerMachine.ts`

---

- [x] 14. TableManager — Join, Leave, Buy-in, Sit-Out

  **What to do**:
  - Create `apps/server/src/poker/tableManager.ts`:
    - `class TableManager`:
      - Manages table lifecycle separate from hand logic
      - `createTable(config: TableConfig): string` — Returns tableId
      - `joinTable(tableId: string, playerId: string, name: string, buyIn: number, seatIndex?: number): { success: boolean; error?: string }`
      - `leaveTable(tableId: string, playerId: string): void` — Cash out chips to DB balance
      - `sitOut(tableId: string, playerId: string): void` — Mark sit-out, stop posting blinds
      - `sitIn(tableId: string, playerId: string): void` — Return to active play
      - `addChips(tableId: string, playerId: string, amount: number): void` — Add chips between hands
      - `handleDisconnect(tableId: string, playerId: string): void` — Start 90s grace timer, auto sit-out
      - `handleReconnect(tableId: string, playerId: string, socketId: string): void` — Restore session
      - `getAvailableSeat(tableId: string): number | null` — Find empty seat
      - `fillWithBots(tableId: string, count: number, profiles: string[]): void` — Add AI players
    - Buy-in validation: min/max based on TableConfig
    - Chip persistence: Update SQLite balance on leave/cashout
    - Dead button rule: When player leaves, handle button progression

  **Must NOT do**:
  - Do NOT mix table lifecycle with hand logic (separation of concerns)
  - Do NOT allow buy-in during active hand (only between hands)
  - Do NOT allow negative chip balance in DB

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Table lifecycle, disconnect handling, DB integration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 13)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 6, 7

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts` — Existing room lifecycle (disconnect timers, reconnection, player tracking)
  - `apps/server/src/roomManager.ts:RoomPlayer` — Player tracking structure

  **WHY Each Reference Matters**:
  - `roomManager.ts` — Follow same disconnect/reconnect grace period pattern (90s timer)

  **Acceptance Criteria**:
  - [ ] Players can join/leave/sit-out/sit-in
  - [ ] Chips persist to SQLite on leave
  - [ ] Disconnect triggers 90s grace + auto sit-out
  - [ ] Dead button rule works when player leaves mid-game

  **Commit**: YES
  - Message: `feat(server): add TableManager with join/leave/buy-in/sit-out`
  - Files: `apps/server/src/poker/tableManager.ts`

---

- [x] 15. Poker Room Manager — Socket.io Integration

  **What to do**:
  - Create `apps/server/src/poker/pokerRoomManager.ts`:
    - Wire Socket.io events (from Task 3) to TableManager (Task 14) and PokerMachine (Task 13)
    - **Event handling** (following `roomManager.ts` pattern):
      - `poker:createTable` → tableManager.createTable + create XState actor
      - `poker:joinTable` → tableManager.joinTable + socket.join(room) + emit state
      - `poker:fold/check/call/raise/allIn` → validate sequence number → actor.send(PLAYER_ACTION)
      - `poker:sitOut/sitIn` → tableManager.sitOut/sitIn
      - `poker:leaveTable` → tableManager.leaveTable + socket.leave(room)
    - **State broadcasting** (following existing pattern):
      - Subscribe to actor state changes
      - For each connected player: emit `poker:state` with `{publicState, privateState}`
      - Public state: community cards, pots, player stacks, current bet (NO hole cards)
      - Private state: player's hole cards, available actions, hand strength
    - **Action broadcasting**: Emit `poker:action` to all when a player acts
    - **Table list**: Maintain and broadcast `poker:tableList` to lobby
    - Register all handlers in `apps/server/src/index.ts` alongside existing Undercover handlers

  **Must NOT do**:
  - Do NOT break existing Undercover socket handlers
  - Do NOT send opponent hole cards in any event
  - Do NOT accept actions without valid sequence number

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Socket.io integration, state sync, security enforcement
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Tasks 13, 14)
  - **Blocks**: Tasks 16, 25
  - **Blocked By**: Tasks 3, 13, 14

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts` — ENTIRE file — Socket.io event handling, state broadcasting, public/private state split
  - `apps/server/src/index.ts` — Server setup, socket handler registration

  **WHY Each Reference Matters**:
  - `roomManager.ts` — THE template for how to wire XState actor → Socket.io events → client state sync
  - `index.ts` — Must register poker handlers alongside undercover without conflicts

  **Acceptance Criteria**:
  - [ ] Poker events handled alongside Undercover events
  - [ ] State broadcast sends public + private state per player
  - [ ] Opponent hole cards are null in publicState
  - [ ] Sequence number validated on every action

  **Commit**: YES
  - Message: `feat(server): add poker room manager with socket.io integration`
  - Files: `apps/server/src/poker/pokerRoomManager.ts`, `apps/server/src/index.ts`

---

- [x] 16. Security Layer — Info Hiding, IP Check, Timers, Sequence Numbers

  **What to do**:
  - Create `apps/server/src/poker/security.ts`:
    - **Information hiding**: `sanitizeStateForPlayer(fullState: PokerMachineContext, playerId: string): { public: PokerPublicState; private: PokerPrivateState }` — Strips all opponent hole cards, returns null/masked
    - **IP collusion check**: `checkIPCollusion(tableId: string, playerIP: string, existingPlayerIPs: Map<string, string>): { allowed: boolean; reason?: string }` — Block same IP at same table
    - **Action timer**: `class ActionTimer` — 30s countdown per player turn
      - `startTimer(playerId: string, callback: () => void): void`
      - `cancelTimer(playerId: string): void`
      - On timeout: auto-check if possible, otherwise auto-fold
      - Emit `poker:timer` with remaining time to all clients
    - **Sequence number**: `class ActionSequencer`
      - `getNextSequence(): number`
      - `validateAction(playerId: string, sequenceNumber: number): boolean` — Rejects stale actions
      - Handles race condition: timeout fires simultaneously with player action → sequence number determines winner
    - **Rate limiting**: Max 1 action per player per 500ms (prevent spam)
    - **Free chip exploit prevention**: Max chip grant per IP per 24h (e.g., 100,000 centimes/day)

  **Must NOT do**:
  - Do NOT trust client-side timers — server is authoritative
  - Do NOT log sensitive data (full game state with cards)
  - Do NOT allow bypassing sequence validation

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Security-critical, race conditions, timing attacks
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 17, 18)
  - **Blocks**: Task 26
  - **Blocked By**: Task 15

  **References**:

  **Pattern References**:
  - `apps/server/src/roomManager.ts:broadcastState` — How state is currently sanitized for public/private

  **Acceptance Criteria**:
  - [ ] Opponent cards never appear in client-receivable data
  - [ ] Same IP blocked from joining same table
  - [ ] Action timer auto-folds after 30s
  - [ ] Stale sequence numbers rejected
  - [ ] Rate limiting prevents action spam

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Opponent cards hidden in state broadcast
    Tool: Bash
    Steps:
      1. Create 2-player game, deal cards
      2. Call sanitizeStateForPlayer for Player 1
      3. Assert: Player 2's holeCards is null in public state
      4. Assert: Player 1's holeCards present in private state
    Expected Result: Information hiding enforced
    Evidence: Script output

  Scenario: Sequence number prevents race condition
    Tool: Bash
    Steps:
      1. Create ActionSequencer
      2. Get sequence N
      3. Validate action with sequence N → true
      4. Validate another action with sequence N → false (stale)
    Expected Result: Duplicate/stale actions rejected
    Evidence: Script output
  ```

  **Commit**: YES
  - Message: `feat(server): add security layer (info hiding, IP check, timers, sequence numbers)`
  - Files: `apps/server/src/poker/security.ts`

---

- [x] 17. Straddle Variant Logic

  **What to do**:
  - Add straddle support to BettingEngine (Task 9):
    - Straddle: Player to left of BB can optionally post 2× BB before seeing cards
    - Straddle acts as a "third blind" — straddle player acts LAST pre-flop
    - Min raise after straddle: straddle amount (2× BB)
    - Only available pre-flop, before cards dealt
    - Configurable per table: `tableConfig.straddleEnabled`
  - Update PokerMachine (Task 13) to handle `STRADDLE` event in preFlop state
  - Add `'poker:toggleStraddle'` handling in room manager

  **Must NOT do**:
  - Do NOT allow straddle after cards are dealt
  - Do NOT allow straddle if disabled in table config
  - Do NOT allow straddle from wrong position (only UTG / left of BB)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Extension of existing betting logic, well-defined rules
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 16, 18)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 9, 13

  **Acceptance Criteria**:
  - [ ] Straddle posts 2× BB from correct position
  - [ ] Straddle player acts last pre-flop
  - [ ] Min raise adjusted to straddle amount
  - [ ] Only works when enabled in table config

  **Commit**: YES
  - Message: `feat(server): add straddle variant support`
  - Files: `apps/server/src/poker/bettingEngine.ts` (modified), `apps/server/src/poker/pokerMachine.ts` (modified)

---

- [x] 18. Run-it-Twice Variant Logic

  **What to do**:
  - Add run-it-twice support:
    - Only available when all remaining players are all-in
    - Both players must agree (opt-in via `poker:acceptRunItTwice`)
    - If agreed: Deal remaining community cards TWICE (two separate boards)
    - Each board determines winner of HALF the pot
    - If one player wins both boards: gets full pot
    - If split: each gets their half
    - Odd chip rule applies per half-pot
  - Update PokerMachine with new state: `runItTwiceDecision` → between all-in detection and remaining community deal
  - Update PotManager to handle half-pot distribution

  **Must NOT do**:
  - Do NOT allow run-it-twice with 3+ players and multiple side pots (too complex for v1 — only when 2 players remain)
  - Do NOT force run-it-twice — both must accept
  - Do NOT allow run-it-twice when disabled in table config

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex pot splitting, dual board evaluation, state machine extension
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 16, 17)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 8, 13

  **Acceptance Criteria**:
  - [ ] Both players prompted when all-in
  - [ ] Two boards dealt if both accept
  - [ ] Pot correctly split per board result
  - [ ] Odd chip rule applies per half-pot
  - [ ] Falls back to single board if either declines

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Run-it-twice splits pot on different winners
    Tool: Bash
    Steps:
      1. Create scenario: 2 players all-in, both accept RIT
      2. Mock deck to produce different winners per board
      3. Assert: Each player gets half pot
    Expected Result: Pot split across two boards
    Evidence: Script output
  ```

  **Commit**: YES
  - Message: `feat(server): add run-it-twice variant support`
  - Files: `apps/server/src/poker/pokerMachine.ts` (modified), `apps/server/src/poker/potManager.ts` (modified)

---

### WAVE 5: CLIENT UI

---

- [x] 19. Game Selector — Landing Page Update

  **What to do**:
  - Update `apps/client/src/App.tsx` to route between Undercover and Poker
  - Update Landing screen to show game selection: "Undercover" or "Poker"
  - Create `apps/client/src/components/screens/poker/` directory for all poker screens
  - Poker selection leads to poker lobby (table list/create)
  - Undercover selection keeps existing flow

  **Must NOT do**:
  - Do NOT break existing Undercover flow
  - Do NOT force poker UI patterns onto Undercover

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI routing, landing page design
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 20-25)
  - **Blocks**: Task 20
  - **Blocked By**: None (can use mocked state)

  **References**:

  **Pattern References**:
  - `apps/client/src/App.tsx` — Current phase routing pattern
  - `apps/client/src/components/screens/` — Existing screen component structure

  **Acceptance Criteria**:
  - [ ] Landing page shows both game options
  - [ ] Selecting Undercover works as before
  - [ ] Selecting Poker navigates to poker lobby

  **Commit**: YES
  - Message: `feat(client): add game selector to landing page`

---

- [x] 20. Poker Lobby & Table List UI

  **What to do**:
  - Create `apps/client/src/components/screens/poker/PokerLobby.tsx`:
    - Display list of active tables (from `poker:tableList` event)
    - Each table shows: player count, blind levels, available seats
    - "Create Table" button with config form (blinds, buy-in range, straddle/RIT toggles)
    - "Join" button per table with seat selection and buy-in amount
    - Player's current chip balance displayed
    - Framer Motion animations for table list updates

  **Must NOT do**:
  - Do NOT show ongoing hand details in lobby (just meta info)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component design
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 3, 19

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/Lobby.tsx` — Existing lobby pattern (player list, settings, host controls)

  **Acceptance Criteria**:
  - [ ] Table list renders with player count and blind info
  - [ ] Create table form validates config
  - [ ] Join table with seat selection works

  **Commit**: YES (groups with 21)

---

- [x] 21. Poker Table UI — Seats, Cards, Community, Pot Display

  **What to do**:
  - Create `apps/client/src/components/screens/poker/PokerTable.tsx`:
    - **6-seat layout**: Oval/circular table with 6 positions, responsive (mobile first)
    - **Player seats**: Name, avatar (DiceBear), chip stack, current bet, status indicator (active/folded/all-in/sit-out)
    - **Hole cards**: Show player's own 2 cards face-up, opponents' cards face-down (or hidden)
    - **Community cards**: 5 slots center table, revealed progressively (flop 3, turn 1, river 1)
    - **Pot display**: Main pot + side pots with amounts
    - **Dealer button**: "D" chip on correct seat, animated movement between hands
    - **Active player indicator**: Highlight/glow on whose turn it is
    - **Card components**: SVG or CSS card faces with suits and ranks
    - Mobile-first: Table must look good on 375px width
    - Use Tailwind CSS v4 (existing in project)

  **Must NOT do**:
  - Do NOT show opponent hole cards (ever, until showdown event)
  - Do NOT add 3D effects or complex WebGL
  - Do NOT use images for cards — CSS/SVG only

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI layout, responsive design, card rendering
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 23
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/` — Screen component structure
  - `apps/client/src/App.tsx:SocketContext` — Context usage pattern

  **Acceptance Criteria**:
  - [ ] 6 seats render correctly on mobile (375px)
  - [ ] Community cards display progressively
  - [ ] Player's own cards visible, opponents' hidden
  - [ ] Pot amounts displayed clearly

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Poker table renders on mobile
    Tool: Playwright (playwright skill)
    Steps:
      1. Set viewport: 375x812 (iPhone)
      2. Navigate to poker table (with mocked state)
      3. Assert: 6 seat positions visible
      4. Assert: Community card area visible
      5. Assert: Pot display visible
      6. Assert: No horizontal scrolling
      7. Screenshot: .sisyphus/evidence/task-21-mobile-table.png
    Expected Result: Table fits mobile viewport
    Evidence: .sisyphus/evidence/task-21-mobile-table.png
  ```

  **Commit**: YES
  - Message: `feat(client): add poker table UI with seats, cards, and pot display`

---

- [ ] 22. Bet Slider & Action Buttons

  **What to do**:
  - Create `apps/client/src/components/screens/poker/BetControls.tsx`:
    - **Action buttons**: Fold, Check, Call (with amount), Raise, All-In
    - Only show available actions (from `privateState.availableActions`)
    - **Bet slider**:
      - Range: minRaise to maxRaise (from privateState)
      - Quick buttons: "Min", "1/2 Pot", "2/3 Pot", "Pot", "Max/All-In"
      - Manual input: Text field for exact amount
      - Display in euros (formatChips from centimes)
    - **Call amount display**: Show exact amount to call
    - **Pot odds display**: Show "Call X to win Y" ratio
    - Touch-friendly: 44px minimum touch targets
    - Haptic feedback on button press (existing pattern in project)
    - Disable buttons when not player's turn

  **Must NOT do**:
  - Do NOT allow submitting invalid bets (client-side validation)
  - Do NOT show slider when only check/fold available

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Interactive UI component, slider mechanics
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 26
  - **Blocked By**: Task 2

  **Acceptance Criteria**:
  - [ ] Quick buttons calculate correct amounts (1/2 pot, 2/3 pot, pot)
  - [ ] Slider range matches min/max raise
  - [ ] Only available actions shown
  - [ ] Amounts display in euros (not centimes)

  **Commit**: YES
  - Message: `feat(client): add bet slider and action buttons with quick bet options`

---

- [ ] 23. Chip Animations & Dealer Button Movement

  **What to do**:
  - Add Framer Motion animations to poker table:
    - **Chip bet animation**: When player bets, chips animate from player seat to pot area
    - **Pot collection**: After betting round, side bets animate to center pot
    - **Pot distribution**: Winning chips animate from center to winner's seat
    - **Dealer button**: "D" button slides smoothly between seats between hands
    - **Card deal animation**: Cards slide from deck position to player seats
    - **Card reveal**: Community cards flip from face-down to face-up
    - **Fold animation**: Player's cards fade out or fly to muck pile
    - Use `<AnimatePresence>` and `<motion.div>` from framer-motion (already in project)
    - Keep animations under 500ms to avoid slow feeling

  **Must NOT do**:
  - Do NOT block game logic on animations (fire and forget)
  - Do NOT add sound effects (explicitly excluded from scope)
  - Do NOT use complex physics simulations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Framer Motion animations, visual polish
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 26
  - **Blocked By**: Task 21

  **References**:

  **Pattern References**:
  - `apps/client/src/components/screens/*.tsx` — Existing Framer Motion usage patterns (AnimatePresence, motion.div)

  **Acceptance Criteria**:
  - [ ] Chips animate to pot on bet
  - [ ] Dealer button slides between hands
  - [ ] Cards animate on deal and fold
  - [ ] All animations < 500ms

  **Commit**: YES
  - Message: `feat(client): add chip animations and dealer button movement`

---

- [ ] 24. Hand Strength Display & Hand History Viewer

  **What to do**:
  - **Hand strength**: Display player's current hand strength in real-time
    - Show below player's cards: "Paire de Rois", "Tirage Couleur", etc.
    - Update on each community card reveal
    - Pre-flop: Show starting hand classification
    - Color-coded: Green for strong, Yellow for medium, Red for weak/draw
  - **Hand history viewer**:
    - Create `apps/client/src/components/screens/poker/HandHistory.tsx`
    - List recent hands (from `poker:handHistory` events)
    - Click to expand: Show full text export (from Task 11)
    - "Copy to clipboard" button for text export
    - Accessible from table UI (sidebar or modal)

  **Must NOT do**:
  - Do NOT show opponents' hand strength
  - Do NOT calculate win probability (keep it simple — just current hand name)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI components, data display
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 10, 11

  **Acceptance Criteria**:
  - [ ] Hand strength updates in real-time with community cards
  - [ ] French descriptions displayed
  - [ ] Hand history expandable with copy button
  - [ ] Text export format matches standard poker format

  **Commit**: YES
  - Message: `feat(client): add hand strength display and hand history viewer`

---

- [ ] 25. Poker Client Hook (usePokerSocket)

  **What to do**:
  - Create `apps/client/src/hooks/usePokerSocket.ts`:
    - Follow exact pattern of `apps/client/src/hooks/useSocket.ts`
    - Manage poker-specific state: `publicState`, `privateState`, `tableList`
    - Emit poker events: `fold()`, `check()`, `call()`, `raise(amount)`, `allIn()`, `sitOut()`, `sitIn()`
    - Table management: `createTable(config)`, `joinTable(tableId, buyIn, seat)`, `leaveTable()`
    - Listen for: `poker:state`, `poker:action`, `poker:dealCards`, `poker:showdown`, `poker:potWon`, `poker:handHistory`, `poker:tableList`, `poker:error`, `poker:timer`
    - Persist poker session in localStorage (tableId, playerToken)
    - Auto-reconnect with token on page refresh
  - Create `PokerSocketContext` and provider (or extend existing SocketContext)

  **Must NOT do**:
  - Do NOT break existing useSocket hook
  - Do NOT duplicate socket connection (reuse same socket, different events)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React hook following established pattern
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 3, 15

  **References**:

  **Pattern References**:
  - `apps/client/src/hooks/useSocket.ts` — ENTIRE file — THE template for this hook (connection lifecycle, state management, emit wrapper, localStorage persistence)

  **WHY Each Reference Matters**:
  - `useSocket.ts` — Must follow identical pattern for consistency and shared socket connection

  **Acceptance Criteria**:
  - [ ] All poker events emitted and received
  - [ ] Auto-reconnect works on page refresh
  - [ ] Reuses same socket connection as Undercover
  - [ ] State updates trigger React re-renders

  **Commit**: YES
  - Message: `feat(client): add usePokerSocket hook with auto-reconnect`

---

### FINAL: E2E INTEGRATION

---

- [ ] 26. Full End-to-End Integration Test

  **What to do**:
  - Create comprehensive E2E test using Playwright:
    - **Scenario A**: 2-player heads-up game
      - Create table → Join 2 players → Play full hand → Verify pot distribution
    - **Scenario B**: 6-player game with all-in and side pots
      - 3 players all-in at different stack sizes → Verify side pot calculation
    - **Scenario C**: AI bot fills seat
      - Create table → Join 1 human → Add 1 bot → Verify bot makes valid actions
    - **Scenario D**: Disconnect and reconnect
      - Player disconnects mid-hand → Reconnect within 90s → Verify state restored
    - **Scenario E**: Information hiding
      - Open browser DevTools → Verify opponent cards NOT in any network payload
    - **Scenario F**: Run full regression of known bugs from spec:
      - Float precision (assert integer chips in DOM)
      - Wheel straight detection
      - Kicker comparison
      - Heads-up blind order
      - BB option
      - Incomplete raise
  - Run all vitest unit tests as part of integration
  - Verify both Undercover and Poker coexist

  **Must NOT do**:
  - Do NOT skip any known bug scenario from the spec
  - Do NOT test only happy paths

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Full system integration, multi-browser testing, network inspection
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (final integration, depends on everything)
  - **Parallel Group**: Sequential (after all other tasks)
  - **Blocks**: None
  - **Blocked By**: ALL previous tasks

  **References**:
  - All poker modules created in Tasks 1-25

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → ALL unit tests pass
  - [ ] Playwright E2E scenarios A-F pass
  - [ ] Undercover game still works (regression)
  - [ ] No opponent cards visible in network tab

  **Agent-Executed QA Scenarios:**

  ```
  Scenario A: 2-player heads-up full hand
    Tool: Playwright (playwright skill)
    Steps:
      1. Open 2 browser contexts
      2. Context 1: Create poker table (blinds 5/10)
      3. Context 2: Join table
      4. Both buy in for 1000
      5. Wait for hand to start
      6. Context 1 (SB/Dealer): Click Raise, set 30, confirm
      7. Context 2 (BB): Click Call
      8. Wait for flop (3 community cards visible)
      9. Context 2: Click Check
      10. Context 1: Click Check
      11. Repeat for turn and river
      12. Assert: Showdown occurs, winner gets pot
      13. Assert: Chip stacks sum to original total (2000)
      14. Screenshot: .sisyphus/evidence/task-26-heads-up-complete.png
    Expected Result: Full hand completes, chips conserved
    Evidence: .sisyphus/evidence/task-26-heads-up-complete.png

  Scenario E: Information hiding verification
    Tool: Playwright (playwright skill)
    Steps:
      1. Open 2 browser contexts
      2. Start game, deal cards
      3. In Context 1: Intercept all WebSocket frames
      4. Parse all received messages
      5. Assert: No message contains opponent's hole card values
      6. Assert: Opponent cards are null in all poker:state payloads
    Expected Result: Zero information leak
    Evidence: WebSocket frame dump saved

  Scenario F: Known bug regression - wheel straight
    Tool: Bash (vitest)
    Steps:
      1. Run: npx vitest run -t "wheel straight"
      2. Assert: A-2-3-4-5 detected as straight
      3. Assert: Ranked lower than 2-3-4-5-6
    Expected Result: Wheel straight works
    Evidence: Vitest output
  ```

  **Commit**: YES
  - Message: `test: add full E2E integration tests for poker engine`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore(server): setup vitest test infrastructure` | vitest.config.ts, package.json | vitest run |
| 2 | `feat(shared): add poker type definitions and constants` | poker/types.ts, constants.ts | tsc build |
| 3 | `feat(shared): add poker socket event type definitions` | poker/events.ts | tsc build |
| 4 | `feat(server): add CSPRNG deck module with burn cards [TDD]` | poker/deck.ts + tests | vitest |
| 5 | `feat(server): add hand evaluator wrapper [TDD]` | poker/handEvaluator.ts + tests | vitest |
| 6 | `feat(server): add integer chip arithmetic module [TDD]` | poker/chips.ts + tests | vitest |
| 7 | `feat(server): add SQLite persistence layer with sql.js` | poker/db.ts | tsc build |
| 8 | `feat(server): add PotManager with side pots [TDD]` | poker/potManager.ts + tests | vitest |
| 9 | `feat(server): add BettingEngine with full bet rule [TDD]` | poker/bettingEngine.ts + tests | vitest |
| 10+11 | `feat(server): add hand strength calculator and history recorder` | handStrength.ts, handHistory.ts | tsc build |
| 12 | `feat(server): add AI bot engine with 3 profiles` | poker/bot.ts | vitest |
| 13 | `feat(server): add poker XState machine with full game flow` | poker/pokerMachine.ts | tsc build |
| 14 | `feat(server): add TableManager with join/leave/sit-out` | poker/tableManager.ts | tsc build |
| 15 | `feat(server): add poker room manager with socket.io integration` | pokerRoomManager.ts, index.ts | tsc build |
| 16 | `feat(server): add security layer` | poker/security.ts | vitest |
| 17 | `feat(server): add straddle variant` | bettingEngine.ts, pokerMachine.ts | vitest |
| 18 | `feat(server): add run-it-twice variant` | pokerMachine.ts, potManager.ts | vitest |
| 19 | `feat(client): add game selector to landing page` | App.tsx, Landing.tsx | dev server |
| 20 | `feat(client): add poker lobby and table list` | PokerLobby.tsx | dev server |
| 21 | `feat(client): add poker table UI` | PokerTable.tsx | dev server |
| 22 | `feat(client): add bet slider and action buttons` | BetControls.tsx | dev server |
| 23 | `feat(client): add chip animations and dealer button` | animations | dev server |
| 24 | `feat(client): add hand strength display and history viewer` | HandStrength.tsx, HandHistory.tsx | dev server |
| 25 | `feat(client): add usePokerSocket hook` | usePokerSocket.ts | tsc build |
| 26 | `test: add full E2E integration tests` | e2e/ | playwright + vitest |

---

## Success Criteria

### Verification Commands
```bash
# All unit tests pass
npm test --workspace=apps/server                    # Expected: 50+ tests, 0 failures

# TypeScript compiles
npm run build                                        # Expected: 0 errors

# Server starts without errors
npm run dev:server                                   # Expected: "Server listening on port 3000"

# Client builds
npm run build --workspace=apps/client               # Expected: 0 errors

# E2E tests
npx playwright test                                  # Expected: All scenarios pass
```

### Final Checklist
- [ ] All "Must Have" present (14 items verified)
- [ ] All "Must NOT Have" absent (14 guardrails verified)
- [ ] All unit tests pass (`npx vitest run` → 0 failures)
- [ ] E2E tests pass (Playwright scenarios A-F)
- [ ] Undercover game regression (still works)
- [ ] No float arithmetic in chip/pot code (grep verified)
- [ ] No Math.random in deck code (grep verified)
- [ ] No opponent cards in network payloads (Playwright WebSocket inspection)
- [ ] Mobile responsive (375px viewport verified)
- [ ] Hand history exportable as text
- [ ] All 3 bot profiles functioning
- [ ] Straddle and Run-it-Twice toggleable
