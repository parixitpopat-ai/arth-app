# Transaction Aggregate — Domain Model

`2026-08-03` · TRX-001C, Team 1 deliverable · **Status: ✅ Frozen** — approved 2026-08-03

Derived from the 8 canonical / 4 duplicate rules in the CBR, the responsibility map from TRX-000A, and the actual field shapes observed in `src/App.jsx`'s transaction objects — not assumed from a generic DDD template. Respects ADR-017 (frozen transaction type taxonomy) without redesigning it.

---

## 1. Aggregate Boundary

**Aggregate root: `Transaction`.**

**Owned (inside the boundary — cannot exist without a parent Transaction, no independent identity outside it):**
- `PersonShare[]` — per-person split/settlement state for this transaction
- `LineItem[]` — itemization, only meaningful in the context of the transaction that owns it
- `SettlementLink[]` — when this transaction *is itself* a settlement, which dues it applies to

**Referenced, not owned (separate aggregates, held by ID only):**
- `Account` — a transaction points at an account; it does not own or embed account state. Confirmed correct per CBR: outstanding-balance mutation is an Accounts-domain rule, not a Transactions one.
- `Bill` — referenced via `paidBillId`/`linkedBillId`. Bill owns its own lifecycle (ADR-frozen `status` field); Transaction only records the link.
- `Loan` — referenced via `linkedLoanId`. Per TRX-001A, Loan owns its own creation and outstanding-reduction rules — these are NOT Transaction Aggregate responsibilities, even though one rule (manual loan settlement, L4512) currently *looks* like Transaction logic because it's physically colocated in `AddModal`. Physical colocation in the old code is not evidence of correct aggregate ownership — this is exactly the kind of "challenge the existing implementation" check requested.
- `Investment` — referenced via `linkedInvestmentId`, same reasoning as Loan.
- `Person` — referenced by ID inside each `PersonShare`; Person identity/profile is not Transaction's concern.
- `Category` — referenced via `catIds`/`subIds`.

**Boundary rule derived from this:** the Transaction Aggregate owns *the record of a financial event and who owes what because of it*. It does not own *what happens to other aggregates as a consequence* (account balances, bill status, loan outstanding) — those are downstream effects, triggered by domain events (see §5), applied by their own aggregates.

---

## 2. Entities vs. Value Objects

| Name | Kind | Why |
|---|---|---|
| `Transaction` | Entity (aggregate root) | Has persistent identity (`id`), lifecycle, mutable over time (edited, settled incrementally) |
| `LineItem` | Entity (local, child) | Has its own `id` (editable in place, per the existing `editingItemId` pattern found in TRX-000A/B) but no identity or meaning outside its parent transaction |
| `PersonShare` | Value Object | No independent identity of its own — identified only by `(transactionId, personId)`. Replaced wholesale on each mutation in the current code (`{...info, settledAmt:..., remainingAmt:...}`), which is actually already value-object-shaped behavior, just not formally modeled as one |
| `SettlementLink` | Value Object | Same reasoning — `{kind, id, amount}`, no independent lifecycle |
| `Money` | Value Object (new — doesn't exist today) | Currently amounts are raw numbers throughout (`Number(info.amount||0)` defensive-coercion patterns everywhere in the audited code — a symptom of not having a real Money type). Introducing this doesn't require currency support (single-currency today), just non-negotiable non-negative/rounding invariants in one place instead of scattered `Math.max(0, ...)` calls — which is the exact pattern that caused BUG-TRX-001 |

---

## 3. Invariants

Derived from CBR rules and observed (sometimes only partially enforced) behavior in the audited code:

1. **`PersonShare.settled` must always equal `PersonShare.remainingAmt <= 0`.** This was not an invariant before — it was a manually-recomputed field, missing entirely in one code path (the original bill-status bug). Making it a true invariant (computed, never independently set) makes that bug class structurally impossible, not just fixed once.
2. **`PersonShare.settledAmt` may never exceed `PersonShare.amount`.** Already enforced via `Math.min()` in the current code at every mutation site — promote to a constructor/setter-level invariant on the value object so it can't be bypassed by a future 5th implementation.
3. **A transaction's `type` constrains which fields are valid** (per ADR-017's frozen taxonomy) — e.g., `PersonShare[]` only makes sense for `expense`; `SettlementLink[]` only for `settlement_in`/`settlement_out`. This should be enforced by the aggregate's constructor/factory, not left to UI-layer discipline (currently: whatever `AddModal`'s 113 states happen to set).
4. **Not currently enforced anywhere found in the audit, flagged as an open question rather than assumed:** does the sum of `LineItem` amounts need to reconcile with the transaction's total `amount` when itemization is used? No evidence of this check existing today. Worth an explicit decision — either it becomes a real invariant, or it's confirmed as intentionally independent (itemization as informational detail, not a balancing constraint).

