# TRX-002C — Settlement Extraction: Partial

`2026-08-03` · Status: **`SettlementService` complete · Production retirement blocked, not started**

Framed per your instruction: *"Reduce registered duplication without changing observable behavior"* — a governance task, not a coding task. That framing is exactly why this ticket splits into two very different halves.

---

## What's done: `SettlementService`

Built and proven — 5 tests, all passing (47/47 combined with TRX-002A/B).

- **Stateless orchestrator**, per ADR-033 — literally has zero instance fields (`Object.keys(service).length === 0`, asserted by test, not just claimed).
- **Allocates one payment across multiple `SettlementTarget`s in order**, applying to each until either the payment or the candidate's `outstanding()` runs out.
- **Matches the real, observed behavior** from this session's debugging — a payment exceeding what's owed doesn't get force-applied or silently dropped; it comes back as `unappliedAmount`, exactly like the real "₹539 extra kept as advance" case found earlier.
- **Proven polymorphic against the contract, not a concrete type** — tests use `Transaction` instances as the `SettlementTarget`, but `SettlementService` itself imports nothing from `Transaction` — it only calls `.outstanding()`/`.applySettlement()`, so a future `Loan` or `Payable` slots in without changing this file.

This part is genuinely safe: **new, additive code, nothing in `App.jsx` touched, nothing production-observable changed.**

## What's explicitly NOT done: retiring the legacy duplicates

Your own success criteria for this ticket include *"no regression tests fail."* Checked honestly: **there are no regression tests for `applyRepaymentAllocations` or `SettleModal.settle()` to run.** ARCH-001 confirmed zero test coverage across `App.jsx`; TRX-002A/B added tests for new code, not the 16,349-line file the legacy settlement logic actually lives in.

That means "no regression tests fail" currently can't be claimed *or* checked — it's not that they'd pass, there's nothing there to run. Proceeding to repoint or delete `applyRepaymentAllocations`/`SettleModal.settle()` right now would mean verifying "no observable behavior change" by inspection alone, on the exact code that's already caused 3 confirmed production bugs from being inspected-not-tested. That's the failure mode this whole session has been correcting, not one to walk back into at the final step.

## Recommendation: a prerequisite step before CR-001 can actually close

**Write characterization tests for `applyRepaymentAllocations` and `SettleModal.settle()` as they exist today, bugs included, before changing anything.** Not testing what they *should* do — testing exactly what they *currently* do, so "no regression" becomes a real, mechanically-checked claim instead of an inspection-based hope. Once that safety net exists:

1. Repoint one call site at a time to `SettlementService` + `Transaction.applySettlement()`
2. Run the characterization tests after each repoint — they must still pass, since they capture current behavior, not intended behavior
3. Only delete the legacy function once every call site is repointed and every characterization test still passes
4. Update CBR, Change Register (CR-001 → Complete), and EDL — only then, matching your stated success criteria exactly

## Updated CBR / Change Register status

**No change yet — this is the honest, unmoved number:**

```
Canonical: 8
Duplicate: 4
```

`SettlementService` existing doesn't move this any more than `Transaction.applySettlement()` did in TRX-002B. The scoreboard moves when CR-001 actually reaches `Complete`, which requires the characterization-test prerequisite first.

## What I'd need from you to proceed

Whether to:
(a) treat the characterization-test-writing as its own sub-ticket (`TRX-002C-prereq` or similar) before continuing, or
(b) accept a lighter-weight verification (e.g. a manual test script covering the known settlement scenarios) given the app is still pre-production/personal-use scale — your call, since it trades rigor for speed and that's a product decision, not an architectural one.
