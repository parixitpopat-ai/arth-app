# RPP-002 — Rich Person Profile + School: Phase 2 Product & Design Decisions

**Status:** Draft — for review
**Phase 1:** Closed. Evidence base: PPL-000/001/002, SFE-000/001, `domain/membership/relationship.js`, `domain/membership/lifecycle.js`, all of `domain/schoolFees/*.js` + tests, `constants/appConstants.js`.
**This document does not write code, schema, or the combined engineering brief.** It locks the product/design decisions the brief will be built on, per your own instruction not to have the brief rewritten mid-implementation.

---

## Two fixes to do immediately, regardless of everything else below

**1. Self-sentinel bug.** `migrateMembershipRelationships` falls back to the literal string `"self"` for a missing `personId`; the real self-identity everywhere else in the app is `ME.id === "__me__"` (`appConstants.js`). Any self-attributed relationship migrated through this path gets a `personId` that `getPerson()` cannot resolve — silent degradation to the `{name:"?"}` placeholder, the exact failure PPL-000 exists to prevent. **Must not be allowed into the generalized relationship architecture (§4).** Fix: `migrateMembershipRelationships` should fall back to `"__me__"`, not `"self"`, and any already-migrated record carrying the literal `"self"` needs a one-time correction pass.

**2. Missing multi-payment regression test.** `settleFeePeriods`'s shape strongly implies same-period, multiple-call accumulation works correctly (`paidAmount` and `settlementLinks[]` both accumulate additively, nothing resets between calls) — but no existing test proves it across two separate calls against the same period. Add: *same period → settle call 1 (₹10,000, txnA) → settle call 2 (₹10,000, txnB) → settle call 3 (₹10,000, txnC) → assert `paidAmount===30000`, `settlementLinks.length===3`, each entry's `txnId`/`amount` correct.* Cheap, high-value, closes a real (if likely small) risk before anything is built on top of this function.

---

## 1. Rich Person Profile — Screen 1 structure **[Proposed — pending your lock]**

Locking the Rich Person doc's own §4 as the actual target, with each block mapped to what's reusable vs. new:

```
← People                                                    ⋮
[Avatar]
Vyom
Dependant · Son                                          [Edit]
DOB · Anniversary (if present)
──────────────────────────────
FINANCIAL POSITION            ← reuse settlements[pid] (PPL-001 §4, unchanged)
You owe me / I owe them / Net
──────────────────────────────
ACTIVE                        ← presence-based, see §2
🏫 School   · 🏋️ Gym  · 👨‍👩‍👦 Groups
──────────────────────────────
SPENDING THIS MONTH           ← reuse Budget's existing person-scoped adapter (L1781's
Category breakdown              "budgeted" filter confirms one exists; exact shape TBD, §8)
View Budget →
──────────────────────────────
RECENT ACTIVITY               ← reuse personFilterOptions (App.jsx L8223/L8493),
3–5 most recent txns            already the real "transactions filtered by Person" mechanism
View all →
```

- **Financial position, Recent Activity, "View all"** — all reuse, zero new authority, exactly per Rich Person doc §7-§9/§29.
- **Contact info (mobile, email, DOB, anniversary, address, notes)** — confirmed **new**. PPL-000's traced Person schema has none of these fields. Additive only — same low-risk pattern as PPL-002 WP-5's `defaultSettlement`/`color`/`modules` additions, not a redesign.
- **Edit Person** — existing `EditPersonModal` (PPL-000 §1, PPL-002 WP-1) extended with the new contact fields. Same mechanism, more fields — not new mechanism.
- **History/details** (past schools, historical memberships) — new aggregation view, but reads existing/soon-to-exist relationship records (§4/§5); no new storage.

## 2. Person capabilities — universal / presence-based / module, decided **[Proposed — pending your lock]**

This resolves the open question flagged two messages ago (should School/Gym be a `PERSON_MODULES` entry or presence-based) — **decisively presence-based, not a module.**

- **Universal, every Person regardless of type:** identity (name, id), contact info, financial position, Groups membership, edit, archive.
- **`PERSON_MODULES`-gated (existing mechanism, unchanged):** `sharedExpenses`, `borrowMoney`, `budget`, `gifts`, `notes`, `reminders` — genuine opt-in feature toggles, correctly left as-is.
- **Presence-based, NOT a module:** School, Gym/Membership, and any future managed relationship. **Reasoning:** these are real domain relationships with their own lifecycle and data (§4/§5) — whether the "Active" section shows "🏫 School" is answered by *"does a relationship record with this personId exist"*, not by a feature toggle the user flips. Making these `PERSON_MODULES` entries would conflate "I want to see this section" with "this relationship is real," which is precisely the mistake the Rich Person doc's §5 warns against for expense categories.
- **Dependant-specific in practice, not by hard rule:** School/Health/Lifestyle will mostly show up for Dependants, but nothing should *technically* forbid a Contact from having a School relationship — the gate is presence of the relationship record, not `personType`. `personType`'s only remaining real function (per `appConstants.js`'s own comment) is the `"owes"`/`"spent_on"` default-mode split (PPL-000 §2) — worth being explicit that this document doesn't touch that.