---

## 4. Lifecycle / State Machine

The current code has **no single top-level status field on Transaction** — unlike Bills. Reconstructing the actual lifecycle from behavior:

```
Draft (autosaved via draftBanner/draftData, localStorage, pre-submit)
   │
   ▼
Posted (upsertTxn — the transaction exists as a real record)
   │
   ├──▶ Edited (in place — same identity, fields change)
   │
   └──▶ Deleted (permanent, per ADR-018 — no soft delete, no recycle bin)
```

**Separately, each `PersonShare` has its own sub-lifecycle**, independent of the parent transaction's state:

```
Owed → (optionally) Partially Settled → Settled
```

This split matters: a transaction can be fully "Posted" while its shares are anywhere from all-Owed to all-Settled. Conflating these two lifecycles into one status field (the way Bills does) would be a modeling mistake — they're genuinely orthogonal, confirmed by the fact the current code never tries to unify them either.

**Open question for Team 1 review:** should "Deleted" remain a hard terminal state (per ADR-018) for the Aggregate design, or does introducing a formal state machine make this a natural point to flag ADR-018 for reconsideration? Not deciding this here — ADR-018's own reopening clause is about Sync/Cloud-Backup/Collaboration mattering, not domain modeling convenience, so the bar for reopening it isn't met by "it would be cleaner." Flagging, not proposing.

---

## 5. What this implies for Domain Events (preview — Team 6's actual deliverable)

Not designing these here, but the aggregate boundary above dictates the event boundary: events fire from `Transaction` when its own state changes (`TransactionPosted`, `TransactionEdited`, `TransactionDeleted`, `SettlementApplied` — the last one specifically because settlement changes `PersonShare` state, which is owned by this aggregate). Events like account balance changes or bill status changes are **consequences other aggregates react to**, not things Transaction does to them directly — this is the mechanism that replaces today's direct `setAccounts`/`setBills` calls from inside transaction-save logic.

---

## 7. Invariant Table

The contract Teams 2–8 work against. A proposed refactor that violates a `✓` row is rejected regardless of how clean the resulting code looks. `Open` rows are not yet decided — treat as unconstrained until resolved, not as implicitly "no."

| Invariant | Status |
|---|---|
| `PersonShare.settled` always equals `PersonShare.remainingAmt <= 0` (computed, never independently set) | ✓ |
| `PersonShare.settledAmt` never exceeds `PersonShare.amount` | ✓ |
| Transaction `type` constrains which fields/child objects are valid (per ADR-017) | ✓ |
| Transaction has exactly one `Account` reference | ✓ |
| Amount values are non-negative where the domain requires it (enforced via `Money`, not scattered `Math.max`) | ✓ |
| Transaction owns `PersonShare[]`, `LineItem[]`, `SettlementLink[]` — no other aggregate may mutate these directly | ✓ |
| Loan owns loan balance/outstanding; Transaction may reference but never mutate it directly | ✓ |
| Account owns outstanding-balance mutation; Transaction may reference but never mutate it directly | ✓ |
| Transaction has no single top-level lifecycle status; `PersonShare` settlement state is a separate, orthogonal sub-lifecycle | ✓ |
| Delete is permanent, no soft-delete (per ADR-018) | ✓ *(inherited, not re-decided here)* |
| `sum(LineItem amounts)` reconciles with transaction `amount` when itemized | **Open** — pending Team 2 audit of actual current behavior; do not assume either outcome |

---

## 9. Addendum (AQ-002, 2026-08-03)

`PersonShare` is a value object **shared by both the `Transaction` and `Bill` aggregates**, not exclusive to Transaction. Confirmed via direct code audit: real `Bill.splitPeople` and `Transaction.people` are the identical shape (amount/mode/settledAmt/remainingAmt/settled), and every read site treats them interchangeably via a fallback (`t.people?.[pid] || t.splitPeople?.[pid]`). This doesn't change Transaction's own boundary (§1) — it means Bill, as its own aggregate, independently owns a `PersonShare[]` of its own, using the same value object definition. No design change; this model already accommodated it, just wasn't stated explicitly until this audit.

## 8. What this deliberately does not answer

- Whether Settlement becomes a shared domain capability across Transaction/Loan/Receivable (Team 4/CR-004's question) — this model assumes `Transaction.applySettlement(personId, amount)` exists as an aggregate-owned method with enforced invariants, callable *by* a settlement capability, without deciding whether that capability is a shared service or per-aggregate logic. Both designs are compatible with the boundary drawn here.
- Persistence shape, repository interfaces, API contract — Teams 5/7/8.
- Migration steps for CR-001–004 — Team 3.

This is the boundary and the invariants. Everything else builds on top of it.
