# Milestone — TRX-001C Closed: Transaction Domain Architecture Complete

`2026-08-03`

## What TRX-001C produced

Started as "design the Transaction Aggregate." Ended as:

- [x] Reconciled business-rule baseline (CBR: 8 canonical, 4 duplicate, 0 unaudited)
- [x] Canonical Transaction domain model, with a frozen Invariant Table (Team 1)
- [x] Legacy code mapped to the model (Team 2)
- [x] Cross-aggregate orchestration pattern — `SettlementTarget`, `SettlementService` (Team 4, ADR-033)
- [x] Persistence model, ownership enforced structurally (Team 5)
- [x] Event model, one publisher per event (Team 6)
- [x] Command model (Team 7 — and the finding that no prior API existed to migrate)
- [x] Interaction model (Team 8 — UI collects intent, never enforces invariants)
- [x] Non-speculative migration plans, CR-001–005 (Team 3)
- [x] An architectural investigation resolved mid-stream (AQ-001 — Payable, not Account)
- [x] Three frozen ADRs: **ADR-032** (duplication governance), **ADR-033** (cross-aggregate orchestration), **ADR-034** (state-centric → command-centric transition)
- [x] A repeatable engineering method, extracted for reuse on Accounts, Budgets, Investments, Reports

23 EDL entries record not just what was decided, but why — including the two moments the discipline nearly slipped, kept deliberately rather than edited out.

## Status: ✅ Closed

Objective met. Not because there's no more Transactions work — there's a full implementation phase ahead — but because the architecture phase's job (understand reality, define the target, freeze it, govern it) is done.

---

## What changes now: Definition of Done for the implementation phase

This is a real shift, not a continuation under the same rules:

**During TRX-001C:** discovering architecture was the job. New ADRs were expected as evidence surfaced gaps.

**During implementation (TRX-002A onward):**
- **No new ADRs unless implementation reveals a genuine architectural gap.** The default assumption is that ADR-032, ADR-033, and ADR-034 are implemented as written.
- **New engineering decisions are exceptions, not the norm.** If TRX-002B (Transaction Aggregate implementation) surfaces a real conflict with the frozen model, that's a legitimate reason to reopen something — a preference for a different approach is not.
- **Conformance to the frozen architecture is the review standard**, replacing "does this design make sense" with "does this match what was already decided."

## Next workstream

`TRX-002A` — Application Layer plumbing (Command Dispatcher, Command Handlers, Aggregate Repository interfaces), per ADR-034's resequenced, behavior-before-storage migration order. No `Transaction` implementation yet — that's `TRX-002B`.
