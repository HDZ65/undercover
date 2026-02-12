# Undercover Game - Learnings

## Tailwind v4 Configuration
- Tailwind v4 uses `@tailwindcss/vite` plugin (NOT PostCSS config)
- Plugin must be added to vite.config.ts: `plugins: [tailwindcss(), react()]`
- CSS configuration uses `@import "tailwindcss"` at top of index.css
- Custom colors defined via `@theme` block in CSS (not JS config)
- Custom palette: --color-civil (Emerald 500 #10b981), --color-undercover (Rose 500 #f43f5e), --color-mrwhite (Slate 500 #64748b)

## TypeScript Configuration
- Project uses `erasableSyntaxOnly: true` in tsconfig.app.json
- This forbids regular `enum` and `const enum` syntax
- Solution: Use type unions instead (e.g., `type Role = 'civil' | 'undercover' | 'mrwhite'`)
- This is compatible with tree-shaking and modern TypeScript practices

## Framer Motion v12+
- Import from `motion/react` NOT `framer-motion`
- Requires separate `motion` package installation
- AnimatePresence with `mode="wait"` for screen transitions

## Project Structure
- `/src/components/ui` - Reusable UI components
- `/src/components/screens` - Full-screen game views
- `/src/machines` - XState state machines
- `/src/hooks` - Custom React hooks
- `/src/data` - Game constants and word lists
- `/src/types` - TypeScript type definitions
- `/src/utils` - Utility functions
- `/src/styles` - Global styles and theme

## Dependencies Installed
- xstate, @xstate/react - State management
- framer-motion, motion - Animations
- canvas-confetti - Celebration effects
- @dicebear/core, @dicebear/collection - Avatar generation
- tailwindcss, @tailwindcss/vite - Styling
- @types/canvas-confetti - Type definitions

## Mobile Optimization
- Viewport meta tags: `viewport-fit=cover, user-scalable=no`
- Prevents zoom on iOS, enables notch support
- Base layout uses Tailwind's responsive utilities

## Build Status
- `npm run build` succeeds with 0 errors
- Production bundle: 197.81 kB (62.58 kB gzipped)
- Dev server runs on localhost:5173

## XState v5 Machine Patterns
- Use `setup({ types, guards, actions }).createMachine(...)` for strongly typed guards/actions
- Keep vote tie handling explicit in context (`tieCandidates`, `tieCount`, `voteResolution`) to support revote and second-tie random elimination
- Model round flow as nested states under `gameRound` (`discussion -> voting -> counting -> vote -> elimination -> checkGameEnd`)
- Use `assign(...)` for every context mutation path; avoid direct mutation inside actions

## Persistence Pattern
- Use a singleton `createActor(gameMachine)` in a root hook and subscribe once for persistence
- Persist with `actorRef.getPersistedSnapshot()` on every state change to localStorage key `undercover-game-state`
- Restore with `createActor(gameMachine, { snapshot })` and fallback to fresh actor when snapshot is invalid

## useLocalStorage Hook Implementation

### Pattern: Tuple-based API with initialValue
- Returns `[value, setValue]` tuple matching React useState pattern
- Accepts `initialValue` parameter for fallback on corrupted/missing data
- Supports functional updates: `setValue(prev => newValue)`

### Error Handling Strategy
- Wrap `localStorage.getItem()` in try-catch (handles quota, privacy mode, corrupted JSON)
- Wrap `localStorage.setItem()` in try-catch (handles quota exceeded)
- On parse error: return initialValue, don't throw
- On write error: log warning, don't throw
- Use console.warn for debugging without breaking app

### Key Implementation Details
- Use `useState` with initializer function for lazy initialization
- Use `useEffect` to sync when key changes (allows dynamic key switching)
- Check `item === null` before parsing (localStorage returns null for missing keys)
- Support both direct values and updater functions in setValue
- Generic type `<T>` for full type safety

### Integration with xstate
- Updated `useGameActor.ts` to use new tuple API
- Changed from `{ readValue, writeValue, removeValue }` to `[value, setValue]`
- Simplified persistence logic: just call `setValue(snapshot)` on actor updates

## XState v5 Undercover Flow (Task Update)
- Keep canonical top-level flow explicit: `menu -> lobby -> roleDistribution -> gameRound -> vote -> elimination -> checkGameEnd -> victory`
- Keep only `discussion` and `voting` as nested states under `gameRound`; use top-level `vote` to centralize tie resolution
- Model tie logic with `tieCandidates + tieRound + voteResolution` so first tie revotes tied candidates only and second tie randomly eliminates among them
- Handle Mr. White with dedicated states (`mrWhiteGuess -> mrWhiteVote`) and decide `mrWhiteGuessResult` from player votes, not word matching

## Theme System Implementation (Task 3)

### Pattern: useTheme Hook
- Combines useLocalStorage for persistence with system preference detection
- Uses `window.matchMedia('(prefers-color-scheme: dark)').matches` for initial value
- Applies/removes "dark" class on `<html>` element for Tailwind dark: variant support
- Prevents hydration mismatch with mounted state check
- Returns { theme, toggleTheme, isDark } interface

### CSS Custom Properties Strategy
- Light theme in :root (default)
- Dark theme in :root.dark (overrides)
- Smooth 300ms transitions on html and body
- Color palette:
  - Dark: bg #0a0a0f, text #e5e5e5, cards #1a1a2e/80%
  - Light: bg #fafafa, text #1a1a1a, cards white
- Role colors (Emerald/Rose/Slate) unchanged between themes

### Component: ThemeToggle
- Fixed position top-right (z-50)
- Sun/moon SVG icons with 180deg rotation animation
- Framer Motion: whileHover scale 1.05, whileTap scale 0.95
- Smooth color transitions with Tailwind dark: variant
- Accessible with aria-label

### Integration
- Initialize useTheme() in App.tsx root
- Use CSS variables with var() for dynamic theming
- localStorage key: "undercover-theme"
- Build passes with no TypeScript errors
