# Arth — Screen Extraction Checklist

Every screen extraction, no exceptions, in this order:

1. **Dependency trace first.** Before moving anything, list every identifier
   the screen's component function references that isn't defined inside it.
   Categorize each: prop (needs passing in), shared helper (already
   extracted, just import), or local-only (stays put — inline business
   logic that hasn't earned extraction yet).
2. **Existing behavior unchanged.** The extracted screen renders and
   behaves identically to before. This is a move, not a rewrite.
3. **No duplicated business logic.** If the screen needs a calculation
   that already exists elsewhere in `App.jsx`, import it — don't
   reimplement a second copy.
4. **Uses shared helpers/constants.** Anything already in `src/helpers` or
   `src/constants` gets imported properly, not re-declared locally.
5. **Imports only what it needs.** No blanket `import * as everything`.
   Every prop and import earns its place — if the screen doesn't touch it,
   it doesn't receive it.
6. **No new circular dependencies.** Check the direction: a screen can
   import from `helpers`/`constants`, never the reverse.
7. **Bundle builds successfully.** `esbuild --bundle` against the real
   entry point, not just a single-file syntax check — this is the only
   way to catch a wrong import path or a prop that got renamed on one
   side but not the other.
8. **Regression checklist passes** (per screen, recorded in
   `SCREEN_ARCHITECTURE.md`): existing data loads, new data saves, dark
   mode works, offline works, no console errors, no regressions.

No screen is "extracted" until all eight are true. Record the outcome —
including anything that didn't fit cleanly — in `DEPENDENCY_MAP.md`,
`SCREEN_ARCHITECTURE.md`, and `CHANGELOG.md`, same as every utility pass.
