# PPL-007 — Person Relationship Architecture: Trace, Decision, Freeze

**Status:** FROZEN on approval. This is the authoritative architecture document for how any domain relates to Person in Arth. It supersedes and consolidates PPL-004's audit, the original `PPL-relationship-architecture-decision.md`, and everything PPL-006 proved by building School end-to-end.
**Date:** 2026-09-03
**Supersedes:** Do not start WP-6 (Change School) or any Insurance implementation until this document is reviewed and explicitly frozen. PPL-006 (WP-1 through WP-5) is accepted and closed — School will not be reopened by this document; it's incorporated as proof, not revisited as a question.

---

## 0. Why this document exists

PPL-004 asked the right question before any School code existed: what is the canonical Person relationship architecture? PPL-006 then built School end-to-end and, in doing so, proved several things PPL-004 could only hypothesize. This document closes the loop — it takes what's now proven, applies the same rigor to every other domain PPL-004 originally scoped, and freezes the result. Nothing here authorizes new implementation. The explicit warning going into this: School's success is not permission to copy its exact shape onto Insurance without first asking the same questions PPL-004 asked of School. Section 4 below asks them.

---

## 1. School — proven, not theorized

What PPL-006 actually demonstrated, as fact, not plan:

- `billerAccounts.id` is sufficient as the sole School identity. No parallel `schoolId` was needed once `schoolRelationships[]` was adapted to carry `billerAccountId` instead.
- The reuse-before-create discipline (same school across academic years = one continuous relationship, one biller account) works and is tested (`feeScheduleLink.test.js`'s "RESOLVED" case).
- A lifecycle-enrichment layer (`schoolRelationships[]`) sitting on top of plain attribution, mirroring Membership's `membershipRelationships[]` shape exactly, is the correct pattern when a domain needs active/ended history that plain attribution can't represent.
- The read layer (`resolveOrganisationInfo`, `getPersonActiveConnections`) required **zero changes** to accommodate School once School's relationship shape matched Membership's — confirming the canonical contract (Section 3) is real, not aspirational.
- The "financial attribution ≠ saved Person" invariant survived implementation intact: `AddSchoolYearModal`'s "Not linked to a saved person" option is the default, unpenalized path, and a `feeSchedules` record with no attribution behaves identically to one with attribution once you strip the Person-facing UI away.

This is now the reference implementation. Every future domain gets compared against it, not against a fresh design exercise each time.

---

## 2. Membership — documented as the lifecycle-enriched extension

Membership was never in question architecturally; PPL-006 confirmed by direct code equivalence (`endSchoolRelationship IS lifecycle.js's endMembership`) that Membership and School share the exact same underlying lifecycle machinery (`domain/membership/lifecycle.js`). Membership is not a separate mechanism School was modeled after — they are two callers of one shared, domain-agnostic lifecycle module.

**Formal position:** Membership is the original instance of the pattern now named in Section 3 as "lifecycle enrichment." It is not a competing architecture, was never at risk of being one, and requires no changes as a result of this freeze.

**One real, standing gap, found during PPL-006 WP-3's trace and still unresolved:** `membershipRelationships[]` has full localStorage persistence but was never added to the cloud snapshot (save or load side) — confirmed by direct inspection of both the snapshot object literal and the restore function. This is a genuine bug, independent of School, not fixed during PPL-006 per its explicit scope boundary. Listed in the priorities the closing note of this document raises, not resolved here.

---

## 3. The canonical contract, formalized

```
Person
  │
  ├── Branch 1: Generic attribution
  │     billerAccounts[] where attributeType === "person" && attributedTo === personId
  │     (Mobile, Electricity, Broadband, School Fees, and any other domain
  │      modeled as a biller account)
  │
  ├── Branch 2: Direct domain ownership (rare — see caveat below)
  │     A domain record carrying personId natively, with no biller-account
  │     wrapper. No live example currently uses this branch — feeSchedules
  │     originally had a personId field, but PPL-006 routed School through
  │     Branch 1 (billerAccountId) instead. Branch 2 stays formally defined
  │     because a future domain may not fit the biller-account shape at
  │     all (see Section 6 — Gifts and Groups are examples of relationships
  │     that exist entirely outside this contract, not inside Branch 2).
  │
  └── Lifecycle enrichment (Section 8 — the one sanctioned escape hatch)
        A relationship object shaped exactly like membershipRelationships[]:
        {id, billerAccountId, personId, status, statusHistory}
        Attaches active/ended (or richer) history to a Branch-1 entry.
        Never a competing identity source. Never carries its own separate
        "which organisation" field — billerAccountId is always that field.
```

**Read layer:** `getPersonActiveConnections(personId, {groups, membershipRelationships, schoolRelationships, ...}, ...)` and `resolveOrganisationInfo(relationship)` are the two functions any UI consumes. Neither contains domain-specific knowledge beyond "does this relationship's `billerAccountId` resolve to a real `billerAccounts` entry" — proven by the fact School required zero changes to either function.

---

## 4. Mobile Recharge — confirmed, no open questions

Already routes through Branch 1 exactly as designed: `billerAccounts[]` with `type` in `{Mobile Prepaid, Mobile Postpaid}`, using the generic `attributedTo`/`attributeType` fields. No lifecycle enrichment need has ever been identified for Mobile — a recharge doesn't have a status that outlives any single transaction the way a Membership or School relationship does. Nothing to freeze here beyond confirming it already fits Section 3's contract without modification.

---

## 5. Insurance — the attribution gap, resolved as a decision; ownership model, explicitly NOT resolved here

This is the section the warning at the top of this document is about. Two different questions were previously conflated, and PPL-006's trace separated them:

**Question A — is `insurancePolicies[]` vestigial?** Answered, with certainty, during PPL-006's trace: **no.** It is a complete, live, cloud-synced feature (full CRUD, reachable UI, auto-generates a linked Bill on save). The original `PPL-relationship-architecture-decision.md` assumption that it was vestigial is superseded by this document. `insurancePolicies[]` stays exactly as it is — **do not touch it** — per your explicit instruction, both in PPL-006 and repeated here.

**Question B — how does Insurance attribute to a Person?** This is the actual open question, and this document resolves only the *shape* of the gap, not the fix:

- `insurancePolicies[].insuredPerson` is a free-text string. It has no `personId` reference into `people[]` and cannot participate in Branch 1 or Branch 2 as currently shaped.
- Separately, `"Insurance"` exists as a label in `BILLER_TYPES`, but selecting it in the UI diverts into the `insurancePolicies[]` list rather than creating a real `billerAccounts` record — so the apparent Branch-1 path for Insurance doesn't actually produce a biller account today.

**Decision, frozen here:** Insurance attribution is **not decided by this document**. Three real options exist and none is chosen yet:
1. Give `insurancePolicies[]` a real `personId` field and route it through Branch 2 (direct domain ownership) — the option most consistent with the fact it's a complete, independent feature with its own CRUD, not naturally modeled as a "biller account" the way Mobile is.
2. Make the `"Insurance"` `BILLER_TYPES` label actually produce a real `billerAccounts` record (Branch 1), separate from `insurancePolicies[]`, and treat the two as intentionally parallel — a policy's *financial* facts live in `insurancePolicies[]`, its *Person relationship* lives in a biller account, joined by some reference.
3. Something structurally different from both, once a real Insurance-specific trace (an actual PPL-00X audit, School-style) is done.

**This document's only ruling on Insurance:** whichever option is chosen, it must produce a `billerAccountId`-bearing relationship if it needs lifecycle enrichment (matching Section 3), and it must not require `insuredPerson` to become a mandatory `people[]` reference (Section 7). Beyond that, Insurance needs its own PPL-00X trace before implementation — exactly the caution in your framing. This document explicitly declines to extend School's shape onto Insurance by analogy.

---

## 6. Other BillerAccounts — the automatic-Organisation rule

Any `billerAccounts[]` entry with `attributeType === "person"` and a real `attributedTo` **automatically** qualifies as a Person-linked Organisation, with no domain-specific code required, by construction of `getPersonActiveConnections`'s Branch-1 read. This was true before PPL-006 (Mobile already worked this way) and is now proven true for School too. The rule, stated plainly:

> **Attribution is Organisation membership.** A domain does not need its own entry in `getPersonActiveConnections` to appear in a person's Organisations — it needs a `billerAccounts` row with `attributeType: "person"` and a valid `attributedTo`. Lifecycle enrichment is opt-in on top of that, only when a domain genuinely needs active/ended history (Section 8).

Electricity, Broadband, DTH, Fastag, Society Maintenance, and any future biller-modeled domain get this for free. No further architecture work is needed for "other billers" as a category.

---

## 7. Gifts, Groups, Transactions, Debt/Future Money — explicitly outside the Organisation contract

PPL-006's trace already established this distinction empirically (every one of these domains was traced during WP-1); this section formalizes it as a rule rather than an observation:

| Domain | Relationship to Person | Why it's NOT an Organisation |
|---|---|---|
| Gifts | `gifts[].personId`, flat field | A gift is a one-off event tied to a person, not an ongoing relationship with status/history — there is nothing to "enrich" |
| Groups | `groups[].members: [personId,...]` | Membership in a group is a different relationship *shape* entirely (many-to-many, no attribution direction) — forcing it through Branch 1/2 would be a category error, not a simplification |
| Transactions | Per-transaction `people: {personId: {...}}`, `forPerson`, `fromPersonId`/`toPersonId`, `allocations[]` | This is a ledger of one-off attributions, recomputed live, not a persistent relationship registry — it answers "who was involved in this specific event," not "what is my ongoing relationship with this person" |
| Debt / Future Money | `loans[].personId` | Same shape as Gifts — a debt is a fact about a specific financial event (a loan given/taken), not a standing relationship with lifecycle status |

**The rule, stated plainly:** the Organisation contract (Section 3) exists for relationships that are *about* a standing connection to an organisation/service on someone's behalf. It is not a general-purpose "everywhere a personId appears" registry. Gifts, Groups, Transactions, and Debt each have their own correct, already-working, domain-appropriate shape, and **must stay outside Section 3's contract** — pulling them in would not simplify anything; it would force four structurally different relationship types into one contract that fits none of them well.

---

## 8. Financial attribution ≠ saved Person — the standing invariant

Proven, not just asserted, by PPL-006: `AddSchoolYearModal`'s default state is "Not linked to a saved person," and every domain function downstream (`createSchoolFeeSchedule`, `getFeeSchedulesForRelationship`) works correctly with `personId`/`billerAccountId` both `null`. This is the exact shape of your original example — paying a postpaid bill for someone not in `people[]` — generalized and now load-bearing across a second domain (School), not just Mobile.

**Formal rule:**

> A financial event or ongoing account (a transaction, a bill, a fee schedule, a biller account) never requires a `people[]` record to exist or be valid. Attribution to an unsaved counterparty — a name typed once, a "not linked" default, or simply no attribution at all — is always a complete, correct, first-class state. A saved Person is an *optional* durable identity that, when it exists, lets attribution additionally participate in the Organisation contract (Section 3) and in aggregation/reporting. Promoting an unsaved counterparty to a saved Person later must be possible without rewriting or duplicating the underlying financial records — the existing attribution field(s) simply start pointing at a real `personId` instead of nothing.

This invariant governs every section above and should be treated as violated — stop and report, per standing project discipline — if any future work package's design would require creating a `people[]` record merely to make attribution "work."

---

## 9. The second escape hatch — formally defined

PPL-004 first raised this question; PPL-006 answered it empirically by building the one real instance (School) the rule needs to generalize from. Restating it here as the frozen rule, refined slightly with what School proved:

> **A domain earns lifecycle enrichment (a `fooRelationships[]` array) only when it has status that changes independently of any single transaction or biller-account record, and where "when did status X begin/end" is itself a fact worth retaining.** When that's true, the array is shaped *exactly* like `membershipRelationships[]` — `{id, billerAccountId, personId, status, statusHistory}` — built on the same shared `domain/membership/lifecycle.js` machinery School reused without modification. It never carries its own separate "which organisation" identity field; `billerAccountId` is always that field, per Section 3. If a domain's only need is "which person does this belong to," it uses plain attribution (Branch 1) and stops there — no array, no lifecycle module, nothing further.

**What School proved that PPL-004 could only assume:** the shared `lifecycle.js` module genuinely is domain-agnostic — School needed zero modifications to it, only a thin wrapper module (`domain/school/relationship.js`) mirroring Membership's. This means the second escape hatch isn't just a naming convention; it's a real, reusable piece of shared machinery. A third domain needing lifecycle enrichment (a future Insurance decision, if Option 1 or 2 in Section 5 needs it) should expect the same near-zero-new-logic outcome, calling `createXRelationship`/`endXRelationship` thin wrappers over the same `lifecycle.js` functions, not writing new status-transition logic.

**What remains genuinely open, deliberately:** whether a *third* kind of relationship shape (beyond plain attribution and lifecycle enrichment) will ever be needed is not resolved by this document, because no real domain has yet demonstrated a need for one. Per the standing discipline of this whole project: do not invent that third shape speculatively. If a future domain's trace reveals a genuine need for richer semantics than Section 3 provides, stop and report before building — exactly as this document itself was produced only after School's real implementation revealed what was actually true, not before.

---

## Freeze summary

| # | Area | Status |
|---|---|---|
| 1 | School | Proven via PPL-006 (WP-1–5), incorporated as reference implementation |
| 2 | Membership | Documented as the original lifecycle-enrichment instance; cloud-sync gap flagged, not fixed |
| 3 | Canonical contract | Formalized: Branch 1 (attribution) + Branch 2 (direct ownership, currently unused) + lifecycle enrichment |
| 4 | Mobile Recharge | Confirmed compliant, no changes needed |
| 5 | Insurance | Vestigial-assumption corrected; attribution mechanism explicitly **undecided**, needs its own PPL-00X trace before implementation |
| 6 | Other BillerAccounts | Automatic-Organisation rule formalized — no further work needed |
| 7 | Gifts/Groups/Transactions/Debt | Formally excluded from the Organisation contract — correct as-is |
| 8 | Financial attribution ≠ saved Person | Proven across two domains (Mobile, School), frozen as standing invariant |
| 9 | Second escape hatch | Formally defined, validated by School reusing `lifecycle.js` with zero modification |

**Explicitly not authorized by this document:** WP-6 (Change School), any Insurance implementation, any Membership cloud-sync fix, or any other implementation work. This is a trace/decision/freeze document only. Per your instruction, the next step after this is reviewed is to decide priorities among Insurance, Membership cloud sync, WP-6, CC Bills, Pending Bills, Transactions, and Settlements Received — not to start any of them now.
