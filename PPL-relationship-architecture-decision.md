# PPL — Person Relationship Layer: Architecture Decision

**Status:** Frozen (pending WP-C school confirmation and WP-F insurance decision)
**Stream:** ARTH-003 (People & Groups / School Fees / Rich Person Profile)
**Date:** 2026-09-02
**Decided by:** PP Sir

---

## Conclusion

Stop inventing new universal relationship systems. The existing `billerAccounts[].attributedTo` mechanism is the generic Person attribution layer and already works for Mobile, Electricity, Broadband, Insurance-as-biller, Gym/Fitness, Streaming, and School Fees-as-biller. All `BILLER_TYPES` share the same `BillerAccountModal` attribution mechanism.

```
PERSON
  ↓
billerAccounts.attributedTo
  ↓
billerAccount
  ↓
domain/service
```

**Do not create another universal relationship table.**

---

## Membership (the exception)

Membership is the one domain with genuine lifecycle needs (pause/resume/end) and remains an enrichment layer on top of the generic mechanism — not a parallel Person-link architecture.

```
Person
  ↓
billerAccount.attributedTo
  ↓
membershipRelationship
  ↓
status / pause / resume / end / history
```

---

## School Fees

Proceed on the assumption that School Fees uses the existing BillerAccount attribution mechanism, rather than `schoolRelationships[]`.

Before retiring the dormant `domain/school/relationship.js`, resolve one open question:

> **Does Academic Year / Class / Division continuity require a relationship object that survives individual fee schedules?**

- **NO** → School uses `billerAccounts.attributedTo`; dormant school relationship module is retired/shelved.
- **YES** → Document exactly what that relationship object stores and why BillerAccount attribution cannot represent it. Do not build it until that distinction is proven.

---

## Person Profile — Read Adapter

Build a single read adapter:

```
getPersonDomainRelationships(
  personId,
  billerAccounts,
  membershipRelationships
)
```

It should:

1. Find all `billerAccounts` where `attributeType === "person"` and `attributedTo === personId`.
2. Resolve the actual biller/domain information from those accounts.
3. Where a Membership lifecycle record exists for that biller account, enrich the result with its real status/history.
4. Never fabricate School, Insurance, Mobile, or any other relationship.
5. Return a consistent read model for Person Profile's **Organisations / Relationships** section.

The adapter is a **read layer only**. It must not create a second source of truth.

---

## Bug fix (separate from the architecture work)

`billerAccounts` cannot currently be deleted when referenced by `txns[].billerLinkId`. Add that reference to the existing deletion guard, with tests. Do not change unrelated deletion behaviour.

---

## Insurance

`insurancePolicies[]` is currently vestigial: no real create/edit flow exists; its only write path is backup/restore.

- Do **not** integrate Person Profile with it.
- Before removing it, provide a short recommendation: **RETIRE** (remove dead structure/code safely) or **SHELVE** (leave untouched as future domain infrastructure).
- Do not silently delete it.

---

## Implementation order

| WP | Description |
|----|-------------|
| WP-A | BillerAccount → transaction deletion guard + tests |
| WP-B | `getPersonDomainRelationships()` + comprehensive tests |
| WP-C | Final School academic-year continuity decision |
| WP-D | School attribution implementation — only if WP-C confirms generic attribution is sufficient |
| WP-E | Replace Person Profile's current Membership-only Organisation resolution with the generic adapter |
| WP-F | Insurance policy retire/shelve decision |

Every WP gets tests first, then `App.jsx` wiring.

**No UI redesign. No new relationship schema. No `people[].school`, `people[].insurance`, `people[].mobile`.**

---

## Objective

Make Person the human-centric entry point while keeping each domain's own data authoritative. Once this is complete, adding a new Person-linked biller domain should require essentially no new Person architecture — only the domain itself needs to support the existing attribution mechanism.

**Coding team: stop after the trace/decision points above and report before coding WP-B onward.**
