# PPL-008 — Insurance → Person: Trace & Decision

**Status:** Active — trace/design phase only. No implementation, no schema changes, no UI changes, no migration.
**Issued:** 2026-09-03
**Precedent:** Mirrors PPL-004's structure exactly (the trace-first brief that preceded School's PPL-006 work) — Insurance gets the same discipline School got, not School's finished shape copied over by analogy.

---

## Why this is its own item, not an extension of PPL-007

PPL-007 (the frozen Person Relationship Architecture) deliberately left Insurance's attribution mechanism undecided. What's already established, from direct trace during PPL-006:

- `insurancePolicies[]` is a live, complete, cloud-synced feature — not vestigial, contradicting an earlier assumption. It has no `personId` field; `insuredPerson` is free text.
- `"Insurance"` also exists as a `BILLER_TYPES` entry, but selecting it in the UI diverts into the `insurancePolicies[]` list rather than producing a real `billerAccounts` record — so the apparent `billerAccounts.attributedTo` path for Insurance doesn't actually work today.

Two structurally different things currently both answer to the name "Insurance," and neither has a working Person link. This is exactly the situation PPL-004 traced for School before any code existed — the same rigor applies here, not the finished School pattern applied by analogy. **Do not build Insurance yet.**

---

## The central question this trace must answer before any implementation

> Should Insurance use the same `billerAccounts.attributedTo = person` mechanism School, Mobile, and other services already use — or does Insurance genuinely require richer, policy-level ownership semantics that plain attribution can't represent?

This is not a foregone conclusion. Insurance has real properties the other domains don't: a policy has an `insuredPerson` *and* a `nominee` (two distinct relationships, not one), a `policyNumber`, a `sumInsured`, a `premiumFrequency`, and its own complete lifecycle (active/archived) already built entirely inside `insurancePolicies[]`. Whether that shape fits into "one biller account, one attributed person" or needs something closer to School's `billerAccountId`-plus-lifecycle-enrichment pattern — or something neither of those precedents anticipated — is exactly what this trace exists to determine.

---

## Required trace, before any decision is proposed

1. **Full re-trace of `insurancePolicies[]`**, current as of today's codebase (not carried over from the PPL-006-era trace, which was done against an earlier state): every field, every read/write path, the `ADR-021` reference noted during PPL-006 (confirm whether an actual ADR-021 document exists anywhere in the repo, or whether that citation is itself worth investigating).
2. **Full re-trace of the `"Insurance"` `BILLER_TYPES` entry**: exactly what happens when a user taps it in the biller grid today, and whether a real `billerAccounts` record with `type: "Insurance"` is reachable through any path at all.
3. **`insuredPerson` vs `nominee`**: are these genuinely two different relationships (the person covered, vs. who receives a claim payout) that need two separate attribution mechanisms, or does only one matter for the Person-relationship question this trace is answering?
4. **Does Insurance need lifecycle enrichment** (a `insuranceRelationships[]`-shaped array, mirroring `membershipRelationships[]`/`schoolRelationships[]`), or is a policy's own `status: active/archived` field already sufficient, making a separate relationship-lifecycle layer redundant?
5. **What, if anything, already reads `insuranceRelationships`** — confirmed hardcoded to `[]` in `App.jsx` since before PPL-006; re-confirm this is still true and trace every consumer.

---

## Explicit options to evaluate, not to choose from prematurely

1. Give `insurancePolicies[]` a real `personId` field, routing Insurance through Branch 2 (direct domain ownership) of PPL-007's canonical contract — the option most consistent with Insurance already being a complete, independent feature with its own CRUD, not naturally biller-account-shaped.
2. Make the `"Insurance"` `BILLER_TYPES` label actually produce a real `billerAccounts` record (Branch 1), with `insurancePolicies[]`'s financial facts and the biller account's Person relationship treated as intentionally parallel, joined by some reference.
3. Something else entirely, if the trace reveals a shape neither of the above anticipates.

**This document does not pick one.** The trace above must be completed and reported before any decision is proposed, matching PPL-004's own discipline.

---

## Hard boundaries, explicit

- No code, no schema changes, no UI changes until a decision is proposed, reviewed, and frozen.
- No assumption that Insurance follows School's exact shape merely because School's implementation succeeded — this is the specific trap flagged before PPL-007 was written, and it applies here with full force.
- Person Profile UI itself stays untouched throughout — per current direction, it's a pure consumer of relationship data; Insurance's trace should determine what data it produces, not add anything to how Person Profile displays it.
- Do not touch `membershipRelationships[]`'s cloud-sync gap as part of this work — that's a separate, already-scoped follow-up item, unrelated to Insurance.

---

## Deliverable

A PPL-008 trace-and-decision document, in the same format PPL-004 and PPL-006's WP-6 trace used: exact current-state findings with file/line citations, the options genuinely on the table, a recommendation with reasoning, and — only once reviewed and approved — a frozen decision. Implementation does not begin until that freeze happens.
