# ARTH-003 — Combined Engineering Brief: People & Groups + Rich Person Profile + School Fees

**Status:** ✅ **APPROVED — IMPLEMENTATION AUTHORIZED** (30 Aug 2026). All product decisions in this brief are now frozen. [VERIFY] work packages (WP-A3, WP-A4, WP-A5, and the WP-C1 proof step) remain genuine gates — approval of this brief does not pre-authorize their outcome or any WP that depends on it.
**Built on (all Frozen, none rewritten by this document):** PPL-000/001/002, RPP-002, SFE-000/001.
**PPL-002's own 9 work packages remain independently Frozen and unchanged** — referenced by number below where a dependency exists, never restated or altered. This document adds new work packages around them; it does not modify PPL-002.

## Governing objective

Make the Relationship Ledger + Rich Person Profile + School Fees experience real using the existing identity and financial model, adding only what RPP-002/SFE-001 confirmed is genuinely missing. Every WP below is tagged **[REUSE]** (existing code, no change to its logic), **[EXTEND]** (existing mechanism, additive change, same pattern as PPL-002 WP-1/WP-5), or **[NEW]** (no existing implementation — this is where real engineering risk lives). No WP is authorized to invent a second financial authority, a second transaction system, or a parallel identity model — per PPL-000/RPP-002 §31, Transactions remain the only record of actual money movement.

**Cross-cutting invariants, binding on every WP below without restatement per-WP:**
- `person.id` / `group.id` never change, never reassigned.
- No historical transaction, settlement, or fee-period record is ever rewritten once touched.
- Archive, not destructive delete (PPL-000 §10) — unchanged, this document adds no new deletion semantics anywhere.
- No duplicate authority: Transactions stay the only ledger; Budget stays the only budget authority; Groups stay the only membership authority.

---

## Phase A — Foundation / Safety (unblocked, can start immediately, no dependencies)

