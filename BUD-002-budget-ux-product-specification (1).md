# BUD-002 — Budget UX & Product Specification

**Version:** 1.0 (Draft)
**Status:** Draft for review — Parts 0, A, B drafted below. Parts C–I pending.
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
| **Plan** (Planning) | "What do I want next period to look like?" | The sole Producer of Planning Allocations | Allocation editor — Household, Category, Person, Group dimensions |
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
├── Planning       (Plan)
└── Insights       (Understand)
```

Deliberately flat — three siblings, no nesting, matching ADR-036 Invariant 5's "dimensions remain orthogonal" principle applied one level up: modes don't nest inside each other any more than dimensions nest inside each other.

### A.4 Cross-mode links (the one exception to strict separation)

Strict separation of Observe/Plan/Understand does not mean the modes are unreachable from each other — it means that reaching another mode is always an explicit *navigation*, never an in-place edit. The one designed cross-link:

- **A Budget Alert on Home (Observe), when tapped, navigates to Planning (Plan), pre-scoped to the dimension that triggered it.** E.g., an 80%-threshold alert on the "Groceries" category opens Planning with the Category tab active and Groceries focused — it does not open an inline editor on Home itself. This preserves the Observe/Plan boundary (Home still never edits) while keeping the alert-to-action path short.
- Similarly, a Variance figure in Understand may deep-link back to Planning for the relevant dimension/period, for the same reason: understanding *why* naturally leads to adjusting *what's planned*, and that adjustment always happens in Plan.

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

Budget is reached as its own top-level entry point from wherever the app's primary navigation places it (bottom nav tab or drawer item — that decision belongs to the app-level IA, not to this document, and is not made here). What *is* specified: entry always lands on **Home (Observe)**, never on Planning or Insights, regardless of entry path — with one exception (B.4, alert deep-links).

**Rationale:** Observe is the zero-commitment mode — it answers a question without requiring the user to have already decided to edit or dig into analytics. Landing anywhere else would front-load a decision (edit something, or interpret a report) before the user has even seen where they stand.

### B.2 Tab structure

Three persistent tabs, always visible while inside Budget, matching the A.3 tree exactly:

```
[ Home ]   [ Planning ]   [ Insights ]
```

No tab is conditionally hidden. Even a household with no allocations set yet sees all three — Planning's empty state (Part D) is the on-ramp for a first-time setup, not a hidden tab that appears only after some other action.

### B.3 The Period Selector — shared, not per-tab

Because the Financial Calendar (ADR-037) is a shared platform capability that all three modes consume identically, Budget has **one period selector, positioned above the tab bar, shared across all three modes** — not three independent selectors. Switching the period while on Insights and then tabbing to Planning shows Planning for that same period; the selection persists across mode switches within a Budget session.

This directly resolves one of BUD-000's confirmed findings: today's `viewMonth` is an implicit, inconsistently-resolved string key duplicated six times across the app. A single, shared period selector is the concrete UI expression of ADR-037 existing as a platform capability rather than something each mode reimplements — there is exactly one place in Budget's UI where "what period am I looking at" is decided.

**Default period on entry:** the current calendar month (or current fiscal year, if the household's configured Budget Policy is FY-based — Part D defines this per Home's landing state). Navigating to a past or future period is supported in all three modes, but Plan restricts *editing* to the current and future periods only.

**Product rule — Closed periods are immutable for planning.** This is stated as a product rule, not a UX convenience, because it's the direct consequence of the Transactions/Budget boundary this entire document is built on (Section 0): Transactions own historical facts; Budget owns future intent. A closed period's plan is itself now a historical fact — allocated, measured, done. Allowing edits to it would mean Budget quietly started rewriting history instead of planning it. Corrections to what actually happened belong in Transactions, not Budget. If a genuine need for retroactive plan correction emerges later (e.g., an admin-unlock capability for closed periods), that is a separate, deliberately-scoped feature with its own governance decision — never a quiet loosening of this rule inside Plan's normal editing flow.

### B.4 Deep-links (entry that bypasses B.1's default)

Two specified deep-link paths, both already justified in A.4:

1. **Budget Alert tap (from Home itself, or from a notification generated by Home's Alert logic)** → lands directly on Planning, dimension and period pre-scoped, bypassing the B.1 default landing on Home. This is the one case where entry does not land on Home, because the user is already past Observe — the alert *is* the Observe finding that prompted the visit.
2. **Variance figure tap, from within Insights** → navigates to Planning for that dimension/period. This is an in-session mode switch, not an app-entry deep-link, but follows the same rule: Understand can hand off to Plan, never edit in place.

No other deep-link paths are specified in this draft. In particular, there is no deep-link from outside Budget (e.g., from Transactions or Home's general navigation) directly into Insights — Insights is reached by first entering Budget normally (B.1) and tabbing over, or via the Variance hand-off above.

### B.5 Back behavior

Standard platform back-navigation applies within a mode (e.g., drilling into a specific category's variance detail inside Insights, then back). Switching *tabs* is not a back-stack event — moving from Home to Planning to Insights and pressing back from Insights returns to wherever the user was *before entering Budget*, not back through Home and Planning. This matches standard tab-bar convention and avoids the Period Selector's shared state (B.3) getting confused with navigation history.

### B.6 Mapping to engineering scope

For traceability into BUD-003 (formalized fully in Part G):

- Home, Planning, and the Period Selector → **WP-4**
- Insights (all three views) → **WP-5**
- The Budget Alert deep-link (B.4.1) → touches both WP-4 (Home's alert surface) and the Notifications boundary already defined in BUD-001 §2 (delivery/dismissal stays Notifications-owned; threshold logic stays Budget-owned)

### B.7 Navigation Principles

Every future Budget screen, journey, or interaction is judged against these six rules before it ships. Each one traces to a decision already made in Parts A–B — this section exists to state them as binding constraints in one place, not to introduce anything new:

1. **One global period context.** A single Period Selector governs all three modes; no mode maintains its own period state. (B.3)
2. **Home is the default Budget entry point.** Every entry into Budget lands on Home unless it's an explicit deep-link. (B.1)
3. **Planning is the only editing mode.** No allocation is ever created or changed from Home or Insights. (A.2, A.4)
4. **Insights is read-only.** It reports on Attribution; it never writes one. (A.2, ADR-036 Invariant 4)
5. **Closed periods cannot be edited.** Immutability of past plans is a product rule, not a UI restriction that a future screen can quietly work around. (B.3)
6. **Every alert deep-links to its relevant planning context.** A Budget Alert never resolves itself in place — it hands the user to Plan, scoped to the dimension and period that triggered it. (B.4.1)

---

## C. User Journeys

Five journeys. The first four are drawn directly from the sequence you set out; the fifth — Month Close & Period Transition — is added here because it's the direct behavioral consequence of B.7's Principle 5 (Closed periods cannot be edited) and ADR-037 (Financial Calendar): the moment a period closes has to *feel like something* to the user, or Principle 5 becomes a rule enforced by an error message instead of a rule the product actually explains.

Each journey states: the trigger, the mode(s) touched, the steps, and which Navigation Principle(s) it exercises — so every journey is traceable back to Part B rather than invented independently of it.

---

### C.1 First-Time Budget Setup

**Trigger:** User enters Budget for the first time — no Planning Allocations exist for the household yet.

**Modes touched:** Home → Planning

**Steps:**
1. User enters Budget (Principle 2: lands on Home).
2. Home detects zero Planning Allocations for the current period and shows an empty state — not a broken/zeroed dashboard, a distinct first-run state (specified fully in Part D). Safe-to-Spend, Health, and Variance are not shown as "₹0" or "0%"; they're replaced with a single call to action: set up a household budget.
3. Tapping the call to action navigates to Planning (Principle 3 — Home itself never opens an inline editor).
4. Planning opens with the Household dimension active by default (the top of the Release 1 Allocation Targets list, A.5) and an empty Household allocation field for the current period.
5. User sets a Household allocation. Category/Person/Group dimensions are available as additional tabs within Planning but are not forced — a household may run on just a Household-level plan.
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
5. **Branch — number prompts a plan change:** user taps the Variance figure's deep-link (B.4.2) into Planning, scoped to that dimension/period. This exits Monthly Review and continues as C.3.

---

### C.3 Planning Next Period

**Trigger:** User wants to set or adjust allocations for the current or an upcoming period — either self-initiated (proactive) or arrived via C.2's branch or an alert deep-link (C.4).

**Modes touched:** Planning, with the shared Period Selector as the mode-independent context (Principle 1).

**Steps:**
1. User enters Planning directly, or arrives via a deep-link already scoped to a dimension/period (Principle 6).
2. Period Selector confirms which period is being planned — must be the current or a future period (Principle 5 — the selector itself prevents selecting a closed period for editing; see Part D for the disabled-state treatment).
3. User selects a dimension tab (Household, Category, Person, or Group — A.5's Release 1 list) and adjusts the allocation.
4. If the change affects a dimension that reconciles against a parent total (ADR-036 Invariant 3 — e.g., Category allocations bounded by Household total), Planning surfaces that constraint inline rather than allowing a silent over-allocation. Exact reconciliation enforcement is implementation detail per ADR-036 §6; this journey specifies that the *user-facing moment* of hitting that constraint must be visible, not deferred to a save-time error.
5. User saves. Planning Allocation is written (the one Producer action in the whole module, A.1).
6. User may continue to another dimension tab within the same period, or exit — exiting always returns to Home (Principle 2's landing rule applies to re-entry, not to staying within a single Planning session; a user does not get bounced back to Home between dimension tabs).

**Exit condition:** At least one Planning Allocation for the selected period has been created or updated.

---

### C.4 Overspending Workflow

**Trigger:** A Budget Alert threshold is crossed (e.g., 80% or 100%+ of a Category or Person allocation) during the period, independent of the user actively looking at Budget.

**Modes touched:** Notification (outside Budget) → Planning directly, per Principle 6.

**Steps:**
1. Alert threshold crossed. Per BUD-001 §2's ownership split: threshold logic is Budget-owned, delivery/dismissal is Notifications-owned — this journey covers only what happens after the user acts on the notification, not how it was generated or delivered.
2. User taps the alert. Per Principle 6 and B.4.1, this bypasses the normal Principle-2 landing-on-Home behavior entirely — the user goes straight to Planning, pre-scoped to the specific dimension and period that triggered the alert.
3. Planning opens showing the over-threshold allocation with its current Variance visible inline (not a separate trip to Insights — the context that caused the alert should be visible at the point of action).
4. User adjusts the allocation (increases it, accepting the new spending reality) **or** takes no allocation action and instead exits Planning, having decided the overspend itself needs correcting in Transactions or behavior rather than the plan.
5. Either resolution is valid. This journey does not assume the "correct" outcome is always raising the allocation — Planning presents the option and the context; it doesn't force a specific response to an alert.

**Exit condition:** User has either updated the relevant Planning Allocation or explicitly left Planning without changing it. Both are legitimate journey endings.

---

### C.5 Month Close & Period Transition

**Trigger:** The Financial Calendar (ADR-037) advances the current period boundary — e.g., the calendar rolls from March to April.

**Modes touched:** Home (primarily), Planning (transition only, no editing of the closed period).

**Steps:**
1. Financial Calendar advances the boundary — this is a platform-capability event (ADR-037), not a Budget-owned action; Budget reacts to it, it does not trigger it.
2. On next Budget entry, Home's default period (B.3) is now the new current period. The just-closed period is no longer the default, but remains fully viewable via the Period Selector.
3. If Budget Policy has Carry-Forward enabled (BUD-001 §3 — "stays Budget-owned," a computation rule applied across Planning Allocations from consecutive periods), Home's first view of the new period reflects the carried-forward amount as part of its Safe-to-Spend/Variance baseline, not as a separate notification the user has to act on.
4. If the user navigates the Period Selector back to the now-closed period, Planning is reachable for *viewing* that period's allocations (consistent with B.3 — viewing past periods is always supported) but every editable field is rendered in its disabled/closed state (Part D specifies the exact treatment) per Principle 5.
5. Attempting to edit a closed-period allocation surfaces the Principle-5 rule directly — *"Closed periods are immutable for planning. Corrections belong in Transactions, not Budget."* — stated to the user in-product, not just enforced silently. This is the one point in the entire specification where a Navigation Principle is written directly into user-facing copy, because B.3 explicitly calls for the rule to be *explained*, not just applied.

**Exit condition:** User has either reviewed the new period's opening state or confirmed (by attempting and being blocked) that the prior period is closed. No allocation write occurs against a closed period under any path in this journey — if one did, it would be a defect against Principle 5, not an alternate flow.

---

*Part D (Screen Specifications) to follow, building directly on these five journeys — each journey's steps above should map cleanly onto the screens/states Part D defines, and any screen state that doesn't serve a step in C.1–C.5 should be treated as unjustified scope creep rather than added by default.*
