# BUD-001A — Implementation Readiness Review

**Status:** For review
**Purpose:** Not an architecture approval — architecture was already frozen at ARCH-001/ADR-035/ADR-036. This is a readiness gate: confirming BUD-001 is executable as written before engineering begins. Once approved, no further planning documents precede implementation — the next artifacts are BUD-002 (UX Modernization) and BUD-003 (Implementation Brief).

---

## Readiness Checklist

- [x] **Architecture frozen** — ADR-035 (Allocation Engine) and ADR-036 (Financial Calendar) both frozen, approved via ARCH-001.
- [x] **ADR dependencies resolved** — BUD-001's Dependency Map (Section 2) accounts for every module Budget touches; no undeclared dependency found during planning.
- [x] **Migration plan approved** — Section 3's mapping covers every current mechanism found across BUD-000's Repository Audit, Component Audit, and Mutation Census; nothing left unmapped except the explicitly-carried Event/Vehicle item below.
- [x] **Work packages approved** — WP-1 through WP-4 sequenced and scoped; WP-5/WP-6 explicitly deferred, not scheduled.
- [x] **Rollback approved** — seven-phase migration strategy (Section 6) plus Migration Principles (Section 6A) adopted as binding, not advisory.
- [x] **Open architectural questions documented** — Event/Vehicle dimension status, decided below rather than left ambiguous in BUD-001.
- [x] **Risks accepted** — Risk Register (Section 5) reviewed; no risk found that blocks starting WP-1.
- [x] **Implementation can begin** — contingent on the one decision below being recorded, not on any further design work.

---

## Decision Required: Event & Vehicle Dimension Status

**The question BUD-001 correctly declined to answer on its own:** are Event and Vehicle genuine long-term Allocation Engine dimensions, or module-local concepts that happen to share a shape with `cat.budget`/`t.vehicleId`?

**Decision:** Not resolved here either — and that's the correct outcome, not a gap. The repository evidence available (a field exists, a field is populated) doesn't answer a question about long-term domain intent. This is recorded as an explicit, carried-forward open item, not silently closed by either adding the dimensions or deleting the fields.

**Governing rule, restated:** if Event and/or Vehicle are ever promoted to Allocation Engine dimensions, that happens through a dedicated **ADR-035A Addendum** — never through a code change that quietly treats them as dimensions because BUD-001's migration happened to be underway at the time. Until an ADR-035A Addendum exists, WP-3 does not touch `ev.budget` or `t.vehicleId`; they remain exactly as they are today.

**Consequence for WP-3:** the migration table in BUD-001 Section 3 is complete as written — this item is correctly marked "not migrated," not missing.

---

## Verdict

**Approved to proceed to implementation**, on the condition that the Event/Vehicle decision above is treated as binding (i.e., no informal promotion of either field during WP-3 or WP-4 without an ADR-035A Addendum first).

No further architecture or planning documents are required before engineering begins. Next artifacts:

```
BUD-001A ✅ (this document)
    ↓
BUD-002 — UX / UI Modernization
    ↓
BUD-003 — Implementation Brief
    ↓
Engineering (WP-1 → WP-2 → WP-3 → WP-4)
```
