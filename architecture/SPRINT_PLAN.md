# Arth v2.0 — Sprint Plan (Final)

**Status: Developer-ready.** This is the last planning document. From here, artifacts come from implementation — sprint reports, code reviews, issues discovered during development — not further upfront design.

## Development Principle (mandatory, read before any PR)

> Arth v2 is an evolution, not a rewrite. Reuse existing code wherever
> practical. Refactor before replacing. New functionality should be built
> only where identified by the UX packages and the frozen Information
> Architecture.

Every pull request must:
- Keep the application buildable.
- Preserve existing user data.
- Avoid duplicate business logic.
- Reference the relevant IA, ADR, or UX package that justifies the change.

## Stop Work Rule (most important addition)

If implementation requires changing Information Architecture, ADRs, UX
Package business rules, or Engine ownership — **stop and raise the issue
before implementing.** Do not solve architectural conflicts in code.

## Sprint Reporting Template (use at the end of every sprint)

```
Completed       - tasks finished
Deviations      - any changes from the original plan
Technical Debt  - debt intentionally introduced
Blockers        - items preventing progress
Risks           - potential issues for the next sprint
Recommendation  - suggested next action
```

---

## Sprint 1 — Architecture & Navigation (1 week) 🟡 Medium Risk

**Goal:** restructure the application without changing business logic.

| # | Task | Status |
|---|---|---|
| 1 | Left Drawer Reorganization (Manage/Data/Settings/Help) | ✅ Complete |
| 2 | Bottom Navigation matches frozen IA | ✅ Complete |
| 3 | Money Hub — relocate existing modules, no new calculations | Pending |
| 4 | Outlook Hub — move Bills/Budget/Scheduled Income, placeholder Calendar/Cash Forecast | Pending |
| 5 | Home Refactor — remove business logic, consume from engines only | Pending |

**Dependencies:** none — this is the foundation sprint.

**Exit Criteria:**
- ✅ App builds successfully.
- ✅ Existing user data remains intact.
- ✅ All existing navigation works after reorganisation.
- ✅ No duplicate navigation paths remain.
- ✅ No new functionality introduced.
- ✅ All moved screens reachable from their new location.
- ✅ No regressions in existing features.

**Out of Scope:** Insurance implementation, Forecast calculations, Insights, AI, new business logic, UI redesign.

**Success Metric:** User cannot tell the architecture changed, but navigation matches the frozen IA.

---

## Sprint 2 — Insurance & Bills 🔴 High Risk

**Goal:** implement the new Insurance architecture end-to-end.
- Insurance module, Policy Detail
- Insurance ↔ Bill linkage (`linkedPolicyId`)
- Insurance Premium as `Bill.type`
- Membership migration (stays `Bill.type`, per ADR-020 — unchanged)
- Biller integration

**Dependencies:** Sprint 1 complete; new drawer navigation merged; Outlook hub available.

**Out of Scope:** Forecast Engine, Cash Forecast, Insights, Vehicle automation.

**Success Metric:** User can create an Insurance Policy, receive an Insurance Premium Bill, and pay it through the existing Bill workflow.

**Why high risk:** introduces a new master entity and links it to Bills — the first genuinely new data model since the architecture freeze.

---

## Sprint 3 — Component Extraction 🟢 Low Risk

**Goal:** reduce duplication.
- Fully migrate all existing usages of PAT-005 (Chip), PAT-006 (ConfirmDialog), PAT-008 (EntityCard) — each already extracted with one proof-migration; this sprint is the remaining migrations.

**Dependencies:** none blocking — can run in parallel with Sprint 2 if capacity allows, though sequenced after for a solo developer.

**Out of Scope:** any new pattern extraction beyond these three.

**Success Metric:** No duplicated implementations remain for PAT-005, PAT-006, and PAT-008.

**Why low risk:** mostly refactoring, no new business logic.

---

## Sprint 4 — Forecast Foundation 🔴 High Risk

**Goal:** prepare Outlook.
- Cash Forecast, Safe to Spend v2, Planned Expenses, Alert Centralization

**Dependencies:** Insurance complete; Outlook complete; Money Hub complete.

**Out of Scope:** AI.

**Success Metric:** Outlook can accurately project upcoming commitments using the Forecast Engine.

**Why high risk:** implements genuinely new forecasting logic (`calculateProjectedBalance`/`calculateSafeToSpend` move from stubs to real).

---

## Sprint 5 — Insights 🟡 Medium Risk

**Goal:** Spending, Income, Net Worth, Charts, Trends.

**Dependencies:** Money Hub and Ledger data stable.

**Success Metric:** User can understand spending behaviour through Insights.

---

