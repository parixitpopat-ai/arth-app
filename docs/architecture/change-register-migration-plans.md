# Duplicate Migration Plans — CR-001 through CR-004

`2026-08-03` · TRX-001C, Team 3 deliverable · Status: **Draft — for review**
No code. Written against frozen ADR-032 and ADR-033 — non-speculative.

---

## CR-001 — Settlement Allocation

**Current implementation:** 4 independent locations — `applyRepaymentAllocations`, `SettleModal.settle()`, `AddModal` L4480 (settlement-allocation block), `AddModal` L4641 (refund-reduction block). Each independently computes `paidFor`/`remainingShare`, mutates `settledAmt`/`remainingAmt`/`settled` by hand.

**Target implementation:** `SettlementService.allocate(payment, candidateDues)` (stateless, per ADR-033) decides how much goes to each due. For each due that resolves to a `Transaction`, it calls `Transaction.applySettlement(personId, amount)` — the `SettlementTarget` method, the only code path allowed to mutate `PersonShare` state, enforcing the frozen invariants (`settled = remainingAmt<=0`, `settledAmt <= amount`).

**Migration steps:**
1. Implement `Transaction.applySettlement()` on the aggregate, encoding the invariants from Team 1's frozen model — this becomes the single source of truth for the mutation logic all 4 old sites currently duplicate.
2. Implement `SettlementService.allocate()` — port the allocation *decision* logic (which due gets how much, remainder-as-advance behavior confirmed in the "Apply to original dues" screen) without porting the direct-mutation code.
3. Repoint `SettleModal`'s Settle-button flow to call `SettlementService.allocate()` instead of its own `settle()` implementation.
4. Repoint `AddModal`'s Settlement-tab/Repayment flow (currently calling `applyRepaymentAllocations`) to the same service call.
5. Migrate the L4480 and L4641 blocks the same way — both are instances of this rule, not separate ones.
6. Delete all 4 original implementations once every call site is repointed and verified.
7. Update CBR: Settlement Allocation → Canonical (Transactions domain, via `SettlementService` + `Transaction.applySettlement`).

**Rollback plan:** Each of the 4 call sites can be repointed independently and reverted independently (git-level revert per call site) until step 6 (deletion). Do not delete any original implementation until all 4 call sites are confirmed working against the new path — keeping old code temporarily dead rather than deleted is the safer order, per ADR-032 §3B's transitional policy.

**Risks:** Highest-risk migration of the four — this is the exact code responsible for 3 confirmed bugs already. Manual regression required (no automated tests exist, per ARCH-001) across: individual bill settlement, group settlement, plain-transaction settlement, refund-reduction, and the partial-allocation/advance-credit behavior. Recommend a manual test checklist covering each of the 4 original call sites' distinct scenarios before deleting any of them.

---

## CR-002 — Outstanding Balance Increment (CC Charge)

**Current implementation:** 2 locations — `AddModal` L4106 (`+upfrontPaid`, EMI down payment), L4434 (`+amt`, regular CC expense).

**Target implementation:** `Account.applyCharge(amount)` — owned by the Accounts domain, per the frozen aggregate boundary (Team 1 §1: Account is referenced, not owned, by Transaction; outstanding-balance mutation is explicitly an Accounts-domain rule).

**Migration steps:**
1. Implement `Account.applyCharge(amount)` with the increment logic, enforcing whatever Accounts-domain invariants exist (not yet audited at Team 1's depth — flag for a short Accounts-domain check before finalizing, since this migration assumes Accounts invariants exist without having verified them the way Transaction's were).
2. Repoint L4106 and L4434 to call `Account.applyCharge()` instead of `setAccounts(prev=>prev.map(...))` inline.
3. Delete both original inline mutations.
4. Update CBR: Outstanding Balance — increment → Canonical (Accounts domain).

**Rollback plan:** Both call sites revert independently; low interdependency with CR-001/003/004.

**Risks:** Lower risk than CR-001 — simpler logic, no settlement/allocation complexity. Main risk is the un-audited Accounts-domain invariant gap noted above; worth a quick Accounts equivalent of Team 1's invariant exercise before this migration is considered fully safe, not just assumed safe by analogy to Transaction.

---

## CR-003 — Outstanding Balance Decrement (CC Payment/Refund)

