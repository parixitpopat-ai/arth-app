# Settlement Architecture — Domain Capability vs. Aggregate-Owned

`2026-08-03` · TRX-001C, Team 4 deliverable · **Status: ✅ Frozen** — approved 2026-08-03. Elevated to ADR-033 (see below).
Resolves CR-004. One question, answered with justification, not a survey of options.

---

## The question

Should Settlement become a `SettlementService` shared by Transactions, Loans, Receivables, and future Payables — or should every aggregate own its own settlement logic?

## Answer

**Neither, in the pure form either option implies. Settlement is a stateless Domain Service that orchestrates *allocation* across possibly multiple target aggregates, but it never directly mutates any aggregate's internal state. Each target aggregate owns and enforces its own settlement invariants through its own method.**

This is a real third option, not a compromise for its own sake — here's the DDD reasoning and the evidence that led to it.

---

## Why "every aggregate owns settlement" is rejected

This is what today's code already does, and it's the exact cause of BUG-TRX-001. `applyRepaymentAllocations`, `SettleModal.settle()`, the L4480 block, and the L4641 block are four independent, aggregate-agnostic implementations of "reduce an owed amount, recompute settled" — none of them is wrong in isolation, but nothing enforces that they stay consistent with each other. "Every aggregate owns settlement" as a target architecture doesn't fix this — it's a description of the current broken state, just with the duplication moved from four UI-adjacent functions to four aggregate classes instead. Same failure mode, different location.

## Why "one shared SettlementService that owns everything" is also rejected

This is the naive reading of "shared capability," and it violates a core DDD principle: **an aggregate is the only thing allowed to enforce its own invariants.** The Invariant Table frozen in Team 1's model states `PersonShare.settled` must always equal `remainingAmt <= 0` — if `SettlementService` reaches directly into `Transaction.personShares` and sets fields, that invariant is enforced by *service discipline*, not by the aggregate's own boundary. That's exactly how `Math.min(originalAmt, prevSettled + amount)` ended up hand-written in four separate places instead of being an invariant nothing could bypass. Centralizing the duplication into one service doesn't remove the risk of a fifth caller doing it wrong — it just moves where the wrong version could get written.

## The actual answer

**`SettlementService` (in `src/domain/transactions/settlement.js`) is responsible for exactly one thing: given a payment amount and a set of candidate dues — which may span Transaction shares, Bills, and Loans simultaneously (confirmed real behavior: the "Apply to original dues" screen already allocates one payment across multiple due types, including "extra kept as advance" when a payment exceeds what's selected) — decide how much goes to each target.**

**Each target aggregate exposes its own method that the service calls, and that method is the only thing allowed to mutate that aggregate's state:**

```
SettlementTarget {
  outstanding()
  applySettlement(allocation)
}
```

- `Transaction implements SettlementTarget` — `applySettlement()` enforces `PersonShare` invariants, returns whether that share is now fully settled
- `Loan implements SettlementTarget` — `applySettlement()` enforces the Loan's own `outstanding`/`status` invariants
- (future) `Receivable`, `Payable` — same contract, added only when real business evidence requires it

`SettlementService` depends on the `SettlementTarget` contract; it never needs to know which concrete aggregate it's dealing with.

**Additional invariant: `SettlementService` is stateless.** It stores nothing, owns nothing, persists nothing — pure orchestration. This is deliberate, not an oversight: without this constraint, `SettlementService` would slowly accumulate responsibilities the way `src/domain/financialEngine/engine.js` legitimately does for forecasting (which is fine for a computation engine, but wrong for an orchestrator that must never become a second place aggregate state can drift from).

---

## What this decides concretely

| Question | Answer |
|---|---|
| Destination of L4512 (manual loan-settlement reduction) | Becomes `Loan.applySettlement()` (the `SettlementTarget` method) — owned by the Loan aggregate, not merged into `settlement.js`. `SettlementService` calls it, doesn't replace it. |
| Final home of `settlement.js` | `SettlementService` — allocation/orchestration logic only, stateless. No direct field mutation of any aggregate lives here. |
| Domain events | Two levels: each aggregate fires its own event when its `SettlementTarget.applySettlement()` is called (`TransactionSettlementApplied`, `LoanPaymentApplied`) — these are what downstream consumers (Accounts, Bills) react to. `SettlementService` additionally fires one coordinating event for the whole allocation act (`SettlementCompleted`, carrying the full allocation breakdown) — useful for audit/history, not for triggering side effects (those come from the aggregate-level events). |
| Repository boundaries | `SettlementService` needs a read-side query across multiple aggregate types to find "what's still owed" (the existing `getPersonReceivableItems`-style lookup, and the candidate-dues list the "Apply to original dues" screen already builds). This is a query/read-model concern, not a write-repository concern — it doesn't imply `SettlementService` has write access to any aggregate's repository directly. |
| API surface | One endpoint (e.g. `POST /settlements`) accepting a payment amount and optional target selection, returning the allocation result — not one settlement endpoint per aggregate type. |
| Persistence | `SettlementService` itself is stateless — nothing to persist beyond what each aggregate already persists via its own `applyPayment`/`applySettlement` call, plus optionally a `SettlementRecord` (allocation history) if `PaymentDistributed` needs to be queryable later, not just emitted. |

---

## What this does not decide

- The exact shape of the `Settleable` contract (method signature details, error handling for partial-failure mid-allocation) — implementation detail for whoever builds `settlement.js`
- Whether Bills participate in this contract directly, or only ever receive settlement effects indirectly via Transaction (current evidence — the bill-mirroring fix from this session — suggests bills are a *consequence* of transaction settlement, not a direct `Settleable` target themselves; worth confirming during implementation, not asserted here)
- Migration sequencing (Team 3's job, now unblocked)
