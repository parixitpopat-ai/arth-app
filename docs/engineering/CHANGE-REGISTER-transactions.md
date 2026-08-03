# Change Register — Transactions

`Opened 2026-08-03` (TRX-001B) · The operational artifact required by ADR-032 §3B to migrate existing duplicated mutations to their canonical owner. No entry here means no migration is currently approved or tracked — ADR-032's transitional policy has no other vehicle to run on.

## Migration Types

Not all entries here are the same kind of work:
- **Duplicate Migration** (CR-001–004): multiple independent implementations of the same rule, no canonical owner yet — the architecture had to decide who owns it first (ADR-032/025, AQ-001).
- **Canonicalization Migration** (CR-005): the architecture already knows who owns the rule (`Payable` owns outstanding liability, decided in AQ-001) — what's open is an *implementation* detail inside that owner (stored field vs. derived calculation vs. cached projection), not a domain-ownership question. This does not block architecture-dependent work the way CR-001–004 could have.

| ID | Type | Source | Target | ADR | Status | Approved By | Implemented In |
|---|---|---|---|---|---|---|---|
| CR-001 | Duplicate | Settlement allocation — 4 locations (`applyRepaymentAllocations`, `SettleModal.settle()`, `AddModal` L4480, `AddModal` L4641) | Transactions domain canonical settlement service | ADR-032 | Proposed | — | TBD |
| CR-002 | Duplicate | Outstanding balance — increment on CC charge — 2 locations (`AddModal` L4106, L4434) | Accounts domain canonical outstanding-balance service | ADR-032 | Proposed | — | TBD |
| CR-003 | Duplicate | Outstanding balance — decrement on CC payment/refund — 2 locations (`AddModal` L4527, L4637) | `Payable.applySettlement()` (per AQ-001) | ADR-032, AQ-001 | Proposed | — | TBD |
| CR-004 | Duplicate | Loan outstanding reduction via manual settlement — 1 location (`AddModal` L4512), conceptually overlapping CR-001 | Transactions domain canonical settlement service (same target as CR-001, if unified) | ADR-032 | Proposed — lower priority, not a strict duplicate, monitoring for unification opportunity | — | TBD |
| CR-005 | **Canonicalization** | **CR-005 — Canonicalize Payable Outstanding.** Two implementations of the same already-owned value: stored/incremental (`account.outstanding`) vs. derived/statement-cycle (`cardOutstanding()`) | `Payable.outstanding()` established as the canonical business value; existing stored fields become either derived caches or are retired after verification | AQ-001 | Proposed — implementation-only, does not block architecture-dependent work | — | TBD |

## Schema

- **Source:** what exists today — the duplicate rule and every location it lives in
- **Target:** the canonical owner it should migrate to, per ADR-032
- **ADR:** which frozen decision authorizes the migration
- **Status:** `Proposed` → `Approved` → `Complete`. A duplicate isn't migrated just because a ticket touches it — this status only moves to `Complete` once the source locations are actually removed and everything routes through the target.
- **Approved By:** who signed off moving from Proposed to Approved (blank until that happens)
- **Implemented In:** which `TRX-00X` ticket actually did the migration

## How this satisfies ADR-032 §3B

§3B requires "existing duplicated mutations shall be removed incrementally through approved Change Register items" — this document is that mechanism. No `TRX-001+` ticket should remove a duplicate implementation without a corresponding CR entry moving to `Complete`; no CR entry should reach `Complete` without a corresponding ticket in `Implemented In`. The CBR and this register should always agree: a rule marked `Canonical` in the CBR should have either no CR entry (never was a duplicate) or a `Complete` one (was migrated).

## Note on CR-004

The real finding here isn't "loans weren't duplicated" — it's that **Loan settlement and Transaction settlement share the same underlying business pattern while operating on different aggregates.** Payment reduces an outstanding amount; a status flag flips when it reaches zero. Same shape, different target object.

That's a design input for TRX-001C, not just a monitoring flag: rather than building a Transaction-only settlement engine and cloning it for Loans later (which would just create duplicate implementation #5 reactively), TRX-001C should evaluate whether **settlement is a domain capability with pluggable targets** — Transaction allocations, Loan principal, Receivables, and future liabilities all as valid settlement targets against one shared capability, rather than one implementation per object type. If that abstraction holds without weakening aggregate boundaries, CR-004 becomes preventative architecture decided up front, not a refactor discovered after the fact. Whether it actually holds is TRX-001C's design call — this note states the question, not the answer.