**Current implementation:** 2 locations — `AddModal` L4527 (`cc_payment` type), L4637 (refund) — both `Math.max(0,(a.outstanding||0)-amt)`. Plus a separate, independent derived calculation (`cardOutstanding()`) used for dashboard totals — not previously in scope, surfaced during AQ-001.

**Target implementation, resolved by AQ-001:** `Payable.applySettlement(amount)` — **not `Account`**. AQ-001 concluded `Account` does not implement `SettlementTarget`; a CC account's outstanding balance is modeled as a `Payable` associated with the account, a distinct entity with its own invariants. This also surfaces CR-005 (see below): the stored `account.outstanding` field and the derived `cardOutstanding()` calculation are two independent implementations of the same number, never reconciled — `Payable.outstanding()` becomes the single canonical calculation going forward.

**Migration steps:**
1. Implement `Payable` (Accounts domain) with `SettlementTarget`'s `outstanding()`/`applySettlement()`, using the statement-cycle-derived calculation as canonical (per AQ-001's reasoning — it can't drift the way a stored incremental counter can).
2. Decide whether `account.outstanding` becomes a cached/denormalized read of `Payable.outstanding()`, or is retired — tracked as CR-005, not blocking this migration but should be resolved alongside it rather than left indefinitely inconsistent.
3. Repoint L4527 and L4637 to `Payable.applySettlement()`.
4. Delete both original inline mutations.
5. Update CBR and Change Register.

**Rollback plan:** Same as CR-002 — independent call sites, low interdependency, easy to revert individually. CR-005's resolution (steps 2) can be deferred separately if it proves more involved than expected, without blocking steps 1/3/4.

**Risks:** No longer blocked on an undefined contract question (AQ-001 resolved it) — risk is now standard migration risk, similar to CR-002. The one thing worth care: reconciling two historically-independent numbers (stored vs. derived) may surface a real discrepancy once compared directly — worth checking before assuming they've agreed all along.

---

## CR-004 — Loan Settlement / Transaction Settlement Overlap

**Current implementation:** `AddModal` L4512 — manual loan-settlement reduction, using the same `paidFor`/`remainingShare`-style pattern as CR-001's cluster, but applied to `Loan.outstanding` instead of `PersonShare`.

**Target implementation:** Per ADR-033 (now frozen): `Loan implements SettlementTarget`. `Loan.applySettlement(amount)` becomes the owned mutation method; `SettlementService.allocate()` can now treat Loan dues exactly like Transaction dues in the same allocation pass — this is the concrete payoff of Team 4's design, not just a migration of L4512 in isolation.

**Migration steps:**
1. Implement `Loan.applySettlement(amount)` (`SettlementTarget` contract), porting L4512's outstanding-reduction/status-closing logic into the aggregate.
2. Extend `SettlementService.allocate()`'s candidate-dues resolution to include Loan dues alongside Transaction dues (this is new capability, not present in any of the 4 CR-001 implementations today — the "Apply to original dues" screen currently doesn't offer loans as a settlement target, based on what's been observed this session).
3. Repoint L4512 to the new path.
4. Delete the original.
5. Update CBR: Loan outstanding reduction — manual settlement → Canonical, explicitly noting the unification with CR-001's target (same `SettlementService`, different `SettlementTarget` implementation).

**Rollback plan:** Since this migration also changes user-facing behavior (loans becoming selectable as a settlement target, not just an isolated flow), rollback should be feature-flaggable if step 2 ships — reverting step 1/3/4 alone (keeping Loan's own method but not exposing it via the shared allocation UI) is a safe partial rollback if step 2 causes issues.

**Risks:** Lowest technical risk of the four (L4512 has no sibling duplicate the way CR-001 does), but the highest *product* risk — step 2 is a real UX/scope expansion (loans becoming a settlement-allocation target), not just an internal refactor. Recommend treating step 2 as its own reviewed decision, separate from the mechanical migration of step 1/3/4, rather than bundling a scope expansion into what's nominally a duplication cleanup.

---

## Summary sequencing recommendation

**CR-002 and CR-004's mechanical parts (steps 1/3/4, not CR-004's step 2) are the lowest-risk starting points** — both have a single clear target, no open sub-questions. **CR-003 is blocked on resolving whether Account implements `SettlementTarget`** — recommend answering that before scheduling CR-003 as a ticket. **CR-001 is the highest-risk, highest-value migration** and the one this whole reconciliation effort was ultimately for — recommend it last among the four, once the `SettlementTarget` pattern has been proven once (via CR-002/004) on lower-stakes code first.
