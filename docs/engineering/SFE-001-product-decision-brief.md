# SFE-001 — School Fees Product Decision Brief

**Status:** Draft — for review. Multiple decisions below are recorded as **Locked** individually (per explicit direction) even though the document as a whole has not yet been Frozen — treat a section's own status marker as authoritative over the document header.
**Depends on:** SFE-000 (trace of record — schema/edit/delete findings cited below are sourced from there, not re-derived here)
**Explicit scope boundary (binding on this document):** no schema is proposed here — layer names and relationships are conceptual, not field definitions. No implementation, no Person picker, no annual-structure editor, no transaction-attribution change happens as a result of this document. PPL-000/PPL-001/PPL-002 are not modified by this document. This is the product-decision layer only; an SFE-002 engineering brief is the next artifact after this one is reviewed/frozen, mirroring the PPL-000→001→002 sequence.

---

## 1. Why this exists

SFE-000's trace surfaced two things that change the product direction for School Fees, not just its implementation:

1. `feeSchedule.personId` already exists in the schema, is already threaded through `createSchoolFeeSchedule`, and is simply never populated — the only creation path hardcodes it to `null`. School Fees was evidently *meant* to attribute to a Person; that intent was never finished.
2. The existing "never rewrite touched history" rule, while correct, is currently implemented as a period-level lock with no separate concept of "the annual plan" — so there's no existing mechanism to correct an entire year's fee structure without either leaving it wrong or reaching into individual future periods one at a time.

Both are product-model gaps, not bugs — nothing here is broken, but the current model can't yet answer "whose fee is this" or "I got the year wrong, fix it going forward."

---

## 2. Decision — School is a remembered entity; a child's relationship to it has a lifecycle **[Locked]**

Arth should remember the school itself, independent of any one child's enrollment in it. A Person's relationship to a school is its own thing, with a beginning and — potentially — an end.

**If a child changes school:**
```
Old school relationship ENDS → historical data remains untouched → new school relationship STARTS from the joining date
```

**Do not edit School A into School B.** A school change is never a rename or an edit of the existing relationship record — it is the old relationship ending and a genuinely separate new relationship beginning. This is the same principle PPL-000/001 already established for People/Groups (archive, don't destructively edit identity) — School Fees arrives at the equivalent conclusion independently: a relationship ending is not the same operation as a relationship's details changing.

**Visibility, not just data model:** the Person profile should show the *current* school prominently. Past schools remain available under the Person's history/details, but must not compete for visibility with the current one — this is a UX requirement, not just a data requirement, and should carry through to whatever the eventual Person-detail design looks like (including any future PPL-side surfacing, per §9's boundary caveat).

---

## 3. Decision — School information vs. yearly/child-specific information **[Locked]**

This resolves what was left open in the original draft's §4 (School/Enrollment/Fee-Schedule boundary) — at the product level, not the schema level.

**Permanent, belongs to the School itself** (survives across children, across years, across relationships):
- School name
- Location/address — **only if it can be reliably geotagged.** This is a conditional inclusion, not a firm commitment — flagged explicitly as a dependency on geocoding reliability, which is a technical feasibility question this document cannot resolve. If reliable geotagging isn't achievable, address should not be forced into the permanent-School layer just because it was listed here as an aspiration.

