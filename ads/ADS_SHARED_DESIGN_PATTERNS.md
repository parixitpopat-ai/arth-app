# ADS — Shared Design Patterns

The Design Language of Arth. Every future screen follows these. Grounded
against real current behavior where checkable — not written as if
greenfield.

---

## PAT-001 — Navigation

**Covers:** Bottom Navigation, Drawer, Back Navigation, Deep Links, Search Navigation, Modal Navigation.

**Rules:**
- Never more than 5 bottom tabs. **Confirmed already true** — the frozen nav (Home/Money/Add/Outlook/Insights) is exactly 5, matches this rule without needing any change.
- Every screen has predictable Back behavior.
- Deep links always restore parent context.
- Search can open any supported entity directly — per H012's merged Universal Search (4 states: Idle/Typing/Results/No Results).

**Current Status:** Existing, already compliant.

---

## PAT-002 — Empty States

**Rules:** every empty state must explain why it's empty, what to do next, and provide one primary CTA. Never "No data."

**Current Status:** Existing — `EmptyState` component (PAT-002 in the Pattern Library numbering, same component) already follows this shape (icon + title + subtitle + CTA), migrated to 7+ locations already. This ADS pattern formalizes a rule the component already enforces structurally — you can't easily build a bare "No data" with this component even if you tried, since title/subtitle are separate, explicit props.

---

## PAT-003 — Feedback

**Standardize:** Success, Error, Warning, Information.
**Duration:** Success 3 sec, Warning until dismissed, Error until action taken.

**Current Status:** Partial. `Toast` (PAT-003 in the component numbering) exists and handles Success — confirmed auto-dismiss timing is configurable (`duration` prop, currently defaulting to ~2.2 sec, close to but not exactly 3 sec). **Warning/Error persistence-until-dismissed/action is not consistently implemented** — several inline warnings (`refDupWarning`-style) auto-clear or get overwritten rather than persisting until the user acts, which doesn't yet match this rule.

---

## PAT-004 — Confirmation

**Rules:** Title, Description, Primary, Secondary. Never more than 2 buttons. Delete always requires confirmation.

**Current Status:** Existing — `ConfirmDialog` (PAT-006 in the component numbering) already matches this shape exactly (message + confirm/cancel, max 2 buttons), extracted and fully deployed this session, replacing the single prior inline implementation.

---

## PAT-005 — Forms

**Rules:** Currency fields, Date fields, Dropdowns, Required indicators, Validation timing, Auto-save behavior.

