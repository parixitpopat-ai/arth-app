# ADR-034 — Transition from State-Centric to Command-Centric Architecture

`Proposed 2026-08-03` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-03

Not a persistence ADR. `saveCloudSnapshot()` is the most visible symptom of the actual gap, not the gap itself.

---

## The actual difference

**Today (state-centric):**
```
Current State → Mutate JavaScript Objects → saveCloudSnapshot(snapshot)
```
Business behavior and state mutation are the same act, performed inline, wherever a component happens to need it — which is the root mechanical cause of every duplicate rule this project found (BUG-TRX-001, CR-001 through CR-005).

**Target (command-centric):**
```
User Intent → Command → Application Layer → Aggregate → Domain Events → Persistence
```
Behavior is expressed once, as a command handled by exactly one owner (Teams 1–6's entire output). Persistence is what happens *after* behavior has already been correctly applied and validated — not the mechanism behavior is smuggled through.

## Decision

**Business behavior may no longer mutate application state directly. All state changes happen through commands, handled by the aggregate that owns the relevant invariant, per ADR-032/025.** This is true regardless of what technology persists the result.

**Persistence technology is explicitly not decided by this ADR and may not change for some time.** A snapshot can remain the serialization format at the edge — `Command → Aggregate → Snapshot Serializer → saveCloudSnapshot()` is a legitimate, ADR-033-compliant flow. What's frozen is that nothing upstream of the serializer is allowed to bypass the aggregate to write state directly. This makes the ADR durable independent of whether Supabase, SQLite, Postgres, or something else eventually holds the data.

---

## Migration sequencing (revised — behavior before storage)

Persistence migration is deliberately **last**, not first, because changing behavior while storage stays constant is lower-risk than changing both simultaneously.

- **TRX-002A — Application Layer.** Command Dispatcher, Command Handlers, Aggregate Repository interfaces, Unit of Work if required. **No `Transaction` implementation yet** — this is plumbing only, and it's testable/verifiable independent of any specific aggregate.
- **TRX-002B — Transaction Aggregate implementation.** Built against TRX-002A's plumbing.
- **TRX-002C — Settlement extraction.** `SettlementService` + `SettlementTarget`, per ADR-033 — this is where CR-001/CR-004 actually get resolved in code.
- **TRX-002D — Payable introduction.** Per AQ-001 — this is where CR-002/CR-003/CR-005 get resolved.
- **(Not yet scheduled) Persistence migration** — replacing or supplementing `saveCloudSnapshot()`'s whole-blob approach with real per-aggregate storage, once TRX-002A–D have proven the command-centric behavior works correctly against the existing snapshot mechanism. Only scheduled after, not before.

## Why this ordering reduces risk

Snapshot persistence isn't the problem — direct state mutation is. Fixing behavior first, while storage stays exactly as it is today, means every one of TRX-002A–D can be verified against real running behavior (the app still works, still syncs, still shows correct data) without also debugging a storage migration at the same time. This is the same reasoning already applied throughout TRX-001C: don't change two things at once when they can be sequenced and verified independently (see: ADR-032's transitional 3B policy, applied here at the persistence layer instead of the code layer).

## What this does not decide

- The actual replacement persistence technology, if any — not scheduled, not designed here
- Whether the snapshot format itself needs to change shape to accommodate the new schema (Team 5) before or after TRX-002A–D — open question for whoever schedules the eventual persistence work
- Timeline for TRX-002A–D beyond the ordering stated

## Sign-off

Proposed, not Active. Needs explicit approval, per the same discipline applied to every prior ADR this session.

---

# ADR-033 — Cross-Aggregate Orchestration: Domain Services Decide, Aggregates Mutate

`Proposed 2026-08-03` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-03

Resolves CR-004. Elevated from a Transactions-scoped decision (Team 4, TRX-001C) to a general architectural rule because the reasoning applies wherever a business process spans more than one aggregate — this is bigger than Settlement alone.

**Relationship to ADR-032:** this doesn't invoke ADR-018's reopening clause independently — it's answering a question ADR-032 itself left open (§Q1, "who owns settlement"), within work ADR-032 already authorized. Not a new precedent for the freeze; a continuation of one already granted.

---

## Decision

**Cross-aggregate decisions belong to domain services. Aggregate state changes belong only to the aggregate that owns the invariant.**

A domain service may decide *what should happen* across multiple aggregates — but it may never *make it happen* by reaching into an aggregate's internal state directly. Every aggregate exposes intention-revealing methods; the service calls them and never bypasses them.

## Why (the two failure modes this rejects)

**Failure mode 1 — every aggregate independently reinvents the same cross-cutting logic.** This is today's actual Settlement code: `applyRepaymentAllocations`, `SettleModal.settle()`, and two more independent blocks, each hand-implementing "reduce an owed amount, recompute settled." Four correct-in-isolation implementations with no mechanism keeping them consistent — confirmed as the direct cause of 3 production bugs this session (BUG-TRX-001, plus the earlier bill-settlement fixes).

**Failure mode 2 — a shared service reaches directly into aggregate state to avoid the duplication.** This looks like the fix, but breaks a harder rule: an aggregate is the only thing allowed to enforce its own invariants. If a service sets `share.remainingAmt -= x; share.settled = (remainingAmt<=0)` directly, that invariant is enforced by service discipline, not by the aggregate boundary — which is exactly how the duplication in failure mode 1 happened, just moved to a new location. The aggregate becomes a passive data structure; the service becomes the real (undeclared) owner.

## The pattern this decision establishes

```
SettlementTarget {
  outstanding()
  applySettlement(allocation)
}
```

Any aggregate that can receive a settlement implements this contract. The orchestrating domain service depends on the contract, never on a concrete aggregate type. For Settlement specifically: `Transaction implements SettlementTarget`, `Loan implements SettlementTarget`; `Receivable`/`Payable` join only when real business evidence requires it — the interface existing is not license to implement it everywhere for symmetry (Bills explicitly do not implement it today, per insufficient evidence — see Team 4's settlement-architecture.md).

**The orchestrating service itself must be stateless** — stores nothing, owns nothing, persists nothing, pure orchestration. Without this constraint, a domain service accumulates responsibility over time the way a computation engine legitimately can (`src/domain/financialEngine/engine.js` is fine being stateful-adjacent for forecasting) — but an orchestrator drifting into ownership is exactly the failure this ADR exists to prevent.

## Domain events, two tiers

- **Aggregate events** (e.g. `TransactionSettlementApplied`, `LoanPaymentApplied`) — fired by the aggregate itself when its own state changes. These are what downstream consumers react to.
- **Process events** (e.g. `SettlementCompleted`) — fired by the orchestrating service to record that a cross-aggregate process occurred, carrying the full allocation breakdown. For audit/history, not for triggering further side effects — those come from the aggregate-level events, not the process event.

## Scope of this ADR

**ADR-033 establishes a preferred architectural pattern, not a mandatory framework. It should be adopted only where an audited domain process spans multiple aggregates and the separation of orchestration from invariant enforcement provides measurable architectural benefit.** It does not itself decide:
- Which other business processes in Arth beyond Settlement should adopt it (evaluated case by case, as evidence emerges — not applied pre-emptively, and never adopted merely because the pattern is available or elegant)
- Whether Bills ever implement `SettlementTarget` (open, insufficient evidence today)
- Implementation details of `settlement.js` itself (Team 3's migration plan)

## Sign-off

**Approved and Frozen 2026-08-03.** Scoping clause (adopt case-by-case, not as mandatory framework) incorporated per review before freezing.

---

# ADR-032 — Settlement & Ledger Mutation Ownership

`Proposed 2026-08-01` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-01

**Reason for approval:** TRX-000C demonstrated an architectural ownership gap, not merely an implementation issue. The audit established that settlement and outstanding-balance mutation are duplicated across independent UI implementations with no canonical owner. That satisfies the reopening criterion established by ADR-018 and justifies a new architectural decision.

**Invokes ADR-018's reopening clause.** ADR-018 Decision 2 (permanent delete, no soft-delete) explicitly named its own trigger for revisiting: *"if Sync/Cloud-Backup/Collaboration ever make undo-ability matter."* This ADR isn't reopening that specific decision, but it establishes the same justification pattern for touching the repo under its stated freeze (`Status: FROZEN, as of ADR-021 — no new ADRs unless a major architectural flaw is discovered`).

**Precedent statement, recorded explicitly since this is the freeze's first invocation:** This ADR was approved because repository evidence (TRX-000C and the Canonical Business Rules Register) demonstrated duplicated ownership of core financial business rules with no canonical owner, resulting in multiple confirmed production defects. **This establishes that the architectural freeze may be reconsidered only when objective repository evidence demonstrates a systemic ownership gap that materially affects correctness or maintainability** — not on the basis of a general sense that something looks messy. Future ADRs invoking this clause should be held to the same evidentiary bar: an audit (`XXX-000`), a register entry (CBR or equivalent), and confirmed production defects or an equivalent measurable harm — not stylistic disagreement.

**Evidence this ADR is answering to** (not repeated in full — see TRX-000C and the Canonical Business Rules Register):
- `applyRepaymentAllocations` and `SettleModal.settle()` share zero code; one call site total for the former in the entire file
- 4 independent implementations of "reduce person's owed amount + recompute settled"
- 2 duplicate pairs implementing outstanding-balance mutation
- CBR baseline: 2 canonical rules, 4 duplicate rules, as of 2026-08-01

---

## Question 1 — Who owns settlement?

**Decision:** Settlement allocation and its consequences (reducing owed amounts, recomputing settled status, mirroring to linked bills) become the responsibility of a single domain owner: the **Transactions domain.** Not because settlement is conceptually "a transaction," but because every settlement in this app either originates as a transaction (the Settlement-tab repayment flow) or targets one (bills' `paidByTxnId` link already makes transactions the source of truth over bills, confirmed in this session's bug fixes). Bills and Accounts consume settlement outcomes; they don't own the rule.

## Question 2 — Who owns outstanding balance mutation?

**Decision:** Outstanding balance mutation becomes the responsibility of the **Accounts domain.** Currently it's an inline side-effect of whatever transaction happens to touch a CC account (`AddModal`, 4 sites). Under this decision, a transaction that affects an account's outstanding balance *requests* that change from Accounts; it does not compute or apply the change itself.

## Question 3 — Which module is allowed to mutate ledger state?

### 3A. Architectural Invariant (Frozen)

**Only the canonical domain owner may own the business rules that mutate ledger state. UI components are never the canonical owner of ledger mutation rules.**

This is timeless — it remains true regardless of whether the canonical implementation currently exists. It does not, by itself, require any code to change today.

### 3B. Implementation Policy (Transitional)

**Until the canonical domain services are implemented, existing UI mutations may remain in place for backward compatibility.** However:
- **No new business-rule mutations may be introduced directly into UI components.** All new mutation logic must follow the ownership model defined by this ADR.
- **Existing duplicated mutations shall be removed incrementally through approved Change Register items** — not a big-bang rewrite, not left indefinitely either.

This is the specific, enforceable rule that prevents duplicate implementation #5: a component that needs to change ledger state calls a named domain function going forward; it does not `setTxns(prev=>prev.map(...))` inline in new code. It is a hard rule for new code and is **not** retroactively enforced against existing code by this ADR alone — that migration happens through tracked Change Register items, giving 3A something to converge toward without forcing an immediate rewrite.

## Question 4 — What is the canonical lifecycle?

**Decision:**

```
Transaction recorded
        ↓
Settlement calculated (if applicable)
        ↓
Account balances updated
        ↓
Bill state updated
        ↓
Derived projections refreshed (Home/Outlook/Insights aggregates)
```

Each arrow is a domain boundary. A step may only be triggered by the step before it completing — never invoked directly by a UI component skipping ahead (e.g., a component should not update Bill state directly without Settlement having calculated what changed and Account balances having been updated first, even if today's code sometimes does exactly that).

---

## Migration Impact

Ownership only — no implementation steps, no code changes proposed by this ADR itself:

| Existing rule | Current owner | Future canonical owner |
|---|---|---|
| Settlement allocation | None (duplicated: `AddModal`, `SettleModal` — 4 locations) | Transactions domain |
| Reduce person's owed amount + recompute settled | None (same 4 locations) | Transactions domain |
| Outstanding balance — CC charge/payment | None (duplicated inline in `AddModal` — 4 sites, 2 rule-pairs) | Accounts domain |
| Bill status recomputation | Bills (canonical, but component-scope) | Bills domain (unchanged owner, formalized location) |
| Bill-to-transaction settlement mirroring | Bills/Transactions (canonical, but component-scope) | Transactions domain (settlement is the trigger; bill state is the consequence) |

## What this ADR does not decide

- The actual code structure (file names, whether "domain function" means a plain module export, a class, or something else) — implementation detail for `TRX-001+`
- Timeline or sequencing of which rule gets migrated first (though the CBR and TRX-000A/C evidence make Settlement and Outstanding Balance the obvious starting pair, being the only rules already proven duplicated)
- Anything about Accounts, People, or Loans domains beyond the two rules explicitly addressed above — this ADR is scoped to what TRX-000A/C's evidence actually covered, not a full ledger redesign

## Sign-off

**Approved and Frozen 2026-08-01.** Amendments 1 (3A/3B split) and 2 (strengthened precedent statement) incorporated per review before freezing.

---
