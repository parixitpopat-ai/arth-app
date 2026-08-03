# Transaction Domain — Schema Design

`2026-08-03` · TRX-001C, Team 5 deliverable · Status: **Draft — for review**
Schema only. No migrations, no implementation. Every table below traces to a decision already frozen (Team 1's model, ADR-032/033, AQ-001) — nothing here introduces new ownership, it encodes ownership already decided.

---

## `transaction`

The aggregate root.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `type` | enum | Frozen list per ADR-017: `expense`, `income`, `transfer`, `cc_payment`, `cc_emi`, `settlement_in`, `settlement_out`, `investment` — not redesigned here |
| `date` | date | |
| `amount` | decimal | `Money` value object at the domain layer; stored as decimal here |
| `account_id` | uuid, FK → `account.id` | Referenced, not owned — per Team 1 §1 |
| `category_id`, `subcategory_id` | uuid, FK, nullable | |
| `note` | text, nullable | |
| `payment_method` | enum, nullable | Per ADR-016/017's existing scoping (Bank-account expenses only) |
| `transaction_ref` | text, nullable | External reference (UPI/bank ref) |
| `is_refund` | boolean | Existing flag pattern, per ADR-017 (flags/relationships, not new types) |
| `reimbursable` | boolean | Same |
| `paid_bill_id` | uuid, FK → `bill.id`, nullable | Relationship, per ADR-017 |
| `linked_loan_id` | uuid, FK → `loan.id`, nullable | Relationship — **reference only, Transaction never mutates Loan** |
| `linked_investment_id` | uuid, FK → `investment.id`, nullable | Same pattern |
| `created_at`, `updated_at` | timestamp | |
| `deleted_at` | — **intentionally absent** | Per ADR-018, delete is permanent — no soft-delete column. A deletion is a row removal (or event-sourced tombstone, see `transaction_events`), not a flag. |

---

## `transaction_line_item`

(Renamed from `transaction_items` — matches the frozen model's `LineItem` naming, avoids ambiguity with generic "items.")

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Local entity identity (Team 1 §2 — has its own `id`, editable in place, no meaning outside its parent) |
| `transaction_id` | uuid, FK → `transaction.id` | Owned — cascade delete with parent |
| `label` | text | |
| `qty` | decimal | |
| `unit` | text, nullable | |
| `unit_price` | decimal | |
| `category_id`, `subcategory_id` | uuid, FK, nullable | |

**Open dependency:** whether `sum(unit_price * qty)` across a transaction's line items must reconcile with `transaction.amount` is still the one **Open** row in Team 1's Invariant Table. This schema doesn't add a `CHECK` constraint for it — adding one now would be deciding the open question via schema rather than via the audit that's supposed to resolve it.

---

## `transaction_person_share`

(This is the `PersonShare` value object. Modeled as its own table rather than embedded JSON, since it needs its own settlement-related columns and is queried independently — e.g. "everything a person owes across all transactions.")

| Column | Type | Notes |
|---|---|---|
| `transaction_id` | uuid, FK → `transaction.id`, part of composite PK | Owned by Transaction |
| `person_id` | uuid, FK → `person.id`, part of composite PK | Referenced, not owned |
| `mode` | enum | `owes`, `owes_by_me`, `on_me` (existing modes, unchanged) |
| `amount` | decimal | Original share amount |
| `settled_amt` | decimal | Mutated only via `Transaction.applySettlement()` — no other write path |
| `remaining_amt` | decimal | **Computed, not stored independently** — `amount - settled_amt`. Modeling as a generated/computed column (or strictly recomputed on every write, never read-modify-written independently) is the schema-level enforcement of the Team 1 invariant that caused the original bill-status bug when it wasn't enforced. |
| `settled` | boolean | **Also computed** — `remaining_amt <= 0`. Same reasoning; this is literally the invariant that was missing in the original bug. |

---

## `settlement_link`

(For when a transaction *is itself* a settlement — `settlement_in`/`settlement_out` types — recording which dues it applies to.)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `settlement_transaction_id` | uuid, FK → `transaction.id` | The settlement transaction this link belongs to |
| `target_kind` | enum | `transaction_share`, `loan`, `payable` (extensible per `SettlementTarget` implementers — Bill deliberately excluded per AQ-001/Team 4's open finding) |
| `target_id` | uuid | Polymorphic reference — resolved based on `target_kind` |
| `amount` | decimal | How much of this settlement applies to this target |

---

## `payable`

New table — the AQ-001 resolution. Owned by the Accounts domain, associated with (not embedded in) `account`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `account_id` | uuid, FK → `account.id` | One `payable` per CC-type account (1:1, but modeled as its own table/aggregate, not a column on `account` — per AQ-001) |
| `principal_charges` | decimal or **computed** | Feeds the canonical `outstanding()` calculation — see note below |
| `statement_date`, `due_date` | date | Existing CC-billing-cycle fields, moved here from `account` |
| — | | **`outstanding` is deliberately not a stored column here.** Per AQ-001/CR-005, `outstanding()` should be the statement-cycle-derived calculation (the one `cardOutstanding()` already does), not a second stored counter that could drift from a first. If a cached/materialized value is needed for read performance, it's an explicit, clearly-labeled cache column (e.g. `outstanding_cache`, `outstanding_cache_updated_at`), never the primary source of truth. |

## `account`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `type` | enum | `cc`, `savings`, `cash`, `upi`, etc. |
| `name`, `last4` | text | |
| `opening_balance` | decimal | |
| — | | **No `outstanding` column.** Per AQ-001, that's `payable`'s concern for CC-type accounts, and doesn't exist at all for other account types (confirmed: never touched on non-CC accounts in the audited code). Removing it from `account` isn't just a rename — it's the schema enforcing the AQ-001 boundary so a future developer can't accidentally reintroduce the two-sources-of-truth problem by adding a quick `account.outstanding` write. |

## `loan`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `direction` | enum | `taken`, `given` |
| `principal` | decimal | |
| `outstanding` | decimal | Loan's own stored outstanding — **this one stays**, unlike Account/Payable, since TRX-001A found no evidence of a competing derived calculation for Loans the way `cardOutstanding()` exists for CC accounts. Not applying the AQ-001 pattern here by default — no evidence it's needed. |
| `status` | enum | `active`, `closed` — computed from `outstanding <= 0`, same invariant-enforcement principle as `transaction_person_share.settled` |
| `source_type` | enum, nullable | `cc` for CC-EMI-linked loans |
| `linked_card_id` | uuid, FK → `account.id`, nullable | |
| `cc_emi_plan_id` | text, nullable | |

---

## `settlement_event` (process-level, per ADR-033's two-tier events)

Not the aggregate-level events (those live in `transaction_events` below, scoped per-aggregate) — this is `SettlementCompleted`'s persistence, the coordinating record of a cross-aggregate allocation act.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `payment_amount` | decimal | Total payment that triggered this allocation |
| `allocations` | jsonb | `[{target_kind, target_id, amount}]` — the breakdown `SettlementService.allocate()` decided |
| `created_at` | timestamp | |

**This table is allowed to exist even though `SettlementService` itself is stateless (per ADR-033)** — the service computing and emitting a record isn't the same as the service *owning* state. This is an audit-history table, populated by the process event, not a working-state table the service reads back from to make decisions.

---

## `transaction_events` (aggregate-level domain events, Team 6's actual scope — schema only, previewed here since it's schema)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `transaction_id` | uuid, FK → `transaction.id` | |
| `event_type` | enum | `TransactionPosted`, `TransactionEdited`, `TransactionDeleted`, `TransactionSettlementApplied` — full list is Team 6's deliverable, not finalized here |
| `payload` | jsonb | Event-specific data |
| `occurred_at` | timestamp | |

---

## What this schema deliberately does not do

- No `outstanding` stored on `account` (removed per AQ-001)
- No settled/remaining columns computed by application code alone without a schema-level commitment to them being derived, not independently writable
- No new transaction `type` values (ADR-017 respected)
- No soft-delete column (ADR-018 respected)
- Does not resolve whether `payable.outstanding_cache` is actually needed — that's a performance decision for implementation, not architecture