**Current Status:** Mixed, real specifics:
- **Auto-save: Existing** — draft auto-recovery for Add Transaction, built this session specifically after a real silent-data-loss bug (backgrounded-tab reload wiping in-progress forms).
- **Currency/Date fields: Existing** — native `<input type="date">`, amount fields throughout.
- **Required indicators: Partial** — some forms show a `*` or red border on empty required fields (Add Bill after this session's fix); not universal across every form in the app.
- **Validation timing: Partial** — this session found and fixed 10 separate cases where validation failures were silently swallowed (the `alert()` bug sweep) — validation *timing* itself (on-blur vs on-submit) isn't yet standardized across forms.

---

## PAT-006 — Lists

**Support:** Search, Sort, Filter, Multi-select, Swipe actions, Pagination.

**Current Status:** Partial — Search/Sort/Filter exist per-screen (Timeline has all three), not unified into one reusable list behavior. Swipe actions exist on Timeline rows. Multi-select and pagination not confirmed to exist anywhere in the app.

---

## PAT-007 — Cards

**Hierarchy:** Summary Card, Asset Card, Bill Card, Goal Card, Forecast Card, Person Card.

**Current Status:** Partial. `StatCard` (extracted, 1 of ~4 known duplicate locations migrated) and `EntityCard` (extracted, 1 real migration) cover part of this. Bill Card, Goal Card, Forecast Card, Person Card all still exist as independent, non-unified inline implementations across their respective screens.

---

## PAT-008 — Charts

**Standard:** Line, Bar, Pie, Forecast, Net Worth. Tap to inspect, pinch to zoom (future), consistent colors, same legends everywhere.

**Current Status:** New/Partial — Recharts is already available as a library dependency (confirmed), but no standardized chart-wrapper component exists yet enforcing consistent colors/legends across the handful of charts that do exist (e.g. Net Worth donut). Insights (I001-I015) is the module most dependent on this pattern actually being built.

---

## PAT-009 — Search

**Covers:** Ranking, History, Recent Searches, Suggestions, No Results.

**Current Status:** Partial — the Universal Search overlay (H012) already returns typed results live and routes by result type; Recent Searches/Suggestions/ranking logic beyond simple text match not confirmed to exist.

---

## PAT-010 — Loading

**Three types:** Skeleton, Spinner, Progress. Never show blank screens.

**Current Status:** Partial, real specifics — **Skeleton: does not exist** (deliberately deprioritized earlier this session, since most of the app loads instantly from localStorage — confirmed, not assumed). **Spinner: Existing** — the ambient sync spinner in the header, built this session. **Progress: not confirmed** to exist as a distinct pattern (e.g., a percentage-based upload/import progress bar) — no current feature needs it yet (Import doesn't exist).

---

## PAT-011 — Errors

**Recoverable → Retry. Fatal → Restart. Validation → Inline. Network → Offline banner.**

**Current Status:** Partial. Inline validation exists (post this session's alert() fixes). Network/Offline banner is genuinely new (H014, not yet built). Fatal/Restart (error boundary) is genuinely new (H015, not yet built).

---

## PAT-012 — Accessibility (previously entirely missing)

**Minimum:** Dynamic font support, screen reader labels, 48dp touch targets, color contrast, haptic feedback for important actions, keyboard navigation (future web version).

**Current Status: New — confirmed, not assumed.** This entire session's work (architecture, engine, UX Bible) never once addressed accessibility. No screen-reader labels, touch-target sizing, or contrast auditing has been done on any screen built or specified so far. **This is a real, honest gap across the entire app, not a single-screen issue** — flagging it plainly rather than let it stay invisible in a 40+ document specification stack that otherwise looks comprehensive.

---

## PAT-013 — Entity Relationship Pattern (unique to Arth)

```
Entity -> Documents -> Bills -> Transactions -> Timeline -> Forecast -> Insights
```

**Current Status:** Partial, validated by real examples already built — Insurance (UX-004) already follows this exactly (Policy → Bill → Transaction → Timeline, per its core rule). Vehicles and Business Assets/Property are designed to follow the same shape once built (per their placeholder specs in Money/Manage), but aren't built yet — this pattern is confirmed *correct* by one working example, not four.

---

## PAT-014 — Progressive Enrichment

**Already an ADR addendum** (ADR-021) — restated here as a design pattern, not a new decision. Validated by three real, shipped examples: Vehicle (registration-only required, value/insurance/warranty added later), Credit Card ("Limit not set" rather than fabricated), Insurance (policy created first, documents/nominee added later). Every future Manage entity should default to the smallest required field set.

---

## Shared Patterns Summary

| Status | Count |
|---|---|
| Existing, already compliant | 4 (Navigation, Empty States, Confirmation, Progressive Enrichment) |
| Partial | 8 |
| New, real gap | 2 (Accessibility, and parts of Loading/Errors combined)

**The one finding worth not losing in the volume of this document: Accessibility (PAT-012) is the single largest, most invisible gap in the entire specification stack.** Every other module's "New" items are visible, scoped, and estimated (Insurance XL, Property XL, Analytics Engine). Accessibility silently applies to every screen already documented as "Existing" — none of them have actually been audited for it.

## Shared Patterns Completion Scorecard

| Category | Status |
|---|---|
| Pattern Definitions | ✅ |
| Component Extraction | 🟡 (7 of ~14+ identified patterns actually extracted) |
| Accessibility Audit | ⏳ Not started |
| Wireframe | ⏳ |
| High Fidelity | ⏳ |

---

## Frozen Outlook Design Rules (permanent — define Arth's identity)

1. **Cash Forecast is the hero screen.** Financial Timeline Strip, Projected Balance, Forecast Explanation Panel, Negative Balance Indicator, and Safe to Spend must never be split across separate screens — if a user asks "why does Arth recommend ₹X/day," the answer is visible on the same screen, always.
2. **Outlook owns time.** Anything with a date — Bills, Renewals, SIPs, Insurance Premiums, EMIs, Salary, Budget Milestones, Planner, Alerts — belongs in Outlook. Money never becomes date-driven.
3. **Timeline Strip is a reusable component**, used identically in Cash Forecast, Monthly Planner, Bill Detail, Insurance Detail, Credit Card Detail, and (future) Goal Detail.

---

## UI Convention — Commitment Timeline (not an ADR — visual convention only)

Every commitment exposes the same **visual** lifecycle, distinct from
its underlying domain lifecycle (which stays whatever it already is —
Bill's `unpaid`/`paid`, ExpectedIncome's `pending`/`received`, etc.):

```
Scheduled -> Upcoming -> Due Today -> Completed
                                    -> Overdue (if missed)
```

Different domain events map to the same visual journey: Salary
(Scheduled -> Received), SIP (Scheduled -> Executed), Insurance
(Scheduled -> Paid), EMI (Scheduled -> Paid), Subscription (Scheduled
-> Renewed). This is a **presentation mapping only** — same principle
as ADR-023's Commitment Card, applied to lifecycle state instead of
layout. No domain entity gains a new status field because of this;
each entity's own real status still drives which visual stage renders.

---

## UI Convention — Three Action Types (frozen)

| Type | Example | Behaviour |
|---|---|---|
| Immediate | Pay Bill | Executes instantly |
| Forecast | Pause Gym | Shows impact preview before confirmation |
| Informational | View Timeline | No state change, never asks for confirmation |

Every future interaction across Arth is exactly one of these three —
keeps the interaction model consistent as new screens get built.
