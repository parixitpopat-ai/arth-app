# Governance Decision — CR-ACC-BUD-001 Resolution & Budget WP-3 Unblock

`2026-08-10` · Governance reconciliation, not new architecture work · Basis: direct read of `CR-ACC-BUD-001-change-request.md` §7 and its own status header — no other document introduced, no re-audit performed.

---

## Question

> Is CR-ACC-BUD-001 formally resolved, and therefore is BUD WP-3 unblocked?

## Decision

**Yes.** CR-ACC-BUD-001 is resolved, per its own status line and §7's content. BUD WP-3 is unblocked from the CR, subject to the one documented prerequisite below. No newer governance artifact was found that supersedes §7.

## Basis (strictly from the CR document itself)

| Item | Resolution |
|---|---|
| **CR status** | The document's own header states "Resolved (see §7)" |
| **Planning Allocation** | A new aggregate is required, modeled directly on `Account`'s shape (closed dimension-type enum, static factory, `update()`/`delete()` commands, `Money`-typed amounts, typed events) |
| **Read models** | Confirmed pattern-compliant — Planning Allocation reads and Attribution totals match the `domain/cards/summaries.js` precedent; no aggregate needed for the read side itself |
| **Person Attribution** | Fully resolved against real `App.jsx` evidence. Canonical rule registered (`CBR-TRX-person-attribution-semantics.md`): counts `mode: "spent_on"` only, excludes `mode: "owes"`. One concrete defect identified: `getPersonAttributedTotal` in PR-1 currently sums all `t.people` entries regardless of mode — needs a one-line fix (`mode==="spent_on"` filter) before that function is trusted for real Budget consumption |
| **Category-dimension Attribution** | Left open — two viable paths, not decided in this CR. The CR's own header explicitly labels this **non-blocking**. Per instruction, this is not being reinterpreted as a blocker |

## What this changes

**`budget-v1-engineering-dashboard.md`'s current state is stale, not correct.** It reads "⚠️ CR-ACC-BUD-001 open" and "WP-3 and beyond are paused pending reconciliation" — both should be updated to reflect the resolution above.

## WP-3 unblock — conditions, not a blank check

WP-3 (Budget Storage Migration) is unblocked **contingent on**:
1. The Planning Allocation aggregate (per §7 resolution point 2) actually being built before WP-3's storage migration proceeds — the CR resolves *what* to build, not a substitute for building it.
2. The one-line `getPersonAttributedTotal` fix landing before that function is used by any real Budget consumer.

Category-dimension Attribution remains an open, tracked, non-blocking item — not resolved by this memo, not required to be resolved before WP-3 proceeds.

## What this memo does not do

- Does not modify `budget-v1-engineering-dashboard.md` — that update should happen as its own tracked change, by whoever owns that file's update cadence ("updates as PRs merge," per its own header).
- Does not start WP-3 or any implementation work.
- Does not reopen or re-decide Category-dimension Attribution.
- Does not touch code.
