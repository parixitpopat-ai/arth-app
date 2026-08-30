# PPL-000 — People & Groups Trace Report

**Status:** Draft — for review, no code proposed
**Source of truth:** live `App.jsx` as uploaded 30 Aug 2026 (~16,600 lines)
**Method:** direct grep + line-level read of every write/read site for `people`, `personId`, `groups`, `groupId`. No assumptions carried from prior threads or docs.

Two files referenced by App.jsx were **not in the upload** and so could not be traced directly: `constants/appConstants.js` (defines `ME`, `PERSON_MODULES`, `GROUP_MODULES`, `GROUP_TYPES`, etc.) and `helpers/idGenerator.js` (defines `genId()`). Findings below note where a claim rests on inference from call sites rather than a read of the actual implementation.

---

## 1. People schema

**State & storage** (line 694):
```js
const [people, setPeople] = useState(()=>normalizePeople(JSON.parse(localStorage.getItem("arth_people")||"[]")));
```
Persisted key: `arth_people`. `normalizePeople` (line 428-431) guarantees a `__me__` record always exists — if the stored list has no `p.id==="__me__"`, it prepends the imported `ME` constant.

**Fields observed** (from `addPerson`, `EditPersonModal`, and detail-screen reads):
| Field | Notes |
|---|---|
| `id` | Identity key. `"__me__"` for self; `genId()` (imported, implementation not in this upload) for everyone else. Never reassigned by any write site found. |
| `name` | Display only, editable. |
| `emoji`, `color` | Display only, editable. |
| `relation` | Free text, editable. |
| `personType` | `"contact"` default; drives default `modules` via `getPersonModules()` (imported, not traced further). |
| `creditLimit` | Number, editable. |
| `spendBudget` | Number, editable. |
| `spendBudgetOverrides` | Map keyed by `viewMonth`, written at line 8775/12594 (monthly budget override). |
| `favorite` | Bool, toggled independently (line 8767-8771). |
| `defaultSettlement` | e.g. `"UPI"`, set at creation only — no edit site found for it in `EditPersonModal`. |
| `modules` | Array of enabled capability modules, editable. |
| `isMe` | Set only on the `ME` sentinel (imported const, not in this upload) — used everywhere as `p.isMe`. |

**ID generation:** `genId()` from `helpers/idGenerator.js`, imported — actual implementation not visible in this upload. Not `Math.random()`/`Date.now()` inline at the people/groups call sites (those inline patterns appear elsewhere, e.g. settlement IDs at line 6034).

**Creation flow:** `addPerson()` (line 8773-8777), inside the `People` component (line 8674), reachable only from the "+ Add" → "Person" step of the add wizard on the People screen (`subView==="people"`).

**Deletion flow:** exactly **one** call site in the whole app (line 9159):
```js
{!p.isMe && <button onClick={()=>{ setPeople(prev=>prev.filter(x=>x.id!==p.id)); setSelectedPerson(null); }}>🗑️ Remove</button>}
```
This is a hard delete of the identity record. No confirmation dialog, no outstanding-balance check, no check of group membership, no check of historical transaction references. `ME` (`isMe`) is not deletable — the button is conditionally omitted, so this is enforced by the UI, not the data layer.

**Editing:** already exists — `EditPersonModal` (line 15276-15291). It edits `name, emoji, relation, color, personType, creditLimit, spendBudget, favorite, modules` by looking the record up via `x.id===p.id` and spreading changes; `id` is never touched. **This means editing a person's name today already preserves identity correctly** — nothing in the edit path rewrites or reissues `id`.

**Where names/details are used:** display only, everywhere I found — labels in transaction rows, bill rows, settlement prompts, share-request text, search results. Every financial computation I traced keys off `id`, not `name` (see §2).

**Immutability:** `id` is the only field never written to after creation. Every other field is editable (directly via `EditPersonModal`, or indirectly via `toggleFavorite`, `spendBudgetOverrides`).

**Do historical transactions reference `personId`?** Yes, extensively — see §2. They store `personId` values as object keys or field values, never `name`.

