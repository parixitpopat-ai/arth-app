# Arth v2.0 — Phase 2.75: Pattern Library

**Status: Frozen v1.** Not a measure of completion — a roadmap for
systematic component extraction. Every pattern below now carries a
permanent `PAT-###` identifier; future UX packages reference patterns
by ID ("Uses PAT-001, PAT-005, PAT-006"), not by re-describing the UI shape.

**Technical sprint completed this pass:** PAT-005, PAT-006, and PAT-008
extracted **and migrated into at least one real call site each** — not
just new unused files. Honesty check: a component isn't "extracted" if
nothing actually uses it yet.

| ID | Pattern | Status |
|---|---|---|
| PAT-001 | Bottom Sheet | ✅ Extracted |
| PAT-002 | Empty State | ✅ Extracted |
| PAT-003 | Toast | ✅ Extracted |
| PAT-004 | Stat Card | ✅ Extracted |
| PAT-005 | Chip | ✅ **Extracted this sprint** — migrated Quick Add's vehicle picker as proof |
| PAT-006 | Confirmation Dialog | ✅ **Extracted this sprint** — replaced the inline `confirmDialog` rendering entirely (single call site, so this is a full migration, not partial) |
| PAT-007 | Delete Dialog | 🟡 Repeats the ConfirmDialog pattern, not yet formalized as its own variant |
| PAT-008 | Entity Card | ✅ **Extracted this sprint** — migrated the Vehicles management list as proof |
| PAT-009 | Entity Detail | 🟡 UX-004's Policy Detail is the first full design, no shared component yet |
| PAT-010 | Commitment Card | 🟡 Bill rows exist, not unified |

**Honest note on PAT-008's migration:** the original Vehicles list showed
name and type/count as two separate lines; EntityCard supports one
subtitle line, so these were combined with " · " separators. Same
information, slightly more condensed — flagging the visual change
rather than letting it pass silently.

**Current state, for the team:** the application has **7 extracted
reusable components** now (up from 4), covering the three highest
duplication points identified in the original catalogue. Everything
else below remains either a repeated-but-inline pattern (extraction
candidate) or a future pattern (introduced by a UX package, not yet built).

---

## 1. Entity Patterns

*Reusable for: People, Groups, Vehicles, Insurance, Properties, Accounts, Billers*

| Pattern | Status | Note |
|---|---|---|
| Entity List | 🟡 | Every entity (Vehicles, Billers, People) hand-builds its own list layout |
| Entity Card | 🟡 | Same — similar shape, no shared component |
| Entity Detail | 🟡 | UX-004's Policy Detail is the first fully-designed instance; no shared component yet |
| Entity Editor | 🟡 | Add/Edit forms exist per-entity, not unified |
| Progressive Enrichment | 🆕 | The *principle* is frozen (ADR-021 addendum); no reusable "optional field, add later" UI component exists yet |
| Suggested Next Steps | 🆕 | Designed in UX-005, not built as a component |
| Archive | 🆕 | Doesn't exist as a distinct action anywhere — today it's Delete or nothing |
| Delete | ✅-ish | Delete flows exist per-entity (confirm dialog pattern repeats, see Shared Patterns) but not as one shared Entity-Delete component |

