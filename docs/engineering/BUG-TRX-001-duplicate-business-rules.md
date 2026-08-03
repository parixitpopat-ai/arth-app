# BUG-TRX-001 — Duplicate Business Rule Implementations (found via TRX-000A)

`Opened 2026-08-01` · Severity: **High** · Status: **Open**

## Why this is a bug, not a refactor item

The same business rules are independently implemented multiple times in the codebase. Whether any one of these is *currently* producing wrong output is secondary — the duplication itself is the defect, because this exact pattern (state that should be computed once, hand-recomputed in multiple places) has already caused 3 confirmed production bugs this session (bill status not recomputing on settlement, two independent settlement implementations drifting apart, bill settlements not mirroring to linked transactions). Severity High reflects that track record, not a currently-observed symptom.

## Confirmed duplicate #1: "Reduce a person's owed/remaining amount and recompute settled"

Found in **at least 4 independent implementations**:

1. `applyRepaymentAllocations` (patched twice already this session)
2. `SettleModal.settle()` (patched once already this session)
3. `AddModal`, settlement-allocation block, `src/App.jsx` L4480 — computes `paidFor`/`remainingShare`, updates `settledAmt`/`remainingAmt`/`settled`
4. `AddModal`, refund-reduction block, `src/App.jsx` L4641 — reduces a refunded person's `amount`/`remainingAmt`, recomputes `settled`

No canonical implementation exists. Each was written independently, which is exactly how #1/#2 drifted apart and produced the 3 bugs already found and fixed.

## Confirmed duplicate #2: CC outstanding balance mutation

Two separate formula-pairs, each hand-duplicated once, no shared function for either:

- **Increment (charging the card):** `src/App.jsx` L4106 (`outstanding + upfrontPaid`, EMI down payment) and L4434 (`outstanding + amt`, regular CC expense)
- **Decrement (paying down the card):** `src/App.jsx` L4527 (`cc_payment` type) and L4637 (refund) — both `Math.max(0,(a.outstanding||0)-amt)`

## What this ticket does NOT do

Per TRX-000A's evidence-only rule, this ticket doesn't prescribe the fix (one shared function vs. a domain service vs. something else) — that's `TRX-001+` implementation work. This ticket's job is to make the duplication a tracked, named defect so it doesn't stay invisible until it produces bug #4, #5, #6.

## Acceptance criteria

- Both duplicate patterns above have a canonical implementation identified or created
- All call sites route through the canonical implementation
- Entry updated in the Business Rule Inventory (Transactions) from "Duplicate" to "Canonical"
