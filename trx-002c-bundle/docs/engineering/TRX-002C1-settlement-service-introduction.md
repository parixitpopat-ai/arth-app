# TRX-002C1 — SettlementService Introduction

`2026-08-03` · Status: **✅ Complete**

## Deliverables

- `SettlementService` implemented — stateless orchestrator, per ADR-033
- Statelessness proven by test (`Object.keys(service).length === 0`, asserted not claimed)
- Allocation logic tested: single candidate, multi-candidate in-order, zero-outstanding skip
- "Excess kept as advance" behavior captured and tested — matches the real observed case from this session's debugging (₹319.40 applied of ₹858.40, ₹539 kept as advance)
- Proven polymorphic against the `SettlementTarget` contract, not a concrete type — tests use `Transaction` instances, but `SettlementService` imports nothing from `Transaction`, only calls `.outstanding()`/`.applySettlement()`

5 tests, all passing. 47/47 combined with TRX-002A/B.

## Scope boundary

New, additive code only. Nothing in `App.jsx` touched. `applyRepaymentAllocations` and `SettleModal.settle()` remain exactly as they are — untouched, still the ones actually running in production.

## CBR impact

None. Per the standing rule: `SettlementService` existing doesn't move the scoreboard any more than `Transaction.applySettlement()` did. **Canonical: 8, Duplicate: 4 — unchanged.**

## Next

`TRX-002C2` — Legacy Settlement Retirement (see separate ticket) — this is where CR-001 actually reaches Complete and the CBR moves.
