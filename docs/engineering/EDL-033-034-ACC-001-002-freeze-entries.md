# EDL Backfill — ACC-001 / ACC-002 Freeze Entries

`2026-08-10` · Documentation hygiene, not a new decision · Purpose: the engineering-decision-log's most recent entry (EDL-032, TRX-002C4b) is dated 2026-08-03; ACC-001 and ACC-002 were frozen 2026-08-04 with no corresponding EDL entries. These backfill that gap using the log's own template. Ready to insert at the top of `engineering-decision-log.md` (newest-first ordering) once reviewed — not yet committed.

---

## EDL-034 — Froze ACC-002 (Migration & Implementation Plan)

`2026-08-04`

**Decision:** Approved and froze ACC-002, decomposing Accounts modernization into ten work packages (WP-01–WP-10), resequenced from the original draft so migration design (WP-02a) and resolution UX (WP-02b) precede code-path wiring (WP-02) — data model migration before code-path changes, matching the discipline already applied on the Transactions track. Confirmed the dependency graph is non-linear: three tracks (Domain, Lifecycle, Independent/Reconciliation) rather than one chain.

**Reasoning:** ACC-001's frozen invariants (same day) made the target shape concrete enough to sequence real work packages against, rather than leaving migration as a single undifferentiated ticket. Splitting migration design from UX design (WP-02a/WP-02b) avoids assuming a resolution UX is needed before real user data confirms any records actually require one.

**What it doesn't decide:** Execution of any individual work package — ACC-002 bridges frozen architecture to a plan; each WP still needs its own `ACC-00X` execution ticket when started, mirroring how `TRX-002A–D` executed against ADR-034 rather than the plan document itself authorizing code changes.

**Affected Tickets:** ACC-001 (input), ACC-002 (this entry)
**Affected Modules:** Accounts
**Affected ADRs:** ADR-035 (Behavior vs. Classification, referenced throughout the WP sequencing)

---

## EDL-033 — Froze ACC-001 (Account Aggregate Definition), amended same day for Behavior vs. Classification

`2026-08-04`

**Decision:** Approved and froze ACC-001, defining `Account` as the aggregate root (one instance per row in the `accounts` array), with invariants traced directly to existing validation code (required name, debit-requires-linkedBank, etc.) rather than designed fresh. Same-day amendment: discovered while executing WP-02 that `type` is not a closed 5-value set as originally assumed — `normalizeAccountTypes` allows arbitrary user-defined "behaviors." Renamed the real system-owned invariant to `behavior` (closed enum: bank/cash/cc/debit/upi) and the open, user-configurable fields to `classificationId`/`classificationLabel`/`icon`/`bucket`, per the newly-frozen ADR-035.

**Reasoning:** Every invariant not traced to existing code is explicitly flagged as new rather than recovered (e.g. the `active`/`archived` lifecycle state, modeled on the existing Insurance-policy `status:"archived"` pattern but not itself pre-existing on Account) — keeping the provenance distinction visible rather than presenting a designed addition as a discovered fact.

**What it doesn't decide:** Deletion-orchestration UX (the reassignment-picker referenced in §5) — flagged as still open, not resolved by this freeze.

**Affected Tickets:** ACC-000 (input, Mutation Ownership Matrix), AQ-003 (input), ACC-001 (this entry)
**Affected Modules:** Accounts
**Affected ADRs:** ADR-035 (new, frozen same day — Behavior vs. Classification)

---

**Insertion note:** these are numbered EDL-033/034 assuming EDL-032 remains the latest committed entry at insertion time — renumber if entries have landed since this draft was prepared.
