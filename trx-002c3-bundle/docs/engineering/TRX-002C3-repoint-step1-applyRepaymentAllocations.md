# TRX-002C3 — CR-001 Step 1: Repoint `applyRepaymentAllocations` (txn-kind branch)

`2026-08-03` · Status: **Step 1 Complete** · CR-001: **In Progress** (not yet Complete)

---

## What changed in `App.jsx`

One block, inside `applyRepaymentAllocations`, inside the `personLinks`/`kind:"txn"` branch. The inline settlement math (`Math.min`/`Math.max` on `settledAmt`/`remainingAmt`, plus group-collective advancement) is replaced with a single call:

```js
return settlePersonShareOnTransaction({ txn, personId, amount:Number(link.amount||0), todayStr });
```

Nothing else in the function changed. Bill-kind links, group-txn links, group-bill links, and tagged links are untouched — still legacy logic, unchanged.

## Why this is safe, not just claimed safe

1. **Adapter equivalence proven before the repoint, not after.** 5 tests (`adapter-equivalence.test.js`) directly compare the new composed path (`Transaction.applySettlement()` + legacy group-collective pass-through) against the old characterized function, for identical inputs — including the group-collective cap edge case. All 5 passed before a single line of `App.jsx` changed.
2. **Syntax verified** — `App.jsx` re-parsed successfully via the same AST tooling used throughout this session (the sandbox's bundler has an unrelated environment issue with a missing native binary, so a full `vite build` couldn't run here; the parse check is the available substitute and confirms no syntax errors were introduced).
3. **Full suite green after the change: 66/66.**

## The CR-006 decision, applied

Per your instruction: group-collective tracking (`groupCollectiveAmount`/`groupCollectiveSettledAmt`) stays as legacy plain-object mutation, isolated inside `settlePersonShareOnTransaction`'s adapter — not absorbed into the `Transaction` aggregate. Registered as **CR-006 — Group Collective Canonicalization**, explicit architectural debt with a stated exit criterion (a domain audit determining where it actually belongs), not a silent compromise.

## What's still legacy (unchanged, on purpose)

- `applyRepaymentAllocations`'s bill-kind, group-txn, group-bill, and tagged-link branches
- `SettleModal.settle()` in its entirety (Step 2, not started)
- `AddModal` L4480/L4641 (the other two of CR-001's 4 duplicate locations)

## CBR / Change Register status

**Unchanged — the honest number stays 8 canonical / 4 duplicate.** CR-001 moves from `Proposed` to `In Progress` (this step), but per your own Step 3, it doesn't reach `Complete` — and the CBR doesn't move — until Step 2 (`SettleModal.settle()`) is also repointed and the full characterization suite stays green through both.

## Next

Step 2: repoint `SettleModal.settle()`'s equivalent branch(es) to the same canonical path, following the identical discipline — equivalence test first, then the `App.jsx` change, then full suite, then its own commit.
