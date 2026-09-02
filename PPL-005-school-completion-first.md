# PPL-005 — School Completion First: Trace + Implementation Plan Request

**Status:** Active assignment — trace/plan required before any coding
**Stream:** Supersedes further Person UI expansion (WP-6+) until School is complete
**Date:** 2026-09-02
**Issued by:** PP Sir

---

## Next phase: finish School completion first. Do not start more Person UI work yet.

We have spent enough time on WP-1 → WP-14 Person UI iterations. The Person mockup remains the target, but before expanding it further we need to complete the underlying School/Person architecture correctly.

### 1. School is the immediate implementation priority

Finish School Fees so that a real School relationship can flow through Person.

The latest trace established an important fact:

- `feeSchedules[]` already contains `billerAccountId` and `personId`.
- This is a real, live relationship source.
- `schoolRelationships[]` is dead/dormant and is not being populated.
- Do **not** create another parallel `schoolRelationships[]` system simply to make the Person Profile work.

The implementation should therefore build on the **existing authoritative School Fee data**, not introduce a shadow relationship model.

Trace and complete whatever is actually required for:

**School Fee → Person → Person Profile → Organisations**

including the missing School Person Picker / Add/Edit flow and whatever state wiring is required.

Preserve the existing financial/transaction model. Do not duplicate ledger records merely to establish the Person relationship.

### 2. Broader architecture discovered during this work

While tracing School, we established that Person is becoming a **relationship hub**, but this does NOT mean every financial event must require a saved Person.

Arth must support this perfectly valid scenario:

> User pays a ₹X mobile/postpaid bill for somebody who is **not a saved Person**.

That payment must be recordable without forcing the user to create a Person.

Therefore maintain this architectural distinction:

**Financial attribution ≠ saved Person.**

A transaction/bill can contain an attribution to an unsaved counterparty. A saved `people[]` record is an optional durable identity that allows Arth to aggregate and enrich relationships later.

If an unsaved counterparty is subsequently promoted to a saved Person, we should be able to associate the existing financial history with that Person **without creating duplicate transactions or rewriting the underlying financial events**.

### 3. Person relationship architecture

We are establishing the following direction:

```text
                        Arth
                          │
            ┌─────────────┴─────────────┐
            │                           │
      Financial Events            Saved Persons
      / Transactions              / Relationships
            │                           │
      Person attribution ───────→ Person Profile
      may be optional                  │
                                        ↓
                              Organisations / Services
```

For saved Persons, the eventual Person read layer should be able to surface:

- School Fees
- Insurance
- Mobile Recharge
- Membership
- other Person-attributed BillerAccounts/services
- Groups separately
- financial/transaction relationships separately

But **do not force these different domain concepts into one storage model**.

The Person Profile should eventually consume a canonical **read layer**, while each domain remains authoritative for its own data.

Preferred direction:

```text
Person
  ↓
Canonical relationship/read layer
  ├── BillerAccount attribution
  │     ├── Mobile
  │     ├── Insurance-as-biller
  │     ├── School Fees
  │     └── other services
  │
  └── lifecycle enrichment
        └── Membership
```

But this is **architecture direction, not permission to build a generic relationship table now**.

### 4. School specifically

Before coding, confirm the complete School lifecycle:

```text
Add/assign School Fee
      ↓
Person attribution
      ↓
feeSchedule / authoritative School data
      ↓
Person Profile Organisations
      ↓
correct School status/details
```

The Person Profile must read the real School relationship. Do not pass a permanently empty `schoolRelationships[]` parameter just to satisfy the UI.

If `feeSchedules[].personId` is sufficient, use it.

If some genuine School lifecycle requirement cannot be represented by the existing model, stop and report exactly what is missing before inventing another relationship mechanism.

### 5. Do not touch Insurance yet

The latest trace exposed two Insurance concepts:

- `insurancePolicies[]`
- `billerAccounts[]` with `type: "Insurance"`

The earlier assumption that `insurancePolicies[]` was simply vestigial is no longer safe. There appears to be a real Insurance policy flow in the bundle, but reachability and runtime behaviour still need verification.

**Do not retire, migrate, modify, or relink Insurance during School completion.**

Leave that as the next architecture/trace decision after School is complete.

### 6. No Person UI expansion during School completion

Do not continue WP-6 → WP-14 or redesign the Person screen further right now.

The existing Person Profile is already live.

The objective of this phase is to make the **underlying relationship architecture correct**, beginning with School.

### 7. Guardrails

- No duplicate relationship store.
- No duplicate transactions.
- No mandatory Person creation for financial attribution.
- No fabricated Organisation entries.
- No changes to `insurancePolicies[]` yet.
- No speculative generic relationship database/table.
- Preserve existing authoritative domain ownership.
- Trace before changing an existing domain mechanism.
- Tests before `App.jsx` wiring where practical.
- One scoped implementation at a time.

### 8. Deliverable

First give me a **School completion trace + implementation plan**:

1. Current School data path.
2. Exact missing wiring.
3. Existing School Person Picker situation.
4. Add/Edit flow required.
5. How `feeSchedules[].personId` becomes visible through Person.
6. Any lifecycle/status requirements.
7. Files that need changing.
8. Tests required.
9. Anything that would require a new architectural decision.

**Do not code until that trace is reported and reviewed.**

After School is completed and verified, we return to the broader Person relationship architecture and then decide the correct next sequence for Insurance, Mobile and the remaining Organisation domains.

**The strategic goal is no longer "finish the Person UI." The goal is to make Person the reliable relationship hub of Arth without turning Person into a mandatory dependency for financial events.**
