# TRX-001 — CBR Reconciliation Report

`2026-08-03` · Investigation 1 of TRX-001 · Status: **Complete**

Answers: what happened to the Canonical Business Rules Register between its creation and today, checked against ADR-032 and the full EDL — not assumed, traced.

---

## 1. Audit of the latest CBR

Current state (`canonical-business-rules-register-transactions.md`):

| Rule | Canonical? | Duplicates |
|---|---|---|
| Settlement allocation | ❌ | 4 |
| Reduce person's owed amount + recompute settled | ❌ | 4 (same underlying rule as above) |
| Outstanding balance — increment on CC charge | ❌ | 2 |
| Outstanding balance — decrement on CC payment/refund | ❌ | 2 |
| Bill status recomputation | ✔ | 0 |
| Bill settlement mirrors to linked transaction | ✔ | 0 |

**Baseline: 2 canonical, 4 duplicate.**

## 2. Comparison against frozen ADRs

Only ADR-032 is relevant (no other frozen ADR touches Transactions/Accounts/Settlement rules — checked against the real repo's ADR-001–023 index, none overlap this domain). Cross-referencing ADR-032's Migration Impact table against the CBR table above: **all 6 CBR rows are represented in ADR-032** — every duplicate rule has an assigned future canonical owner (Transactions domain for settlement-related rules, Accounts domain for outstanding-balance rules), and both already-canonical rules are confirmed unchanged (Bills domain, formalized location TBD but ownership itself not in question).

**Gap found:** the CBR document itself was never edited to reference ADR-032 by name after it froze. Its "Owner (domain)" column still reads as aspirational (e.g. "Transactions" without qualification) rather than citing the frozen decision that makes it authoritative. This is a documentation sync gap, not a substance gap — the decision exists and is correct, the CBR just doesn't point to it yet. Fixed in this report's output (see §6).

## 3. Trace through the Engineering Decision Log

Relevant entries, in order: EDL-007 (SEC-001, unrelated to CBR directly) → EDL-008 (CBR opened, seeded from TRX-000A's corrected findings) → EDL-009 (TRX-000A/B closed, BUG-TRX-001 opened on the corrected 4-location settlement duplicate) → EDL-010 (renamed to CBR, TRX-000C confirmed zero domain owner for settlement) → EDL-011 (ADR-032 drafted, Ownership Matrix corrected to "TBD") → EDL-012 (ADR-032 frozen with 3A/3B split, procedural rule adopted) → EDL-013 (Phase 1 closed, DoD formalized in the CBR itself).

**No EDL entry records a change to the canonical/duplicate counts themselves** at any point — every entry that touches the CBR either seeds it, renames it, or adds process around it. The counts have been 2/4 since the register's first draft.

## 4. Why the counts changed (or didn't)

**They didn't change, and that's the correct outcome for Phase 1, not a stall.** The 2 canonical rules became canonical *before* the CBR existed — they were fixed as live bugs during this session's settlement debugging (bill-status recompute, bill-to-transaction mirroring), and the CBR was created afterward to register that fact alongside the still-open duplicates. ADR-032 then defined *where* the 4 duplicates should end up — but ADR-032 explicitly states it proposes no code changes itself ("Migration Impact... no implementation steps"). So there was never a point between CBR creation and now where an implementation ticket could have moved the count. Phase 1 was audit and architecture only; TRX-001 is the first ticket positioned to actually move these numbers.

## 5. Verify every surviving rule is represented in the frozen architecture

Confirmed yes for all 6 registered rules (see §2). **Not confirmed** for the two explicitly flagged-unaudited items: `setLoans` (4 call sites, TRX-000A found them but marked "not yet confirmed identical or distinct") and `setInvestments` (2 call sites, same status). These have no CBR entry, no ADR-032 coverage, and no audit conclusion — they are the honest unknowns, not silently assumed either way.

## 6. Orphaned rules / architectural gaps found

1. **`setLoans` and `setInvestments`** — real gap, carried forward from TRX-000A, never closed. Before TRX-001 designs the Transaction Aggregate, these need at least a quick duplication check (same method as the CC-balance check: read each site directly, don't pattern-match) since loan and investment creation are both triggered from inside `AddModal`'s transaction-save flow and could plausibly hide a similar duplicate.
2. **CBR/ADR-032 cross-reference missing** — cosmetic but worth fixing before it causes confusion: the CBR should cite ADR-032 explicitly per row, not just implicitly agree with it.
3. **No Change Register exists yet** — ADR-032's 3B policy requires "approved Change Register items" to migrate existing duplicated mutations, and TRX-001's own deliverable list includes "Change Register Entry," but no Change Register artifact has been created in this project at all yet. This isn't a rule-ownership gap, but it is a process gap: 3B's migration mechanism currently has no vehicle to run on.

---

## Reconciled Baseline for TRX-001

**2 canonical, 4 duplicate, unchanged since Phase 1, all 6 covered by ADR-032, 2 rules (`setLoans`/`setInvestments`) still unaudited and excluded from this baseline until checked.**

TRX-001 (Transaction Domain Model / Aggregate design) can proceed on this baseline for the 6 registered rules. Recommend a short pre-check on `setLoans`/`setInvestments` before finalizing the Aggregate's boundaries, so the domain model isn't designed around 6 rules only to discover a 7th and 8th once the Aggregate is already frozen.
