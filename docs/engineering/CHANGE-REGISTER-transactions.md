# Change Register — Transactions

`Opened 2026-08-03` (TRX-001B) · The operational artifact required by ADR-032 §3B to migrate existing duplicated mutations to their canonical owner. No entry here means no migration is currently approved or tracked — ADR-032's transitional policy has no other vehicle to run on.

## Migration Types

Not all entries here are the same kind of work:
- **Duplicate Migration** (CR-001–004): multiple independent implementations of the same rule, no canonical owner yet — the architecture had to decide who owns it first (ADR-032/033, AQ-001).
- **Canonicalization Migration** (CR-005): the architecture already knows who owns the rule (`Payable` owns outstanding liability, decided in AQ-001) — what's open is an *implementation* detail inside that owner (stored field vs. derived calculation vs. cached projection), not a domain-ownership question. This does not block architecture-dependent work the way CR-001–004 could have.
- **Explicit Architectural Debt** (CR-006): a concept intentionally NOT canonicalized yet, because it hasn't earned that decision through evidence — kept in a legacy adapter on purpose, with a stated exit criterion, rather than either silently absorbed into an aggregate or silently left ungoverned. Different from ordinary tech debt: this is *governed* debt, tracked the same way a real migration is.

| ID | Type | Source | Target | ADR | Status | Approved By | Implemented In |
|---|---|---|---|---|---|---|---|
| CR-001 | Duplicate | Settlement allocation — 4 locations (`applyRepaymentAllocations`, `SettleModal.settle()`, `AddModal` L4480, `AddModal` L4641) | Transactions domain canonical settlement service | ADR-032 | **In Progress** — Step 1 + Step 2 done: the plain-transaction, single-person-share settlement path is now canonical in BOTH `applyRepaymentAllocations` (txn-kind branch) and `SettleModal.settle()` (else branch), both routed through the same `Transaction.applySettlement()` via `settlePersonShareOnTransaction`, both proven equivalent before repointing (TRX-002C3, TRX-002C4). **Still legacy, not yet touched:** the bill-kind branches of both functions (Bill has no aggregate yet), `applyRepaymentAllocations`'s group-txn/group-bill/tagged branches, and `AddModal` L4480/L4641 entirely. Not Complete until every location and branch is repointed and the full suite stays green. | — | TRX-002C3, TRX-002C4 (both partial) |
| CR-002 | Duplicate | Outstanding balance — increment on CC charge — 2 locations (`AddModal` L4106, L4434) | Accounts domain canonical outstanding-balance service | ADR-032 | Proposed | — | TBD |
| CR-003 | Duplicate | Outstanding balance — decrement on CC payment/refund — 2 locations (`AddModal` L4527, L4637) | `Payable.applySettlement()` (per AQ-001) | ADR-032, AQ-001 | Proposed | — | TBD |
| CR-004 | Duplicate | Loan outstanding reduction via manual settlement — 1 location (`AddModal` L4512), conceptually overlapping CR-001 | Transactions domain canonical settlement service (same target as CR-001, if unified) | ADR-032 | Proposed — lower priority, not a strict duplicate, monitoring for unification opportunity | — | TBD |
| CR-005 | **Canonicalization** | **CR-005 — Canonicalize Payable Outstanding.** Two implementations of the same already-owned value: stored/incremental (`account.outstanding`) vs. derived/statement-cycle (`cardOutstanding()`) | `Payable.outstanding()` established as the canonical business value; existing stored fields become either derived caches or are retired after verification | AQ-001 | Proposed — implementation-only, does not block architecture-dependent work | — | TBD |
| CR-006 | **Explicit architectural debt** | **CR-006 — Group Collective Canonicalization.** Group-collective settlement tracking (`groupCollectiveAmount`/`groupCollectiveSettledAmt`) stays legacy plain-object mutation, deliberately isolated inside `settlePersonShareOnTransaction`'s adapter (TRX-002C3) instead of absorbed into the `Transaction` aggregate | Not yet determined — requires its own domain audit first (see Exit criterion below) | — | **Open — deliberate, not accidental** | — | N/A |

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

## Note on CR-006

**Why an entry exists for something that isn't being migrated:** the alternative to registering this was to either (a) silently absorb `groupCollectiveAmount`/`groupCollectiveSettledAmt` into the `Transaction` aggregate without evidence it belongs there, or (b) leave it as ungoverned legacy code with no record that anyone noticed. Per this project's own discipline (ADR-001: don't expand a model without evidence), neither was acceptable — the concept exists in the code, but hasn't been audited as a business concept the way person-share settlement, Loans, and Payables were. CR-006 makes that gap visible and trackable rather than either silently deciding it or silently ignoring it.

**Exit criterion:** a domain audit of group-collective tracking as its own business concept — is it a Transaction-owned field, a separate aggregate, or something else entirely? — followed by either absorbing it into whichever aggregate the audit points to, or explicitly deciding it stays a cross-cutting concern outside any single aggregate. Until that audit happens, it stays exactly where TRX-002C3 put it: in the adapter, not the domain model.
