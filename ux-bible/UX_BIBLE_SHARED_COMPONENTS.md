# Sprint 3E, Part B — Shared Components (Design System Inventory)

Not screens — reusable components. Grounded against the real Pattern
Library (`PHASE2.75_PATTERN_LIBRARY.md`) rather than restated fresh.

| Component | PAT ID | Status |
|---|---|---|
| Bottom Sheet | PAT-001 | ✅ Extracted, animated, reused across Goals/Events/Membership/Bills |
| Empty State | PAT-002 | ✅ Extracted, 7+ locations migrated |
| Toast | PAT-003 | ✅ Extracted |
| Stat Card | PAT-004 | ✅ Extracted, 1 of 4 known duplicate locations migrated |
| Chip | PAT-005 | ✅ Extracted this UX Bible cycle, migrated 1 real usage as proof |
| Confirmation Dialog | PAT-006 | ✅ Extracted, **fully replaced** the single inline usage — no duplicates remain |
| Delete Dialog | PAT-007 | 🟡 Repeats the Confirmation Dialog pattern, not yet formalized as its own variant |
| Entity Card | PAT-008 | ✅ Extracted, migrated the Vehicles list as proof |
| Entity Detail | PAT-009 | 🟡 UX-004's Policy Detail is the first full design; no shared component built yet |
| Commitment Card | PAT-010 | 🟡 Bill rows exist, not unified into one component |
| Date Picker | — | ✅ Existing — native `<input type="date">`, tappable, added this session (Quick Add) |
| Amount Keyboard | — | 🟡 Native numeric keyboard used today; no custom in-app calculator/keyboard exists |
| Calculator | — | ❌ New — doesn't exist |
| Search | — | 🟡 Exists per-screen (Timeline, universal Search overlay); not a single reusable component |
| Filters | — | 🟡 Same — per-screen, not unified |
| Sort | — | 🟡 Same |
| Attachment Viewer | — | 🟡 Per-transaction viewing exists; not the shared platform-wide Attachment service (ADR-021) |
| QR Scanner | — | ❌ New — doesn't exist, no current feature needs it |
| Snackbar | — | Same as Toast (PAT-003) — no separate component needed unless a genuinely different interaction (e.g., action button in the notification) is required |
| Loading | — | 🟡 Ambient sync spinner exists (header); no general-purpose loading component |
| Skeleton | — | ❌ New — deliberately low priority, since most of the app loads instantly from localStorage (confirmed this session); the one real async case (cloud sync) already has its own spinner |
| Error State | — | ❌ New — errors currently shown via inline warning text (the `refDupWarning`-style pattern), not a named/extracted component |

## Honest summary

**10 real components exist** (7 fully extracted with proof-migrations: Bottom Sheet, Empty State, Toast, Stat Card, Chip, Confirmation Dialog, Entity Card; 3 more as native-but-unextracted: Date Picker's native input, Search, and per-transaction Attachment viewing).

**The rest — Calculator, QR Scanner, Skeleton, Error State — are genuinely new**, and two of them (Calculator, QR Scanner) don't correspond to any current feature need in the app at all; building them now would be speculative, not backed by an actual screen requiring them.

## Sprint 3E-B Summary

| Status | Count |
|---|---|
| Extracted/Existing | 10 |
| Repeats inline (extraction candidate) | 7 |
| New, no current need | 2 (Calculator, QR Scanner) |
| New, real gap | 2 (Error State, Skeleton — though Skeleton is deliberately deprioritized) |
