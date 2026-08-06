# BUD-002 — Budget UX & Product Specification

**Version:** 1.0 (Frozen)
**Status:** **Frozen**, with 7 tracked open items (F.5) that do not block implementation. Parts 0, A, B, C, D, E, F, G, H, I complete. Product rules PR-1/PR-2/PR-3 (§B.8) are frozen. F.1/F.3's type and spacing scale are the confirmed working default pending the person's own review of the raw prototype values (F.5, items 1–2) — a tracked refinement, not a reason to hold the freeze.
**Precedes:** Nothing — this is the terminal planning artifact. BUD-003's WP-4/WP-5 build against this document.
**Depends on:** BUD-000 (Domain Reconciliation), BUD-000A (Architecture Review), ADR-036 (Allocation Engine, Frozen), ADR-037 (Financial Calendar, Frozen), BUD-001 (Modernization Plan), BUD-003 (Engineering Work Packages).
**Context:** No prior BUD-002 was ever found to exist, in this repository or in any recoverable session history (see conversation-history check, 2026-08-06). This is not a recovery or reconstruction — it is a first-class specification, written after the architecture it describes was already frozen, which the original (missing) BUD-002 could not have been. One design artifact (an exploratory 16-screen Claude Design mockup, uploaded 2026-08-05, including one "Budgets" screen) exists as visual reference material — **Design Input #1** — but predates ADR-036/037 and BUD-001/003, and is treated as inspiration for Parts E/F, never as a source for Parts A–D.

---

## 0. Product Intent

Budget is Arth's financial planning workspace.

Transactions record what happened. Budget records what the user intends to happen. This is not a stylistic distinction — it is the frozen architectural boundary between two domains (ADR-025, Rule 3; reaffirmed in ADR-036 §4): Transactions are the single source of fact, and Budget never creates, edits, or owns one. Everything Budget shows is either a plan (a Planning Allocation, set independently of any transaction) or a read-model computed by comparing that plan against transaction fact.

Home answers today's question — *"where do I stand right now?"* Budget answers next month's question — *"what do I want to happen, and how am I tracking against it?"* Home is the operational, glanceable dashboard; Budget is where planning and review actually happen (BUD-000, Section 2). Budget does not compete with Home for the same job — it consumes the same underlying facts (via the Allocation Engine and, indirectly, Transactions) but exists to answer a different, longer-horizon question. A user who never opens Budget should still get an accurate Safe-to-Spend figure on Home; a user who lives inside Budget should never have to reconcile a second, conflicting number back on Home. That non-negotiable consistency is what ADR-036's Producer/Consumer split exists to guarantee.

Every screen, mode, and interaction in this document is judged against one test: **does it help the user express intent (Plan), see whether reality matched intent (Observe), or understand why it didn't (Understand)?** If a proposed screen doesn't answer one of those three questions, it doesn't belong in Budget — it belongs to Reports, Home, or a domain that hasn't been audited yet.

---

## A. Information Architecture

### A.1 The three modes

Budget is not organized as a set of screens that happen to share a module. It is organized as three modes of work, each with a distinct question, a distinct relationship to write access, and a distinct architectural role under ADR-036:

```
Observe  →  Plan  →  Understand
```

The arrow is not a rigid sequence a user must follow — it's the natural order in which the questions arise (check standing, adjust intent, learn why). A user can enter any mode directly.

| Mode | Question | ADR-036 role | Owns |
|---|---|---|---|
| **Observe** (Home) | "How am I doing?" | Consumer only — read-only | Safe-to-Spend, Budget Health, Variance summary, Forecast snippet |
| **Plan** (Planning Workspace) | "What do I want next period to look like?" | The sole Producer of Planning Allocations | Allocation editor — Household, Category, Person, Group dimensions |
| **Understand** (Insights) | "Why did this happen?" | Consumer only — read-only | Month View, Category View, Person View, Summary View |

This mirrors, rather than invents, the architecture: ADR-036 §7 already names Budget as the only Producer of Planning Allocations and lists Budget itself (for variance/health/forecast), Reports, Goals, AI, Forecasting, and Home as read-only Consumers. Observe and Understand are both Consumer-mode surfaces internal to Budget; Plan is the Producer surface. No screen in Observe or Understand ever writes a Planning Allocation — that capability exists in exactly one place.

### A.2 What each mode explicitly does not do

Stated as boundaries, not just capabilities, because BUD-000's Repository Audit found today's five-mechanism sprawl specifically because these boundaries were never drawn:

- **Observe never edits.** No tap on a Safe-to-Spend figure, a Health tile, or a Variance bar opens an editable field in place. It may *navigate* to Plan (see A.4), but it never mutates state itself.
- **Plan never computes historical variance.** It shows the current allocation and, where useful for context, the plan-vs-actual comparison for the period being edited — but Plan is not where a user goes to understand *why* a category ran over three months ago. That's Understand.
- **Understand never edits.** It is Attribution-only (ADR-036 §6, Invariant 4) — it reports on what already happened. A finding in Understand (e.g., "Person X consistently overspends on weekends") may prompt a user to go adjust a plan, but Understand itself has no write path.
- **None of the three modes owns Budget Period definitions.** Per BUD-000A's Q3 decision, the Financial Calendar is a shared platform capability (ADR-037), not a Budget-owned concept. All three modes *consume* period boundaries; none of them defines what a "month" or "fiscal year" is.

### A.3 Tree

```
Budget
├── Home           (Observe)
├── Planning Workspace       (Plan)
└── Insights       (Understand)
```

Deliberately flat — three siblings, no nesting, matching ADR-036 Invariant 5's "dimensions remain orthogonal" principle applied one level up: modes don't nest inside each other any more than dimensions nest inside each other.

### A.4 Cross-mode links (the one exception to strict separation)

Strict separation of Observe/Plan/Understand does not mean the modes are unreachable from each other — it means that reaching another mode is always an explicit *navigation*, never an in-place edit. The one designed cross-link:

- **A Budget Alert on Home (Observe), when tapped, navigates to Planning Workspace (Plan), pre-scoped to the dimension that triggered it.** E.g., an 80%-threshold alert on the "Groceries" category opens Planning Workspace with the Category tab active and Groceries focused — it does not open an inline editor on Home itself. This preserves the Observe/Plan boundary (Home still never edits) while keeping the alert-to-action path short.
- Similarly, a Variance figure in Understand may deep-link back to Planning Workspace for the relevant dimension/period, for the same reason: understanding *why* naturally leads to adjusting *what's planned*, and that adjustment always happens in Plan.

No other cross-mode links are specified in this draft. Additional ones should be justified against the Product Intent test (0) before being added, not added by convention.

### A.5 Release 1 Allocation Targets vs. Future Allocation Targets

Not exclusions — scoping. The IA is not wrong about Goal/Trip/Project/Event/Vehicle; Release 1 simply doesn't build them yet. Framed this way so a future ADR addendum extends this document rather than contradicts it:

