# PPL-005 Response — School Completion Trace + Implementation Plan
## Traced against real source (`arth-app.zip`), not the production bundle

**Status:** Trace complete, per PPL-005 item 8. Not yet reviewed/approved. **Do not code from this until you sign off.**
**Date:** 2026-09-02
**Method note:** Everything below is read directly from source files in the uploaded repo — `src/App.jsx`, `src/domain/school/relationship.js`, `src/domain/school/feeScheduleLink.js`, `src/domain/person/personOverview.js`, `src/domain/school/relationship.test.js`, `src/screens/SchoolFeesScreen.jsx`, `src/screens/PersonProfileScreen.jsx`, `src/screens/InsuranceScreen.jsx`, and `I-5-School-Fees-Implementation-Plan.md`. No bundle reconstruction was needed for this pass — confidence is high throughout.

---

## Important correction before the School trace: Section J is resolved, and the answer overturns a frozen assumption

Both the original `PPL-relationship-architecture-decision.md` and PPL-005 itself told the coder to "treat `insurancePolicies[]` as vestigial unless the trace proves otherwise." The trace now proves otherwise, decisively:

- `insurancePolicies[]` is a fully live feature: real `useState` with localStorage persistence (`arth_insurance_policies`), a complete Add/List/Detail modal set (`InsuranceScreen.jsx`), included in the cloud-sync snapshot and restore path, and reachable from the live UI — tapping "Insurance" in the biller grid calls `setShowInsuranceList(true)` directly (`App.jsx` ~L13609).
- It references a formal decision, **ADR-021** ("Policy never creates Transactions — only creates a Bill"), though I could not find an ADR-021 file anywhere in the repo tree. Worth confirming that decision is actually recorded somewhere, or reconstructing it, since the code comment cites it as settled.
- However: `insuredPerson` on a policy is a **free-text string field**, not a `personId` reference into `people[]`. It cannot participate in any Person attribution mechanism as it's currently shaped — that's a real gap, but a different one than "vestigial."
- Separately, `"Insurance"` also appears in the `BILLER_TYPES` list used for generic biller accounts. But selecting it in the UI does not create a `billerAccounts` record — it special-cases straight into the separate `insurancePolicies[]` list. So there are genuinely two Insurance concepts, but neither is dead: one is a live, complete feature with no Person link; the other is a label that never actually produces the generic biller-account path it appears to offer.

**This is a Change-Request-worthy correction to a frozen decision, not a footnote.** Recommend formally amending `PPL-relationship-architecture-decision.md`'s Insurance section rather than letting this live only in this reply. I have not touched Insurance code or state — this is trace-only, per your explicit "do not touch Insurance yet" instruction.

---

## 1. Current School data path

Two separate, independently-built layers exist, and only one of them is wired into production:

**Layer A — the financial/ledger engine (I-5), appears complete:**
`feeSchedules[]`, `feePeriods[]`, `schoolCreditNotes[]` are all live `useState` + localStorage-persisted arrays in `App.jsx`, with a full `SchoolFeesScreen.jsx` UI (schedule creation, period settlement, discounts, write-offs, credit notes, annual summary). The `I-5-School-Fees-Implementation-Plan.md` in the repo documents WP-1 through WP-10 for this exact layer, and the code matches that plan's shapes precisely (`generateFeePeriods`, `settleFeePeriods`, `startingStateDeclared` gate, the eight-value annual summary, etc.). This is a real, working financial feature.

**Layer B — the Person relationship foundation (ARTH-003 WP-C2/C3/B1), built but not connected:**
- `src/domain/school/relationship.js` — a complete, tested (`relationship.test.js`) module: `createSchoolRelationship`, `endSchoolRelationship`, `isSchoolRelationshipCurrent`, `getCurrentSchoolRelationship`, `getHistoricalSchoolRelationships`. Built directly on Membership's generic `lifecycle.js` — no duplicated status-machine logic.
- `src/domain/school/feeScheduleLink.js` — the join layer connecting a School Relationship to `feeSchedules[]` via the shared `personId` field. Its own header states, from direct re-trace: *"App.jsx's one call site (AddSchoolYearModal) still hardcodes `personId={null}`. This means, in production TODAY, every existing real feeSchedule has personId===null."* Confirmed independently — `App.jsx` line 15694 passes `personId={null}` literally.
- `src/domain/person/personOverview.js` — `getPersonActiveConnections()`, the canonical read-adapter this whole PPL-004/005 discussion was aiming at, already built and already called in `App.jsx` (line 8852) — but called with `{ groups, membershipRelationships }` only. `schoolRelationships` is omitted, falling through to the function's own empty-array default. **The computed `activeConnections` result is never subsequently used or passed anywhere** — it's a dead variable today, confirmed by grep (only the one assignment, zero other references).

## 2. Exact missing wiring

Four discrete gaps, in dependency order:

