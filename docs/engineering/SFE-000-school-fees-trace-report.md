# SFE-000 — School Fees Trace Report

**Status:** Draft — trace now complete against all three files that matter (`App.jsx`, `screens/SchoolFeesScreen.jsx`, `domain/schoolFees/futureMoney.js`). The critical question is answered with certainty below. One dependency (`domain/schoolFees/service.js`, imported by `SchoolFeesScreen.jsx` but not itself uploaded) still bounds a couple of narrower points — flagged inline, not blocking the main conclusion.
**Method:** same evidence standard as PPL-000 — direct grep + line-level read of the live files as uploaded. No inference from naming, no memory carried over.

## Update note (this revision)

The original draft of this report was written with only `App.jsx` available and explicitly flagged School Fees' real screens/logic as untraced. `screens/SchoolFeesScreen.jsx` and `domain/schoolFees/futureMoney.js` have since been provided and traced. This revision **reverses the tentative finding in §10 of the original draft** — see below. The original draft's §4/§5/§6/§7 findings (all sourced from `App.jsx` alone) are unchanged and still hold; only §1 (schema), §2 (edit), §3 (delete/archive), §10, and §11 are updated here.

One remaining boundary: `SchoolFeesScreen.jsx` imports `../domain/schoolFees/service.js`, `../domain/schoolFees/outstanding.js`, and `../domain/schoolFees/annualSummary.js` — none of these three were uploaded. Every finding below is sourced from what's directly visible in the two files I do have; where a conclusion depends on `service.js`'s internals specifically, it's marked as inferred-from-call-site rather than confirmed-by-reading.

---

## 1. School Fees schema — now confirmed

**Confirmed from `App.jsx`:** three top-level state collections, each independently persisted:
```js
const [feeSchedules, setFeeSchedules] = useState(()=>JSON.parse(localStorage.getItem("arth_fee_schedules")||"[]"));      // L728
const [feePeriods, setFeePeriods]     = useState(()=>JSON.parse(localStorage.getItem("arth_fee_periods")||"[]"));       // L729
const [schoolCreditNotes, setSchoolCreditNotes] = useState(()=>JSON.parse(localStorage.getItem("arth_school_credit_notes")||"[]")); // L730
```
No normalizer equivalent to `normalizePeople` runs on any of these three on load — they load as raw JSON.

**`feeSchedule` fields, confirmed from `SchoolFeesScreen.jsx`:**
```js
const { schedule, periods } = schoolFeesService.createSchoolFeeSchedule(
  { billerAccountId: billerAccountId||null, personId: personId||null, schoolYearStart, schoolYearEnd, rateRules },
  genId
);
const scheduleWithName = { ...schedule, schoolName: schoolName.trim() };
```
(`AddSchoolYearModal`, L100-104)

**This is the decisive finding for the whole report: `personId` is a real, named field in the School Fees schema.** It's passed as a construction argument to `createSchoolFeeSchedule` alongside `billerAccountId`, `schoolYearStart`, `schoolYearEnd`, `rateRules` — this is not a guess or an inference, it's the literal argument list. Confirmed fields on `schedule`: `id` (assigned by `service.js` via the injected `genId`, not directly visible but structurally required — `schedule.id` is read elsewhere, e.g. L667's `schoolFeesService.createCreditNote(schedule.id, ...)`), `billerAccountId`, `personId`, `schoolYearStart`, `schoolYearEnd`, `rateRules`, plus `schoolName` (added client-side after the service call, not part of the service's own construction).

