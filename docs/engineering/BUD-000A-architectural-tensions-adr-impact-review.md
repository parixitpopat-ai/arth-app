# BUD-000A — Architectural Tensions & ADR Impact Review

**Status:** For architecture review. No architectural decisions are made in this document.
**Purpose:** Surface the ambiguity between frozen ADRs and the domain model emerging from BUD-000's audit, describe the candidate interpretations on their merits, and identify what needs a dedicated decision before BUD-000 continues. This document does not choose between the interpretations it describes, and does not treat any existing ADR as wrong.

---

## 1. Architectural Ambiguities Discovered

### Ambiguity 1 — What does "Allocation" actually mean?

This is not framed as an ADR conflict. On closer reading, ADR-025 and the BUD-000 product direction aren't necessarily contradictory — they may simply be describing two different things that both got called "allocation." The real open question is definitional, and it has at least three candidate answers:

**Interpretation 1 — Financial Allocation (Pool Model).** A Household Budget of ₹100,000 is divided into parts (Food ₹20,000, Family ₹30,000, ...) that are expected to reconcile back to the whole. This is what ADR-025, Rule 2 describes: *"People and Groups receive allocations from the Household Budget... allocations of that one pool, not separate pools of their own."* Planning-oriented — the question it answers is "how am I choosing to spend this money."

**Interpretation 2 — Analytical Allocation (Dimensional Model).** Category, Person, Trip, Goal, Project, and Liability are independent lenses over the same spend, with no reconciliation requirement between them — the same ₹500 transaction can contribute fully to more than one dimension at once. Reporting/accountability-oriented — the question it answers is "who or what did this money actually go toward, viewed from different angles."

**Interpretation 3 — Hybrid.** Financial allocations (the money plan — Household, Category budgets, Person/Group budgets) reconcile to a pool, as ADR-025 already describes. Analytical dimensions (Person spend, Trip spend, Goal progress as attribution rather than as a target) classify and report on the same activity without needing to reconcile to anything. Both exist; they're not the same mechanism wearing two names.

The distinction matters because it changes what "Allocation" is *for* in each case — a planning commitment versus a classification tag — and those don't need to behave identically just because both involve assigning a transaction to something.

### Ambiguity 2 (naming only) — "Forecast" (ADR-024) vs. "Budget Forecast" (BUD-000 candidate object)

Not a definitional ambiguity — a term collision. ADR-024 already froze **Forecast Status** as a specific, distinct concept (cash-flow survival risk, measured against Buffer, explicitly *not* budget adherence). BUD-000's candidate "Budget Forecast" object (projecting month-end spend vs. budget) answers a different question but risks being confused with the frozen concept if both ship under overlapping names. Flagged here for completeness; does not require an architecture decision the way Ambiguity 1 does — a naming resolution is sufficient.

---

## 2. Repository Evidence Supporting Each Interpretation

**Evidence supporting Interpretation 1 (Financial/Pool):**
- ADR-025 itself, already frozen, already using the word "allocations" for exactly the Person/Group case.
- The person/group override mechanism (`spendBudgetOverrides`, `manualLimitOverrides`) and the household mechanism (`annualBudget`, `monthOverrides`) are structurally identical — both are *target amounts* set by a user as a plan, not derived from transaction activity. That symmetry is real evidence these were intended as the same kind of thing.
- No repository evidence currently shows person/group allocations actually summing to or being validated against `annualBudget` — so even this interpretation isn't enforced in code today; it exists as documented intent (ADR-025) more than as an active constraint.

**Evidence supporting Interpretation 2 (Analytical/Dimensional):**
- `catAllocations` (transaction-level category split) and `t.people` (transaction-level person split) already coexist independently on the same transaction today, with no relationship enforced between them.
- Trip/Project/Goal/Liability have no allocation mechanism at all yet — the question is genuinely open for these, with no existing implementation pulling toward either interpretation.

**Evidence supporting Interpretation 3 (Hybrid) — this is where the schema itself is most informative:**
The repository already draws a clean structural line between two kinds of fields, and it's drawn this line consistently across every dimension that currently has both:
- **Planning-type fields** — `cat.budget`, `p.spendBudget`, `g.manualLimit`, `annualBudget` — are *targets*, set once by the user, independent of any transaction, living on the owning entity (Category/Person/Group) or the household shell.
- **Attribution-type fields** — `catAllocations`, `t.people` — are *facts about a specific transaction*, live only inside that transaction, and describe what actually happened rather than what was planned.
A category has both: `cat.budget` (the plan) and appears as a key inside `catAllocations` on individual transactions (the fact). Same for a person: `p.spendBudget` (the plan) and appears inside `t.people` (the fact). **This split already exists in the schema for every dimension that has planning at all — the codebase has been treating "plan" and "attribution" as two different things all along, it just never gave the distinction a name.** That's a materially stronger evidence base for Interpretation 3 than for either pure interpretation on its own.