1. **No `schoolRelationships[]` state exists in `App.jsx` at all** — no `useState`, no setter, no localStorage key. Layer B's domain module has nothing to operate on in production.
2. **`AddSchoolYearModal` hardcodes `personId={null}`** at its one call site — there is no Person Picker UI in the School Fees add-schedule flow.
3. **`PersonProfileScreen.jsx` receives `schoolRelationships={[]}` as a literal**, hardcoded at the render call site (`App.jsx` line 9109), and separately defaults the prop to `[]` in its own signature (line 80) with a comment confirming this is deliberate/known, not accidental.
4. **The `activeConnections` computation is orphaned** — built, called, discarded. Either it should feed something (and currently doesn't), or it should be removed until it does. Worth deciding which during implementation, not left as silent dead code.

## 3. Existing School Person Picker situation

**None exists.** `AddSchoolYearModal`'s props are `{ onClose, T, inp, lbl, setFeeSchedules, setFeePeriods, billerAccountId, personId }` — `personId` is accepted as a prop but the one call site never supplies a real value. There is no person-selection UI (dropdown, chip picker, or otherwise) inside `SchoolFeesScreen.jsx` for this flow. This needs to be built new — it does not exist in any dormant/unwired form the way the relationship module does.

## 4. Add/Edit flow required

Minimum viable, consistent with how Membership's equivalent flow already works elsewhere in the app:

- Add a Person Picker to `AddSchoolYearModal` (or its call site), defaulting to unselected — not forced, per PPL-005's "financial attribution ≠ saved Person" guardrail. A schedule with no person selected should behave exactly as today (works fine, `personId: null`, no Person Profile linkage — this is a legitimate state, not an error).
- When a person **is** selected, on save: call `createSchoolRelationship({ schoolId, personId, startDate, genId })` if no current relationship already exists for that person (via `getCurrentSchoolRelationship`), and pass the resulting `personId` through to the `feeSchedules` record exactly as the existing `feeScheduleLink.js` join already expects.
- `schoolId` needs a source — currently `feeSchedules` has no `schoolId` field, only a free-text `schoolName` string (confirmed by `feeScheduleLink.js`'s own documented "REAL LIMITATION"). This needs a decision: either derive a stable `schoolId` from the school name (risk: two schools with the same typed name collide or diverge), or accept that `schoolId` stays opaque/uncorrelated to `schoolName` for now and is set once at relationship-creation time, independent of the schedule. **This is a real open question, not resolved by existing code** — flagging per your hard-stop instruction rather than picking one silently.

## 5. How `feeSchedules[].personId` becomes visible through Person

Once (2) and (3) above are fixed, the chain is otherwise already built:
`feeSchedules.personId` (set) → `feeScheduleLink.getPersonFeeSchedules(personId, feeSchedules)` (already correct) → real `schoolRelationships[]` state (needs to exist) → `getPersonActiveConnections` (already correct, just needs the real array passed in) → `PersonProfileScreen`'s Organisations section (already correct, just needs the real array passed in instead of `[]`).

No new read-layer code is needed. This is entirely a wiring gap, not a missing-logic gap.

## 6. Lifecycle/status requirements

Per `relationship.js`'s own documented scope: only `create` and `end` are needed for School (no pause/resume — a school relationship is either ongoing or ended because the child left, per RPP-002 §4/SFE-001 §2, already locked). This matches the existing module exactly — no gap here.

One real question: a school change (child moves schools) requires **ending** the old relationship and **creating** a new one — never editing `schoolId` on an existing record (documented explicitly in `relationship.js`'s own comments as the correct pattern). No UI currently exists for this "change school" action either. Worth deciding whether it's in scope for this pass or deferred.

## 7. Files that would need changing (implementation, not yet done)

- `src/App.jsx` — new `schoolRelationships` state + setter + localStorage key + cloud-snapshot wiring (mechanical, same pattern as every other array); pass real array to `getPersonActiveConnections` call and to `PersonProfileScreen`; add Person Picker UI or its call-through to `AddSchoolYearModal`; call `createSchoolRelationship`/`endSchoolRelationship` at the appropriate points.
- `src/screens/SchoolFeesScreen.jsx` — `AddSchoolYearModal` needs a person-selection control and to pass a real `personId` instead of accepting the caller's null.
- No changes needed to `src/domain/school/relationship.js`, `feeScheduleLink.js`, or `personOverview.js` — all three are already correct for this use case.

## 8. Tests required

- `AddSchoolYearModal` with no person selected still creates a working schedule exactly as today (regression — must not break the existing no-person path).
- Selecting a person on schedule creation results in a `feeSchedules.personId` matching a real, newly-created (or existing/reused) `schoolRelationships` entry.
- `getPersonActiveConnections` with a real populated `schoolRelationships` array correctly surfaces School in a test person's connections (this can largely reuse the existing `relationship.test.js` fixtures).
- Ending a school relationship correctly removes it from "current" (via `isSchoolRelationshipCurrent`) while it remains visible via `getHistoricalSchoolRelationships`.
- Cross-cutting: creating a schedule for Person A never creates or mutates a relationship for Person B, and never touches an existing schedule's `personId` retroactively.

## 9. Anything requiring a new architectural decision before coding

Two items, both flagged rather than resolved:

1. **`schoolId` sourcing** (Section 4 above) — no existing mechanism ties a stable school identity to the free-text `schoolName` already on `feeSchedules`. Needs a product decision: derive one, or accept the relationship's `schoolId` as independently set and not required to correlate with `schoolName` for now.
2. **"Change school" flow scope** (Section 6 above) — whether ending-old/creating-new for a school change is in scope for this implementation pass or deliberately deferred.

Neither blocks starting the mechanical wiring work (state, Person Picker, adapter connection) — both only block the specific "what happens on a school change" and "what identifies a school" questions.

---

## Summary for your review

- **School:** the hard work (relationship lifecycle module, join logic, read adapter) is already built and tested. What's missing is pure wiring — no new domain logic required, two small open decisions flagged above.
- **Insurance:** the "vestigial" assumption in the frozen decision doc is wrong. It's live and complete but has no Person-linkage field at all. Recommend a formal correction to that document before any future Insurance work — separate from this School pass, per your "do not touch Insurance yet" instruction, which I've followed.

Tests/implementation this turn: **NONE** — trace and plan only, as instructed.