## 3. Financial attribution — confirmed reuse map, one confirmed gap **[Locked — this is trace fact, not proposal]**

| Relationship | Mechanism | Status |
|---|---|---|
| Person ↔ transaction | `t.people[pid]`, mode `owes`/`spent_on` | Existing, unchanged |
| Group ↔ transaction | `t.groupId`, `t.groupAllocations[]` | Existing, unchanged |
| Person + Group together | `groupAllocations` entries carry both | Existing, unchanged |
| Person-level balance | `settlements[pid]` | Existing, unchanged |
| Group-scoped balance (receivable) | `getGroupMemberOwed(groupId,pid)` | Existing, unchanged |
| Group-scoped balance (payable) | — | **Confirmed gap — PPL-002 WP-3, not yet built** |
| Transactions filtered by Person | `personFilterOptions` (L8223/L8493) | Existing, confirmed reusable |
| Transactions filtered by Group | — | **Not yet confirmed to exist — verify in engineering, don't assume** |

No new financial authority proposed anywhere in this document — every box above is either existing reuse or an already-known, already-scoped gap.

## 4. MembershipRelationship — the generalization decision **[Locked, direction confirmed by trace]**

- **`lifecycle.js` needs zero changes.** It's already fully generic — operates purely on `{status, statusHistory}`, no domain coupling anywhere in the file. Reused as-is by both Membership and School.
- **`relationship.js` needs exactly one decoupling:** `billerAccountId` generalizes to something like `{targetType, targetId}` (`targetType:"billerAccount"` for Membership, `targetType:"school"` for School, extensible for future managed domains). Everything else in the file (`createMembershipRelationship`'s shape, `getRelationshipStatusAsOfDate`, `isDateActiveMembershipCoverage`) generalizes unchanged, just renamed off "Membership" if you want the shared module to read as domain-neutral.
- **`migrateMembershipRelationships` stays Membership-specific**, tied to the legacy `memberships[]` payment-record shape — not part of the generalization, and shouldn't be forced to be. (This is also where fix #1 above lives.)
- **School's consumption:** School gets its own thin wrapper (mirroring `relationship.js`'s current shape) around the shared core, using `targetType:"school"`. School would realistically only ever call create + end — pause/resume exist in the shared engine but nothing in the School product decisions (SFE-001 §2) calls for pausing a school relationship.

## 5. School — locking SFE-001 §2/§3/§10.1 as the target, on top of §4's primitive **[Locked, restated]**

```
Person → School Relationship (§4's generalized primitive, targetType:"school")
              ├─ Academic Year 2025–26 → Class/Division/Roll (§10.1) + Annual Fee Structure (§6)
              └─ Academic Year 2026–27 → Class/Division/Roll + Annual Fee Structure
```

- Continuous relationship across years — one relationship record, ended only when the child actually leaves (SFE-001 §2), reusing the same `endRelationship`/new-relationship-starts pattern Membership already has.
- Current vs. historical school — reuses `getRelationshipStatusAsOfDate`/`isDateActiveMembershipCoverage`-equivalent logic directly; "is this the current school" is the same as-of-date question Membership already answers, no new logic needed.
- Class/Division/Roll — per-year facts, sibling to Annual Fee Structure (§10.1), not on the relationship or the permanent School record.
- School change — end + new start, never edit, per SFE-001 §2, mechanically identical to how §4's primitive already works for Membership.

## 6. School Fees — what's reusable vs. genuinely new **[Locked where confirmed by trace, flagged where new]**

