# ARTH — Post-School Execution Roadmap

**Status:** Frozen execution order. P0 (School Fees) is the only active work. No parallel redesigns.
**Date:** 2026-09-04
**Author:** PP Sir

---

## Governing principle

We are not redesigning Arth all at once. We are fixing UX/domain seams in dependency order while preserving the architecture already built (PPL-004 through PPL-007).

## Execution order

```
P0  School Fees (active now)
     |
     v
P1  Master User / Signup ("Me")
     |
     v
P2  People & Groups
     |
     v
P3  Billers & Bills (incl. P3A Credit Cards)
     |
     v
P4  Add Transaction screens
     |
     v
P5  Trips
     |
     v
P6  Outlook
     |
     v
P7  Budget (left as-is this phase)
     |
     v
P8  Insights
```

## Horizontal architecture rule, across every phase

```
                MASTER USER
                     |
             +-------+-------+
             |               |
          PEOPLE           GROUPS
             |               |
             +-------+-------+
                     |
              RELATIONSHIPS
                     |
                ORGANISATIONS
                     |
               SERVICES/ACCOUNTS
                     |
              PLANS / COMMITMENTS
                     |
                   BILLS
                     |
              TRANSACTIONS
                     |
                  ACTUALS
```

Separately:

```
MASTER USER
     |
   BUDGET
     |
 ALLOCATIONS
     |
Future planning
```

**Actuals and planning must never get mixed together.**

## Global UX principle: Context first, catalogue second

Inside a Person, Group, or Transaction screen, show only what's relevant to that context. The complete catalogue (every biller type, every trip, every service) lives in Settings, not in the daily operational flow.

## Global architecture principle

Transactions are historical facts. AI may analyze actuals and recommend future plans (budgets, allocations), but must never rewrite historical actuals.

---

## Phase summaries

**P0 — School Fees.** Finish schedule editing properly: name, dates, rate rules, Person attribution, one coherent Edit experience. Safe reconciliation for dates/rate changes. Preserve settled financial history absolutely. Keep PPL-006/PPL-007 attribution guards untouched and functionally separate from schedule-edit logic. Trace -> design -> freeze -> build -> regression.

**P1 — Master User / Signup.** Move real identity collection (name, basic info) into signup/onboarding, establishing `__me__` as the canonical master-user Person rather than a manually-edited generic contact. Do not turn onboarding into a full services-catalogue questionnaire.

**P2 — People & Groups.** Redesign Person/Group as the contextual hub: basic info, planning/allocation, services/relationships, bills/commitments, expenses, settlements, insights — horizontal card sections, not an endless vertical list. `+ Add` is contextual, progressively narrowing (Education -> School -> existing organisation -> account), with smart reuse of existing organisations to prevent duplicate creation from name variations.

**P3 — Billers & Bills (+ P3A Credit Cards).** Move the full service catalogue into Settings as a configurable "Services Catalogue" (enabled/available). Contextual add-flows show only relevant, enabled services. Resolve Credit Card's Account -> Statement/Bill -> Transaction -> Payment relationships explicitly, before transaction-entry work.

**P4 — Add Transaction screens.** Only after People, Groups, and Billers/Bills are coherent, so the transaction flow can ask intelligently (what/where/who/account) rather than exposing every entity. Transactions remain historical facts — never rewrite a Person, Budget, Bill, or relationship.

**P5 — Trips.** Fix contextual trip selection (current/relevant trips shown by default, not the full historical list) when attaching an expense. Trace the existing Trip architecture first — do not assume the relevance basis (dates, status, person, destination) without evidence.

**P6 — Outlook.** Rebuild as the forward-looking operational view once commitments/bills/trips data is clean — not another data-entry surface.

**P7 — Budget.** Left as-is this phase. The ₹50,000 concept is confirmed as the Master User's own spending budget, not household-wide. Future AI-driven recommendations (recommended budget, per-person allocation suggestions) stay separate from historical actuals, which are never rewritten.

**P8 — Insights.** Trace both existing Insights surfaces (global page vs. Budget -> Insights tab) before deciding whether to merge them — what data each consumes, whether they're genuinely duplicates, and what belongs to Budget intelligence vs. personal financial intelligence vs. operational alerts vs. recovery recommendations. Replace premature/low-signal insights (e.g., "F&B spending down 85%" after four days) with actionable ones (e.g., recovery-oriented: overspend amount, specific category reductions, timeline to recover).

---

## Today's scope

**P0 only.** School Fees must be finished — creation, editing, attribution, and historical protection all working together — before P1 opens.