**Can person records be edited without changing identity?** Yes — confirmed by reading `EditPersonModal`'s `save()`. This already holds today.

---

## 2. Financial dependencies on People

All of the following key exclusively by `person.id` (never `name`). I read each function's actual body, not just its call sites.

- **Transaction attribution — `t.people` map** (e.g. lines 1298, 1584, 1618, 3351): shape is `{ [personId]: { amount, mode, settled, settledAmt } }`. Legacy alias `t.splitPeople` also exists and is merged with `t.people` at read time (line 1583: `{...(t.splitPeople||{}), ...(t.people||{})}`) — both are id-keyed.
- **`trackingMode`** (set at write time in `normalizeTxns`, line 444-447): derived as `"split"` (has an `owes` person entry), `"tag"` (has `forPerson`/`groupId` but no split), or `"none"`. Purely a classification of *how* the id-keyed attribution is structured — carries no name data.
- **`attributedAway` / `getMyExpenseAmount`** (line 1288-1320): sums amounts from `expense.people` entries with `mode==="owes"` plus `expense.groupAllocations[]` entries with `mode==="owes"`, entirely by iterating `Object.entries(expense.people)` — id-keyed, name never read.
- **`getPersonAttributedAmount`** (line 1703-1728): this function's own comment documents a **previously real bug** — a transaction can carry attribution in up to four different fields (`people`, `forPerson`, `tagItems`, `allocations`) that used to be summed instead of read with one fixed priority, silently doubling amounts. **In this uploaded copy, that fix is already present** — the function returns on the first matching field in priority order and cannot double-count. This appears to be the same defect logged in my memory as `getPersonAttributedTotal` counting all `t.people` regardless of `mode` — worth flagging to you directly: **this specific bug looks already fixed in the code I just read**, which is good news but should be confirmed against your own test suite before being assumed closed, since I can't rule out a second, differently-named copy elsewhere that still has the old behavior.
- **`personSpend`** (line 1733-1744): sums `getPersonAttributedAmount` per known person id, month-scoped.
- **`settlements`** (line 1575-1650): builds `receivables`/`payables` maps keyed by `pid`, reading `t.people`, `t.splitPeople`, `t.forPerson`, `t.tagItems`, `t.fromPersonId` (`settlement_in`), `t.toPersonId` (`settlement_out`), and `bills[].splitPeople`. 100% id-keyed.
- **Bills** — `b.splitPeople` uses the identical `{ [personId]: {amount, mode, settled} }` shape as transactions (line 9122, 9382, 15213). Bill-to-transaction linkage is via `b.paidByTxnId`, and settlement logic explicitly checks `linkedTxn?.people?.[p.id]` to avoid double-counting a bill that's already tracked through its linked expense.
- **Loans**: `l.personId` used directly for outstanding-balance lookups tied to a person's detail screen (line 9791: `loans.filter(l=>l.direction!=="taken"&&l.personId===p.id...)`).
- **Membership**: `MembershipRelationship` records carry `personId` (lines 4091, 14726, 14795-14808) — this is the entity your prior session built, and it is id-based, consistent with everything else.
- **School Fees**: I did not find a `personId`/`studentId` field anywhere in the fee-schedule code path (`feeSchedules`, `feePeriods`, `AddSchoolYearModal`). School Fees does not appear to attribute to a Person record today — it's schedule/biller-account based, not person-identity based. Worth a direct question back to you: is a "student = Person" link expected as part of this pass, or is School Fees intentionally outside the People/Groups identity model?
- **Dashboard/Insights**: card subtitles and search results (line 2192, 2218, 2262-2270, 2684, 2708-2710) all resolve display names via `getPerson(id)`/`getGroup(id)` at render time — never store a name independently.
- **Search** (line 2807-2811): filters `people`/`groups` by `name` for the search *query match itself* (expected — that's what search is), but the result object carries the full `item` (with `id`) and navigation always goes through `id`. One cosmetic bug noticed in passing: the groups search filter has a stray `.includes(g.id)` clause (line 2809) that's always false in practice and looks like leftover dead code — harmless, not a data-integrity issue.

**Conclusion on "Person = identity":** confirmed true everywhere I traced. `person.id` is the actual key used for every financial computation, filter, and search-result resolution I found. Display name is read only at render time via a live lookup (`getPerson(id)`), never persisted as a substitute for id.

---

## 3. Groups schema

**State & storage** (line 695): `const [groups, setGroups] = useState(()=>JSON.parse(localStorage.getItem("arth_groups")||"[]"));`. Persisted key `arth_groups`. No `normalizeGroups` wrapper exists (unlike `people`) — groups load as-is from storage.

**Fields observed** (from `addGroup`, `saveGroupEdits`):
| Field | Notes |
|---|---|
| `id` | `genId()`, identity key, never reassigned after creation. |
| `type` | Human label, e.g. from `GROUP_TYPES` lookup. |
| `typeId` | Stable type id (`"other"` fallback), editable via `saveGroupEdits`. |
| `name` | Editable. |
| `icon`, `color` | Editable (icon derives from `typeId` on edit; color set at creation, no edit site found for color). |
| `members` | Array of `personId`s. Editable via the group-edit member toggler. |
| `includeMe` | Bool, editable. |
| `manualLimit` | Number, editable (group budget). |
| `manualLimitOverrides` | Map keyed by `viewMonth`, same pattern as people's `spendBudgetOverrides`. |
| `defaultIntent` | e.g. `"split"`, derived from type, editable indirectly via `typeId`. |
| `modules` | Capability array, set at creation from `GROUP_TYPE_DEFAULT_MODULES`; no dedicated edit UI found for this field specifically. |

**Creation:** `addGroup()` (line 8779-8786), same `People` component, `subView==="groups"` step.

**Deletion:** exactly **one** call site (line 9672):
```js
<button onClick={()=>setGroups(prev=>prev.filter(x=>x.id!==g.id))&&setSelectedGroup(null)}>🗑</button>
```
**Real bug found here, not hypothetical:** `setGroups(...)` is a state-setter call and returns `undefined`. `undefined && setSelectedGroup(null)` short-circuits, so `setSelectedGroup(null)` **never actually runs**. After deleting a group, `selectedGroup` likely stays pointed at the now-deleted object, and depending on how the detail view guards against a missing group, this could leave the UI showing a stale/broken group-detail screen. This should be fixed as part of any People/Groups pass regardless of scope, since it's a pure bug, not a design question.

Like person deletion, there is no confirmation dialog and no check of `members[]`, outstanding balances, or historical transaction references before deleting a group.

**Membership editing:** `saveGroupEdits()` (line 9413-9431) already exists — edits `name, manualLimit, members, includeMe, typeId, type, icon, defaultIntent` by `id` lookup, `id` never touched.

**Member removal — real and carefully built:** `toggleMember(pid)` (line 9365-9393) is more sophisticated than person/group deletion. Before removing a member with an outstanding balance, it computes `getGroupMemberOwed()` and prompts the user (native `window.prompt`) with three choices: remove + write off (marks the relevant `txns`/`bills` entries `settled:true`, but does **not** delete or rewrite them), cancel, or keep in group. If there's no outstanding balance, removal is silent. Either way, `members[]` is only the group's *current* roster — it is never consulted by historical spend/settlement calculations, which read `t.groupId` and `t.people[pid]`/`b.splitPeople[pid]` directly off each transaction/bill, independent of current membership.

**Are groups referenced by transactions?** Yes — `t.groupId`, plus `t.groupAllocations[]` (array of `{groupId, mode, amount}`), plus legacy `t.tagGroup`/`t.taggedGroupId` variants still read by `getGroupAttributedAmount` for backward compatibility (with an in-code comment flagging this exact divergence as known drift, already partially consolidated).

**Does group history depend on group id?** Yes, entirely — every display of a group name off a transaction/bill goes through `getGroup(t.groupId)?.name`, always with `?.` guards, so a deleted group degrades gracefully to "Group" or blank rather than crashing. The underlying money math (`t.people`, `b.splitPeople`, `t.groupAllocations`) doesn't depend on the group record existing at all — it's stored directly on the transaction.

---

## 4. Critical historical-data test — traced answers, not assumptions

**Person name changes (Rahul → Rahul Sharma):** Safe today. `EditPersonModal.save()` updates `name` by `id` lookup; every financial read (`t.people[pid]`, `settlements[pid]`, `personSpend[pid]`) is keyed by `id`, and every display (`getPerson(id).name`) re-resolves the name live at render time. No transaction stores a name independently that would go stale. **Confirmed A — already works.**

**Group name changes (Goa Trip → Goa Trip 2026):** Safe today, same mechanism — `t.groupId` is the only thing stored on the transaction; `getGroup(t.groupId).name` is resolved live. **Confirmed A — already works.**

**Person removed from group:** Safe today, but only for the "remove" action specifically — `toggleMember` never deletes or rewrites transaction/bill data; at most it marks an entry `settled:true` if the user explicitly chooses to write off an outstanding balance, and that write-off is a real financial event the user opted into, not an accidental history rewrite. **Confirmed A — already works**, with the one caveat that the write-off choice is presented via a raw `window.prompt()`, which is a UX/polish gap, not a data-integrity one.

**Not asked for, but found during the trace and worth flagging as a real risk:** deleting a **person entirely** (§1) does *not* have the same care as removing them from a group. It does not check outstanding balances, does not check group memberships (so a deleted person's id can be left dangling in some group's `members[]` array — harmless for money math since `members[]` isn't consulted for history, but it means the group's roster UI could show `getPerson(orphanId)` fall back to `{name:"?"}` indefinitely), and does not warn the user at all. The financial numbers stay correct (nothing is deleted from `txns`/`bills`), but the *identity resolution* for that history is permanently degraded to "?" once the person record is gone. This is the one place where "names are editable, but IDs and financial history are sacred" is at risk — not because IDs get rewritten, but because a hard person-delete quietly detaches the id from any resolvable name forever.

---

## 5. Current UI — real navigation flow

```
Home
 → Drawer (hamburger icon)
 → "People & Groups" (goToTab("people"))
 → People component, tab="people"
     → subView="people" (default) — list screen with 🧑 Person / 🏘️ Groups toggle pills
     → subView="groups" — group list screen
     → tap a person → selectedPerson set → in-place detail view (same People component, not a new route)
     → tap a group → selectedGroup set → in-place detail view (same component)
```

Confirmed via every `setTab("people")`/`goToTab("people")` call site (line 7880, 13029, 14123, 15516-15517) and the render gate `{!showSettings && tab==="people" && <People/>}` (line 15483).

- **Not under Settings.** It's a first-class Drawer item, same level as Payments/Vehicles/Goals/Trips.
- Global search results for a person or group also land here: `setSelectedPerson`/`setSelectedGroup` + `setTab("people")` (line 15516-15517).
- Two secondary entry points exist as "Manage People →" / "Manage Groups →" links from elsewhere in the app (lines 13029, 13081 — inside what looks like a Budget-adjacent screen), both just calling the same `setTab("people")`.
- **Add flow:** "+ Add" button on the list screen opens a step wizard inline (`addPersonStep`/`addGroupStep`, both multi-step: Identity → Capabilities → Details for a person; similar staged flow for a group) — not a separate modal/route.
- **Detail screens:** person and group detail are conditional renders inside the same `People` component (`if(selectedPerson){...}`, `if(selectedGroup){...}`), not separate screens/routes.
- **Edit capability:** exists for both (`EditPersonModal`, in-place `saveGroupEdits`), reachable from the detail screen.

---

## 6. Can editing stay thin?

**Yes — and it already is.** `editPerson()` and `editGroup()` (under different names — `EditPersonModal.save()` and `saveGroupEdits()`) already exist, already operate purely by `id` lookup, and already never touch identity. There is no schema change needed to support safe editing; that capability is not a gap in this app, it's already shipped and structurally correct.

What's missing is narrower than "editing": a couple of specific fields have no edit path today (person's `defaultSettlement`; group's `color`, `modules`) — small, additive, no schema risk. These are B items, not new capability.

---

## 7. Deletion semantics — current behavior, precisely

| Action | What happens today | Preserves history? | Warns user? |
|---|---|---|---|
| Delete a person | Hard-removes the record from `people[]`. `txns`/`bills`/`loans`/`MembershipRelationship` records keep the orphaned `personId` untouched. | Money math: yes. Identity/name resolution: **no, permanently degrades to "?"**. | No confirm, no balance check. |
| Delete a group | Hard-removes the record from `groups[]`. Transactions/bills keep `groupId` untouched. | Money math: yes. Group name resolution: degrades gracefully (optional-chained everywhere). | No confirm, no balance check. Also has the `setSelectedGroup(null)` dead-code bug noted in §3. |
| Remove a person from a group's current membership | Only mutates `group.members[]`. Optionally offers to write off (`settled:true`) that person's outstanding balance within the group — a real, user-consented financial event, not a silent rewrite. | Fully — this is the best-behaved of the three. | Yes, via `window.prompt` when there's an outstanding balance; silent otherwise. |

The three cases are genuinely different operations and the code (mostly) treats them as such — "remove from group" is a relationship change, "delete person/group" is an identity deletion. The one place this distinction breaks down is that identity deletion has none of the safeguards relationship-removal already has.

---

## 8. Classification of findings

**A — already works, reuse directly**
- Editing a person's name/emoji/relation/color/type/limits/budget/favorite/modules, id-stable.
- Editing a group's name/budget/members/includeMe/typeId, id-stable.
- Name changes (person or group) do not break any historical financial reference — confirmed by trace, not assumption.
- Removing a person from a group's current membership without erasing history, including an explicit, user-consented write-off path for outstanding balances.
- All financial attribution (transactions, bills, settlements, loans, membership) is already id-keyed, never name-keyed.

**B — small, safe additions**
- Add a confirmation step (and ideally an outstanding-balance check, mirroring `toggleMember`'s existing pattern) before hard-deleting a person or a group.
- Fix the `setSelectedGroup(null)` dead-code bug in group deletion (§3) — pure bug fix, no design decision needed.
- Add edit paths for the few untouched fields (person `defaultSettlement`; group `color`, `modules`).
- Replace the `window.prompt()` member-removal write-off dialog with a proper in-app confirmation UI — UX polish, no data-model change.

**C — structural/product decisions, not to be coded yet**
- What should happen, product-wise, when a person with historical financial references is deleted? Options include: soft-delete (keep the record, hide from active lists, so `getPerson()` keeps resolving a real name), block deletion outright while balances/history exist, or accept today's "id survives, name resolution degrades to '?'" behavior as intentional. This is the single biggest open question from this trace and should be decided before any delete-flow UI work, per your own instruction not to implement destructive behavior until it's clear.
- Whether School Fees should gain a `personId` link (student = Person) as part of this pass, or stays intentionally outside the identity model — I found no existing linkage either way, so this is a genuine open question, not a defect.
- Whether cleanup of a deleted person's id from any group's stale `members[]` array is worth doing, and if so, whether that's a migration or a lazy-cleanup-on-read.

---

## 9. Recommended minimum implementation for the 3-week release

Given the trace, the honest scope statement is: **the identity layer is already sound.** Person and Group editing is safe, id-stable, and shipped. The real gap is entirely on the deletion side, and it's a product decision (C) before it's an engineering task.

Suggested sequencing:
1. Decide the C item (deletion semantics for a person/group with financial history) — this blocks nothing else and can happen in parallel with anything below.
2. Ship the B items now — they're safe, small, and improve on real gaps without touching the data model: deletion confirmation, the `setSelectedGroup` bug fix, the two-three missing edit fields.
3. Any UI redesign work for People/Groups (the actual reason for this trace) can proceed on top of the current schema with no migration required — the trace found no structural reason to change `people[]`/`groups[]`'s shape.

No code has been written. This report is the input to the separate designer UI brief and engineering implementation brief you referenced as the next step.