**Release 1 Allocation Targets** (Plan's dimension list, Release 1):
- Household
- Category
- Person
- Group

**Future Allocation Targets** (not part of Release 1 Information Architecture):
- Goal, Trip, Project, Liability — explicitly out of scope for this Release (BUD-001 §8)
- Event, Vehicle — pending an ADR addendum (the ADR-035A-equivalent decision carried forward from BUD-001A); no mode surfaces either as a first-class allocation target until that addendum exists

If/when any of these onboard, they become additional entries inside Plan's dimension list and additional views inside Understand — they do not create new modes. **History / Snapshots** follows the same logic and is covered separately in Part I, since it isn't a dimension at all but a missing capability (BUD-000 Gap Analysis: "Missing entirely"; no WP in BUD-003 builds it).

---

## B. Navigation

### B.1 Entry into Budget

Budget is reached as its own top-level entry point from wherever the app's primary navigation places it (bottom nav tab or drawer item — that decision belongs to the app-level IA, not to this document, and is not made here). What *is* specified: entry always lands on **Home (Observe)**, never on Planning Workspace or Insights, regardless of entry path — with one exception (B.4, alert deep-links).

**Rationale:** Observe is the zero-commitment mode — it answers a question without requiring the user to have already decided to edit or dig into analytics. Landing anywhere else would front-load a decision (edit something, or interpret a report) before the user has even seen where they stand.

### B.2 Tab structure

Three persistent tabs, always visible while inside Budget, matching the A.3 tree exactly:

```
[ Home ]   [ Planning Workspace ]   [ Insights ]
```

No tab is conditionally hidden. Even a household with no allocations set yet sees all three — Planning Workspace's empty state (Part D) is the on-ramp for a first-time setup, not a hidden tab that appears only after some other action.

### B.3 The Period Selector — shared, not per-tab

Because the Financial Calendar (ADR-037) is a shared platform capability that all three modes consume identically, Budget has **one period selector, positioned above the tab bar, shared across all three modes** — not three independent selectors. Switching the period while on Insights and then tabbing to Planning Workspace shows Planning Workspace for that same period; the selection persists across mode switches within a Budget session.

This directly resolves one of BUD-000's confirmed findings: today's `viewMonth` is an implicit, inconsistently-resolved string key duplicated six times across the app. A single, shared period selector is the concrete UI expression of ADR-037 existing as a platform capability rather than something each mode reimplements — there is exactly one place in Budget's UI where "what period am I looking at" is decided.

**Default period on entry:** the current calendar month (or current fiscal year, if the household's configured Budget Policy is FY-based — Part D defines this per Home's landing state). Navigating to a past or future period is supported in all three modes, but Plan restricts *editing* to the current and future periods only.

**Product rule — Closed periods are immutable for planning.** This is stated as a product rule, not a UX convenience, because it's the direct consequence of the Transactions/Budget boundary this entire document is built on (Section 0): Transactions own historical facts; Budget owns future intent. A closed period's plan is itself now a historical fact — allocated, measured, done. Allowing edits to it would mean Budget quietly started rewriting history instead of planning it. Corrections to what actually happened belong in Transactions, not Budget. If a genuine need for retroactive plan correction emerges later (e.g., an admin-unlock capability for closed periods), that is a separate, deliberately-scoped feature with its own governance decision — never a quiet loosening of this rule inside Planning Workspace's normal editing flow.

**Surfacing this rule is contextual, not persistent.** The rule itself is binding at all times (see PR-3, B.8), but the user only sees it stated when it's actually relevant — opening a closed period. A user planning the current month is never shown copy about closed periods; nothing about the immutability rule appears anywhere in the normal current/future-period editing flow. The moment the Period Selector is moved to a closed period, Planning Workspace shows a banner:

> *This period is closed.*
> *Budget plans are locked after period close. If historical corrections are needed, edit the underlying transactions instead.*

Every field on the screen is then rendered disabled. This keeps the rule enforced everywhere (nothing about PR-3 is optional or skippable) while keeping the day-to-day experience of planning the current month free of a warning that, for that user in that moment, doesn't apply.

### B.4 Deep-links (entry that bypasses B.1's default)

Two specified deep-link paths, both already justified in A.4:

1. **Budget Alert tap (from Home itself, or from a notification generated by Home's Alert logic)** → lands directly on Planning Workspace, dimension and period pre-scoped, bypassing the B.1 default landing on Home. This is the one case where entry does not land on Home, because the user is already past Observe — the alert *is* the Observe finding that prompted the visit.
2. **Variance figure tap, from within Insights** → navigates to Planning Workspace for that dimension/period. This is an in-session mode switch, not an app-entry deep-link, but follows the same rule: Understand can hand off to Plan, never edit in place.

No other deep-link paths are specified in this draft. In particular, there is no deep-link from outside Budget (e.g., from Transactions or Home's general navigation) directly into Insights — Insights is reached by first entering Budget normally (B.1) and tabbing over, or via the Variance hand-off above.

#### B.4.1 Navigation Contract

BUD-002 specifies what a deep-link into Planning Workspace must be able to carry — not how it's implemented. Serialization (URL params, route state, event payload shape) is engineering's decision at build time; this contract is what any implementation must satisfy to be correct:

> **A Budget Alert (or any other deep-link source, present or future) must be able to open Planning Workspace scoped to:**
> - **Period** — which period is being planned
> - **Dimension Type** — which allocation dimension (Household, Category, Person, Group, per A.5's Release 1 list)
> - **Dimension Identifier** — which specific instance of that dimension (e.g., which category, which person)
>
> Planning Workspace, on receiving all three, opens directly to that dimension's editor for that period, with no intermediate navigation step required of the user.

If a future deep-link source can't supply all three (e.g., an Insights hand-off where the user hasn't drilled into a single dimension), it may omit Dimension Type/Identifier and fall back to opening Planning Workspace's default dimension (Household) for the given Period — but Period is never optional; every deep-link into Planning Workspace must specify which period, given PR-1 (B.8).

### B.5 Back behavior

Standard platform back-navigation applies within a mode (e.g., drilling into a specific category's variance detail inside Insights, then back). Switching *tabs* is not a back-stack event — moving from Home to Planning Workspace to Insights and pressing back from Insights returns to wherever the user was *before entering Budget*, not back through Home and Planning Workspace. This matches standard tab-bar convention and avoids the Period Selector's shared state (B.3) getting confused with navigation history.

### B.6 Mapping to engineering scope

For traceability into BUD-003 (formalized fully in Part G):

- Home, Planning Workspace, and the Period Selector → **WP-4**
- Insights (all three views) → **WP-5**
- The Budget Alert deep-link (B.4.1) → touches both WP-4 (Home's alert surface) and the Notifications boundary already defined in BUD-001 §2 (delivery/dismissal stays Notifications-owned; threshold logic stays Budget-owned)

### B.7 Navigation Principles

Every future Budget screen, journey, or interaction is judged against these six rules before it ships. Each one traces to a decision already made in Parts A–B — this section exists to state them as binding constraints in one place, not to introduce anything new:

1. **One global period context.** A single Period Selector governs all three modes; no mode maintains its own period state. (B.3)
2. **Home is the default Budget entry point.** Every entry into Budget lands on Home unless it's an explicit deep-link. (B.1)
3. **Planning Workspace is the only editing mode.** No allocation is ever created or changed from Home or Insights. (A.2, A.4)
4. **Insights is read-only.** It reports on Attribution; it never writes one. (A.2, ADR-036 Invariant 4)
5. **Closed periods cannot be edited.** Immutability of past plans is a product rule, not a UI restriction that a future screen can quietly work around. (B.3)
6. **Every alert deep-links to its relevant planning context.** A Budget Alert never resolves itself in place — it hands the user to Planning Workspace, scoped to the dimension and period that triggered it. (B.4.1)

### B.8 Frozen Product Rules

Three of the six Navigation Principles above are strong enough to freeze as product invariants, not just UI conventions — meaning any future screen, journey, or feature that would violate one of these needs a deliberate governance decision to change it, the same discipline already applied to ADRs elsewhere in this project. Restated here at invariant strength, independent of any specific screen:

**PR-1 — Single Period Context.** Budget always operates within one active Financial Calendar period. No mode, screen, or future feature maintains an independent period state.

**PR-2 — Planning Ownership.** Only Planning Workspace may edit allocations. Every other Budget surface is read-only.

**PR-3 — Historical Integrity.** Closed periods are immutable. Historical corrections occur through Transactions, never Budget.

These three are binding on Parts C through I of this document and on every implementation decision made against it. A future change to any of them is a product decision requiring the same explicit sign-off this project already requires for ADR amendments — not something a screen spec in Part D can quietly redefine.

---

## C. User Journeys

Five journeys. The first four are drawn directly from the sequence you set out; the fifth — Month Close & Period Transition — is added here because it's the direct behavioral consequence of B.7's Principle 5 (Closed periods cannot be edited) and ADR-037 (Financial Calendar): the moment a period closes has to *feel like something* to the user, or Principle 5 becomes a rule enforced by an error message instead of a rule the product actually explains.

Each journey states: the trigger, the mode(s) touched, the steps, and which Navigation Principle(s) it exercises — so every journey is traceable back to Part B rather than invented independently of it.

---

### C.1 First-Time Budget Setup

**Trigger:** User enters Budget for the first time — no Planning Allocations exist for the household yet.

**Modes touched:** Home → Planning Workspace

**Steps:**
1. User enters Budget (Principle 2: lands on Home).
2. Home detects zero Planning Allocations for the current period and shows an empty state — not a broken/zeroed dashboard, a distinct first-run state (specified fully in Part D). Safe-to-Spend, Health, and Variance are not shown as "₹0" or "0%"; they're replaced with a single call to action: set up a household budget.
3. Tapping the call to action navigates to Planning Workspace (Principle 3 — Home itself never opens an inline editor).
4. Planning Workspace opens with the Household dimension active by default (the top of the Release 1 Allocation Targets list, A.5) and an empty Household allocation field for the current period.
5. User sets a Household allocation. Category/Person/Group dimensions are available as additional tabs within Planning Workspace but are not forced — a household may run on just a Household-level plan.
6. On save, user is returned to Home, which now renders its real Safe-to-Spend/Health/Variance state instead of the empty-state call to action.

**Exit condition:** At least one Planning Allocation exists for the current period. Journey does not require every dimension to be filled in — only Household is treated as the minimum for Home to exit its empty state.

---

### C.2 Monthly Review

**Trigger:** A returning user, mid-period, wants to check standing. The default, most common journey — this is the journey Home's entire design (A.2, "Observe never edits") exists to serve.

**Modes touched:** Home only, optionally Insights.

**Steps:**
1. User enters Budget, lands on Home (Principle 2), current period pre-selected (B.3 default).
2. User reads Safe-to-Spend, Health tile, Variance summary, Forecast snippet — no interaction required; this journey can complete in a glance.
3. **Branch — satisfied:** journey ends here. This is intentionally the shortest journey in the document; Home's whole reason for existing is that most visits should end at step 3.
4. **Branch — curious about a specific number:** user taps into Insights (tab switch, not a deep-link) to see the Month View or Category View behind a Variance figure. Read-only throughout (Principle 4).
5. **Branch — number prompts a plan change:** user taps the Variance figure's deep-link (B.4.2) into Planning Workspace, scoped to that dimension/period. This exits Monthly Review and continues as C.3.

---

### C.3 Planning Next Period

**Trigger:** User wants to set or adjust allocations for the current or an upcoming period — either self-initiated (proactive) or arrived via C.2's branch or an alert deep-link (C.4).

**Modes touched:** Planning Workspace, with the shared Period Selector as the mode-independent context (Principle 1).

**Steps:**
1. User enters Planning Workspace directly, or arrives via a deep-link already scoped to a dimension/period (Principle 6).
2. Period Selector confirms which period is being planned — must be the current or a future period (Principle 5 — the selector itself prevents selecting a closed period for editing; see Part D for the disabled-state treatment).
3. User selects a dimension tab (Household, Category, Person, or Group — A.5's Release 1 list) and adjusts the allocation.
4. If the change affects a dimension that reconciles against a parent total (ADR-036 Invariant 3 — e.g., Category allocations bounded by Household total), Planning Workspace surfaces that constraint inline rather than allowing a silent over-allocation. Exact reconciliation enforcement is implementation detail per ADR-036 §6; this journey specifies that the *user-facing moment* of hitting that constraint must be visible, not deferred to a save-time error.
5. User saves. Planning Allocation is written (the one Producer action in the whole module, A.1).
6. User may continue to another dimension tab within the same period, or exit — exiting always returns to Home (Principle 2's landing rule applies to re-entry, not to staying within a single Planning Workspace session; a user does not get bounced back to Home between dimension tabs).

**Exit condition:** At least one Planning Allocation for the selected period has been created or updated.

---

### C.4 Overspending Workflow

**Trigger:** A Budget Alert threshold is crossed (e.g., 80% or 100%+ of a Category or Person allocation) during the period, independent of the user actively looking at Budget.

**Modes touched:** Notification (outside Budget) → Planning Workspace directly, per Principle 6.

**Steps:**
1. Alert threshold crossed. Per BUD-001 §2's ownership split: threshold logic is Budget-owned, delivery/dismissal is Notifications-owned — this journey covers only what happens after the user acts on the notification, not how it was generated or delivered.
2. User taps the alert. Per Principle 6 and B.4.1, this bypasses the normal Principle-2 landing-on-Home behavior entirely — the user goes straight to Planning Workspace, pre-scoped to the specific dimension and period that triggered the alert.
3. Planning Workspace opens showing the over-threshold allocation with its current Variance visible inline (not a separate trip to Insights — the context that caused the alert should be visible at the point of action).
4. User adjusts the allocation (increases it, accepting the new spending reality) **or** takes no allocation action and instead exits Planning Workspace, having decided the overspend itself needs correcting in Transactions or behavior rather than the plan.
5. Either resolution is valid. This journey does not assume the "correct" outcome is always raising the allocation — Planning Workspace presents the option and the context; it doesn't force a specific response to an alert.

**Exit condition:** User has either updated the relevant Planning Allocation or explicitly left Planning Workspace without changing it. Both are legitimate journey endings.

---

### C.5 Month Close & Period Transition

**Trigger:** The Financial Calendar (ADR-037) advances the current period boundary — e.g., the calendar rolls from March to April.

**Modes touched:** Home (primarily), Planning Workspace (transition only, no editing of the closed period).

**Steps:**
1. Financial Calendar advances the boundary — this is a platform-capability event (ADR-037), not a Budget-owned action; Budget reacts to it, it does not trigger it.
2. On next Budget entry, Home's default period (B.3) is now the new current period. The just-closed period is no longer the default, but remains fully viewable via the Period Selector.
3. If Budget Policy has Carry-Forward enabled (BUD-001 §3 — "stays Budget-owned," a computation rule applied across Planning Allocations from consecutive periods), Home's first view of the new period reflects the carried-forward amount as part of its Safe-to-Spend/Variance baseline, not as a separate notification the user has to act on.
4. If the user navigates the Period Selector back to the now-closed period, Planning Workspace is reachable for *viewing* that period's allocations (consistent with B.3 — viewing past periods is always supported) but every editable field is rendered in its disabled/closed state (Part D specifies the exact treatment) per Principle 5.
5. If the user navigates the Period Selector back to a closed period, Planning Workspace shows the B.3 closed-period banner and disables every editable field — this journey is where that banner is actually encountered, not just specified. Attempting to interact with a disabled field is a no-op; the banner has already stated why (PR-3) before the user gets far enough to attempt an edit.

**Exit condition:** User has either reviewed the new period's opening state or confirmed (by attempting and being blocked) that the prior period is closed. No allocation write occurs against a closed period under any path in this journey — if one did, it would be a defect against Principle 5, not an alternate flow.

---

## D. Screen Specifications

One template, applied to every screen without exception, per your instruction — consistency here is what makes the document usable by both design and engineering without a translation step:

```
Purpose
Primary User
Entry Points
Displayed Data
Primary Actions
Secondary Actions
Sections
Empty State
Loading State
Error State
Navigation
Accessibility
Acceptance Criteria
Engineering Notes
```

Three screens specified below: **Home**, **Planning Workspace**, and **Insights** (covering all four of its sub-views under one screen spec, since they share a template, a data source, and a read-only contract — see Insights' own note on this). Every field in every screen below traces back to a candidate object from BUD-000 §4, a read-model named in BUD-001 §1, or a journey step from Part C — nothing here is invented independently of those.

---

### D.1 Home

**Purpose:** Answer "how am I doing?" without requiring any action. The Observe surface (A.1) — this screen's entire reason for existing is that most visits should end here (C.2).

**Primary User:** Any household member returning to check standing, at any point in a period — not just at period start or period end.

**Entry Points:** Default landing for all Budget entry (Principle 2, B.1), except the Budget Alert deep-link (B.4.1) which bypasses Home entirely.

**Displayed Data:**
- Safe-to-Spend (BUD-000 §4, "Budget Forecast" family — read-model, computed, never stored)
- Budget Health tile (BUD-000 §4 — derived status from Variance: on track / cutting it close / over)
- Variance summary (household-level, with a path to Insights for dimension-level detail)
- Forecast snippet (month-end projection at current pace)
- Current period, from the shared Period Selector (B.3) — always visible, since Home is where period context is set for the whole Budget session

**Primary Actions:**
- Switch period (via the shared Period Selector — a Home interaction that affects all three modes, per PR-1)
- Tap a Budget Alert, if one is active (→ Planning Workspace, per B.4.1's Navigation Contract)

**Secondary Actions:**
- Tap the Variance summary → Insights (Month View), for users who want detail without a specific alert prompting it

**Sections:** Safe-to-Spend (primary, top of screen), Health tile, Variance summary, Forecast snippet, Alert banner (if any threshold crossed — appears above Safe-to-Spend when present, per BUD-001 §3's alert-threshold logic staying Budget-owned)

**Empty State:** Zero Planning Allocations exist for the household (C.1, step 2). Safe-to-Spend/Health/Variance/Forecast are **not** rendered as zeroed — they're replaced entirely by a single call-to-action: set up a household budget, linking to Planning Workspace's Household dimension. This is a distinct state, not a degraded version of the normal state.

**Loading State:** Standard skeleton treatment for each of the four data tiles independently — Safe-to-Spend, Health, Variance, and Forecast may resolve at different times depending on their underlying Allocation Engine queries (ADR-036 §7); no tile blocks another from rendering.

**Error State:** If the Allocation Engine query underlying any tile fails, that tile alone shows a retry affordance — a failure in Forecast, for example, does not block Safe-to-Spend from displaying if that query succeeded independently.

**Navigation:** Tab bar (Home/Planning Workspace/Insights) always visible; Period Selector always visible above the tab bar (B.3).

**Accessibility:** Health tile's status (on track/cutting it close/over) must be conveyed through text/label, not color alone — the tri-state health signal is exactly the kind of information that fails for colorblind users if color-only. Safe-to-Spend and Variance figures need explicit sign (positive/negative) stated in text, not implied by color or icon direction alone, consistent with the Math.abs() bug this same figure already had in the legacy implementation (memory: Budget dashboard "Remaining" tile fix) — the fix was numeric; the accessibility requirement makes sure the UI layer doesn't reintroduce the same ambiguity visually.

**Acceptance Criteria:**
- Home never renders an editable field, under any state (Principle 3 — Observe never edits)
- Empty state and normal state are visually and structurally distinct, not the same layout with zeroed numbers
- Alert banner, when present, deep-links per B.4.1's full contract (Period + Dimension Type + Dimension Identifier)
- All four data tiles are independently loading/error-capable

**Engineering Notes:** Maps to WP-4. Consumes Allocation Engine read APIs only (`getPlanningAllocation`, `getAttributedTotal`, per ADR-036 §7) — Home must not reimplement any monthly-value formula locally, which is the specific duplication this whole migration exists to retire (BUD-001 §1). Carry-Forward display (C.5, step 3) is computed by Budget's read-model layer, not by Home itself (BUD-001 §3 — Carry-Forward "stays Budget-owned").

---

### D.2 Planning Workspace

**Purpose:** The sole Producer interface for Planning Allocations (A.1, PR-2). Answers "what do I want next period to look like?" — and, for a closed period, explains why that question can no longer be answered there (PR-3).

**Primary User:** Any household member with edit rights, either self-initiated (C.3) or arriving via a deep-link from an alert (C.4) or a Variance hand-off (C.2 branch).

**Entry Points:** Home (proactive navigation), Budget Alert deep-link (B.4.1), Insights Variance hand-off (B.4.2), direct tab selection.

**Displayed Data:**
- Dimension tabs: Household, Category, Person, Group (Release 1 Allocation Targets, A.5) — Household active by default on first-time entry (C.1)
- Current allocation value for the active dimension + period
- For a reconciling dimension (e.g., Category against Household total, ADR-036 Invariant 3), the parent total and remaining headroom, shown inline
- Closed-period banner (B.3), shown only when the Period Selector is on a closed period

**Primary Actions:**
- Set or update an allocation amount for the active dimension + period (the one Producer write in the entire module)
- Switch dimension tab within the same period

**Secondary Actions:**
- Switch period via the shared Period Selector (affects Home and Insights too, per PR-1)
- Exit to Home

**Sections:** Dimension tab bar, active dimension's allocation editor, reconciliation/headroom indicator (where applicable per Invariant 3), closed-period banner (conditional)

**Empty State:** No allocation set yet for the active dimension + period — rendered as an empty, immediately-editable field with a clear affordance to enter a value, not as a placeholder "$0" that looks like a real value already saved.

**Loading State:** Standard field-level skeleton while the current allocation value loads; the dimension tab bar itself renders immediately (it doesn't depend on any allocation data to display).

**Error State:** Save failure shows inline against the specific field that failed to save, with the entered value preserved (not cleared) so the user doesn't lose their input on a transient failure — standard for a Producer interface where data loss on error is a real cost, unlike a read-only screen.

**Navigation:** Tab bar and Period Selector always visible, same as Home. Switching dimension tabs does not trigger the Principle-2 return-to-Home behavior (B.5) — that only applies to leaving Planning Workspace entirely.

**Accessibility:** Reconciliation/headroom indicator (Invariant 3) must be readable by screen reader as an explicit numeric relationship ("₹8,000 of ₹20,000 Household budget allocated to Groceries"), not a progress-bar-only treatment. Disabled fields in the closed-period state must be announced as disabled with the banner's reason available to assistive technology, not just visually grayed.

**Acceptance Criteria:**
- No allocation can be saved against a closed period, under any interaction path (PR-3 — enforced at the field level, not just the banner's presence)
- Every deep-link entry point satisfies the full B.4.1 Navigation Contract (Period, Dimension Type, Dimension Identifier) or falls back to the specified default (Household, given Period only)
- Reconciliation constraint (Invariant 3) is visible at the moment the user would exceed it, not only surfaced as a save-time error (C.3, step 4)
- Closed-period banner text matches B.3's specified copy exactly, not a paraphrase

**Engineering Notes:** Maps to WP-4 (the editor itself) and UX-001 (visual/interaction design, explicitly out of BUD-002's authority per your original scoping — this spec defines structure and behavior, not final visual treatment). The one Producer write path in Budget goes through the Allocation Engine's interface (ADR-036 §7), never to local component state that's synced elsewhere — this is the specific anti-pattern (six duplicate reads, two dead modals) BUD-001 §3 exists to retire.

---

### D.3 Insights

One screen specification, not four — the four views are modes of a single analytical workspace, not independent screens. Shared elements (Purpose, Layout, Navigation, Filters, and the acceptance criteria that apply regardless of view) are specified once; each view then adds only what's actually different about it.

**Purpose:** Answer "why did this happen?" — the Understand surface (A.1). Reports on Attribution, never Planning.

**Primary User:** A household member who has already checked standing on Home (C.2) and wants to understand a specific figure, or who visits Insights directly for a periodic deeper review.

**Entry Points:** Tab bar (direct), Home's Variance summary (C.2 branch, lands on Month view).

**Shared Layout:** Sub-view selector at the top (Month / Category / Person / Summary), shared Period Selector above that (B.3, PR-1), primary data visualization area below — visualization shape changes per view (breakdown / trend / trend / roll-up) but occupies the same layout region across all four.

**Shared Navigation:** Tab bar and Period Selector always visible, consistent with Home and Planning Workspace. Sub-view switch is a within-screen state change, not a tab-bar-level navigation event (doesn't affect B.5's back-stack behavior). Every view's Variance-figure tap uses the same hand-off: → Planning Workspace deep-link (B.4.2), satisfying the full B.4.1 Navigation Contract.

**Shared Filters:** Dimension-type filter (Category / Person / Group), available on Month view and Summary view; not applicable to Category view or Person view, which are already scoped to a single dimension instance by definition.

**Shared Data Source:** All four views read exclusively via `getAttributions`/`getAttributedTotal` (ADR-036 §7). No view has a write path — this is enforced identically across all four, not configured per-view.

---

**View A — Month:** Category-by-category (and Person-by-Person) breakdown of Attribution for the selected period, against each dimension's Planning Allocation. Default landing view for Insights, and the target of the C.2 Home hand-off.

**View B — Category:** Single category's Attribution trend across multiple periods. Entered by drilling into a specific category from Month view.

**View C — Person:** Single person's Attribution trend across multiple periods, distinguishing `mode: "spent_on"` from `mode: "owes"` per the frozen CBR (`CBR-TRX-person-attribution-semantics.md`) — see Business Correctness, below.

**View D — Summary:** Household-level roll-up across all dimensions for the selected period.

---

**Empty State (all views):** No Attribution data exists for the selected period (e.g., a newly-onboarded household with no transactions yet) — distinct copy per view, consistently framed as "nothing to report yet," not an error.

**Loading State (all views):** Standard skeleton per view; Summary (aggregating across dimensions) may load slower than Month and should not block the sub-view selector itself from being interactive.

**Error State (all views):** Query failure shows inline with retry; does not block navigation to other views or back to Home/Planning Workspace.

**Accessibility (all views):** Person view's `spent_on`/`owes` distinction must be conveyed in text/label form, not solely through a visual treatment (e.g., color-coding) that a screen reader user would miss — this is a correctness issue, not just a styling one (see Business Correctness).

---

**Shared Acceptance Criteria:**
- No view ever renders a write action against a Planning Allocation directly (Principle 4 — enforced identically across all four views)
- Every Variance-to-Planning-Workspace hand-off satisfies B.4.1's Navigation Contract
- Sub-view switching preserves the current Period Selector state (PR-1) — switching from Month to Person does not reset the period

**View-specific Acceptance Criteria:**
- **Month:** Breakdown totals reconcile against Summary's household-level figure for the same period — the two views must never disagree about the same underlying data.
- **Category:** Trend spans at minimum the trailing 6 periods, or however many periods of Attribution data exist if fewer than 6.
- **Person:** See Business Correctness, below — this is the one view-specific criterion elevated above the others.
- **Summary:** Roll-up includes every Release 1 Allocation Target (A.5) with any Attribution in the period; a dimension with zero Attribution is shown as zero, not omitted (an omitted row is indistinguishable from "no such dimension exists," which is false).

**Business Correctness:**

> **Person-based Insights must respect the canonical attribution rules defined by `CBR-TRX-person-attribution-semantics.md` (`mode: "spent_on"` vs. `mode: "owes"`). No view may reinterpret these semantics.**
>
> Only `spent_on` entries count toward Budget-relevant Person spend; `owes` entries represent a receivable, not attributable household spend, and must be excluded from every Person-view figure that claims to represent spend. This is stated as a Business Correctness Criterion rather than an implementation detail because Insights is the screen where a household trusts the numbers — a formatting error here degrades the UI, but a semantics error here produces a wrong number the user acts on. Any implementation that sums `t.people` without filtering by mode (the exact defect already confirmed and fixed once, per `CR-ACC-BUD-001` §7) is non-compliant with this screen spec, not merely visually imperfect.

**Engineering Notes:** Maps to WP-5. Consumes `getAttributions`/`getAttributedTotal` (ADR-036 §7) exclusively — Insights has no write path anywhere, which should be enforceable at the API-consumption level (Insights' code should have no import path to any Allocation Engine write/producer interface), not just as a UX convention that a future screen could accidentally violate.

---

## E. Components

Reorganized as design primitives, not a per-screen widget list — the point of a component catalogue is that a component's existence is independent of which screen currently uses it. Every component ends with a metadata block specifically so a later question like *"can Goals reuse the Progress Ring?"* is answerable by reading this section, not by reverse-engineering the running app.

**Metadata fields, and why there are four of them, not three:** A component has two independent timelines, not one — when it's first built (**First Introduced**), and when additional screens start using it (**Later Consumers**), which may land in a later work package entirely. Collapsing both into a single "Release" field was overloading it with two different facts; keeping them separate means the metadata stays accurate even when a component's adoption outlives its origin. **Owner** is the mode/screen whose data model or interaction contract the component is defined against — the place a change to the component's behavior must be approved. **Editable** states whether the component itself is a write surface (governed by PR-2) or strictly read-only. A component owned by Planning Workspace but consumed read-only by Home (e.g., a rendering of an Allocation figure) is not a PR-2 violation — PR-2 governs *writes*, and read-only consumption of Planning-owned data elsewhere is exactly what ADR-036 §7's Consumer list already permits.

```
Owner:              [mode/screen that owns the contract]
First Introduced:   [WP + which screen(s) consume it at launch]
Later Consumers:    [WP + screen, for each consumer added after launch — or "None"]
Editable:           [Yes / No]
```

---

### Group 1 — Foundation

**Period Selector**
Purpose: single shared control for the active Financial Calendar period (B.3, PR-1).
Owner: Home (defines the default-period logic, B.3)
First Introduced: WP-4 (Home, Planning Workspace, Insights — all three consume it from launch, per PR-1)
Later Consumers: None
Editable: Yes (selection only — does not edit period definitions themselves, which are ADR-037's concern)

**Tab Bar**
Purpose: the three-mode navigation (A.3) — Home / Planning Workspace / Insights.
Owner: Budget (module-level, not owned by any single mode)
First Introduced: WP-4 (Home, Planning Workspace, Insights)
Later Consumers: None
Editable: No

**Page Header**
Purpose: consistent title/context bar per screen, showing current mode and (where relevant) active dimension.
Owner: Budget (module-level)
First Introduced: WP-4 (Home, Planning Workspace, Insights)
Later Consumers: None
Editable: No

**KPI Card**
Purpose: generic single-figure display primitive (a label, a number, a trend indicator) — the base shape that Safe-to-Spend Card and Forecast Card (Group 3) both specialize.
Owner: Home
First Introduced: WP-4 (Home)
Later Consumers: WP-5 (Insights, Summary view)
Editable: No

---

### Group 2 — Planning

**Allocation Card**
Purpose: displays a single dimension's current allocation for the active period, in Planning Workspace's dimension tabs.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: Yes

**Allocation Row**
Purpose: list-item primitive for showing multiple allocations at once (e.g., all Category allocations under Household) — the building block Allocation Card composes for multi-item views.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: Yes (each row independently)

**Allocation Editor**
Purpose: the actual input surface for setting/changing an allocation amount — the field-level component behind Allocation Card's edit state. This is the component UX-001 designs the interaction/visual detail for; BUD-002 specifies only its structural role.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: Yes

**Dimension Picker**
Purpose: the tab/selector for choosing which dimension (Household/Category/Person/Group) is active in Planning Workspace.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: No (selection only, not the dimension data itself)

**Allocation Summary**
Purpose: read-only roll-up of all allocations across dimensions for the active period — used at the top of Planning Workspace and reused inside Insights' Summary view (D.3, View D) as the same underlying shape viewed read-only.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: WP-5 (Insights, Summary view)
Editable: No

---

### Group 3 — Analytics

**Insight Tile**
Purpose: generic analytical-finding display — the base shape Month/Category/Person breakdowns render as.
Owner: Insights
First Introduced: WP-5 (Insights)
Later Consumers: None
Editable: No

**Progress Ring**
Purpose: circular progress indicator for Health/Variance-against-allocation display.
Owner: Home (Health tile, D.1)
First Introduced: WP-4 (Home; Planning Workspace's headroom indicator, D.2, ships in the same WP)
Later Consumers: WP-5 (Insights)
Editable: No

**Variance Bar**
Purpose: linear plan-vs-actual comparison, the primary visualization inside Month view.
Owner: Insights
First Introduced: WP-4 (Home, Variance summary, D.1 — Home's need for it ships ahead of Insights')
Later Consumers: WP-5 (Insights, Month view)
Editable: No

**Trend Chart**
Purpose: multi-period line/bar visualization behind Category view and Person view.
Owner: Insights
First Introduced: WP-5 (Insights)
Later Consumers: None
Editable: No

**Forecast Card**
Purpose: month-end projection display, specializing KPI Card.
Owner: Home
First Introduced: WP-4 (Home)
Later Consumers: None
Editable: No

**Safe-to-Spend Card**
Purpose: the primary figure on Home, specializing KPI Card.
Owner: Home
First Introduced: WP-4 (Home)
Later Consumers: None
Editable: No

---

### Group 4 — Feedback

**Alert Banner**
Purpose: one primitive, configured by severity/icon/title/message/action — never a separate component per context. The same Alert Banner renders the crossed-threshold warning on Home and the closed-period notice on Planning Workspace (B.3); what changes is configuration, not the component:

| Configuration | Severity | Example title | Example action |
|---|---|---|---|
| Overspending threshold crossed (Home) | 🔴 High | "Groceries at 92% of budget" | "Review allocation" → Planning Workspace deep-link (B.4.1) |
| Closed Period (Planning Workspace) | 🟡 Medium | "This period is closed" | "View Transactions" |
| Informational (e.g., Carry-Forward applied, C.5 step 3) | 🔵 Low | "Forecast updated" | none required |

Owner: Budget (module-level — threshold logic is Budget-owned per BUD-001 §2)
First Introduced: WP-4 (Home, Planning Workspace)
Later Consumers: None
Editable: No

**Empty State**
Purpose: the distinct-not-degraded empty treatment specified per screen in Part D (D.1's setup call-to-action, D.2's empty allocation field, D.3's "nothing to report yet").
Owner: Budget (module-level)
First Introduced: WP-4 (Home, Planning Workspace)
Later Consumers: WP-5 (Insights)
Editable: No

**Validation Message**
Purpose: inline messaging for reconciliation constraints (ADR-036 Invariant 3, D.2's headroom check) and save errors.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: No

**Success Toast**
Purpose: confirms a Planning Allocation save completed — the one Producer action's positive-path feedback.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: No

---

### Group 5 — Navigation

**Breadcrumb**
Purpose: shows the deep-link origin when Planning Workspace is entered via B.4.1 (e.g., "From: Groceries Alert") — gives the user context for *why* they landed where they did, since alert deep-links skip the normal Home-first path (Principle 2's one exception).
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: No

**Deep-link Banner**
Purpose: the pre-scoping confirmation shown on Planning Workspace entry via a deep-link — distinct from Breadcrumb in that it states *what* is pre-scoped (Period + Dimension Type + Dimension Identifier, per B.4.1's contract), not just where the user came from.
Owner: Planning Workspace
First Introduced: WP-4 (Planning Workspace)
Later Consumers: None
Editable: No

**Filter Bar**
Purpose: the dimension-type filter on Insights' Month and Summary views (D.3, Shared Filters).
Owner: Insights
First Introduced: WP-5 (Insights)
Later Consumers: None
Editable: No

---

## F. Design Rules

**Source and its limits, stated up front:** Design Input #1 is `Arth_app_design_specification.zip` (uploaded 2026-08-06), a 16-screen exploratory mockup dated 2026-08-04 — predating ADR-036/037 and this document. Its "Budgets" and "Insights" screens (§7, §8 of the mockup) use a materially different IA than what's frozen in Parts A–D (a single flat budget list, no Observe/Plan/Understand separation, no shared Period Selector, an "Insights" screen that's Financial-Health/Cashflow/Net-Worth rather than Budget's Month/Category/Person/Summary) — **so screen layout from the mockup is not used here at all**, consistent with your earlier instruction not to copy its IA. What *is* used: the raw visual tokens (color, type, radius, spacing, shadow) extracted directly from the mockup's markup, not eyeballed. **You flagged the prototype itself as "not final,"** so this Part F is a rationalized proposal built from that raw material, not a frozen system — treat everything below as open to a real design pass, not as something to build against yet.

**What the raw extraction actually showed:** the mockup's values are exploratory, not a maintained system — 19 distinct font-sizes, 9 distinct border-radii, and spacing values that mostly-but-not-quite follow a 4px grid, all used ad hoc across 16 screens by whoever built the prototype in one pass. Presenting that raw soup as "the design system" would just relocate the inconsistency BUD-000 found in the *code* into the *design spec* instead. So F.1–F.4 below rationalize the raw values into a coherent scale, and F.5 states plainly where no source material existed at all.

### F.1 Typography

**Font families (directly from the mockup, no rationalization needed — these were already consistent across all 16 screens):**
- **Space Grotesk** — all UI text (headers, labels, body)
- **IBM Plex Mono** — all numeric/currency values, without exception (every ₹ figure in the mockup, across Budgets/Insights/Home, uses the mono face — this is a real, consistent pattern worth keeping as a hard rule: **any monetary or numeric figure in Budget renders in IBM Plex Mono; UI chrome around it renders in Space Grotesk.**)

**Type scale — rationalized from 19 raw values down to 8 steps** (raw values in parens, showing which ones each step absorbs):

| Step | Size | Weight | Raw values absorbed | Usage |
|---|---|---|---|---|
| Display | 32px | 700 | 30, 32, 44* | Screen-level hero figures (*44px appeared once, on a single large figure — treat as an outlier needing its own confirmation, not folded in blindly) |
| H1 | 26px | 700 | 26 | Screen title ("Budgets", "Insights") |
| H2 | 22px | 600 | 22, 24 | Section-level emphasis (e.g., net-worth figure) |
| H3 | 19px | 600 | 18, 19 | Card-level emphasis |
| Body | 16px | 500–600 | 16 | Primary card content |
| Label | 14px | 400–600 | 13.5, 14, 14.5 | Row labels, primary UI text |
| Caption | 13px | 400–500 | 12.5, 13 | Secondary figures, muted values |
| Micro | 11px | 400–600 | 10, 10.5, 11, 11.5, 12 | Timestamps, chart axis labels, uppercase eyebrow text |

**Rationalization note — provisional, not settled:** the raw mockup's half-point sizes (12.5, 13.5, 14.5) look like manual per-screen tuning rather than a deliberate sub-scale, and the table above folds them into the nearest whole step on that assumption. **You've asked to review the raw values yourself before this is treated as confirmed** — so the 8-step scale above is the working default for anyone building against this document today, but is explicitly flagged as pending your own pass over the raw prototype markup, not a closed decision. See Known Open Items (F.5).

### F.2 Color System

The mockup uses OKLCH throughout — confirmed as the color space to keep, matching BUD-000's earlier "Proposed redesign vision" note about a dark, branded system. Extracted and organized into semantic roles rather than kept as a flat list of 45 raw values:

**Neutral scale** (hue 95, chroma 0.005–0.008 — near-gray with a warm cream undertone):
| Role | Value |
|---|---|
| Page background | `oklch(96% 0.005 95)` |
| Card background | `oklch(99.5% 0.001 95)` |
| Card border | `oklch(90% 0.006 95)` |
| Track/divider background | `oklch(92% 0.006 95)` |
| Text — primary | `oklch(19% 0.008 95)` |
| Text — secondary | `oklch(45% 0.008 95)` |
| Text — tertiary/muted | `oklch(63% 0.008 95)` |

**Accent (Teal, hue 195)** — the brand/primary accent, used for progress fills, links, and the "on track" state:
| Role | Value |
|---|---|
| Primary accent | `oklch(58% 0.14 195)` |
| Accent hover/pressed | `oklch(48% 0.14 195)` |
| Accent, dark-surface variant | `oklch(70% 0.12 195)` |

**Status colors** — extracted from where the mockup actually used non-neutral, non-teal color with clear semantic intent (over-budget bars, health score, expense vs. income):
| Status | Value | Confirmed usage in mockup |
|---|---|---|
| Positive / on-track (Green, hue 150) | `oklch(58% 0.13 150)` | Financial Health "Good" label, positive trend indicator |
| Warning / over-threshold (Red, hue 25) | `oklch(58% 0.16 25)` | Shopping category rendered in red once its bar hit 100%+, Expense-series bars |

**Direct mapping to Budget Health (D.1) and the closed-period Alert Banner (E, Group 4) — confirmed:** the mockup's own red-at-100%+ pattern on the Budgets screen (line 447–448 of the source) is reused as-is for both Budget Health's "over" state and the closed-period Alert Banner's warning tier. Both use the same danger red rather than splitting closed-period into a separate neutral/informational color — a deliberate decision, not a default.

**Dark surface** (hue 250, chroma 0.03, 23% lightness) — used once, for the Net Worth card on the mockup's Insights screen, as an inverted dark card on an otherwise light page:
| Role | Value |
|---|---|
| Dark card background | `oklch(23% 0.03 250)` |
| Text on dark card | `oklch(75–80% 0.02–0.1 250)` range, white for primary figures |

**Not adopted into Budget's palette:** the mockup also contains a categorical color set (pink/hue 330, blue/hue 220, purple/hue 275, amber/hue 80) used for the category-breakdown pie chart on its Insights screen. These look like a per-category tagging palette (one hue per category) rather than a Budget-specific system color — flagged as **out of scope for Part F**, since Category identity/color belongs to Categories (per Part A's ownership boundary — Budget references dimensions, never owns their identity), not to Budget's own design rules.

### F.3 Spacing & Radius

**Spacing — rationalized to a 4px-based scale** (the mockup's raw values cluster near this grid but aren't strictly on it — 3px, 5px, 6px, 10px, 14px, 18px appear as often as clean multiples of 4):

| Token | Value |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 12px |
| lg | 16px |
| xl | 20px |
| 2xl | 24px |
| 3xl | 32px |
| 4xl | 48px |

Odd raw values (14px, 18px specifically, which appeared often enough to not be accidents) are treated as **half-steps between lg and xl** — used in the mockup for card internal padding specifically. **Provisional, same status as F.1's type scale:** this is the working default, pending your own review of the raw values (Known Open Items, F.5) — not a closed decision on whether Budget adopts a true 4px grid or keeps the half-step.

**Border radius — rationalized from 9 raw values to 4 roles:**

| Role | Value | Raw values absorbed |
|---|---|---|
| Small (chips, badges, progress-bar tracks) | 4px | 2, 3, 4, 5 |
| Medium (buttons, tab pills) | 9–12px | 6, 7, 8, 9 |
| Card (the dominant card radius in the mockup — used far more than any other single value) | 18px | 14, 16, 18 |
| Large (hero/summary cards — Total Budget card specifically used a bigger radius than category cards beneath it) | 20–24px | 20, 24 |
| Pill (fully rounded — tab bar selector background) | 100px | 100 |

**Direct application:** Budget's Total-Budget-equivalent (Home's Safe-to-Spend Card) should use the Large radius, matching the mockup's own hierarchy of "the one big number gets a bigger radius than the list beneath it" — this is a real, repeated pattern in the mockup, not an invented rule.

### F.4 Elevation & Cards

Only 3 shadow values appeared across all 16 screens — genuinely sparse, likely because the mockup relies on the `oklch(90% 0.006 95)` 1px border for card separation rather than shadow, which is itself a usable design decision:

| Elevation | Shadow | Usage in mockup |
|---|---|---|
| Flat (default card) | none — 1px border only | Every standard card |
| Raised (selected/active state) | `0 1px 2px rgba(0,0,0,0.06)` | Active tab-pill background |
| Prominent (rare, high-emphasis) | `0 8px 20px oklch(58% 0.14 195 / 0.4)` | Appeared once, on what looked like a primary CTA button — not confirmed against Budget's own component set |

**Applied to Part E's components:** Allocation Card, KPI Card, Insight Tile, and all standard cards default to Flat (border-only). Alert Banner and Success Toast, being transient/attention-seeking, are candidates for Raised — not decided here, flagged for the real design pass.

### F.5 Known Open Items — tracked, not blocking

Per your decision, BUD-002 v1.0 freezes with these items open rather than holding the freeze for them. They are tracked here as the canonical list of what's *not yet decided*, so "frozen" doesn't quietly come to mean "silent about its own gaps":

| # | Item | Status | Where it matters |
|---|---|---|---|
| 1 | Type scale rationalization (F.1) — whether the half-point sizes (12.5/13.5/14.5px) were intentional | **Pending your own review of the raw prototype values.** F.1's 8-step scale is the working default until then. | Every text element in D.1–D.3 |
| 2 | Spacing half-steps (F.3) — whether 14px/18px stay as a real half-step or snap to the strict 4px grid | **Pending your own review**, same as #1. F.3's scale is the working default until then. | Card internal padding across all three screens |
| 3 | Motion — timing, easing, what animates vs. snaps | **No source material exists.** Needs a real design pass. | Progress Ring on load, closed-period banner entrance, Success Toast, tab switching |
| 4 | Iconography — library, style (line/filled/duotone), sizing | **No source material exists.** Needs a real design pass. | Every icon-bearing component in Part E (Alert Banner's severity icon, Breadcrumb, etc.) |
| 5 | Responsive behavior — tablet/desktop/landscape | **No source material exists.** Mockup is fixed at one mobile frame (402×874). | Any non-mobile Arth client |
| 6 | Accessibility visual treatment — exact contrast ratios, label placement for D.1's Health-tile and sign-not-color requirements | **No source material exists.** Requirements are stated in Part D; visual execution isn't. | D.1 Accessibility, D.3 Accessibility |
| 7 | Shadow "Prominent" tier (F.4) — confirmed against a single mockup element, not verified against any Budget component | **Provisional**, lower priority than 1–6. | Alert Banner / Success Toast elevation, if Raised tier is adopted |

None of these block WP-4/WP-5 from starting UI implementation against Parts A–E (behavior) and F.1–F.4 (as the working visual default) — they block only the specific, narrower decisions listed above, which can be resolved incrementally without reopening the frozen document.

---

*Part F drafted as a proposal, not frozen — per your note that the prototype isn't final. BUD-002 status remains Awaiting Visual Baseline until F.1–F.5 above get an explicit pass/confirm, particularly the rationalization calls in F.1 (half-point sizes), F.3 (14/18px half-steps), and F.5 (the four genuinely open areas).*

---

## G. Engineering Mapping

Four mappings, each read directly off Parts D and E rather than re-decided here — this section has no new content, only reorganized traceability.

### G.1 Screen → Work Package

| Screen | Work Package(s) | Note |
|---|---|---|
| Home | WP-4 | |
| Planning Workspace | WP-4 (build) · UX-001 (interaction/visual design, owned by Product/Design per BUD-003) | WP-4 blocks on UX-001 per BUD-003's dependency table, not just on WP-1 |
| Insights (all 4 views) | WP-5 | Depends on WP-4 (BUD-003: "WP-5 needs WP-4") |

### G.2 Component → Work Package

Read directly from each component's **First Introduced** field in Part E — reproduced here as a single table rather than a re-derivation:

| Component | First Introduced | Later Consumers |
|---|---|---|
| Period Selector | WP-4 | — |
| Tab Bar | WP-4 | — |
| Page Header | WP-4 | — |
| KPI Card | WP-4 | WP-5 |
| Allocation Card | WP-4 | — |
| Allocation Row | WP-4 | — |
| Allocation Editor | WP-4 | — |
| Dimension Picker | WP-4 | — |
| Allocation Summary | WP-4 | WP-5 |
| Insight Tile | WP-5 | — |
| Progress Ring | WP-4 | WP-5 |
| Variance Bar | WP-4 | WP-5 |
| Trend Chart | WP-5 | — |
| Forecast Card | WP-4 | — |
| Safe-to-Spend Card | WP-4 | — |
| Alert Banner | WP-4 | — |
| Empty State | WP-4 | WP-5 |
| Validation Message | WP-4 | — |
| Success Toast | WP-4 | — |
| Breadcrumb | WP-4 | — |
| Deep-link Banner | WP-4 | — |
| Filter Bar | WP-5 | — |

**Consequence for sequencing:** every component WP-5 needs either already exists from WP-4 (KPI Card, Allocation Summary, Progress Ring, Variance Bar, Empty State) or is WP-5-native (Insight Tile, Trend Chart, Filter Bar). No component requires a WP-6 or later dependency — consistent with BUD-003's WP-6 being cleanup-only (legacy code removal), never new component work.

### G.3 Component → Screen

Reverse index of Part E's per-component "Owner" and consumption notes, grouped by screen rather than by component:

| Screen | Components used |
|---|---|
| Home | Period Selector, Tab Bar, Page Header, KPI Card, Progress Ring (Health tile), Variance Bar (Variance summary), Forecast Card, Safe-to-Spend Card, Alert Banner, Empty State |
| Planning Workspace | Period Selector, Tab Bar, Page Header, Allocation Card, Allocation Row, Allocation Editor, Dimension Picker, Allocation Summary, Progress Ring (headroom indicator), Alert Banner (closed-period), Empty State, Validation Message, Success Toast, Breadcrumb, Deep-link Banner |
| Insights | Period Selector, Tab Bar, Page Header, KPI Card (Summary view), Allocation Summary (Summary view), Insight Tile, Progress Ring, Variance Bar (Month view), Trend Chart (Category/Person views), Empty State, Filter Bar |

### G.4 Screen → ADR / Governance Dependency

| Screen | Depends on | Why |
|---|---|---|
| Home | ADR-036 (Allocation Engine, read-only) · ADR-037 (Financial Calendar, period boundaries) · ADR-024 (Financial Model — confirmed compliant, no drift, per BUD-000A §5) · BUD-001 §2 (Notifications boundary, for Alert Banner delivery/dismissal) | Home is a pure Consumer (ADR-036 §7); every figure it shows is a read-model over Allocation Engine + Financial Calendar data, and its Alert Banner's threshold logic must stay ADR-024-compliant (commitments never double-count against Safe-to-Spend) |
| Planning Workspace | ADR-036 (Allocation Engine, the sole Producer — Invariants 1–5 all apply directly) · ADR-037 (period boundaries gate PR-3's edit restriction) · ADR-025 (Person/Group allocation semantics, Rule 2) | The only screen where ADR-036's Invariant 3 (reconciliation) and Invariant 5 (dimensional orthogonality) are actually exercised by a write path, not just read |
| Insights | ADR-036 (Attribution reads, Invariant 4 — non-reconciling, per-dimension completeness) · `CBR-TRX-person-attribution-semantics.md` (Business Correctness, D.3) · ADR-025 Rule 3 (Transactions as single source of truth) | Insights is where ADR-036's Invariant 4 distinction (Category's completeness rule vs. Person's) becomes user-visible, and where a CBR violation would be a wrong number shown to the user, not just an internal inconsistency |

---

## H. Acceptance Criteria

Two layers: module-level criteria that apply regardless of which screen is being tested, and per-screen criteria that consolidate (not duplicate) what Part D already specified — each line below is traceable to where it was actually decided, not restated as if newly invented here.

### H.1 Module-level (applies to all of Budget)

| # | Criterion | Traces to |
|---|---|---|
| M-1 | Period Selector state is identical across Home, Planning Workspace, and Insights at all times — switching period in one mode and tabbing to another shows the same period, never a stale one. | PR-1, B.3 |
| M-2 | No write to a Planning Allocation occurs from any surface other than Planning Workspace. | PR-2, A.2, A.4 |
| M-3 | No allocation write succeeds against a closed period, under any interaction path, including deep-link entry. | PR-3, B.3, D.2 |
| M-4 | Every deep-link into Planning Workspace satisfies the Navigation Contract (Period, Dimension Type, Dimension Identifier) or falls back to the specified default (Household, Period-only). | B.4.1 |
| M-5 | Home's default-entry rule (land on Home) holds for every entry path except the two specified deep-links (Alert, Variance hand-off). | B.1, B.4 |
| M-6 | Person-based figures anywhere in Budget (Home, Planning Workspace, or Insights) exclude `mode: "owes"` from attributed spend. | `CBR-TRX-person-attribution-semantics.md`, D.3 Business Correctness |
| M-7 | No screen reimplements a monthly-value or variance formula locally — every figure is sourced from the Allocation Engine's query APIs (`getPlanningAllocation`, `getAttributedTotal`, `getAttributions`). | BUD-001 §1, ADR-036 §7 |

### H.2 Home

- Renders correctly in all four states (normal, empty, loading-per-tile, error-per-tile) as distinct treatments, not variations of one layout. (D.1)
- Never renders an editable field under any state. (Principle 3, M-2)
- Alert Banner, when present, is the only element that can trigger navigation away from Home before the user has read the standing figures — no other tap target on Home leaves the screen except intentional navigation (tab bar, period switch). (D.1, B.4.1)
- Health tile's status is conveyed through label text, not color alone; Safe-to-Spend/Variance signs are stated explicitly, not implied. (D.1 Accessibility)

### H.3 Planning Workspace

- Household dimension is active by default on first-time entry (zero allocations); the correct dimension/period is pre-selected on every deep-link entry. (C.1, D.2)
- Reconciliation constraint (Invariant 3) surfaces at the moment of the edit that would exceed it, not deferred to a save-time error. (C.3 step 4, D.2)
- Closed-period banner text matches B.3's specified copy exactly; every field is disabled in that state, not merely styled to look disabled. (B.3, D.2, M-3)
- A save failure preserves the user's entered value and reports the error against the specific field, never a silent failure or a cleared input. (D.2 Error State)

### H.4 Insights

- Month view's totals reconcile against Summary view's household-level figure for the same period — no discrepancy between the two views over the same underlying data. (D.3 View-specific Acceptance Criteria)
- No sub-view renders a write action against a Planning Allocation, under any configuration. (Principle 4, M-2)
- Person view correctly excludes `mode: "owes"` — verified against the CBR, not just visually distinguished. (D.3 Business Correctness, M-6)
- Summary view's roll-up includes every Release 1 Allocation Target with any Attribution in the period, including zero-value dimensions shown as zero, never omitted. (D.3 View-specific Acceptance Criteria)

---

## I. Future Expansion

Two categories: items already carried in BUD-003's Deferred Streams (DS-1–DS-9), restated here with the reason each stays out of Release 1; and items this document surfaced that **are not yet in BUD-003 at all** — flagged as gaps to formally add, not silently treated as already approved.

### I.1 Already Deferred (BUD-003, canonical)

| ID | Item | Why deferred |
|---|---|---|
| DS-1 | Reports Integration | Reports consumes Attribution independently of Budget's own release; not gated on Budget's WPs (BUD-001 §8) |
| DS-2 | AI Integration | AI consumes both Planning and Attribution read-only (ADR-036 §5); no Release 1 dependency |
| DS-3 | Event Dimension | Blocked on the ADR-035A-equivalent Addendum (BUD-001A) — Event is not yet decided as a genuine Allocation Engine dimension (A.5) |
| DS-4 | Vehicle Dimension | Same Addendum, same undecided status as DS-3 |
| DS-5 | Telemetry | None exists in Budget today (BUD-000 audit); adding it is a product decision not made here |
| DS-6 | Category Month Overrides | Flat-only category budgets remain flat-only for Release 1 |
| DS-7 | Budget Templates | Not scoped |
| DS-8 | Budget Cloning | Not scoped |
| DS-9 | Advanced Forecasting (beyond Release 1's Budget Projection) | Distinct from ADR-024's frozen Forecast Status (BUD-000A Ambiguity 2's naming note) |

### I.2 Proposed Future Capabilities (Not Yet Backlog Items)

These came up naturally while specifying Parts A–E but have no DS number and no prior approval anywhere in the project's governance chain. They are ideas surfaced by this document, not approved backlog — listed here so they have a documented home, but deliberately **not** assigned a DS number, since minting one inside a UX spec would let new scope enter the project outside the process BUD-003 already established for everything else in Part I.1.

- **Budget History / Snapshots** — BUD-000 §4 candidate object ("Budget Snapshot — does not exist today in any form"); Part A.5 explicitly excluded it from Release 1 IA. *Requires a BUD-003 amendment before it's a real backlog item.* Two related-but-distinct concepts (a log of past periods vs. a frozen point-in-time record) worth separating when that amendment is proposed.
- **Scenario Planning / What-if Analysis** — from your original Future Expansion sketch; doesn't trace to a repository finding the way DS-1–DS-9 do. *Requires a BUD-003 amendment before it's a real backlog item.* Also needs a scoping pass to determine whether it's a Budget capability at all, or belongs to the Forecast Engine (ADR-024).

**Both items stay proposals until BUD-003 is formally amended.** This document does not promote them into the roadmap by naming them.

---

*Document status: BUD-002 v1.0 — Frozen. All ten parts (0, A–I) complete. Seven items remain open per F.5's tracked list — none block WP-4/WP-5 implementation against this document. This is the canonical product specification for the Budget module going forward.*
