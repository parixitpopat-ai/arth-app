# ADR-033 — Cross-Aggregate Orchestration: Domain Services Decide, Aggregates Mutate

`Proposed 2026-08-03` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-03

Resolves CR-004. Elevated from a Transactions-scoped decision (Team 4, TRX-001C) to a general architectural rule because the reasoning applies wherever a business process spans more than one aggregate — this is bigger than Settlement alone.

**Relationship to ADR-032:** this doesn't invoke ADR-018's reopening clause independently — it's answering a question ADR-032 itself left open (§Q1, "who owns settlement"), within work ADR-032 already authorized. Not a new precedent for the freeze; a continuation of one already granted.

---

## Decision

**Cross-aggregate decisions belong to domain services. Aggregate state changes belong only to the aggregate that owns the invariant.**

A domain service may decide *what should happen* across multiple aggregates — but it may never *make it happen* by reaching into an aggregate's internal state directly. Every aggregate exposes intention-revealing methods; the service calls them and never bypasses them.

## Why (the two failure modes this rejects)

**Failure mode 1 — every aggregate independently reinvents the same cross-cutting logic.** This is today's actual Settlement code: `applyRepaymentAllocations`, `SettleModal.settle()`, and two more independent blocks, each hand-implementing "reduce an owed amount, recompute settled." Four correct-in-isolation implementations with no mechanism keeping them consistent — confirmed as the direct cause of 3 production bugs this session (BUG-TRX-001, plus the earlier bill-settlement fixes).

**Failure mode 2 — a shared service reaches directly into aggregate state to avoid the duplication.** This looks like the fix, but breaks a harder rule: an aggregate is the only thing allowed to enforce its own invariants. If a service sets `share.remainingAmt -= x; share.settled = (remainingAmt<=0)` directly, that invariant is enforced by service discipline, not by the aggregate boundary — which is exactly how the duplication in failure mode 1 happened, just moved to a new location. The aggregate becomes a passive data structure; the service becomes the real (undeclared) owner.

## The pattern this decision establishes

```
SettlementTarget {
  outstanding()
  applySettlement(allocation)
}
```

Any aggregate that can receive a settlement implements this contract. The orchestrating domain service depends on the contract, never on a concrete aggregate type. For Settlement specifically: `Transaction implements SettlementTarget`, `Loan implements SettlementTarget`; `Receivable`/`Payable` join only when real business evidence requires it — the interface existing is not license to implement it everywhere for symmetry (Bills explicitly do not implement it today, per insufficient evidence — see Team 4's settlement-architecture.md).

**The orchestrating service itself must be stateless** — stores nothing, owns nothing, persists nothing, pure orchestration. Without this constraint, a domain service accumulates responsibility over time the way a computation engine legitimately can (`src/domain/financialEngine/engine.js` is fine being stateful-adjacent for forecasting) — but an orchestrator drifting into ownership is exactly the failure this ADR exists to prevent.

## Domain events, two tiers

- **Aggregate events** (e.g. `TransactionSettlementApplied`, `LoanPaymentApplied`) — fired by the aggregate itself when its own state changes. These are what downstream consumers react to.
- **Process events** (e.g. `SettlementCompleted`) — fired by the orchestrating service to record that a cross-aggregate process occurred, carrying the full allocation breakdown. For audit/history, not for triggering further side effects — those come from the aggregate-level events, not the process event.

## Scope of this ADR

**ADR-033 establishes a preferred architectural pattern, not a mandatory framework. It should be adopted only where an audited domain process spans multiple aggregates and the separation of orchestration from invariant enforcement provides measurable architectural benefit.** It does not itself decide:
- Which other business processes in Arth beyond Settlement should adopt it (evaluated case by case, as evidence emerges — not applied pre-emptively, and never adopted merely because the pattern is available or elegant)
- Whether Bills ever implement `SettlementTarget` (open, insufficient evidence today)
- Implementation details of `settlement.js` itself (Team 3's migration plan)

## Sign-off

**Approved and Frozen 2026-08-03.** Scoping clause (adopt case-by-case, not as mandatory framework) incorporated per review before freezing.
