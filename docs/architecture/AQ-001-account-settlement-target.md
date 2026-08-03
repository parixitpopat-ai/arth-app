# AQ-001 — Does Account Implement SettlementTarget?

`2026-08-03` · Architectural investigation, blocking CR-003 and Teams 5–8 · Status: **Resolved**

---

## The question

Is a credit-card payment a settlement against an obligation the Account itself represents (making `Account implements SettlementTarget`), or is `outstanding` a derived/incidental number that a payment merely updates as a side effect, with the real obligation living elsewhere?

## Evidence

**`outstanding` is a stored, manually-mutated field — not purely derived — and it's strictly CC-specific.** Every mutation site is guarded by `type==="cc"`: `AddModal` L4106/L4434 (increment on charge), L4527/L4637 (decrement on payment/refund), and two more sites at L1394/L1398 (refund handling). Non-CC accounts (savings, cash, UPI) never have this field touched anywhere in the codebase. This rules out the "Account balance in general" framing — the question is specifically about CC accounts' `outstanding`, not Accounts broadly.

**A second, independent notion of CC outstanding already exists in the code, computed differently.** `cardOutstanding(account)` (used for the Credit Card Liability total on dashboards) recomputes outstanding fresh from the statement cycle — summing charges since the last statement date, minus refunds, minus payments since that date — rather than reading the stored `account.outstanding` field at all. **These are two parallel implementations of "how much is owed on this card," one stored/incremental, one derived/statement-cycle-based, with no evidence they're ever reconciled against each other.** This wasn't part of TRX-001A's original audit scope (that covered `setAccounts` mutation sites, not this separate derived calculation) — surfacing it here because it's directly relevant to answering AQ-001, and it's a finding in its own right worth registering.

**Conceptually, CC `outstanding` behaves exactly like a debt obligation** — money owed to the card issuer, reduced by payment, with a natural "fully paid" terminal state — structurally identical to `Loan.outstanding`. That similarity is what raised the question in the first place.

## Analysis

The stored-vs-derived tension above is the deciding evidence, not just a tie-breaker. If `Account.outstanding` were the single, uncontested source of truth for what's owed, treating `Account` itself as a `SettlementTarget` would be defensible — the obligation and the account would be the same thing. But there are **already two competing answers to "how much is owed on this card"** in the live code. Making `Account` a `SettlementTarget` would mean the aggregate responsible for enforcing settlement invariants is also the aggregate with an internal consistency problem between two of its own numbers — exactly the kind of coupling ADR-033 exists to prevent.

**The obligation and the Account are conceptually different things that happen to be stored on the same record today.** An Account is "a place transactions post to, with a balance." A CC's outstanding balance is "an obligation owed to the issuer" — which happens to be tracked *via* the CC account, but is a distinct business concept, matching exactly what ADR-033 already anticipated and left room for: **a Payable.**

## Resolution

**`Account` does not implement `SettlementTarget`. A CC account's outstanding balance is modeled as a `Payable`** (the concept ADR-033 already named as a future `SettlementTarget` implementer, not a new addition) — associated with the Account (each CC account has-a Payable representing what it owes), but a distinct aggregate/entity with its own invariants, separate from the Account's own balance-tracking role.

This has a direct, valuable side effect: it forces a decision on the stored-vs-derived tension found above. The `Payable`'s `outstanding()` (the `SettlementTarget` method) becomes the **single canonical calculation** — likely the statement-cycle-derived version, since that's the one that actually matches real-world credit card billing behavior (a stored incremental counter can drift; a fresh calculation from statement-cycle transactions cannot). The old stored `account.outstanding` field becomes either a cached/denormalized copy of the Payable's calculation, or is retired entirely in favor of always computing it — a decision for whoever implements CR-003, informed by this resolution rather than left open.

## Consequences for CR-003 and Teams 5–8

- **CR-003 becomes:** implement `Payable` (owned by Accounts domain, associated with a CC-type Account) implementing `SettlementTarget`; `SettlementService.allocate()` can now treat CC payments identically to Transaction/Loan settlements. L4527/L4637 migrate to `Payable.applySettlement()`, not `Account.applySettlement()`.
- **A second, smaller migration item surfaces:** reconcile or retire the duplicate `cardOutstanding()` derived calculation against the new canonical `Payable.outstanding()`. Not urgent enough to block CR-003, but should be tracked — recommend CR-005.
- **Teams 5–8 now have a stable model:** `Payable` gets its own schema consideration (Team 5), its own `SettlementTarget`-family events (Team 6), and Account itself stays a simple balance-holder in the API/schema, not conflated with settlement semantics.

## What this does not decide

- Whether `Payable` eventually generalizes beyond CC accounts (e.g. other liability types) — no evidence reviewed for that here, not assumed
- The exact mechanics of retiring vs. caching `account.outstanding` — flagged as CR-005, not resolved
