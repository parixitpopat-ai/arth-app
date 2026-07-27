# H001 Freeze Package

**Status: 🟢 Validated → 🔒 Frozen.** This package reflects what is
actually deployed and running, corrected through three real deployment
cycles today (header, Today's Focus fold, Widget Registry) — not a
fresh design exercise.

---

## 1. UX Spec (Revision 2)

**Screen ID:** H001 | **Module:** Home | **Priority:** P0

**Purpose:** Answers "What should I do today?" Home surfaces
information; every widget deep-links to its owning module.

**Header (Home-specific, verified against the real conditional):**
```
[greeting icon] Good Morning/Afternoon/Evening/Night[, name if set]
[Day, Date]
─────────────────────────────
☰                    💼 🔍 👁️ 🔒
```
Name comes from `people.find(p=>p.isMe)?.name` — real, confirmed by
checking, not the `userProfile` field I initially and incorrectly
assumed existed. Greeting/date only render when `tab==="home"`; every
other tab keeps the "Arth / Personal Finance" branding header.

**Layout, in actual render order:**
```
Header
  |
Today's Focus (mandatory)
  |
Safe to Spend + Protected Money (one combined 2-column card)
  |
Quick Actions (mandatory)
  |
Goals (max 2, grid)
  |
Recent Activity (max 5)
  |
[Arrange button]
  |
Bottom Navigation
```

---

## 2. Architecture Diagram

```
Home
├── Header (conditional: greeting on Home, branding elsewhere)
├── Today's Focus [MANDATORY]
│     ├── Overdue/Due-today Bills
│     └── Membership Renewal/Lapsed alerts (folded in this session)
├── Safe to Spend + Protected Money [combined card, HIDEABLE as a unit]
├── Quick Actions [MANDATORY]
├── Goals [HIDEABLE]
├── Recent Activity [HIDEABLE]
└── Bottom Navigation
```

**Known incomplete fold, flagged not hidden:** Recurring Investment
Reminders (`allFoliosDue`) is a *second* legacy alert block that still
renders separately, outside this architecture, un-hideable — only
Membership alerts were folded into Today's Focus this session, not
this one. Real remaining work, not forgotten.

---

## 3. Widget Registry (matches what's enforced in code, not aspirational)

| Widget | Card ID | Hideable? | Reorderable? | Enforced how |
|---|---|---|---|---|
| Today's Focus | `bills` | ❌ No | ✅ Yes | Hide button conditionally not rendered for this ID; `MANDATORY_CARDS` set also force-shows it defensively |
| Safe to Spend + Protected Money | `safeToSpend` | ✅ Yes | ✅ Yes | Standard toggle |
| Quick Actions | `quickActions` | ❌ No | ✅ Yes | Same mandatory enforcement as Today's Focus |
| Goals | `goalsHome` | ✅ Yes | ✅ Yes | Standard toggle |
| Recent Activity | `recent` | ✅ Yes | ✅ Yes | Standard toggle |

**Rule enforced, verified:** hiding is refused if it would leave zero
visible widgets (`visibleCount<=1` check) — confirmed in the actual
button handler, not just documented.

---

## 4. Data Mapping — honest, not aspirational

| Widget | Claimed source (original spec) | **Actual source (verified)** |
|---|---|---|
| Today's Focus | `ForecastEngine.getTopFocusCards()` | **Does not exist.** Computed inline inside `Home`'s own component body — filters `bills` directly, filters `memberships` directly. No engine function call. |
| Safe to Spend | `ForecastEngine.calculateSafeToSpend()` | **Partially real, but not via the engine file.** Uses the same *formula* as Outlook (`monthBudget − monthSpend`), but recomputed inline in `Home`, duplicated from `OutlookPage` — not a shared function call to `engine.js`. |
| Protected Money | `ForecastEngine.calculateProtectedMoney()` | **Does not exist as a named function anywhere.** Same situation — inline in `Home`, duplicated from `OutlookPage`'s equivalent inline logic. |
| Goals | `GoalsEngine.getGoals()` | Real — reads the `goals` array directly, filtered to non-completed, sliced to 2. No dedicated "Goals Engine" module exists as a file; "engine" here means the data array + inline logic, not a separate service. |
| Recent Activity | `Ledger.getRecentTransactions()` | Real — reads `txns` directly, no dedicated Ledger Engine module either. |

**This is the single most important finding in this whole package:**
Home's own principle — *"Home never performs calculations, only
consumes engine output"* — is **currently violated** for 3 of 5
widgets. The calculations are correct (verified against real Bills/
Budget/Membership data), but they live inside `Home` and are
**duplicated** inside `OutlookPage` rather than shared. If the formula
changes again, both places need updating by hand — a real, acknowledged
piece of tech debt, not a hidden one. **Recommended fix, not done in
this pass:** extract `calculateSafeToSpend`/`calculateProtectedMoney`/
`getTodaysFocusItems` into real functions in `engine.js`, called
identically from both `Home` and `OutlookPage`.

---

## 5. Interaction Map (every tap, verified against real onClick handlers)

| Element | Action |
|---|---|
| Safe to Spend + Protected Money card | `setTab("outlook")` |
| Bills Due row (real bill) | `setEditingBill(b)` → opens `EditBillModal` |
| Membership alert row | `setActiveBillerForAction(ba)` |
| Goal card | `setShowGoalsList(true)` |
| Recent Activity row | opens transaction detail (existing, unchanged) |
| Quick Action button | opens Add flow for that type (existing, unchanged) |
| "Arrange" button | toggles `editingCards`, revealing ↑/↓ reorder + 👁/🚫 hide (mandatory widgets excepted) |
| Search icon | `setShowSearch(true)` |
| Mask icon | `toggleMask()` |
| Lock icon | `onLock()` |

---

## 6. Component Map — honest about what's a real component vs. a style token

| Widget | Claimed component | **Actual** |
|---|---|---|
| Safe to Spend / Protected Money / Today's Focus / Goals cards | "Summary Card (CMP-002)" | **Not a component** — these all apply the shared `card` **style object** inline (`style={{ ...card }}`), not an imported `<Card>`/`<SummaryCard>` component. Visually consistent, but not componentized — a future refactor target, not a broken thing. |
| Empty states | CMP-007 (Empty State) | Real — `EmptyState` is an actual imported component, used correctly where present. |
| Confirmation Dialog | CMP-006 | Real — `ConfirmDialog`, actual component. |
| Chips (Membership status etc.) | CMP-005 | Not used on Home currently — no chip-styled elements present on this screen today. |

**No new components introduced this session** — every widget added
(Safe to Spend, Protected Money, badge count) reused the existing
`card` style token and inline patterns already used throughout Home.

---

## 7. Developer Notes — exactly what changed from V1

- Removed: standalone Membership Expiry block (folded into Today's Focus)
- Removed: Financial Health Score, AI Insight, 6-stat grid, Category pie chart, Credit Card summary card, Events card (per the "should disappear" list)
- Added: Safe to Spend + Protected Money combined card
- Added: Today's Focus badge count (includes bills + membership counts)
- Added: hide/show toggle in Arrange mode, with Today's Focus and Quick Actions exempted (mandatory)
- Added: time-aware greeting header, Home-specific only
- **Not removed, still pending:** Recurring Investment Reminders block (separate legacy alert, not yet folded)
- **Known tech debt, not fixed this pass:** Safe to Spend / Protected Money / Today's Focus logic is duplicated between `Home` and `OutlookPage` — see Data Mapping section above

---

## Status Model (adopted)

| Status | Meaning |
|---|---|
| 🟡 Designed | UX approved, not implemented |
| 🔵 Implemented | Built |
| 🟢 Validated | Checked against the running app and corrected |
| 🔒 Frozen | Reference implementation |

**H001 Status — multi-area, not a single label:**

| Area | Status |
|---|---|
| UX | 🔒 Frozen |
| Visual Design | 🔒 Frozen |
| Navigation | 🔒 Frozen |
| Business Rules | 🔒 Frozen |
| Code Architecture | 🟡 Deferred — see Architecture Debt Register (AD-001, AD-002, AD-003) |

Behavior is frozen. Implementation debt is tracked separately and
re-prioritized after each Freeze Package — not fixed reactively now.

## Screen Tiering (adopted)

**H001 is Tier 1 (Reference Screen)** — full design package + deployment
validation, exactly as done here. Future Tier 1 candidates: Money
Dashboard, Cash Forecast (already done — O014), Commitments, Settings,
Insights Dashboard.
