# TRX-000C — Transaction Services Audit

`2026-08-01` · Status: **Approved & Closed**
Scope: non-UI logic referenced across transaction-related components (per ARCH-005 §3): `applyRepaymentAllocations`, `SettleModal.settle()`, `getPersonReceivableItems`, `remainingShare`, and the CC-balance/settlement rules registered in the CBR.

Evidence only, per TRX-000A's established discipline — this audit documents ownership, it does not prescribe the fix.

---

## Q1: Which services actually own settlement today?

**Two, fully independent, zero shared code.** Confirmed directly: `applyRepaymentAllocations` is called from exactly **one** place in the entire file (`AddModal`, L4651, the Settlement-tab/Repayment flow). `SettleModal.settle()` never calls it, and nothing calls into `SettleModal.settle()`'s logic from `applyRepaymentAllocations` either — verified via full-file search, one call site total for `applyRepaymentAllocations(`.

So: **settlement has no single owner.** It has two owners, each reachable from a different UI entry point (Add Transaction → Settlement tab vs. the Settle button on a bill/transaction), each maintaining its own copy of "reduce owed amount, recompute settled, mirror to linked records." This is the direct mechanical cause of all 3 settlement bugs found and patched this session — not a symptom of them, the actual cause.

## Q2: Which business rules belong in Transactions?

- Settlement allocation (which dues a payment applies to, and how much)
- Reduce person's owed/remaining amount + recompute settled
- Transaction creation/edit/delete itself (not audited in depth here — in scope for a future ticket if needed)

## Q3: Which belong in Accounts?

- Outstanding balance increment (CC charge) / decrement (CC payment, refund)
- Account balance adjustments generally (not fully audited — only the CC-outstanding rule was checked in TRX-000A; opening-balance and non-CC account math wasn't in scope here)

## Q4: Which belong in Bills?

- Bill status recomputation (now canonical, per CBR)
- Bill-to-transaction settlement mirroring (now canonical, per CBR)

## Q5: Which are currently owned by nobody?

**This is the most important answer in this audit.** Two rules exist in code but have no domain owner at all — they live inside `AddModal`, a UI component, not inside any Accounts or Transactions service:

- **Outstanding balance mutation** — currently implemented as inline `setAccounts` calls scattered across `AddModal`'s transaction-save logic. There is no `AccountDomainService` or equivalent that owns "what happens to an account's outstanding balance when X occurs." The rule exists only as an effect of wherever a transaction happens to touch a CC account.
- **Settlement allocation** — technically "owned" by two components (`AddModal`, `SettleModal`) rather than by a Transactions or Settlements domain service. A component owning a business rule is functionally the same as nobody owning it — components are UI, and UI is exactly where domain rules go to drift, which is what happened.

This directly answers why bugs kept surfacing in the same area: **the rules most prone to bugs are the ones with no domain owner**, only incidental UI-component owners.

---

## Business Rule Ownership Matrix

| Rule | Current owner | Canonical owner |
|---|---|---|
| Settlement allocation | None — duplicated across 2 UI components (`AddModal`, `SettleModal`), 4 independent code locations | **TBD — pending ADR-032** |
| Reduce person's owed amount + recompute settled | None — same 4 locations as above | **TBD — pending ADR-032** |
| Outstanding balance — CC charge/payment | None — duplicated inline within `AddModal`, 2 rule-pairs, 4 sites | **TBD — pending ADR-032** |
| Bill status recomputation | Bills (canonicalized this session, though still living inside a component-scope function rather than a standalone module) | Bills |
| Bill-to-transaction settlement mirroring | Bills/Transactions (canonicalized this session) | Bills/Transactions |

This table states the gap, not the fix. Naming a not-yet-built service (`TransactionDomainService`, etc.) as "correct owner" would have been prescribing architecture inside an audit — that's ADR-032's job, not this one's.

---

## Audit Summary

**Biggest risk:** Settlement has two independent owners and always has — this audit didn't find a new bug, it found the structural reason the same bug class keeps recurring.

**Biggest opportunity:** Both "owned by nobody" rules (outstanding balance, settlement allocation) are exactly where ADR-032's single-ledger/domain-service direction would have the most immediate payoff — this isn't a hypothetical architecture benefit, it's the fix for a rule that's already caused 3 confirmed bugs.

**First move:** Resolve ADR-032 (still open) — TRX-000C has now made the cost of leaving it open concrete and measurable via the CBR, rather than a theoretical architecture preference.

**Biggest blocker:** ADR-032 itself is undecided. `TRX-001+` implementation work on settlement can't meaningfully start until the single-ledger question is actually resolved — otherwise any fix just becomes a 5th independent implementation.
