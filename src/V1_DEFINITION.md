# Arth — v1.0 Definition

What "done" means for a first shippable version. Grounded against real
status in `SCREEN_ARCHITECTURE.md` (checked directly, not assumed) —
where this doc says ✅, it's actually built; where it says 🟡 or ⬜, a
decision is still needed on whether it blocks v1.0 or ships in v1.1+.

## Functional — screen by screen, real status

**Complete (✅), no decision needed:**
- Home, Add Transaction, Timeline, Bills, Budgets, Goals, Events, People

**Partial (🟡) — needs a v1.0/later decision:**
- Login & Security — PIN lock works; cloud sign-in exists but isn't
  framed as onboarding
- Money — exists as "Wealth" tab, renamed; Account Story/Money Map not built
- Wealth (unified hub) — data exists, not unified into one tabbed hub;
  no Financial Freedom Meter, no Scenario Planner
- Profile (Me) — Financial Health Score works here; Achievements,
  Streaks, Personal Statistics not built
- Settings — functional, not reorganized into the locked structure

**Not started (⬜) — needs an explicit v1.0/v2 call:**
- Splash — no native splash exists (PWA); would be a loading overlay at most
- Onboarding — not started at all
- Reports — no dedicated screen; fragments exist (Bill Analytics,
  Budget Insights) but nothing unified
- AI + Search — deliberately parked ("build the engine first,
  intelligence later" — this one already has a stated reason, likely a
  clean v2 deferral)
- Documents — attachments exist per-bill/transaction; no unified vault

**Open question, not yet decided:** of the 10 screens above that aren't
✅, which are must-ship-for-v1.0 and which are explicitly v1.1+? This
doc can't answer that on its own — it's a product call, not something
derivable from the code.

## Engineering

- ✅ Domain layer (Cards, Bills period calculations, Bills refunds, shared)
- ✅ Design System v1 (`BottomSheet`, `EmptyState`, `StatCard` — 3 of the
  ~25 originally listed; the rest are still hand-built duplicates,
  tracked in `COMPONENT_INVENTORY.md`)
- ✅ Regression checklist process (real gate, not just a clean build)
- ✅ Documentation (`DOCS_INDEX.md` + 11 other living/historical docs)
- 🟡 No critical tech debt — `TECH_DEBT.md` has one open item (TD-001,
  duplicate UPI sharing implementation), not yet investigated or resolved
- ⬜ `useArthData()` — designed (`USE_ARTH_DATA_DESIGN.md`), not
  implemented; per ADR-015, **not required for v1.0** — its original
  justification (Bills needs it to extract) no longer holds
- ⬜ Timeline, Bills, People screen extractions — all measured over the
  20-dependency threshold, none extracted yet

**Answered, based on evidence (ADR-015):** No, v1.0 does not require
`useArthData()`. Domain-function extraction closed most of what Bills
could shed without it (38 → 34 dependencies), and what remains — State,
Mutations — was never going to be solved by more pure-function pulls.
The original case for building `useArthData()` ("Bills needs it to
extract") no longer holds on its own. If it gets built, it should be
justified by testability, consistency, or reduced duplication across
screens — not as a means of forcing a screen under a dependency
threshold. This is a decision to revisit on its own merits post-launch,
not a v1.0 blocker.

## UX

- 🟡 Visual polish — not yet a dedicated pass; this is the queued UI/UX
  sprint
- 🟡 Responsive — works on the phone-width layouts tested throughout
  this session; not verified across a wider device range
- 🟡 Smooth interactions — `BottomSheet` exists as a shared component but
  has no animation yet (opens/closes instantly, no transition)
- ⬜ Empty/loading states — `EmptyState` exists as a component but is
  only migrated to 2 of the ~6 known empty-state locations
  (`COMPONENT_INVENTORY.md`); no loading/skeleton states exist anywhere

## What this doc is NOT

Not a commitment to ship every ✅/🟡/⬜ item above at any particular
date. It's a shared reference for the question "what does v1.0 actually
include" — so that "done" has a real definition instead of drifting
indefinitely, which is the problem this doc exists to prevent.
