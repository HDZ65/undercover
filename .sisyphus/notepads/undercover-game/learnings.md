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
