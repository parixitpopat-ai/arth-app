# PPL-006 — Closure Record

**Status:** CLOSED.
**Closed:** 2026-09-03
**Final implementation commit:** `d10898f` — "PPL-006 WP-6: safe School Person reattribution + close BillerAccountModal and Membership-flow escape hatches"
**Closure trace:** `PPL-006-closure-trace.md`, verdict **PPL-006 CLOSEABLE**, committed alongside this record.

---

## What this closes

School Fees now has a complete, verified Person relationship lifecycle: create (with saved Person, `Me`, or explicitly unlinked), persist (localStorage + cloud snapshot), display (Person Profile → Organisations), and edit (change Person, unlink, re-link) — with every reachable path that could mutate a School Fees biller account's Person attribution brought into architectural consistency, per PPL-007's canonical relationship contract. Historical financial data (fee periods, settlements, outstanding amounts) is structurally incapable of being touched by any Person-attribution change, confirmed by direct code inspection, not merely by test.

## Work packages, for the record

| WP | Commit | Scope |
|---|---|---|
| WP-1 | `eac0c92` | Retired `schoolId`; converged School identity onto `billerAccounts.id` |
| WP-2 | `0c95b1d` | Resolved the two-schools-same-person join ambiguity |
| WP-3 | `e5442f1` | `schoolRelationships[]` state, persistence, cloud sync |
| WP-4 | `2707f7f` | Real Person/biller-account picker in `AddSchoolYearModal` |
| WP-5 | `603c93c` | Wired real data into Person Profile's Organisations section |
| WP-6 | `d10898f` | Person reattribution/unlink, shared-account protection, closed the generic `BillerAccountModal` and Membership-flow escape hatches |

## Known, accepted, non-blocking gap

`attemptSchoolAttributionChange` (`src/screens/SchoolFeesScreen.helpers.js`) has no test explicitly named for the `__me__` sentinel. Confirmed functionally correct by direct code inspection — the function contains no `personId`-specific branching, so `__me__` follows the identical path as any other person id. **Not added now.** To be added opportunistically the next time this file is legitimately modified for any other reason — not a reason to reopen WP-6.

## What remains explicitly out of School's scope, unaffected by this closure

- "Change School" (moving an existing schedule to a different biller account) — never scoped into WP-6, remains undecided.
- Insurance's own Person-attribution mechanism — PPL-007 left this open by design; addressed next under PPL-008.
- `membershipRelationships[]`'s cloud-sync gap — a real, pre-existing bug, unrelated to School, found during WP-3's trace and left on record.

## Governance note

This closure record is committed with no code changes — a pure documentation commit, per instruction. School Fees is not to be reopened as a WP under PPL-006; any future School-specific work (e.g., "Change School") starts as its own numbered item.