### Pattern: Suggested Next Steps
- **Purpose:** offer related setup actions immediately after an entity is created.
- **When to use:** right after saving a new Manage entity that commonly needs follow-up (Vehicle, Property, Insurance, Loan, Credit Card, Business Asset).
- **When NOT to use:** never for actions that create a financial commitment automatically — this pattern always requires explicit user selection (per ADR-021/UX-005's "never silently create commitments" rule).
- **States:** default (all unchecked) → selections made → each selection routes to its own real creation flow.
- **Variants:** suggestion list is per-entity-type, not fixed.
- **Accessibility:** each suggestion is an independent checkbox, not a forced radio choice; Skip always present and unambiguous.
- **Developer Notes:** never wire this directly to Bill/Transaction creation — it only opens the *entity's own* proper creation flow (e.g., selecting Insurance opens UX-004 in full, not a shortcut).
- **Used In:** UX-005 (Buy Vehicle). Designed for: Property, Credit Card, Loan, Business Asset.

---

## 2. Commitment Patterns

*Reusable for: Bills, EMI, Subscription, Membership, Insurance Premium, SIP*

| Pattern | Status | Note |
|---|---|---|
| Commitment Card | 🟡 | Bill rows exist, styled per-screen, not one shared card |
| Commitment Detail | 🟡 | UX-002 designed this generically; current Bill Detail is Bills-specific, needs generalizing |
| Resolve Commitment (Pay/Skip/Snooze/Edit) | 🆕 partial | Pay/Edit exist (reuse); **Skip and Snooze confirmed new** — only `unpaid`/`paid` status exists on Bill today |
| Pause Series | ✅ | Already exists — `isPaused`/`pausedDate` on Bill, distinct from per-instance Skip |
| History | ✅ | Bill payment history via linked Transactions already works |
| Upcoming Timeline | ✅ | Upcoming Bills list already built |

### Pattern: Skip / Snooze
- **Purpose:** resolve a single due occurrence without paying it (Skip) or defer it briefly (Snooze) — as UI-level actions on any Commitment, not Bill-specific features.
- **When to use:** any Commitment Detail screen, regardless of Bill.type.
- **When NOT to use:** not a substitute for Pause Series — Skip/Snooze affect one occurrence only, never the recurring schedule itself.
- **States:** Skip → this occurrence marked resolved-without-payment, next occurrence generates normally. Snooze → reappears after a set period.
- **Variants:** not every Bill.type needs to expose both in its UI (a fixed EMI likely never shows Skip) — but the underlying lifecycle supports both regardless.
- **Developer Notes:** requires two new fields on Bill (e.g., `skippedDates[]` or a per-instance status, and a `snoozedUntil` — note a *different* `snoozedUntil` already exists on `recurringSchedules` for SIPs specifically; this would be a parallel field on Bill, not a reuse of that one).
- **Used In:** UX-002 (Resolve Financial Commitment).

---

## 3. Transaction Patterns

*Reusable for: Expense, Income, Transfer, Investment, Loan, Refund, Split*

| Pattern | Status | Note |
|---|---|---|
| Transaction Form | ✅ | Quick Add + Full Add, extensively built |
| Amount Entry | ✅ | Built |
| Category Picker | ✅ | Built, with auto-detect |
| Entity Selector (generic) | 🟡 | Account picker, Person picker, Group picker all exist separately — not one generic "pick a linked entity" component |
| Account Picker | ✅ | Built, recently corrected to exclude debit/UPI sub-accounts |
| Attachment Picker | 🟡 | Per-transaction attachment exists; **not** the shared platform-wide Attachment service from ADR-021 |
| Split Sheet | ✅ | Multiple modes (equal/amount/percent/share) built |
| Confirmation Toast | ✅ | `Toast` component, extracted this session |

---

## 4. Forecast Patterns

*Reusable for: Upcoming, Calendar, Cash Forecast, Safe to Spend, Alerts, Today's Focus*

| Pattern | Status | Note |
|---|---|---|
| Upcoming list | ✅ | Bills' upcoming list exists |
| Calendar view | 🆕 | Doesn't exist |
| Cash Forecast card | 🆕 | `calculateProjectedBalance` is an explicit engine stub |
| Safe to Spend card | ✅-ish | Current formula exists; Financial-Engine version stubbed |
| Alerts | 🟡 | Inline in Action Centre today, not centralized per ADR (Forecast Engine should own generation) |
| Today's Focus | 🟡 | Evolving from Action Centre, per earlier IA work |

---

## 5. Analytics Patterns

*All 🆕 — Insights is confirmed the domain with the least existing work (0 Existing screens per the Screen Inventory)*

| Pattern | Status |
|---|---|
| Trend Card | 🆕 |
| Pie chart | 🆕 (Recharts available, not yet used for this) |
| Bar chart | 🆕 |
| Heatmap | 🆕 |
| Comparison | 🆕 |
| Top Merchant / Top Category | 🆕 |
| Insights Card | 🆕 |

---

## 6. Shared Patterns

*The most valuable section — used everywhere, most extraction debt*

| Pattern | Status | Note |
|---|---|---|
| Bottom Sheet | ✅ Extracted | `components/BottomSheet.jsx` — animated, reused across Goals/Events/Membership/etc. |
| Empty State | ✅ Extracted | `components/EmptyState.jsx` — 7+ locations migrated |
| Toast | ✅ Extracted | `components/Toast.jsx` |
| Stat Card | ✅ Extracted | `components/StatCard.jsx` — 1 of 4 known duplicate locations migrated so far |
| Search | 🟡 | Exists per-screen (Timeline, Transactions), not unified |
| Filter | 🟡 | Same |
| Sort | 🟡 | Same |
| FAB | ✅-ish | Built, with press animation and long-press speed menu — but not extracted as a standalone reusable component, lives inline in the main app file |
| Confirmation Dialog | 🟡 | `askConfirm` pattern exists and is used widely, but is a function convention, not an extracted component |
| Delete Dialog | 🟡 | Repeats the confirm pattern above |
| Error State | 🆕 | No dedicated pattern — errors currently shown via inline warning text (`refDupWarning`-style), which itself isn't a named/extracted pattern |
| Skeleton Loader | 🆕 | Confirmed earlier this session — most of the app loads instantly from localStorage, so this has been deliberately low-priority; the one real loading case (cloud sync) uses a simple spinner, not a skeleton |
| Chip | ✅-ish | Used extensively (category chips, account chips) but as repeated inline styles, not one exported `<Chip>` |
| Badge | 🟡 | "📱 SMS" badge, similar small badges repeat inline |
| Timeline Item | ✅ | `TxnRow`, already a shared, reused component |

---

## Extraction priority, based on this catalogue

**Highest value to extract next** (used most widely, currently most duplicated):
1. **Chip** — category/account/payment-method chips are near-identical inline styles repeated dozens of times across Quick Add, Full Add, and multiple screens
2. **Confirmation/Delete Dialog** — `askConfirm` convention is solid but not a real component; formalizing it would tighten every delete/destructive action at once
3. **Entity Card / Entity List** — directly needed for UX-006 (Create Person) and UX-007 (Split Expense) validation passes, and every future Manage entity

**Lower priority** (fewer current call sites, or blocked on other work):
- Attachment Picker (blocked on the shared Attachment service itself being built first)
- Analytics patterns (blocked on Insights domain existing at all)

---

## Status Update

| Package | Status |
|---|---|
| UX-001 – Record Expense | ✅ Approved |
| UX-002 – Resolve Financial Commitment | ✅ Approved |
| UX-004 – Insurance Policy Lifecycle | ✅ Approved |
| UX-005 – Buy Vehicle | ✅ Approved |
| **Phase 2.75 – Pattern Library** | ✅ This document |
| UX-003 – Salary Received | Next |
| UX-006 – Create Person | Pending Validation |
| UX-007 – Split Expense | Pending Validation |

From here, each remaining UX package should reference patterns by name
("Uses Entity Detail," "Uses Chip") rather than re-describing the same
UI shape from scratch.