**Yearly / child-specific, belongs to the relationship-for-that-year** (per §2's lifecycle, per Person, per year):
- Academic year
- Class/Grade
- Division
- Roll number
- Fee structure (§4)

**Division and Roll Number therefore belong to the child's yearly school context, not the permanent School identity** — stated explicitly because it's the detail most likely to be gotten wrong by analogy to "obviously belongs to the school."

**What remains open, not resolved by this decision:** whether "the relationship-for-that-year" needs its own named conceptual layer (an "Enrollment," in the original draft's terms) distinct from the Annual Fee Structure itself, or whether the yearly details above simply live alongside the Annual Fee Structure as one combined per-year record. §2 and this section establish *what* the yearly facts are and that they're not permanent-School facts; they don't settle *where exactly* those facts are conceptually housed relative to the fee structure. That's a smaller, more mechanical follow-up than the original §4 question was, but it's still open.

---

## 4. Decision — Annual fee structure supports itemized components **[Locked]**

The annual fee structure is not a single opaque number. It supports:
- Individual fee components (e.g. Tuition, Transport, Books, Annual charges — illustrative, not an exhaustive or fixed list)
- An automatically calculated annual total from those components
- Multiple schedule shapes: monthly, term-wise, or fully custom

Example given, for reference:
```
Tuition          ₹60,000
Transport        ₹20,000
Books            ₹5,000
Annual charges   ₹15,000
─────────────────────────
Total            ₹1,00,000
```

This decision establishes *that* itemization and multiple schedule shapes are required product capability. It does not define how components map onto individual Fee Periods, how a term-wise vs. monthly schedule shape affects period generation, or any other mechanical detail — those belong to the design pass and SFE-002, not this brief.

---

## 5. Decision — the annual structure remains editable at all times; recalculation must be explicit and confirmed **[Locked]**

**Governing principle, restated and now the binding rule for this whole document:**

> **The annual plan is editable. Financial history is immutable.**

This supersedes the more tentative framing in the original draft of this section (which left "exactly how recalculation should work" as an open question) with a concrete, locked behavior:

- **Annual fee structure** — always editable, at any time. Never blocked because the year has started or some periods have already been paid. The user must never be forced to live with an incorrect setup (the concrete example given: entered ₹1,20,000, later corrected to ₹1,50,000, for the same year — must be possible without a workaround).
- **When the structure changes mid-year:**
  1. Recalculate the remaining future/unpaid obligation.
  2. Already-paid or otherwise financially touched periods (§6) remain unchanged — no exception, no override path.
  3. Show the user, explicitly, what future amounts will change as a result, before anything is applied.
  4. Let the user modify the proposed future schedule (the recalculation is a proposal the user can adjust, not a silent automatic overwrite).
  5. The user confirms before the change is actually applied.

**What remains open:** the exact recalculation algorithm (e.g. does a rate change apply retroactively to already-generated-but-untouched future periods, or only to periods generated after the change point?) is still a design/engineering question, not resolved by this decision — this section locks the *behavioral contract* (recalculate future, protect touched, show before applying, let the user adjust, require confirmation), not the arithmetic.

---

## 6. Decision — existing payment transactions are immutable, non-negotiable **[Locked]**

If ₹40,000 was already paid, that transaction's amount, id, date, and account **do not change**, ever, for any reason — including a subsequent annual-structure correction (§5). Payment history does not change. Any correction happens through future obligations or a new, separate financial adjustment (a new transaction, a discount, a write-off, a credit note) — never by mutating an existing transaction record.

This isn't a new rule — it's the same immutability principle already found live in the code (SFE-000 §2's `touched` gate on `editPeriodAmount`) and already established as the PPL-side principle for identity records — restated here as an explicit, non-negotiable law specifically because §5 introduces new editing capability elsewhere in the model, and that expansion must not be allowed to erode this boundary anywhere, even by accident.

---

## 7. Decision — a single fee obligation must support multiple independent payment transactions **[Locked]**

One fee due can be satisfied by more than one real payment, across different accounts/methods, and each payment remains its own independent, immutable transaction.

**Example:** Fee due ₹30,000, paid as ₹10,000 cash + ₹20,000 from HDFC → the fee is fully satisfied, but financial history contains **two** real transactions, each retaining its own actual account/payment method. A three-way split (₹10,000 cash + ₹10,000 HDFC + ₹10,000 ICICI) must be supported the same way.

**Explicitly rejected approach:** do not model this as one artificial ₹30,000 transaction against a fake "mixed" account. Each actual money movement stays its own actual transaction.

**Conceptual consequence:** the Fee Period/Schedule needs to know *how much of its obligation has been satisfied* by tracking the sum of whatever real, independent transactions have been linked to it — the period is a running satisfaction-state derived from multiple real transactions, not itself a transaction or a container that owns a single payment. This is a description of the required capability, not a schema — how "linked" is represented is for SFE-002.

**Called out explicitly for the next engineering brief:** SFE-002 must specifically account for partial payments plus multiple payment methods/accounts against one fee obligation, while preserving transaction immutability (§6). This is flagged here so it isn't treated as an incidental detail once engineering scoping begins.

---

## 8. Decision — school change does not carry unused fees forward **[Locked]**

If a child leaves School A (per §2's relationship-ends lifecycle):
- Existing School A payments remain untouched — no exception, consistent with §6.
- If the school actually refunds money, that's recorded as a **new refund transaction** — a real, new financial event, not a reversal of the original payment.
- If the school does not refund the unused amount, it is treated as **forfeited** — again, this is a fact to be recorded, not a value to be silently moved.
- Unused School A fees are never automatically transferred into School B's structure.
- School B starts as a genuinely new relationship (§2) with its own new fee structure, from the joining date — it does not inherit or net against anything from School A.

---

## 9. Decision — Person relationship, restated **[Locked, direction confirmed; wiring not yet authorized]**

The conceptual chain, now with §2/§3's resolution folded in:

```
Person → School relationship (§2) → Annual Fee Structure (§4/§5) → Fee Periods → actual payment Transactions (§6/§7)
```

`feeSchedule.personId` should eventually be wired to a real Person, replacing today's hardcoded `null` (SFE-000 §3). **This document locks the direction. It does not authorize implementation** — the Person picker, the wiring itself, and how the resulting transaction/Future Money projection represent the link (SFE-000 §5/§10, and this document's own §1) all remain unimplemented and unscoped until a design pass and SFE-002 happen.

---

## 10. §10 items resolved — design pass, 31 Aug 2026

Each of the seven items you specified, resolved at the same level PPL-001 used for People/Groups: what information appears, in what hierarchy, what the user can do — never pixels, component names, schema, or algorithms. Where a resolution genuinely requires your sign-off before it counts as settled product direction, it's marked **Proposed — pending your lock** rather than declared Locked unilaterally; where the conceptual boundary itself is what was asked for and there's no further judgment call needed, it's marked **Locked**.

### 10.1 — Yearly school relationship vs. Annual Fee Structure **[Proposed — pending your lock]**

**Resolution:** a School Relationship (§2) can span multiple academic years at the same school — it doesn't end and restart every year, only when the child actually leaves. Within that relationship, each academic year has two separate, sibling records: **Academic Context** (year, class/grade, division, roll number) and **Annual Fee Structure** (§4/§5). They're kept separate, not merged into one yearly record, because they're edited for different reasons on different timelines — correcting a roll number has nothing to do with correcting a fee amount, and §5's "always editable, with recalculation preview" behavior belongs specifically to the fee structure, not to academic facts that don't have a recalculation concept at all.

```
Person
  └─ School Relationship (§2, spans years, one start, one possible end)
       ├─ Year 2025–26
       │    ├─ Academic Context (grade, division, roll)
       │    └─ Annual Fee Structure (§4/§5)
       └─ Year 2026–27
            ├─ Academic Context
            └─ Annual Fee Structure
```

This directly resolves §3's leftover open question ("one combined thing, or two") — two, sibling, per year, under one longer-lived relationship.

### 10.2 — Person attribution UX **[Proposed — pending your lock]**

**Resolution:** School Fees only ever links to an **existing** Person — it never creates one. The picker is a selection-only control over the existing People list (matching PPL-001 §6's existing edit/select conventions), excluding archived people per PPL-002 WP-6's active-selection rule once that ships. If the person the fee is for doesn't exist yet as a Person record, School Fees does not offer an inline "add new" shortcut — the user is directed to add them via People & Groups first, then comes back and links. This is a deliberate constraint, not an oversight: it's the concrete way to honor "do not create a parallel student identity" — there is exactly one place a Person gets created (People & Groups), and School Fees is a consumer of that list, never a second entry point into it.

```
SCHOOL RELATIONSHIP — Add / Edit

For: [ Select Person ▾ ]         ← existing People only, none pre-created
     "Don't see them? Add them in People & Groups first."
```

### 10.3 — Current vs. past school relationship UX **[Proposed — pending your lock]**

**Resolution:** on the Person screen (a PPL-001 surface, referenced here but not modifying PPL-001 itself), the current school gets a primary, always-visible position — name, current academic year, at-a-glance fee status. Past schools are reachable via a single secondary action, not shown inline by default.

```
PERSON DETAIL — [Child's name]

CURRENT SCHOOL
🎓 Springdale Academy                Class 6-B
   2026–27 · ₹85,000 of ₹1,00,000 paid

[View school history]   ← past schools, collapsed behind this
```

This is the same "balance → context → evidence, nothing duplicated" instinct PPL-001 §4 already established for a Person's financial position — applied here to school history instead of money owed.

### 10.4 — Annual fee structure UX **[Proposed — pending your lock]**

**Resolution:** an itemized builder — add a component (name + amount), running total calculates automatically, then a schedule-shape choice (monthly / term-wise / custom) governs how that total maps to periods, without this document specifying the mapping mechanics (that's SFE-002/engineering territory per §4's own existing scope note).

```
ANNUAL FEE STRUCTURE — 2026–27

Tuition            ₹60,000
Transport          ₹20,000
Books              ₹5,000
Annual charges     ₹15,000
──────────────────────────
Total              ₹1,00,000

Schedule:  ( ) Monthly   ( ) Term-wise   (•) Custom
```

### 10.5 — Mid-year annual-plan editing UX **[Proposed — pending your lock]**

**Resolution:** editing the structure opens a preview step before anything is applied — never a silent recalculation. **No recalculation algorithm is specified here** (per your explicit boundary) — this only describes the three-step interaction shape the eventual algorithm's output gets displayed through.

```
STEP 1: Edit structure (§10.4's builder, same UI, pre-filled with current values)
STEP 2: Preview
   "This changes 5 upcoming periods:"
   Feb 2027    ₹8,333 → ₹10,417
   Mar 2027    ₹8,333 → ₹10,417
   ... [user can adjust any individual proposed future amount here]
   "3 already-paid periods are not affected."
STEP 3: [Confirm changes]   [Cancel]
```

The "already-paid periods are not affected" line is a fixed, non-negotiable statement per §6 — not a claim the algorithm needs to prove correct in the UI, but a guarantee the UX makes to the user regardless of how the underlying recalculation is eventually implemented.

### 10.6 — Multiple / partial payments UX **[Proposed — pending your lock]**

**Resolution:** a fee period shows its satisfaction state as a running total against the obligation, with every contributing transaction listed individually beneath it — never merged into one line.

```
FEE PERIOD — Term 2, 2026–27
Obligation: ₹30,000
Paid: ₹30,000 ✓

PAYMENTS (3)
₹10,000  Cash        12 Sep 2026
₹10,000  HDFC •1234  15 Sep 2026
₹10,000  ICICI •5678 20 Sep 2026
```

Each row is a real transaction (tappable, navigates to that transaction's own detail per the existing pattern School Fees already uses for single payments — SFE-000 §6). Nothing here proposes how "linked" is represented internally (§7 already flagged that as SFE-002's job).

### 10.7 — School address/geotagging feasibility **[ENGINEERING DECISION — recommend deferring from v1]**

**This one isn't a UX design question — it's a technical feasibility question, and I checked the live code rather than guess.** `App.jsx` has **zero** existing geocoding/mapping/location infrastructure — no `latitude`/`longitude` fields, no Maps/Places API integration, nothing (confirmed by direct search across the whole file). Adding reliable school geotagging wouldn't be a small addition to something that already exists; it would be net-new infrastructure — a third-party geocoding API dependency, API keys, network calls at data-entry time.

That last point matters specifically for this app: your own architecture (ADR-036, local-first/durable data) treats the app as fully functional offline with localStorage as the durable store, not a rolling cache. A geocoding call at school-creation time would be the first place School Fees — or arguably the app in general — required a live network round-trip to save a basic field. That's a real tension with the existing architectural posture, not just an implementation detail.

**Recommendation, not a decision I can make for you:** treat address/geotagging as out of scope for the first version of this work. Ship School with just `name` (already the only field that exists today per SFE-000 §1) and revisit geotagging later as its own, separately-scoped technical spike if it turns out to matter — rather than let a "nice to have, if feasible" line item quietly become the reason new network-dependency infrastructure gets built into an otherwise offline-first app. This needs your explicit call, not mine — flagging it as a real tradeoff rather than a simple yes/no.

---

## 12. Summary — LOCKED / OPEN / ENGINEERING DECISION

| # | Item | Status |
|---|---|---|
| — | School = persistent remembered entity | **LOCKED** (§2) |
| — | Child–school relationship has a lifecycle; school change = end + start, never edit | **LOCKED** (§2) |
| — | School identity separate from yearly/child-specific info | **LOCKED** (§3) |
| — | Annual fee structure is itemized, supports monthly/term/custom | **LOCKED** (§4) |
| — | Annual plan always editable | **LOCKED** (§5) |
| — | Financial history/transactions immutable, non-negotiable | **LOCKED** (§6) |
| — | One fee obligation, multiple independent real transactions | **LOCKED** (§7) |
| — | Unused fees don't auto-transfer between schools | **LOCKED** (§8) |
| — | `feeSchedule.personId` intended to link to existing Person identity | **LOCKED** (§9, direction only — wiring not authorized) |
| 1 | Yearly relationship vs. Annual Fee Structure boundary | **PROPOSED, pending your lock** (§10.1) |
| 2 | Person attribution UX (existing-People-only picker) | **PROPOSED, pending your lock** (§10.2) |
| 3 | Current vs. past school UX | **PROPOSED, pending your lock** (§10.3) |
| 4 | Itemized annual fee structure UX | **PROPOSED, pending your lock** (§10.4) |
| 5 | Mid-year edit preview/adjust/confirm UX | **PROPOSED, pending your lock** (§10.5) |
| 6 | Multiple/partial payments UX | **PROPOSED, pending your lock** (§10.6) |
| 7 | School address/geotagging | **ENGINEERING DECISION — recommend deferring**, requires your explicit call (§10.7) |

**None of the above authorizes any code, schema, wiring, migration, or algorithm.** Per your boundaries: no PPL doc touched, no financial attribution model changed, no new or parallel identity created, `personId` not wired, no annual-structure editor built, no historical transaction migrated or altered, no recalculation algorithm invented. §10.1–§10.6 are wireframe-level UX resolutions only, in the same register PPL-001 used. §10.7 is flagged as needing your decision specifically because it's the one item that isn't really a design question at all.

---

## 13. What happens next

This document is the product-decision layer, now including the §10 design pass. Once you've reviewed and locked §10.1–§10.6 and made the call on §10.7:
1. §10's proposed resolutions become part of SFE-001's frozen content — no separate "Designer Brief" document is needed beyond what §10 already contains, since it was written at exactly that register (wireframe-level, no pixels/schema/algorithms) per your own instruction. If you want it split into its own SFE-001-designer-brief.md matching PPL's file structure, say so and I'll extract it.
2. SFE-002 — Engineering Brief, following the same WP-by-WP, stop-for-review discipline as PPL-002 — with explicit, called-out coverage of multi-transaction partial-payment satisfaction (§7) as its own work package, not folded silently into a larger one, and with §10.1's relationship/year/structure boundary as the conceptual foundation for whatever schema WP structure SFE-002 proposes.

No code, no schema, no wiring happens until that sequence completes.