### WP-A1 — Self-sentinel correction **[EXTEND]**
**Existing code:** `migrateMembershipRelationships` (`domain/membership/relationship.js`) falls back to literal `"self"` for a missing `personId`; `ME.id === "__me__"` (`appConstants.js`) is the real sentinel everywhere else.
**New work:** change the fallback to `"__me__"`. Add a one-time correction pass for any already-migrated record carrying literal `"self"` as `personId`.
**Schema change:** none — same field, corrected value.
**Tests:** a membership record with no `personId` migrates to `personId==="__me__"`, not `"self"`; `getPerson("__me__")` resolves correctly post-migration; the correction pass is idempotent (running twice doesn't double-touch already-corrected records).
**Acceptance criteria:** zero records anywhere in `membershipRelationships[]` carry `personId==="self"` after this WP ships.

### WP-A2 — Multi-payment regression test **[REUSE, test-only]**
**Existing code:** `settleFeePeriods` (`domain/schoolFees/settlement.js`) — accumulates `paidAmount` and `settlementLinks[]` additively per call, never tested across multiple calls against the same period.
**New work:** none to production code — a test only.
**Tests:** same period, three sequential `settleFeePeriods` calls (₹10,000/txnA, ₹10,000/txnB, ₹10,000/txnC) → assert `paidAmount===30000`, `settlementLinks.length===3`, each entry's `txnId`/`amount` correct and in call order.
**Acceptance criteria:** test passes against the existing, unmodified `settlement.js` — if it doesn't, this WP escalates to a real bug fix, not silently patched inside a test-only WP.

### WP-A3 — Verify existing Person/Group transaction filters **[VERIFY]**
**Existing code:** `personFilterOptions` (`App.jsx` L8223/L8493) confirmed as a real Person-filtered Transactions mechanism.
**New work:** confirm whether an equivalent Group filter already exists (RPP-002 §3/§9 flagged this as unconfirmed, not assumed absent).
**Tests:** if found, a test confirming it filters correctly by `groupId`; if absent, this WP's output feeds directly into WP-D4 below rather than assuming WP-D4's scope in advance.
**Acceptance criteria:** a definitive yes/no on Group-filtered Transactions, with the exact call site cited if yes.

### WP-A4 — Verify Budget's person-scoped adapter shape **[VERIFY]**
**Existing code:** `App.jsx` L1781 confirms *a* person-scoped Budget filter (`getPersonModules(p).includes("budget")`) exists.
**New work:** trace the actual category-breakdown shape this produces (RPP-002 §8 flagged as unconfirmed).
**Tests:** none — this is a trace deliverable feeding WP-B4 below.
**Acceptance criteria:** confirmed shape documented, or confirmed absent (in which case WP-B4 scopes a small new adapter rather than assuming reuse).

### WP-A5 — Verify Future Money's actual School Fees wiring **[VERIFY]**
**Existing code:** `futureMoney.js`'s own header states School Fees is not wired into any consumer; session memory states otherwise. RPP-002 §8 explicitly declined to resolve this by assumption.
**New work:** trace `App.jsx`'s actual `composeFutureMoneyCommitments` call site directly.
**Tests:** none — trace deliverable.
**Acceptance criteria:** definitive statement of whether School Fees currently reaches Home/Outlook via Future Money, with the exact call site cited either way. This gates whether WP-F-series (§ below) needs to also wire the consumer, or whether that's already done.

---

## Phase B — Rich Person Profile (depends on Phase A verification results for B4/B5's exact scope; B1-B3/B6 unblocked)

### WP-B1 — Person Overview mobile screen **[NEW UI, existing data]**
**Existing code:** `settlements[pid]` (financial position), `personFilterOptions` (recent activity), `getPersonModules` (progressive disclosure precedent).
**New work:** build the Screen 1 hierarchy locked in RPP-002 §1 / Rich Person doc §4 — Identity → Financial Position → Active → Spending → Recent Activity → nav-outs. No new data layer; pure composition of existing reads.
**Tests:** each block renders from its real existing source; empty states for a Contact with no Active items, no Recent Activity.
**Acceptance criteria:** matches the locked wireframe hierarchy; zero new financial computation introduced by this WP.

### WP-B2 — Contact info fields **[EXTEND]**
**Existing code:** `EditPersonModal` (PPL-002 WP-1's target), current Person schema (PPL-000 §1) has none of: mobile, email, DOB, anniversary, address, notes.
**New work:** add these fields, additive only, same id-lookup-update pattern PPL-002 WP-1/WP-5 already established as safe.
**Schema change:** additive fields on `people[]` records, absent-defaults-to-empty for existing records (no migration required).
**Depends on:** sequenced alongside PPL-002 WP-1/WP-5 (same edit surface), not before it.
**Tests:** each new field edits and persists independently; existing fields unaffected; `id` untouched (same invariant class as PPL-002 WP-1).
**Acceptance criteria:** matches RPP-002 §1's exact field list, no more, no less.

### WP-B3 — Presence-based Active section **[NEW]**
**Existing code:** none — this is the first real consumer of the generalized relationship primitive (Phase C).
**New work:** "Active" renders one entry per existing relationship record for this `personId` (School via Phase E, Gym/Membership via existing `MembershipRelationship`, Groups via existing membership) — **never** a `PERSON_MODULES` toggle (RPP-002 §2, locked). No relationship record → no card. No empty-state placeholder card.
**Depends on:** Phase C (generalized relationship read) for School to appear here; Membership/Groups can populate immediately since their underlying records already exist.
**Tests:** a Contact with zero relationship records shows an empty (not placeholder-cluttered) Active section; a Dependant with School+Gym+Groups shows exactly three, each with real data, none derived from a category/expense.
**Acceptance criteria:** RPP-002 §5's Active-vs-not-Active distinction holds — verified by a test asserting a Hospital transaction never produces an Active card.

### WP-B4 — Spending summary **[REUSE or EXTEND, depends on WP-A4]**
**Existing code:** per WP-A4's finding.
**New work:** either wire the existing adapter (if WP-A4 confirms one), or build the smallest new category-breakdown read scoped to a person (if WP-A4 confirms absence) — never a second Budget authority regardless of which branch.
**Depends on:** WP-A4.
**Tests:** category totals for a person match what the existing Budget screen would show for the same filter, if traceable side-by-side.
**Acceptance criteria:** no new Budget ledger created under any circumstance — this is the hard constraint from RPP-002 §10/Rich Person doc §9-10, regardless of what WP-A4 finds.

### WP-B5 — Recent Activity + "View all" **[REUSE]**
**Existing code:** `personFilterOptions`/existing Transactions screen.
**New work:** Person Overview's "Recent Activity" shows 3-5 most recent, "View all" navigates into the existing Transactions screen pre-filtered by this `personId` — zero new transaction storage or view.
**Tests:** "View all" produces the identical result set the existing Transactions-with-Person-filter already produces for the same person.
**Acceptance criteria:** no second transaction list/database exists anywhere in this WP's output (RPP-002 §9, locked).

### WP-B6 — "Add to Person" launcher **[NEW UI, thin]**
**Existing code:** none directly — this is a navigation menu, not a data mechanism.
**New work:** a launcher listing only capabilities that actually exist/apply for this Person — School (Phase E), Gym/Membership (existing), Group (existing), Budget/Allowance (existing), plus Health/Documents/Notes only if/when Phase H ships. Never a generic "create a relationship" object (RPP-002 §13, locked) — each menu item routes directly to its real domain-specific flow.
**Tests:** menu never shows a capability with no underlying implementation.
**Acceptance criteria:** matches Rich Person doc §13's exact framing — launcher, not creator.

---

## Phase C — Relationship Foundation (blocks Phase E; WP-A1 should land first since it touches the same file)

### WP-C1 — Determine minimum change to support School's relationship needs; prove before generalizing **[VERIFY → EXTEND, only as far as proven necessary]**

**Reframed per review — this WP no longer presumes a schema migration.** Knowing `lifecycle.js` is already generic does **not** by itself mean the *persisted* `membershipRelationships[]` shape needs to generalize. Those are separate facts, and this WP starts from that separation rather than skipping to a migration.

**Existing code:** `domain/membership/relationship.js` — `createMembershipRelationship({billerAccountId, personId, startDate, genId})`; `lifecycle.js`, already fully generic, confirmed unchanged either way.

**Step 1 (required first, do not skip):** determine whether School can reuse `lifecycle.js`'s generic engine while School's own relationship records are persisted in their **own** collection/shape (e.g. `schoolRelationships[]`, its own thin file mirroring `relationship.js`'s current pattern but with a `schoolId` field instead of `billerAccountId`) — i.e., two sibling persisted shapes sharing one lifecycle engine, no shared/generalized record at all. **This is the preferred outcome if it works** — it costs nothing to Membership, requires zero migration of existing `membershipRelationships[]` data, and is the smallest safe change for the 3-week runway.

**Step 2 (only if Step 1 provably doesn't work):** if there's a genuine, evidenced reason School *must* share the same persisted record shape as Membership (not just "it would be tidier") — e.g. a real consumer that needs to query both kinds of relationships together without knowing which domain each belongs to — only then does the `billerAccountId → targetType/targetId` migration get scoped, and only with that specific evidenced reason stated in the WP, not as a default.

**Schema change:** none, if Step 1 succeeds. If Step 2 is genuinely required, same migration as previously drafted, but now gated on proof rather than assumed upfront.
**Depends on:** WP-A1 (self-sentinel fix lands first regardless of which branch this WP takes).
**Tests:** Step 1's sibling-shape approach — School relationship create/end tests pass using `lifecycle.js` directly, zero changes to any existing Membership test. Step 2 (if reached) — full existing Membership regression suite passes unmodified post-migration.
**Acceptance criteria:** the WP's writeup states explicitly which step was taken and why — "Step 1 sufficed" or "Step 2 required because X" — this decision must be visible, not silently defaulted to the bigger change.

### WP-C2 — School's relationship implementation **[NEW, thin, shape depends on WP-C1's outcome]**
**Existing code:** WP-C1's outcome (either the sibling-shape pattern or the generalized core).
**New work:** School creates/ends relationships via `lifecycle.js` directly, using whichever persisted shape WP-C1 established. Only create + end are exercised — School has no product need for pause/resume (RPP-002 §4).
**Depends on:** WP-C1.
**Tests:** create/end behave correctly for School; `getRelationshipStatusAsOfDate`-equivalent correctly answers "is this the current school" for a Person with two sequential school relationships (one ended, one active).
**Acceptance criteria:** zero duplicated lifecycle logic — confirmed by this WP importing, not reimplementing, `lifecycle.js`, regardless of which WP-C1 branch was taken.

---

## Phase D — Groups

### WP-D1 — Person ↔ Group navigation **[REUSE]**
Already exists (PPL-000 §6, PPL-001). No new work — referenced here only so the combined brief's navigation map (Phase-I diagram below) is complete.

### WP-D2 — Group-scoped payable (`iOwe`) **[NEW]**
This is **PPL-002 WP-3, unchanged, referenced not restated.** Sequenced here to confirm it still gates WP-B3's Groups card showing both directions correctly, and gates WP-D3.

### WP-D3 — Group balance display in Person Overview **[REUSE, depends on WP-D2]**
**New work:** Person Overview's Groups entries show group-scoped balance (PPL-001 §5/§6, RPP-002 §3) — both directions, once WP-D2 ships.
**Depends on:** PPL-002 WP-3.
**Tests:** matches PPL-002 WP-3's own reconciliation test.
**Acceptance criteria:** never collapses group-scoped figures into the person's overall net (PPL-001 §5, locked).

### WP-D4 — Group transaction filter, if absent **[NEW, conditional on WP-A3]**
**Depends on:** WP-A3's finding. If a Group filter already exists, this WP is void — folded into WP-B5's equivalent for Groups. If absent, smallest possible addition to the existing Transactions screen, mirroring `personFilterOptions`'s exact pattern.
**Acceptance criteria:** no Group-specific transaction screen created under any circumstance (RPP-002 §9, locked) regardless of which branch this WP takes.

---

## Phase E — School (depends on Phase C)

### WP-E1 — Person → School relationship, continuous across years **[NEW, uses Phase C]**
**Existing code:** WP-C2's wrapper.
**New work:** School record itself (permanent identity — name, address only if WP-E-geo below is approved) is new storage, separate from the relationship record; the relationship (Person↔School, via WP-C2) is what has the lifecycle.
**Schema change:** new `schools[]` collection (id, name, address?), new relationship records via WP-C2, keyed `targetType:"school", targetId: school.id`.
**Tests:** same school across two years = one relationship record, not two, even as Academic Year details (WP-E2) change under it.
**Acceptance criteria:** RPP-002 §5's continuous-relationship model holds — verified by a test that changes Class/Division/Roll year-over-year and confirms the relationship's `id` and `startDate` never change as a result.

### WP-E2 — Academic Year owns its year-scoped context, including that year's Annual Fee Structure — single source of the year, not two **[NEW]**

**Hard constraint, stated explicitly per review — binding on this WP's design, not optional:**
```
School relationship → Academic Year → { Class, Division, Roll, Annual Fee Structure }
```
**The Academic Year is the single owner of "which year this is."** Class/Division/Roll and that year's Annual Fee Structure are both children of one Academic Year record — never two independently-created representations of the year (e.g. `academicYear:"2026-27"` stored once on a yearly-details record and *again*, separately, on a fee-schedule record) that could disagree with each other. If the fee structure needs its own record for size/complexity reasons (likely, given WP-F1's itemization), it is still scoped by reference to its owning Academic Year's id — never by re-stating the year string independently.

**New work:** an Academic Year record (id, school-relationship reference, year label, Class, Division, Roll) that the Annual Fee Structure (WP-F1) is created *under* — engineering determines the exact reference direction (Fee Structure holds `academicYearId`, or Academic Year holds `feeStructureId` — either is acceptable, but exactly one must be the source of truth, decided and documented in this WP's implementation, not left implicit).

**Schema change:** new Academic Year collection; the fee-structure schema from WP-F1 gets scoped to it by reference, not by a duplicated year value.
**Tests:** editing an Academic Year's Class/Division/Roll never requires or triggers any change to its Fee Structure, and vice versa — proving they're siblings under one owner, not two independent things that happen to usually agree. A test that deliberately tries to construct a Fee Structure with a mismatched/independent year string should be structurally impossible (no such field exists to set), not merely discouraged by convention.
**Acceptance criteria:** exactly one place in the data model states "what year this is" per Academic-Year-scoped record — verified by inspection, not just by a passing test, since this is a structural property the schema itself should enforce.

### WP-E3 — Current vs. historical school display **[REUSE via WP-C2]**
**Existing code:** `getRelationshipStatusAsOfDate`-equivalent, already generic (WP-C1).
**New work:** Person Overview shows only the current (active) school prominently; past schools behind "View school history" (RPP-002 §1's wireframe, Rich Person doc §17).
**Tests:** a Person with one ended + one active school relationship shows only the active one in the primary Active section.
**Acceptance criteria:** matches RPP-002 §5's current-vs-past visibility requirement exactly.

### WP-E4 — School change lifecycle **[REUSE via WP-C2]**
**New work:** UI action "change school" = end current relationship (WP-C2's `end`) + create new relationship (WP-C2's `create`) — never an edit of the existing record (RPP-002 §5/§17, locked).
**Tests:** old school's historical Academic Years/Fee data remain fully intact and attached to the ended relationship after a school change.
**Acceptance criteria:** no edit path exists anywhere that can turn School A into School B directly.

### WP-E5 (conditional) — School address/geotagging **[DEFERRED per SFE-001 §10.7]**
Restated, not reopened: SFE-001 §10.7 recommended deferring this from v1 given zero existing geocoding infrastructure and the app's local-first architecture (ADR-036). Not scoped as a WP unless you explicitly authorize it separately.

---

## Phase F — School Fees (depends on Phase E for the Person/Academic-Year linkage; the fee-domain logic itself is independent and could theoretically run in parallel)

### WP-F1 — Itemized annual components **[EXTEND]**
**Existing code:** `createSchoolFeeSchedule`/`generateFeePeriods` currently take `rateRules[]` (a single monthly rate per date range) — no itemized-component concept exists.
**New work:** support the Tuition/Transport/Books/Annual-charges itemization (SFE-001 §4/RPP-002 §6) with an auto-calculated total. This changes what `rateRules` (or its replacement) represents — components sum to a monthly/period rate, not a single flat number.
**Schema change:** new shape for the annual structure's rate input — components list instead of (or alongside) a flat `monthlyRate`.
**Tests:** the example from SFE-001 §4 (₹60k+₹20k+₹5k+₹15k=₹1,00,000) generates correctly; existing single-rate schedules (no components) still work unchanged (backward compatible).
**Acceptance criteria:** `periodGeneration.js`'s existing guarantees (no proration, throws on missing coverage, generate-once) all still hold with itemized input.

### WP-F2 — Term-wise and custom schedule shapes **[NEW]**
**Existing code:** `periodGeneration.js` only generates monthly periods today — confirmed gap, not previously scoped this precisely (RPP-002 §6).
**New work:** two additional generation modes alongside the existing monthly one. This is real new logic, not a config toggle on the existing function.
**Tests:** term-wise generates the right number of periods for a given term structure; custom accepts an explicit period list; both preserve every existing guarantee (`generateFeePeriods`'s no-mutation, no-cross-schedule-reference properties).
**Acceptance criteria:** monthly mode's existing tests (periodGeneration.test.js) all still pass unmodified — this WP adds, never edits, the existing monthly path.

### WP-F3 — Annual structure editing + recalculation engine **[NEW — the single largest WP in this brief]**
**Existing code:** `editFeePeriodObligationAmount` (single-period, touched-gated) is the only existing edit primitive; nothing recalculates a whole schedule.
**New work, exact scope, per your own framing:**
```
new annual structure
  → calculate remaining annual obligation
  → redistribute across untouched future periods only
  → preview: old vs. new, per period
  → user can adjust any individual proposed future amount
  → user confirms
  → apply: edit untouched periods in place, IDs preserved, never regenerated
```
Touched periods (SFE-001 §6's immutability rule) are never included in the redistribution — excluded entirely, not zeroed or skipped-with-a-flag.
**Schema change:** none beyond WP-F1/F2's — this operates on the existing `feePeriods[]` shape, editing `obligationAmount` on untouched records only.
**Depends on:** WP-F1 (components) and WP-F2 (schedule shapes) conceptually inform what "recalculate" redistributes across, though the core engine could be built against the existing single-rate shape first and extended.
**Tests:** the exact worked example from SFE-001 §5/RPP-002 §19 (₹1,00,000→₹1,20,000 mid-year, ₹40,000 already paid, ₹80,000 new remaining, correctly redistributed across untouched future periods only); a period with any payment/discount/write-off/credit is provably excluded from redistribution in every test case; preview output matches what's actually applied after confirmation (no drift between preview and apply).
**Acceptance criteria:** this WP's own test suite is the largest in the brief, proportional to it being the riskiest new logic — no WP-F3 sign-off without it.

### WP-F4 — Preview/adjust/confirm UX **[NEW UI, depends on WP-F3]**
**New work:** the interaction shape locked in SFE-001 §10.5 — a real UI over WP-F3's engine, not a new calculation.
**Tests:** UI-level — every number shown in preview matches WP-F3's own test-proven output exactly.
**Acceptance criteria:** no recalculation logic duplicated in the UI layer — purely a renderer over WP-F3.

---

## Phase G — School Payments (depends on Phase F for periods to settle against; independent of Phase F3's recalculation engine)

### WP-G1 — Multiple payments / partial payments **[REUSE, confirmed by WP-A2]**
Already correct per trace + WP-A2's new regression test. No new production code — referenced here for completeness in the sequencing diagram.

### WP-G2 — Overpayment / credit **[EXTEND]**
**Existing code:** `createSchoolCreditNote`/`applyCreditToPeriod` (`creditNotes.js`) — already exactly the right shape.
**New work:** a product flow wrapping these — when a structure change (WP-F3) or a settlement produces an overpayment, default to School Credit (SFE-001 §9/RPP-002 §23), with an explicit alternative to refund.
**Tests:** the SFE-001 §9 worked example (₹1,00,000→₹70,000, ₹80,000 already paid, ₹10,000 credit).
**Acceptance criteria:** zero new domain function — confirmed by this WP's implementation only calling existing `creditNotes.js` exports.

### WP-G3 — Refund **[REUSE]**
**New work:** UI action creating an ordinary new transaction (SFE-001 §8) — no new mechanism.
**Acceptance criteria:** the original payment transaction is never modified; refund is always a distinct, new transaction record.

### WP-G4 — Forfeiture, with explicit accounting semantics **[NEW — resolved in full, not partially, per review]**

**Product decision, unchanged:** forfeiture is **not** a transaction. The money already moved at original payment time. Restated because it's the anchor everything below has to remain consistent with.

**What was underspecified before, now made explicit — a forfeited amount must never continue showing as outstanding:**
```
Period
  obligation:  ₹10,000
  paid:        ₹10,000   ← unchanged, this is the original real payment
  forfeited:   ₹10,000   ← new, distinct field
  outstanding: ₹0        ← must resolve to zero, not remain ₹10,000
```

**This requires `calculateOutstanding` (`outstanding.js`) to account for forfeiture as a reduction, the same structural role `discountAmount`/`writeOffAmount`/`appliedCreditAmount` already play** — engineering must decide whether that's literally a fifth term added to the existing formula, or whether forfeiture is represented as a specific *reason* on the existing `writeOffAmount` field rather than a new field entirely. **Do not assume either way** — the two concepts are semantically different (a write-off is the school's waiver of what's still owed; forfeiture is the family's loss of an amount that was already paid and already spent by the school on the family's behalf) and might need to stay distinct for accurate reporting even if they behave identically inside `calculateOutstanding`'s arithmetic. This WP's job is to make that call explicitly and document why, not to silently reuse `writeOffAmount` for convenience.

**Every consumer this must be verified against, not assumed correct by extension:**
- **Outstanding calculation** (`outstanding.js`) — must reflect forfeiture as shown above.
- **Remaining annual obligation** (`annualSummary.js`'s `remainingObligation`) — a forfeited period must not continue contributing to the annual remaining figure; verify `calculateAnnualSummary`'s direct-sum-of-outstanding approach (already correctly avoids the "residual subtraction" bug for undeclared periods, per its own file header) handles a forfeited period correctly by the same mechanism, or needs its own explicit test proving it does.
- **Future recalculation** (WP-F3) — a forfeited period must be excluded from redistribution the same way a touched period is; this WP should add a test to WP-F3's own suite, not just its own, proving a forfeited period is never redistributed into.
- **School credit** (WP-G2) — forfeiture and credit are different outcomes for the same situation (unused prepaid amount) — confirm they're mutually exclusive per period (a period is either forfeited or credited, never both) or explicitly design for the case where they're not, rather than leaving the interaction undefined.
- **Refund** (WP-G3) — confirm a refunded period and a forfeited period are mutually exclusive states, and that recording a refund on a period that was headed toward forfeiture correctly prevents the forfeiture path rather than allowing both.
- **Reporting** — any UI/summary surface showing "outstanding" or "remaining obligation" must reflect the corrected figures above, not the pre-forfeiture ones.

**Tests:** the SFE-001 §7/RPP-002 §22 worked example end-to-end (₹60,000 paid, Apr–Jul consumed, Aug/Sep unused, school doesn't refund → Aug/Sep marked forfeited) verifying **all six** consumers above in one connected test, not six isolated unit tests that could each pass while the integration is wrong; a test explicitly asserting transaction count is unchanged before/after a forfeiture action (the property most likely to be gotten wrong by a naive implementation that creates a "loss" transaction).
**Acceptance criteria:** a forfeited amount is provably ₹0 outstanding, provably excluded from remaining-obligation and recalculation, provably distinct from both write-off and credit in the data even if their arithmetic effect overlaps, and provably produces zero new transactions.

---

## Phase H — Final Dependent enrichment (explicitly deferred, listed for completeness only)

Health, Lifestyle, Documents, Notes — **not scoped as work packages in this brief.** Per RPP-002/Rich Person doc §14, these ship "only where there is an approved underlying capability" — none exists yet. Reopen as their own Phase 2-style product decision pass when/if you want to scope them, rather than let them ride along on this brief's momentum.

---

## Phase I — Sequencing diagram

```
Phase A (WP-A1..A5) ── all parallel, no dependencies
   │
   ├── WP-A1 ──► WP-C1 ──► WP-C2 ──► Phase E (WP-E1..E4)
   │                                       │
   │                                       ▼
   │                              Phase F (WP-F1, F2 parallel ──► WP-F3 ──► WP-F4)
   │                                       │
   │                                       ▼
   │                              Phase G (WP-G1..G4, mostly parallel)
   │
   ├── WP-A2 ── standalone, ships whenever
   ├── WP-A3 ──► WP-D4 (conditional)
   ├── WP-A4 ──► WP-B4
   └── WP-A5 ──► informs whether Phase F needs an extra Future Money wiring WP

PPL-002 WP-6 (archived-people filtering, independently Frozen) is a **hard dependency**, not a soft note — enforced explicitly:

```
PPL-002 WP-6
      ↓
School Person Picker (Phase E's Person-linkage UI)
      ↓
School relationship (WP-E1)
```

School creation must not build a temporary or parallel Person-selection mechanism to work around WP-6 not being ready yet. If Phase E is reached before PPL-002 WP-6 ships, Phase E's Person-picker work waits — it does not improvise a substitute.

Phase B (WP-B1..B6) ── B1/B2/B5/B6 unblocked from the start; B3 depends on Phase C
   for School to appear, and on existing Membership/Group data for its other cards;
   B4 depends on WP-A4

Phase D (WP-D1..D4) ── D1 already exists; D2 is PPL-002 WP-3 unchanged; D3 depends on D2
```

---

## Testing discipline (restated, binding across every phase)

Same as PPL-002: tests are written with each work package, not after. No WP in this brief is complete without its own listed tests passing. Phase F3 (the recalculation engine) is the single riskiest piece of new logic in this entire combined brief and should receive proportionally the most test coverage — explicitly called out again here so it isn't diluted across a 30+-WP document.

## Final acceptance checklist (mirrors Rich Person doc §31/RPP-002 §39, restated as engineering sign-off gates)

- [ ] Person ID / Group ID never change under any WP in this brief.
- [ ] No historical transaction, settlement, or touched fee period is ever rewritten.
- [ ] Archive, not destructive delete — unchanged from PPL-002.
- [ ] Person Profile introduces zero new financial/budget/transaction authority.
- [ ] "View all" always routes into the existing Transactions experience, filtered — never a new screen.
- [ ] School is a continuous relationship across years; school change is end+start, never edit.
- [ ] Annual fee structure is always editable; touched periods are never rewritten by a structure change.
- [ ] Multiple real transactions can satisfy one fee obligation, proven by WP-A2's test.
- [ ] Refund is always a new transaction; forfeiture is never a new transaction (WP-G4).
- [ ] `PERSON_MODULES` gains no School/Gym/Health entries — presence-based only.
- [ ] Self-sentinel bug closed before any relationship generalization ships (WP-A1 before WP-C1).
- [ ] WP-C1 states explicitly which step it took (sibling-shape vs. generalized migration) and why — never defaults to the bigger change unproven.
- [ ] Exactly one record owns "what year this is" per Academic Year context (WP-E2) — Class/Division/Roll and that year's Fee Structure never independently restate the year.
- [ ] A forfeited period is provably ₹0 outstanding, excluded from remaining obligation and recalculation, and produces zero new transactions (WP-G4, verified across all six listed consumers, not assumed by extension).
- [ ] PPL-002 WP-6 is a hard gate on the School Person-picker — no temporary/parallel Person-selection mechanism is built to work around it.
- [ ] Single combined brief, no separate PPL/RPP/SFE implementation tracks.

---

Not implementation-authorized until reviewed. PPL-002's own 9 WPs remain exactly as Frozen — nothing above alters them, only sequences new work around WP-3 and WP-6's existing dependency points.

---

## Execution instructions for implementation (issued at approval, 30 Aug 2026)

> **ARTH-003 APPROVED — IMPLEMENTATION MAY BEGIN.**
>
> Use this document as the implementation authority. All product decisions in the brief are now frozen.
>
> **Execution rules:**
> - Follow the WP sequencing and dependencies exactly (Phase I diagram).
> - **[VERIFY] WPs are genuine gates. Do not assume the outcome.**
> - Do not perform the larger WP-C1 relationship schema migration (Step 2) unless Step 1's required proof actually establishes it's necessary.
> - Do not create parallel Person, Group, Transaction, Budget, or relationship authorities anywhere in this work.
> - Preserve all existing IDs and historical financial relationships — no exceptions, no WP is authorized to override this.
> - PPL-002 remains Frozen and unchanged.
> - PPL-002 WP-6 is a hard dependency for the School Person-picker — do not build a temporary/parallel Person-selection mechanism to work around it if reached early.
> - Write tests with each WP, not retrospectively.
> - Do not silently broaden scope into Phase H (Dependent enrichment — Health/Lifestyle/Documents/Notes). Phase H is explicitly out of scope for this brief.
> - For WP-G4: forfeiture is not a transaction. The original payment is never modified.
>
> **Start with Phase A, proceed WP-by-WP.** After each meaningful WP/cluster, report: what was changed; files changed; tests added/changed; tests passed; any deviation from ARTH-003; any newly discovered architectural issue.
>
> **Do not redesign frozen product decisions during implementation.** If the live code contradicts a frozen decision, stop at that WP and surface the contradiction before proceeding — do not resolve it unilaterally.
>
> Implementation is now authorized.
