# Undercover Game - Issues & Gotchas

## Resolved Issues

### TypeScript Enum Syntax Error
**Problem**: `erasableSyntaxOnly: true` in tsconfig forbids `enum` and `const enum`
**Error**: `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`
**Solution**: Replaced with type unions (`type Role = 'civil' | 'undercover' | 'mrwhite'`)
**Status**: ✅ RESOLVED

### Missing motion/react Package
**Problem**: Import from `motion/react` failed - module not found
**Error**: `TS2307: Cannot find module 'motion/react'`
**Solution**: Installed `motion` package separately (framer-motion v12+ split)
**Status**: ✅ RESOLVED

## Known Constraints
- No audio support (per spec) - Howler.js not installed
- No routing library - state-based routing only
- No test framework - focus on implementation first
- iOS Safari requires -webkit- prefixes for 3D transforms (for future tasks)

## Future Considerations
- DiceBear API uses modern imports: `@dicebear/core` + `@dicebear/collection`
- XState v5 uses `createActor()` pattern at root level
- canvas-confetti is lightweight (~2.5KB) - good for celebration effects