- **Reusable, unchanged:** `outstanding.js`, `discountWriteOff.js`, `creditNotes.js`, `settlement.js`, `startingState.js`'s touched-gate, `futureMoney.js`'s projection, `annualSummary.js`. All correct, all tested, none need to change for School's richer product direction.
- **Confirmed gap, not previously flagged this precisely: schedule shapes.** `periodGeneration.js` only generates monthly periods from `rateRules[]` — there is **no term-wise or fully-custom schedule generation anywhere in the codebase.** SFE-001 §4's "monthly / term-wise / custom" requirement is two-thirds unbuilt, not a UI-only gap.
- **The big one — annual recalculation engine is genuinely new, zero existing implementation.** Explicitly scoping it, per your framing:
  ```
  new annual structure
    → calculate remaining annual obligation
    → redistribute across untouched future periods (touched periods excluded entirely)
    → preview (old vs. new, per period)
    → user can adjust the proposed future schedule
    → user confirms
    → apply: edit untouched periods in place (never regenerate/reissue ids —
      nothing currently references a period by anything other than its own
      id, and preserving ids costs nothing while avoiding any orphaned-
      reference risk)
  ```
  This deserves its own work package and its own test suite in the combined brief — not a sub-task of anything else.
- **Overpayment/credit** — not new logic. `createSchoolCreditNote`/`applyCreditToPeriod` already do exactly this shape; overpayment handling is very likely a thin product-flow wrapper, not a new domain function.
- **Refund** — a new, ordinary transaction (per SFE-001 §8), no new mechanism required structurally.
- **Forfeiture** — genuinely undecided at the data level: is it just a note on how the relationship ended, or a formal recorded fact? **Flagging as open, not deciding here** — small decision, but a real one for the combined brief to make explicitly rather than assume.

## 7. Payments **[Locked — restates §3.6/§4's findings in one place, no new decisions]**

Partial payments, multiple transactions against one obligation, multiple accounts/methods — all confirmed working by `settlement.js`'s design (fix #2 above closes the one remaining unverified edge). Nothing further to decide here; this section exists in Phase 2 only so the combined brief has one place to point at.

## 8. Integration — one real, unresolved discrepancy flagged rather than guessed **[Mixed — see below]**

- **Transactions, Budget's person-filter, Groups** — existing, reusable, per §1/§3.
- **Future Money — a real conflict between memory and the live file, worth surfacing rather than silently resolving either way.** Session memory states Future Money's composition layer (`composeFutureMoneyCommitments`) already includes School Fees as a wired source, alongside Bills/CC/SIP and Debt Service. But `futureMoney.js`'s own file header, read directly in this trace, says explicitly: *"This module is not wired into any consumer (Home/Outlook/getCommitments())... something else, later, composes it."* These don't agree. I'm not resolving this by picking one — it needs a direct check of `App.jsx`'s actual `composeFutureMoneyCommitments` call site (not yet traced in this thread) before the combined brief assumes either way.
- **Budget's exact person-scoped breakdown shape** (the "Education ₹8,000 / Food ₹5,400..." style summary in Rich Person doc §7) — `App.jsx` L1781 confirms *a* person-scoped budget filter exists, but the category-breakdown shape itself hasn't been traced. Flag for engineering to verify before assuming the UI can just read it directly.

## 9. Mobile navigation **[Locked — straightforward extension of existing patterns]**

Person → School, Person → Gym/Membership: new screens, same "tap Active item → domain detail screen" pattern already implied by existing modal-based navigation elsewhere in the app. Person → Group, Person → Budget, Person → Transactions (filtered): all existing. Group → Transactions (filtered): **not yet confirmed to exist — same flag as §3**, verify before the brief assumes it's free.

## 10. Combined engineering brief — structure, not content **[Confirmed direction, not written yet]**

One document, not three. Structure:
- PPL-002's existing 9 WPs, unchanged, still Frozen.
- New SFE-002 WPs, including the recalculation engine (§6) as its own WP, schedule-shape generation (§6) as its own WP, and the two immediate fixes as an early, unblocked WP.
- New RPP WPs for the Person Profile screen itself (§1), the presence-based Active section (§2), and the new contact-info fields (§1).
- **Preserved exactly as before:** PPL-002 WP-6 (archived-people filtering) still gates the School Person-picker WP — nothing in this Phase 2 pass changes that dependency.
- No duplicate authorities anywhere — every WP in the eventual brief either reuses something in §3/§6/§7's "reusable" columns or is explicitly named as new in §1/§2/§6's "gap" callouts. Nothing should be built twice.

---

## What's still open going into the combined brief

- Forfeiture's data shape (§6).
- The Future Money wiring discrepancy (§8) — needs a direct `App.jsx` check, not a guess.
- Budget's exact person-scoped breakdown shape (§8).
- Whether a Group-scoped transaction filter already exists (§3/§9).

None of these block locking this document — they're scoped as explicit engineering-verification items, not product decisions waiting on you.

---

Next: your review/lock of §1-§2 (the two genuinely new product calls — presence-based Active section, new contact fields) and §6's forfeiture question. Everything else is either restated trace fact or already-decided direction. Once locked, Phase 3 is the single combined PPL+SFE+RPP engineering brief.