---

## 3. Product Implications

- **If Interpretation 1 (Pool) is affirmed:** Allocation needs a reconciliation/validation layer that doesn't exist today — person/group/category plans would need to relate meaningfully to the household total. Gives one coherent "is my household budget being respected" answer, at the cost of forcing every future dimension (Trip, Goal, Project) into the same pool even where that may not fit naturally.
- **If Interpretation 2 (Dimensional) is affirmed:** Simplest to implement, extends cleanly to any future dimension with no reconciliation questions. Trade-off: no single number answers "is my household budget being respected" — that becomes a UX/reporting concern rather than a domain guarantee.
- **If Interpretation 3 (Hybrid) is affirmed:** Two distinct concepts under one umbrella term — a Financial Allocation (planning, reconciles) and an Analytical Dimension (attribution, doesn't reconcile) — matching the split the schema already has for Category and Person. Requires the most upfront naming/modeling discipline (two concepts instead of one), but appears to require the least *structural* change, since it's closest to what's already implemented today.

## 4. Recommended Architectural Decision(s) Required

1. **A dedicated product/architecture decision on which interpretation of "Allocation" Arth intends** — Pool, Dimensional, or Hybrid — informed by this document but not made inside it or inside a module audit.
2. **A naming decision** separating BUD-000's month-end spend projection from ADR-024's Forecast Status, so the two don't collide under one label (lower priority, doesn't block the interpretation decision above).

---

## 5. ADR Compliance Check (ADR-024) — Verified, No Drift Found

Per your instruction, checked whether current Budget/Home calculations comply with ADR-024's commitment-accounting rule (commitments reduce Protected Money's Cash Required, never Budget/Safe-to-Spend a second time) rather than assuming the earlier "orphaned rule" framing was itself correct.

**Finding: compliant, and the earlier "orphaned" framing was imprecise.** Every spend calculation used by Budget and Home (`myActual` line 1275, and `monthSpend` at lines 2353, 2386, 10643, 12842) sums only `type==="expense"` entries from the **transactions** array. Unpaid Bills live in a separate `bills` array and only become a transaction once paid — so these calculations structurally cannot double-count an unpaid commitment; there's nothing to exclude, because it was never included. `isCashOnlyNotBudget` exists in exactly one place — OutlookPage's forward-looking forecast — because that is the only calculation in the repository that projects *unpaid, future* obligations into a budget-relevant figure, which is the one place ADR-024's exclusion rule actually applies. **No compliance gap found; the earlier framing of this as an "orphaned rule" is corrected here — it's correctly scoped, not under-applied.**

---

## 6. ADR Status Summary

**Remain valid, no tension found:**
- ADR-008 (Person attribution field-priority) — relevant precedent for how Allocation should generalize `catAllocations`/`t.people`, not in conflict.
- ADR-021 (Master Data vs Financial Objects) — establishes that Allocation is a "verb" (behavior), not a "noun" (master data), and that the Engine layer (Balance/Ledger/Forecast/Analytics) is the existing pattern for verbs. **Per your instruction, not concluding Allocation is an Engine** — recording this only as an established precedent that makes "Allocation as a future platform capability" a valid, evidence-backed candidate for later evaluation, not a decided outcome.
- ADR-024 (Financial Model) — confirmed compliant, no amendment needed. The one open item is naming overlap with a new BUD-000 term, not a substantive conflict.

**May require clarification (not necessarily amendment):**
- **ADR-025, Rule 2** — describes Interpretation 1 (Pool) correctly for the Person/Group case it addresses, but doesn't speak to Category, Trip, Goal, Project, or Liability at all. It may be entirely correct as far as it goes, and simply need to be read as one part of a Hybrid model rather than the whole answer. Not recommending amendment here — recommending that the definitional question in Section 1 be resolved through its own decision process, after which ADR-025 either stands as-is (if Hybrid or Pool is affirmed) or is explicitly revisited (if Dimensional is affirmed for Person/Group too).

---

*This document makes no architectural decisions. It is intended to enable an informed review before BUD-000's modernization plan is finalized. BUD-000 should not proceed to Migration Planning until this is reviewed.*
