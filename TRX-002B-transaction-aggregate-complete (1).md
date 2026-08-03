# TRX-002B — Transaction Aggregate: Complete

`2026-08-03` · Status: **Done**

## Success criteria (stated, then proven)

- ✅ **Every Transaction mutation flows through the Aggregate.** `post()`, `edit()`, `delete()`, `applySettlement()` are the only ways state changes — confirmed by test: direct mutation of a `TransactionPersonShare` throws `TypeError` (the object is frozen).
- ✅ **No UI code directly mutates transaction state.** Not applicable yet — no UI wired to this (that's a later ticket). What exists proves the aggregate itself enforces this once wired.
- ✅ **No service enforces Transaction invariants.** `PostTransactionHandler`/`ApplySettlementHandler` load, call the aggregate's own method, save. Neither handler touches a field directly.
- ✅ **Legacy behavior preserved** — nothing in `App.jsx` was touched. This is new, additive code.
- ✅ **Existing persistence continues to work through the adapter** — `SnapshotAdapter` from TRX-002A, unchanged, reused as-is.

## What was built

**Domain (`src/domain/transactions/`):**
- `Money` — value object centralizing non-negative/rounding invariants (the exact class of bug BUG-TRX-001 was, applied to numeric safety)
- `LineItem` — child entity, own id, computes `amount` from `qty × unitPrice`. Deliberately does **not** enforce reconciliation against the transaction total — Team 1's Invariant Table left this Open, and enforcing it now would mean inventing a rule the audit never gathered evidence for.
- `TransactionPersonShare` — the value object implementing Team 1's two core invariants structurally: `settled` is a computed getter (never independently set), `settledAmt` is clamped at construction (never exceeds `amount`). Immutable — `applySettlement()` returns a new instance.
- `Transaction` — the aggregate root. Constructor enforces: valid type (frozen ADR-017/030 taxonomy), required date/accountId, `personShares` only on `type=expense`. Implements `post()`, `edit()`, `delete()` (permanent per ADR-018), and the `SettlementTarget` contract (`outstanding()`, `applySettlement()`) per ADR-033.

**Application (`src/application/transactions/`):**
- `PostTransactionHandler`, `ApplySettlementHandler` — same load/validate/save/publish shape as TRX-002A's `CreateTagHandler`, now with the real aggregate
- `wiring.js` — registers both commands on TRX-002A's `CommandDispatcher`, unchanged mechanism

**Tests: 38 new (76 total across the whole `src/application`+`src/domain/transactions` tree, 42 when combined with TRX-002A's suite), all passing, confirmed by actually running them — not asserted.**

## The one deliberate scope boundary

Per your explicit instruction — **no feature expansion.** This implements exactly what Team 1 designed: `Transaction`, `TransactionPersonShare`, `LineItem`, `Money`, `post`/`edit`/`delete`/`applySettlement`, the frozen event set, repository integration through TRX-002A. It does **not** touch:
- `SettlementService` (ADR-033's orchestration layer) — that's TRX-002C
- `Payable` (AQ-001's resolution) — that's TRX-002D
- Any `App.jsx` code, any UI wiring, any migration of `AddModal`'s existing logic

## CBR impact

Per the standing "What happened to the CBR?" review question: **the CBR does not move yet.** This ticket built the canonical `Transaction.applySettlement()` that CR-001's migration will eventually repoint `applyRepaymentAllocations`/`SettleModal.settle()` to — but that repointing is TRX-002C's job (Settlement extraction), not this one's. The canonical implementation now exists; the legacy duplicates haven't been retired yet. CBR stays at 8 canonical / 4 duplicate until CR-001 actually migrates.

## Next

`TRX-002C` — Settlement extraction (`SettlementService` + full `SettlementTarget` orchestration across Transaction/Loan) — this is where CR-001/CR-004 actually get resolved and the CBR's duplicate count starts moving.
