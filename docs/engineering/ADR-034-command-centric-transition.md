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

**Business behavior may no longer mutate application state directly. All state changes happen through commands, handled by the aggregate that owns the relevant invariant, per ADR-032/033.** This is true regardless of what technology persists the result.

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