**`feePeriod` fields, confirmed** (from direct property reads across `PeriodDetailModal` and `AdjustmentModal`): `id`, `label`, `obligationAmount`, `startingStateDeclared`, `paidAmount`, `discountAmount`, `writeOffAmount`, `appliedCreditAmount`, `settlementLinks`, plus `dueDate` (confirmed separately from `futureMoney.js`'s `mapFeePeriodToCommitment`, which reads `period.dueDate` directly). No `studentName`/`childName`/`studentId` field was found anywhere in either file.

**No `studentId` field exists anywhere in the schema.** The identity hook that exists is `personId` — pointing at the general People identity layer, not a School-Fees-specific student concept.

## 2. Existing Edit capability — now confirmed, and it's more precise than "exists or doesn't"

**Schedule-level: no edit exists.** There is no edit action anywhere in `SchoolFeesScreen.jsx` for `schoolName`, `schoolYearStart`, `schoolYearEnd`, `rateRules`, `billerAccountId`, or `personId` once a schedule is created. Confirmed by exhaustive read of the file — the only place any of those fields are set is at creation (`AddSchoolYearModal`).

**Period-level: a real, gated edit exists** — `schoolFeesService.editPeriodAmount(feePeriods, period.id, v)` (`PeriodDetailModal`, L450-458), which edits a single period's `obligationAmount`. It is gated by two conditions computed inline:
```js
const und = !period.startingStateDeclared;
const touched = period.paidAmount>0 || period.discountAmount>0 || period.writeOffAmount>0 || period.appliedCreditAmount>0;
const editable = !und && !touched;
```
(L437-440) — editable only if the period's starting state has been declared *and* nothing has touched it yet (no payment, discount, write-off, or applied credit). Once touched, the UI explicitly disables the input and shows, verbatim: **"This period has been settled or adjusted. Editing the fee would rewrite history — use a discount, write-off, or credit note instead."** (L525)

This is a real, deliberate design principle already implemented in School Fees, independently of PPL — it's the same "never rewrite history" instinct PPL-000/PPL-001 apply to People/Groups, arrived at separately for periods. Worth naming explicitly since it's a point of alignment, not a gap: **School Fees already treats settled financial history as immutable, same as the Relationship Ledger direction.**

`editPeriodAmount` is id-preserving by construction (called with `period.id`, updates via `service.js`'s own lookup — not independently re-verified since `service.js` wasn't uploaded, but the call signature leaves no other id-independent way to target the update).

## 3. Existing Add / Delete / Archive behavior — now confirmed

**Add — confirmed, one call site, schema now known:**
```jsx
{showAddSchoolYear&&<AddSchoolYearModal onClose={()=>setShowAddSchoolYear(false)} T={T} inp={inp} lbl={lbl}
  setFeeSchedules={setFeeSchedules} setFeePeriods={setFeePeriods} billerAccountId={null} personId={null}/>}
```
(`App.jsx` L15587) — this is the **only** place `AddSchoolYearModal` is rendered anywhere in `App.jsx`, and `AddSchoolYearModal` is the **only** place `createSchoolFeeSchedule` is called anywhere in `SchoolFeesScreen.jsx`. Both `billerAccountId` and `personId` are hardcoded to `null` at this single call site. Now that §1 confirms `personId` is a real schema field the service function actually accepts, this reframes the earlier finding precisely: **the schema supports a Person link; the one and only place in the entire traced codebase that constructs a schedule simply never supplies one.** This isn't "no linkage was built" — it's "linkage was built into the data layer and never wired to a real value at the UI layer."

**Delete/Archive — confirmed absent, for both schedule and period.** Exhaustive read of `SchoolFeesScreen.jsx` found no delete, remove, or archive action for a `feeSchedule` or `feePeriod` anywhere. The only "Remove" found in the file (L85, L138) removes a draft `extraRules[]` entry *during creation, before save* — not a saved record. There is no `setFeeSchedules(prev=>prev.filter(...))`-equivalent call anywhere in this file, consistent with `App.jsx` also having none (confirmed in the original draft).

**Whether deletion can affect historical fee records:** moot as currently built — there is no deletion mechanism to affect them. If one is added later, the period-edit gating logic in §2 (`touched` check) is the natural precedent to extend to a delete/archive decision, since it already distinguishes "nothing has happened yet, safe to change" from "something happened, now immutable."

## 4. Person relationship — the central question

I searched `App.jsx` exhaustively for `personId`, `studentId`, `people`, and any School-Fees-adjacent lookup helper. Results:

- **`personId` appears exactly once in any School-Fees-related line in `App.jsx`: the hardcoded `null` at L15587 (§3).** No other School Fees code path in `App.jsx` reads or writes a `personId`.
- **`studentId` does not appear anywhere in `App.jsx`.** Zero occurrences.
- By contrast, **Membership** — a separate, adjacent domain — genuinely does use `personId` as real, live data:
  ```js
  const existingRel = membershipRelationships.find(r=>r.billerAccountId===billerAccount.id && r.personId===memberPersonId); // L14795
  const newRel = createMembershipRelationship({ billerAccountId:billerAccount.id, personId:memberPersonId, ... });          // L14799
  ```
  This confirms the codebase *does* know how to wire a real Person into a Biller-adjacent flow when it's built to — Membership does it, School Fees' `App.jsx` entry point does not.
- **A direct code comment settles the BillerAccount question explicitly**, at the point where the user taps "School Fees" from the category grid:
  ```js
  // Insurance and School/Education Fees don't participate in the
  // billerAccounts hierarchy (neither writes to billerAccountId in
  // practice) — routing them into the generic flow would be a dead end.
  // Route straight to their real, domain-specific screens instead.
  if(type==="Insurance"){ setShowInsuranceList(true); return; }
  if(type==="School Fees" || type==="Education Fees"){ setShowSchoolFeesList(true); return; }
  ```
  (`App.jsx` L13522-13528)

  **This is a direct correction to something I'd previously understood as fact** (that a "Payments" surface consolidated Insurance/School Fees/Bills under the existing Biller → BillerAccount hierarchy). What this comment actually says is closer to the opposite for School Fees specifically: School Fees is explicitly routed *around* the BillerAccount hierarchy to its own dedicated screen, because — per the comment, in the code's own words — it doesn't participate in that hierarchy "in practice." I'm flagging this discrepancy rather than silently updating my notes, since it affects how PPL-002/PPL-001's assumptions about Payments navigation should be read going forward — worth you confirming which framing is actually current.

**No student/person lookup helper specific to School Fees was found** (no `getStudent(...)`, no `getFeeScheduleStudent(...)`, nothing analogous to `getPerson`/`getGroup`).

## 5. Financial dependencies

**Confirmed, traced directly:**
- **Future Money:** `feePeriods` feeds `getSchoolFeeCommitments(feePeriods)` → `composeFutureMoneyCommitments` (`App.jsx` L7654) — confirmed wiring, but the internal projection logic lives in the external `domain/schoolFees/futureMoney.js`, not traceable here.
- **Transactions:** confirmed, direct read at the settlement call site (L15607-15622, quoted in full below) — a School Fee settlement creates a real transaction in `txns[]`.
- **Backup/restore:** `feeSchedules`, `feePeriods`, `schoolCreditNotes` are all included in the app's snapshot object (`App.jsx` L7199-7201) and restored from a snapshot (L7249-7251) and included in the cloud-sync dependency array (L7611) — confirmed to participate in the same backup/sync mechanism as everything else in the app.

**Not confirmed / not found:** any direct School Fees dependency on `accounts`, `bills[]` (the Bills domain specifically — School Fees creates its own transactions directly, not via the Bills mechanism, per L15607-15622), Budget calculations, or dashboard/Insights reads. I did not find School Fees referenced in `personSpend`, `settlements`, or `getPersonAttributedAmount` — consistent with §4's finding that no personId flows through School Fees at all.

**The single most important piece of hard evidence in this entire trace — the actual transaction a School Fee settlement creates:**
```js
createRealTxn={(amount, accId, catId, linkedFeePeriods)=>{
  const txnId = genId();
  setTxns(prev=>[{
    id: txnId, type:"expense", amount, date: todayStr(),
    merchant: viewingSchoolFeeSchedule?.schoolName || "School Fee",
    desc: `School fee payment — ${viewingSchoolFeeSchedule?.schoolName || ""}`,
    accId, catId, catIds:catId?[catId]:[], subId:null, subIds:[],
    trackingMode:"none", people:{},
    linkedFeePeriods: linkedFeePeriods || [],
    createdDate: todayStr(), createdAt: Date.now(),
  }, ...prev]);
  return txnId;
}}
```
(`App.jsx` L15607-15622)

**`trackingMode:"none", people:{}` — explicit, hardcoded, empty.** Every transaction a School Fee settlement produces is created with zero person attribution, by construction. This is not an inference from absence of evidence — it's a positive, direct statement in the write path itself.

## 6. Navigation

Confirmed from `App.jsx`:
```
Home → (category grid) → "School Fees"/"Education Fees" tap → setShowSchoolFeesList(true)
  → SchoolFeeScheduleListModal → tap a schedule → setViewingSchoolFeeSchedule(s)
    → SchoolFeeScheduleDetailModal → [Add period / Settle / Adjust / Credit Note / view a period]
      → SettlePaymentModal (creates the real transaction, §5)
      → PeriodDetailModal → onViewTransaction(txnId) → navigates to the transaction's detail (setTxnDetailId)
```
Entry point confirmed at L13528 as a direct route from the category grid — **not** confirmed as routed through the People/Person screen in either direction. **No navigation from Person → School Fees, or School Fees → Person, was found anywhere in `App.jsx`.** This is a direct, searched-for absence, not an oversight — I grepped for any School-Fees-adjacent call inside the `People` component (L8674-onward) and found none, and I grepped for any `setTab("people")`/`setSelectedPerson(...)` call inside the School Fees render block (L15586-15648) and found none.

## 7. Persistence

Confirmed — three independent `localStorage` keys (`arth_fee_schedules`, `arth_fee_periods`, `arth_school_credit_notes`), each with its own `useEffect` writer (L820-822), each included in the full snapshot/backup object and the cloud-sync dependency list (§5). No School-Fees-specific migration logic was found (contrast with the real, commented migration for the separate, legacy `feePayments`→Membership mechanism at L932-950 — see the note in §8 about not confusing the two).

## 8. Historical-data risk

| Scenario | Finding |
|---|---|
| Student's name changes | Not traceable — no student-name field was found on any record `App.jsx` touches; if this field exists, it's inside the external schema. |
| Student deleted | Not traceable — no delete call site found in `App.jsx` (§3). |
| A Person is edited | **No effect on School Fees, because no School Fees record references a `personId` anywhere in `App.jsx`'s code paths (§4).** Editing a Person cannot desynchronize something that was never linked. |
| A Person is archived (per PPL-002 WP-2, once built) | Same reasoning — no linkage found, so no effect expected, though this is inference from absence, not a positive trace of "archiving explicitly ignores School Fees." |
| A School Fees record is edited | Not traceable — edit implementation is external (§2). |
| Historical fee records reference the old identity | N/A on current evidence — there is no "old identity" being referenced, because there's no Person identity being referenced at all in the code paths I could see. |

**One naming collision worth flagging so it isn't mistaken for a School Fees finding:** there is a *separate*, legacy `feePayments` collection (`App.jsx` L755, L932-950) being migrated into Membership records — its own code comment explicitly says it originally had "no person" concept either, and is being converted to `personId:"self"` as part of a one-time migration into `MembershipRelationship`. **This is not School Fees** (`feeSchedules`/`feePeriods`) — it's a differently-named, unrelated legacy mechanism that happens to also involve "fees." Don't let the two get conflated in any downstream brief.

## 9. Can the existing School Fees Edit be safely reused?

**Yes, for what it covers — but it covers less than "edit a School Fee record" might suggest.** The only edit that exists is `editPeriodAmount`, gated to untouched periods, id-preserving by construction. It's safe to reuse as-is; no PPL-adjacent change is needed to make it safe, because it was already built with the same historical-immutability principle PPL-001 establishes for People/Groups (§2). There is no schedule-level edit to reuse — one would need to be built from scratch if wanted, and that's new scope, not reuse.

## 10. Does School Fees need to be brought into the People & Groups Relationship Ledger? — RESOLVED

**Definitive answer, proven from the live code, not inferred from naming:**

**School Fees maintains a `personId` field in its schema — the same identity concept PPL-000/PPL-001 use — but that field is never populated with a real value anywhere in the current codebase.** It is not "an independent student identity system" (there is no `students[]`, no `studentId`, no student-specific identity concept anywhere). It is also not accurate to say School Fees "doesn't use the People identity layer" — the schema was built to use it (`createSchoolFeeSchedule({ ..., personId, ... })`, `AddSchoolYearModal`'s own prop signature accepts a `personId`). What's actually true is narrower and more specific: **the hook into the People identity layer already exists in the data model; the single UI entry point that constructs a schedule (`App.jsx` L15587) simply passes `null` for it and there is no UI anywhere to set it to anything else.**

This reverses the tentative direction of the original draft of this report, which (working from `App.jsx` alone) leaned toward "no identity link at all." The corrected, evidence-complete statement is: **a dormant, unused Person link — built, never wired.**

Everything else already confirmed still holds: the resulting transaction carries `people:{}` regardless (§5, unchanged — `App.jsx`'s settlement code doesn't read `schedule.personId` at all when constructing the transaction, so even if a schedule *did* have a real `personId` today, it wouldn't currently propagate to the transaction). No navigation exists between Person and School Fees in either direction (§6, unchanged).

## 11. Product/schema decision required — narrower than originally scoped

Because the field already exists, this is **not** a schema-design decision the way it would be if School Fees had no identity concept at all. The actual decision is narrower: **should `App.jsx`'s School Fees creation flow be given a real Person picker (wiring `personId` to an actual selection instead of a hardcoded `null`), and should the resulting transaction and Future Money projection propagate that link once set?** That's UI work plus a small amount of read-path work (transaction construction, `futureMoney.js`'s projection shape doesn't currently carry `personId` either — confirmed, §1/the `futureMoney.js` read above), not a new identity model. This is good news for PPL-002's "no schema migration" posture — the same posture likely extends to this gap, since the schema piece is already there.

**Still a genuine product decision, not something this trace resolves:** *should* School Fees participate in the Relationship Ledger at all (a schedule tied to, say, a child's Person record), or is the dormant `personId` field a vestige of an earlier design intent that's since been superseded by School Fees standing alone (fees are per-school, not per-child, in the current UI's actual model — `schoolName` is the only identity-like field actually surfaced to the user anywhere)? Both are legitimate positions; this report only establishes what's technically already possible, not which product direction is correct.

## 12. Recommendation

Trace is now complete against the two files that mattered most. `domain/schoolFees/service.js` remains unread — if a future decision hinges on exactly how `personId` flows through `createSchoolFeeSchedule` internally (e.g. whether it's validated, whether it's read anywhere inside `service.js` itself for calculation), that file would need a follow-up trace; nothing found so far suggests that's likely to change the §10 conclusion, since every consumer of a `feeSchedule`/`feePeriod` object I could find (this file, `App.jsx`, `futureMoney.js`) treats `personId` as inert. Per your instruction, **PPL-000/PPL-001/PPL-002 remain unmodified.** If you want the "give School Fees a real Person picker" work reflected anywhere, that's a deliberate scope decision for a future SFE-001 or a PPL-002 amendment — not something this report proposes on its own.
