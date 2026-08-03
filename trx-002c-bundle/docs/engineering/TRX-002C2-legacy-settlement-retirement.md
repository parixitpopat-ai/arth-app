# TRX-002C2 — Legacy Settlement Retirement

`2026-08-03` · Status: **Characterization prerequisite complete · Repointing not started**

---

## Prerequisite: characterization tests

**Done.** Both legacy functions extracted faithfully (mechanical, no logic changes — closure variables became explicit parameters, nothing rewritten) and characterized:

- **`applyRepaymentAllocations`** — 9 tests, covering the plain-transaction, bill, group-txn, group-bill, and tagged-link branches. Includes a direct regression anchor for this session's two bug fixes (bill-status recompute, bill-to-transaction mirroring) — if a future change breaks either, one of these tests fails immediately.
- **`SettleModal.settle()`** — 5 tests, covering plain-transaction settle, overpayment/advance handling, bill settle, and a reconstruction of the real "UG1 / Public Works Department" scenario from this session's debugging (bill settle mirroring onto its `paidByTxnId` transaction).

**14 new tests, all passing. 61/61 across the entire suite built this session.**

Both extractions reuse real, already-canonical code where it existed (`src/domain/shared/remainingShare.js`) rather than re-implementing it — consistent with the repo's own established discipline (ADR-013/014).

## What this prerequisite now makes possible

"No regression tests fail" (your stated success criterion) is now a real, checkable claim for the first time. Any future change to either legacy function's logic — including the eventual repointing to `SettlementService`/`Transaction.applySettlement()` — can be verified against these 14 tests before being trusted.

## What's still not done

**The actual repointing.** These characterization tests capture current behavior — they don't yet change anything in `App.jsx`. `applyRepaymentAllocations` and `SettleModal.settle()` are still the functions actually running in production, unchanged. Remaining work:

1. Repoint `AddModal`'s Settlement-tab flow (currently calling `applyRepaymentAllocations`) to construct a `Transaction` aggregate + call `SettlementService.allocate()`
2. Repoint `SettleModal`'s Settle button flow the same way
3. Run the 14 characterization tests after each repoint — if either breaks, that's a real behavior change to review deliberately, not a silent regression
4. Only once both are repointed and all characterization tests still pass: delete the original `applyRepaymentAllocations` and `SettleModal.settle()` bodies
5. Update CBR (Settlement Allocation → Canonical), Change Register (CR-001 → Complete), EDL

**This is real production surgery on the highest-stakes code in the app** — deliberately not attempted in this pass without your explicit go-ahead, given the stakes involved and the fact that the repointing itself (not just having tests) is what actually changes production behavior.

## CBR / Change Register status

**Unchanged — still the honest number:**
```
Canonical: 8
Duplicate: 4
```
CR-001 remains Proposed, not Complete. The prerequisite is done; the migration itself hasn't started.
