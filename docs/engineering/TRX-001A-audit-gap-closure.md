# TRX-001A — Audit Gap Closure: setLoans & setInvestments

`2026-08-03` · Status: **Complete**
Method: direct read of every call site (same discipline as the earlier `setAccounts` correction — no pattern-matching, no assuming call-count implies duplication).

---

## setInvestments (2 sites) — result: no duplication found

| Site | Line | What it does |
|---|---|---|
| Create/update | `AddModal` L4573 | Upserts an investment record — creates if new, updates if an existing record matches by `id` or `linkedTxnId` |
| Remove | `AddModal` L4733 | Deletes the investment record when an existing investment-type transaction is edited to a different type |

**Verdict:** these are two different operations (upsert vs. delete) on the same collection, not two implementations of the same rule. Correctly single-purpose. No CBR "Duplicate" entry warranted.

## setLoans (4 sites) — result: no strict duplication, but one relationship worth registering

| Site | Line | What it does |
|---|---|---|
| Create (generic loan) | `AddModal` L4180 | Creates a new loan record for a manually-entered loan |
| Create (CC-EMI-linked loan) | `AddModal` L4689 | Creates a loan record specifically for a credit-card-backed EMI plan — different required fields (`ccEmiPlanId`, `linkedCardId`, `sourceType:"cc"`) than the generic case |
| Reduce outstanding via settlement | `AddModal` L4512 | User-initiated payment allocation reduces a loan's `outstanding`, flips `status` to `"closed"` when it reaches zero |
| Reduce outstanding via CC-EMI auto-tracking | `AddModal` L4531 | Automatic reduction triggered by posted `cc_emi` installment transactions being cleared via a CC bill payment — a different trigger mechanism entirely, not user-initiated |

**Verdict on the two creation sites:** different loan subtypes with different required shapes — not confirmed as the same rule implemented twice. Registering as related-but-distinct rather than assuming either way.

**Verdict on the two reduction sites:** genuinely different triggers (manual settlement vs. automatic installment-tracking), so not duplicates of *each other*. **But L4512 is structurally the same underlying pattern as the 4-way duplicate already registered under BUG-TRX-001** ("apply a payment, reduce an outstanding amount, flip a settled/closed status") — just applied to a Loan instead of a Transaction-person-share. This isn't a new duplicate in the CBR's strict sense (same object, multiple implementations), but it's a real signal: **whatever canonical settlement service ADR-032 leads to should very likely also serve Loan outstanding reduction**, or this becomes duplicate implementation #5 of the same conceptual rule the moment someone builds the Transactions-domain service without considering Loans.

---

## CBR Updates

6 new rows added, all Canonical (no duplication found in this audit):

| Rule | Owner (domain) | Canonical? | Duplicates |
|---|---|---|---|
| Investment record create/update | Investments | ✔ | 0 |
| Investment record removal on type change | Investments | ✔ | 0 |
| Loan creation — generic | Loans | ✔ | 0 *(related to next row — not confirmed distinct)* |
| Loan creation — CC-EMI-linked | Loans | ✔ | 0 *(related to previous row — not confirmed distinct)* |
| Loan outstanding reduction — manual settlement | Loans | ✔ | 0 *(conceptually related to Settlement Allocation — see note above)* |
| Loan outstanding reduction — CC-EMI auto-tracking | Loans | ✔ | 0 |

**Updated baseline: 8 canonical, 4 duplicate** (up from 2 canonical — the audit found no new duplication, only previously-unclassified canonical rules).

## What this means for TRX-001C (Aggregate design)

The audit gap is closed — no more "unevaluated" rules remain in scope. One design input for the Aggregate/domain-service boundaries: the Loan outstanding-reduction relationship above suggests the canonical settlement service (whatever ADR-032 leads to) should be designed with Loans in mind from the start, not bolted on after Transactions-only design is already frozen.
