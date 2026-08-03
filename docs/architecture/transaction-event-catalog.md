# Transaction Domain — Event Catalog

`2026-08-03` · TRX-001C, Team 6 deliverable · Status: **Draft — for review**
Three tiers as specified. Rule applied strictly throughout: **every event has exactly one publisher, stated explicitly** — and two naming conflicts with already-frozen decisions are resolved below rather than silently introducing duplicates.

---

## Naming reconciliation (before the catalog, not after)

Team 4's frozen `settlement-architecture.md` already named three events: `TransactionSettlementApplied`, `LoanPaymentApplied`, `SettlementCompleted`. This message's illustrative list used different names for overlapping concepts (`PersonShareSettled`, `AllocationCompleted`). Resolving rather than duplicating:

- **`TransactionSettlementApplied` (frozen) wins over `PersonShareSettled`** — same event, already named. Using both would itself violate "one publisher, one event" by giving one occurrence two names.
- **`AllocationCompleted` is not adopted as a separate event from `SettlementCompleted`.** Checked what each would represent: both describe "a payment was allocated across one or more targets." Two process events for the same act isn't two categories of information, it's the same information published twice — which is the exact failure mode ADR-033's statelessness rule and this message's "one publisher" rule both guard against. `SettlementCompleted`'s payload (the full allocation breakdown, already specified in Team 4's doc) already covers what `AllocationCompleted` would carry.

---

## 1. Aggregate Events

Published only by the aggregate that owns the state.

| Event | Publisher | Fires when |
|---|---|---|
| `TransactionPosted` | `Transaction` | A new transaction is created (`upsertTxn`, not-editing case) |
| `TransactionEdited` | `Transaction` | An existing transaction's fields change |
| `TransactionDeleted` | `Transaction` | Permanent deletion (no soft-delete, per ADR-018 — this event is the only record a deletion occurred, since there's no `deleted_at` row to query later) |
| `TransactionSettlementApplied` | `Transaction` | `Transaction.applySettlement()` is called — a `PersonShare`'s `settled_amt`/`remaining_amt`/`settled` changed. Payload includes whether this fully or partially settled the share (both cases fire this one event — no separate "PartiallySettled" event, since it's the same state transition method, just a different resulting value) |
| `LoanPaymentApplied` | `Loan` | `Loan.applySettlement()` is called (per ADR-033's `SettlementTarget` contract) |
| `PayableSettled` | `Payable` | `Payable.applySettlement()` is called (per AQ-001) — naming matches the `LoanPaymentApplied`/`TransactionSettlementApplied` pattern: `{Aggregate}{WhatHappened}` |

---

## 2. Process Events

Published by stateless orchestration only. Per ADR-033, `SettlementService` owns nothing — publishing this event is the one thing it's allowed to do with the outcome of its own computation, not a form of state ownership.

| Event | Publisher | Fires when |
|---|---|---|
| `SettlementCompleted` | `SettlementService` | An allocation across one or more `SettlementTarget`s finishes. Payload: total payment amount, full allocation breakdown (`[{target_kind, target_id, amount}]` — matches `settlement_event.allocations` from Team 5's schema exactly) |

**Refunds do not get a separate `RefundCompleted` process event.** Per ADR-017, refund is a flag (`isRefund`) on `settlement_in`, not a distinct type — applying that same reasoning to events (not just the schema) means a refund is a `SettlementCompleted` occurrence with `isRefund: true` in its payload, not a second event describing the same kind of act. Introducing `RefundCompleted` would quietly reopen a naming/modeling decision ADR-017 already made, just at the event layer instead of the type layer.

---

## 3. Integration Events

Only where something genuinely outside this domain needs to react. Checked each of this message's three examples against the "who actually publishes this" question rather than accepting all three as given:

| Event | Publisher | Consumed by | Included? |
|---|---|---|---|
| `AccountBalanceChanged` | **`Account`**, not Transaction | Anything tracking account balances (dashboards, statements) | **Included**, but reclassified: this is `Account`'s own aggregate event, not a Transactions-domain event. It appears here only because a `TransactionPosted` on a CC-linked transaction *triggers* `Account.applyCharge()` downstream — the trigger comes from Transactions, but the publisher is Account. Listed for the cross-domain flow to be visible, not because Transactions owns it. |
| `DashboardMetricsUpdated` | — | — | **Not included in this catalog.** This would be published by whatever owns Home/dashboard aggregation, reacting to `TransactionPosted` etc. — it's downstream of this domain's events, not published by it. Including it here would mean Transactions domain claims ownership of a concern (dashboard state) it has no business owning — the same mistake AQ-001 corrected for `Account`/`Payable`, applied consistently here. |
| `BudgetImpactCalculated` | — | — | **Not included**, same reasoning as above — Budget domain's own event, if it needs one at all. |

**The pattern worth stating explicitly:** "integration event" doesn't mean "any event another team might find useful" — it means an event *this domain* publishes across its own boundary. Two of the three suggested examples turned out to belong to other domains' catalogs instead, once checked against who actually owns the state being described.

---

## Publisher Summary (the enforceable table)

| Event | Publisher (exactly one) |
|---|---|
| `TransactionPosted`, `TransactionEdited`, `TransactionDeleted`, `TransactionSettlementApplied` | `Transaction` |
| `LoanPaymentApplied` | `Loan` |
| `PayableSettled` | `Payable` |
| `SettlementCompleted` | `SettlementService` |
| `AccountBalanceChanged` | `Account` *(not part of this domain's own catalog, included for traceability only)* |

No event in this list has, or should ever gain, a second publisher.
