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

## XState Gotchas (Resolved)

### Persisted Snapshot Corruption
**Problem**: LocalStorage can contain invalid JSON or stale actor snapshot shape after code changes.
**Risk**: Actor restoration can throw and block app startup.
**Solution**: Wrap snapshot restoration in `try/catch`, remove invalid storage entry, and create a fresh actor.
**Status**: ✅ RESOLVED

### Tie Vote Reflow Between States
**Problem**: Without explicit tie metadata, first tie vs second tie is ambiguous.
**Risk**: Machine can loop or skip random elimination on second tie.
**Solution**: Store `tieCount` and `voteResolution` in context and guard `isTied` / `isSecondTie` separately.
**Status**: ✅ RESOLVED

### LSP Diagnostics Tool Unavailable On Windows Session
**Problem**: `lsp_diagnostics` fails with `Binary 'typescript-language-server' not found on Windows`.
**Risk**: Cannot run language-server diagnostics through the dedicated tool for changed files.
**Mitigation**: Verified type safety through `npm run build` (`tsc -b`) and retried `lsp_diagnostics` after installing the server globally.
**Status**: ⚠️ ENVIRONMENT LIMITATION (workaround applied)
