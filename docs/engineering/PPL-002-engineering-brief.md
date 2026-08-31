# PPL-002 — People & Groups Engineering Brief

**Status:** ✅ Frozen (30 Aug 2026) — 4 corrections applied per first review (WP-2 scoped to archive-only, WP-6 elevated to a hard trace gate, WP-7 made a completion-gate on WP-2, WP-8 reframed as tests-with-each-work-package), plus one implementation clarification on WP-7/WP-2 sequencing (gate is on shippability, not on strict start-after-finish ordering — WP-7 can begin in parallel with WP-1). Implementation-ready. Next: WP-1, per the sequencing diagram below.
**Depends on:** PPL-000 (Frozen — trace of record), PPL-001 (Frozen — designer brief of record)
**Objective:** Make the Relationship Ledger experience real using the existing identity and financial model, adding only the missing computations and lifecycle/UI behavior required by PPL-001. **This is not a refactor project.** PPL-000 already established the identity layer is sound and no schema migration is required — every work package below should be read against that constraint. If a work package appears to require a schema migration or a rewrite of existing financial computation, that is a signal to stop and raise a Change Request against PPL-000/PPL-001, not to proceed.

**Sequencing discipline:** stop-for-review between work packages, same as HOME-001. No work package below is pre-authorized to start until the one before it (where there's a real dependency) is reviewed. Dependency order is noted per WP.

---

## WP-1 — Person / Group edit hardening

**Existing code:** `EditPersonModal` (`App.jsx` ~L15111–15291, save path at L15276-15291) and `saveGroupEdits()` (~L9413-9431) already perform id-preserving, lookup-by-id updates for the fields PPL-001 §9 lists as "existing edit capability." PPL-000's trace found no bug in these paths — both are already correct.

**Required change:** none to the underlying update mechanism. "Hardening" here means UI-layer work only: presenting these as a proper modern edit experience per PPL-001 §9 (not a bolt-on form), not touching the update logic that already works. If any exploratory pass through this code during implementation finds a real defect (not hypothetical), it should be logged as its own bug fix, sequenced independently, not folded silently into this WP.

**Invariants:** `id` never reassigned by any change in this WP. No historical transaction/bill/settlement/loan/membership record is touched, read for rewrite, or recalculated as a side effect of an edit.

**Tests:** edit person/group name, emoji/icon, color, and confirm (a) the record's `id` is byte-identical before/after, (b) a transaction created before the edit still resolves to the new display values when re-rendered, (c) no `txns`/`bills` array entries changed. Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** Edit UI matches PPL-001 §9/§4/§5 presentation; zero changes to `people`/`groups` update logic beyond what's needed to wire the new UI to the existing save functions; regression suite (WP-8) passes.

---

## WP-2 — Archive semantics

**Existing code:** the only two deletion call sites in the app — Person: `setPeople(prev=>prev.filter(x=>x.id!==p.id))` (~L9159); Group: `setGroups(prev=>prev.filter(x=>x.id!==g.id))&&setSelectedGroup(null)` (~L9672, and note the `&&` on this line is dead code today since a state setter returns `undefined` — `setSelectedGroup(null)` currently never runs; this WP is the natural place to fix that, since the whole line is being replaced anyway).

**Required change:** replace both hard-filter deletions with an archive operation. This requires a new field on the Person/Group record — e.g. `archived: boolean` (default `false`/absent for all existing records, so no migration of existing data is required; absence of the field reads as "active"). `archivePerson(personId)` / `archiveGroup(groupId)` set the flag via the same id-lookup-and-update pattern WP-1 already confirmed is safe, not a filter/removal.

**Archive is the required operation in this WP. Restoration mechanics are intentionally deferred until the restoration UX is defined.** PPL-001 leaves the restoration interaction explicitly open — building it now would be Engineering silently making a product decision that belongs to a future designer-brief pass, not this WP. WP-2 must preserve the identity record in a way that makes future restoration possible (i.e. archiving is a reversible flag flip in principle, not a destructive transform), but must not invent or ship a restoration interaction — no un-archive UI, no un-archive function — in this WP.

**Invariants:** `id` unchanged. No entry removed from the `people[]`/`groups[]` arrays by this operation, ever — archived is a status, not an absence. Financial history untouched. A group's `members[]` may continue to contain an archived person's id — this WP does not clean that up (that's a display-filtering concern, WP-6).

**Tests:** archive a person/group with existing financial history; confirm `getPerson`/`getGroup` still resolve full details (not the "?" placeholder) after archiving; confirm the record still exists in the underlying array; confirm the `setSelectedGroup` fix — deleting/archiving a group from its detail view correctly returns to the list.

**Acceptance criteria:** both delete call sites replaced with `archivePerson`/`archiveGroup`; no data loss on archive; existing `getPerson`/`getGroup` fallback-to-placeholder behavior (§1/§3 of PPL-000) is preserved only for genuinely missing ids, not exercised by the normal archive path. Un-archive is explicitly out of scope for this WP — do not implement, do not add a reverse-flag function, do not add restore UI. WP-2 tests are written alongside this WP's implementation, not after (see WP-8).

---

## WP-3 — Group-scoped `iOwe` computation

**Existing code:** `getGroupMemberOwed(groupId, pid)` already exists (used within the group member-removal flow, ~L9365-9393 area) and already correctly computes the group-scoped receivable direction. The reverse does not exist — today's only "I owe them" figure is `settlements[pid].iOwe` (~L1575-1650), which is global/cross-group by construction (it aggregates across every `groupId` a person appears in).

**Required change:** add a new read-only computation, `getGroupMemberIOwe(groupId, pid)` (naming to match the existing sibling function), following the same pattern `getGroupMemberOwed` already establishes — scoped to `t.groupId===groupId && t.people[pid]` (and the equivalent `b.splitPeople` path for bills), filtering for the "I owe them" direction the way `settlements` already does at the unscoped level. This is a pure additive read function. It does not touch `settlements`, does not touch `getGroupMemberOwed`, does not change how any existing screen computes its numbers.

**Invariants:** no existing computation's output changes as a result of adding this function. Person-level overall balance (PPL-001 §4) continues to come from the existing unscoped `settlements[pid]`, untouched by this WP.

**Tests:** for a person with obligations in two different groups (the Family/Goa Trip case from PPL-001 §5), confirm `getGroupMemberIOwe(familyGroupId, pid)` and `getGroupMemberIOwe(goaGroupId, pid)` return different, correctly-scoped numbers, and that their sum (plus any non-group-attributed amount) reconciles with the existing unscoped `settlements[pid].iOwe`. This reconciliation check is the single most important test in this WP — it's what proves the new function isn't quietly inventing a parallel, divergent number. Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** new function ships with the reconciliation test above passing; Group detail screen (PPL-001 §5) can now show both directions, scoped, per member.

---

## WP-4 — Group member-management UX replacement

**Existing code:** `toggleMember(pid)` (~L9365-9393) already correctly checks for an outstanding balance and offers a write-off choice before removing a member — but does so via a raw `window.prompt()`, which PPL-000 flagged as unusable on mobile/Capacitor and PPL-001 §13 confirmed as a real UI gap, not a data-model problem.

**Required change:** replace the `window.prompt()` interaction with proper in-app UI (modal/sheet, matching the app's existing modal patterns). The underlying decision logic — check balance, offer write-off vs. cancel vs. keep-in-group, mark `settled:true` on write-off without deleting/rewriting the underlying record — does not change.

**Invariants:** identical to today's `toggleMember` behavior at the data layer — no change to what gets written when a user chooses write-off; only the interaction surface changes.

**Tests:** member removal with an outstanding balance (write-off path, cancel path, keep-in-group path) all produce the same underlying data state as today's `window.prompt()` flow, verified against the existing behavior as a baseline; member removal with no outstanding balance remains silent (no dialog). Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** no `window.prompt()`/`window.confirm()` remaining in the People/Groups member-management path; behavior parity confirmed against baseline.

---

## WP-5 — Missing edit fields

**Existing code:** confirmed by PPL-000's trace as having no edit path today: Person `defaultSettlement` (set at creation only); Group `color` (set at creation only); Group `modules` (set at creation from `GROUP_TYPE_DEFAULT_MODULES`, no edit site).

**Required change:** add these three fields to the existing edit modals (`EditPersonModal`, group edit surface) using the same id-lookup-and-update mechanism WP-1 confirmed is already correct for every other field — this is additive surface area on an already-correct mechanism, not new mechanism.

**Invariants:** same as WP-1 — `id` untouched, no financial history touched.

**Tests:** each of the three fields can be changed post-creation and the change persists; no other field is affected by editing these three. Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** matches PPL-001 §9's "design requirement / additive enhancement" list exactly — no more, no less.

---

## WP-6 — Archived identity resolution / search

**Existing code:** `getPerson(id)`/`getGroup(id)` (~L1229-1230) already resolve by id with graceful fallbacks; global search (~L2807-2811) already includes people/groups by name match, resolving to the full object.

**Required change:** two behaviors, both filtering concerns, neither a data-model change: (1) active-selection contexts (new-transaction person picker, new-group-member picker, and any other "choose someone for a new thing" surface) must exclude archived people/groups by default — this requires auditing every such picker in the app and adding an `archived` filter, which may touch several call sites even though each change is small and mechanical; (2) search and historical-display contexts must continue to include and correctly resolve archived people/groups, with a visible "archived" indicator per PPL-001 §11-§12, rather than being excluded or shown as if still active.

**Invariants:** an archived person's historical transactions must render with their real name, not a placeholder, identically to before archiving (this WP does not touch `getPerson`/`getGroup` themselves — it only adds filtering around where they're called for active-selection purposes).

**Tests:** archived person is absent from every new-transaction/new-split/new-member picker; archived person is present and correctly labeled in search results and in a past transaction's display; a person who was never archived is unaffected by any change in this WP. Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** **Hard gate, not a checklist item — no implementation is accepted until every selectable People/Groups surface in the app has been enumerated and classified as one of: Active Selection, Historical Display, Search, or Other.** This is deliberately stricter than "audit every picker," because a missed picker isn't a minor UI gap — it's a hole an archived person could be selected into a *new* financial relationship through, silently reintroducing exactly the identity-degradation problem PPL-000/PPL-001 exist to close. PPL-000's trace confirmed current selection/search behavior at the sites it found, but did not — and could not — establish exhaustive coverage of every surface that lists people or groups; this WP's job is to complete that enumeration, not assume the trace already did it.

---

## WP-7 — Persistence + compatibility

**Existing code:** `people`/`groups` persist to `localStorage` under `arth_people`/`arth_groups`; `normalizePeople` (~L428-431) already runs a light normalization pass on load (ensuring the `__me__` record exists) — `groups` has no equivalent normalizer.

**Required change:** confirm the new `archived` field (and the three WP-5 fields) round-trip correctly through existing save/load, Supabase cloud sync, and any backup/export/import path. Given ADR-036 (local-first, durable data) and the live household data at `arth-app.vercel.app`, this WP should include a real read of `cloudSync.js` (referenced in `repository-index.md` §3) to confirm sync doesn't drop or choke on the new field, and should NOT assume compatibility without checking — this is exactly the kind of claim PPL-000's method required verifying against the file rather than asserting from memory.

**Sequencing (binding, not just a suggestion):** this WP is a completion gate on WP-2, not merely "somewhere in the overall sequence." **Clarification for implementation: this is a completion gate, not a strict start-after-finish ordering.** WP-7's investigation (reading `cloudSync.js`, confirming round-trip behavior) can start in parallel with WP-1 — it does not need to wait for WP-1 to be fully finished. The actual constraint is narrower and stricter: WP-7 must establish persistence/sync compatibility *before WP-2's archive behavior is declared shippable*. WP-2 itself should not begin building archive lifecycle logic on an unverified persistence assumption — if WP-7 is still investigating, WP-2 waits; if WP-7 has already cleared, WP-2 can proceed even while other WPs are in flight. The risk being closed here is concrete: shipping local archive behavior and only later discovering cloud sync silently strips the `archived` field, which would quietly un-archive every archived record on the next sync.

**Invariants:** existing records with no `archived` field must load as active (absence defaults to active, not to an error or to archived).

**Tests:** load a pre-existing `arth_people`/`arth_groups` localStorage payload (from before this change) and confirm every record loads as active with no errors; round-trip a newly-archived record through a save/load cycle; if feasible, verify against real household data per the existing "live data validation" pattern used for the Commitment Read Model. Written alongside this WP's implementation, not after (see WP-8).

**Acceptance criteria:** zero load errors on pre-existing data; `archived` field confirmed to survive cloud sync round-trip (or, if cloud sync doesn't cover this data today, that absence is confirmed and logged rather than assumed).

---

## WP-8 — Regression / historical-data tests

**Existing code:** none — this WP is new test coverage, not a code change, formalizing PPL-000 §4's historical-data test scenarios as a permanent regression suite rather than a one-time trace finding.

**Required change:** codify as automated tests: person name change preserves all historical resolution; group name change preserves all historical resolution; person removed from group preserves history (including the write-off-as-explicit-event distinction from §4); person/group archived preserves history and correctly excludes from active selection (WP-6); the group-scoped balance reconciliation from WP-3. **Tests are written with the work package, not after the work package** — WP-1 through WP-7 each already specify their own tests above, written alongside that WP's implementation. WP-8 is where those per-WP tests are consolidated into the permanent regression suite, plus the PPL-000 §4 scenarios that don't belong to any single WP.

**Invariants:** this WP is itself the invariant-verification layer for every other WP — it should be written to fail loudly if any other WP's implementation regresses a PPL-000 finding.

**Tests:** (this WP is the consolidation of tests) — target coverage: every scenario in PPL-000 §4, plus WP-2's archive-preserves-history case, plus WP-3's reconciliation case, plus every per-WP test listed above.

**Acceptance criteria:** the pattern is WP-N → implementation + WP-N tests, for every WP in this brief; WP-8 is not a separate end-of-project testing phase but the point at which all of those per-WP suites are confirmed to run together as one consolidated regression suite, passing, per the standard `npm test` pass (Node `--test` runner, tests co-located with domain modules).

---

## WP-9 — APK + Web verification

**Existing code:** Capacitor wraps the same web app (per Arth's stack) — no separate mobile codepath exists for People/Groups today.

**Required change:** none to application code beyond what WP-1 through WP-6 already produce. This WP is a verification pass, not implementation — confirm the new edit UI (WP-1, WP-5), archive UI (WP-2), and member-management replacement (WP-4) all render and function correctly on both web and the Capacitor-wrapped build, per PPL-001 §13's requirement that these work identically across both.

**Invariants:** none beyond what prior WPs already establish — this WP verifies, doesn't add behavior.

**Tests:** manual verification pass on both targets for every new interactive surface introduced by this brief; specific attention to the WP-4 replacement modal, since `window.prompt()`'s removal is precisely the kind of change most likely to render differently across web/APK.

**Acceptance criteria:** sign-off on both targets before the overall PPL-002 effort is considered closed.

---

## Suggested sequencing

```
PPL-002 Frozen
       │
       ├── WP-1  Edit hardening
       │     └── tests alongside
       │
       ├── WP-7  Persistence / sync investigation + tests
       │     └── MUST clear before archive ships (not a strict finish-WP-1-first gate — can start in parallel with WP-1; see WP-7 for the exact constraint)
       │
       ├── WP-2  Archive
       │     └── tests alongside
       │
       ├── WP-3  Group-scoped iOwe (independent — no dependency on WP-2)
       │     └── tests alongside
       │
       ├── WP-4  Member-management UI (independent)
       │     └── tests alongside
       │
       ├── WP-5  Missing edit fields (rides naturally with WP-1)
       │     └── tests alongside
       │
       ├── WP-6  Archived selection/search (depends on WP-2 existing)
       │     └── exhaustive picker audit — HARD GATE
       │
       ├── WP-8  Consolidated regression (accumulates throughout, not a postponed phase)
       │
       └── WP-9  APK + Web verification (last)
```

**Hard boundary, restated for implementation:** if the coder discovers, during any WP, that a schema migration is actually required, existing financial calculations need changing, attribution semantics need changing, historical records need migration, cloud sync cannot safely preserve the new state, or the archived-state model conflicts with another subsystem — **stop. Don't solve it inside the WP. Raise it** as a Change Request against PPL-000/PPL-001/PPL-002, the same way this repo already handles findings that contradict a frozen decision. No WP in this brief is authorized to resolve a structural surprise by improvising past what's written here.

No work package in this brief requires a schema migration, a rewrite of `settlements`, `getPersonAttributedAmount`, or any other existing financial computation. Every change is additive (new field, new read function, new UI) or a direct like-for-like replacement of a single call site (the two delete sites, the one `window.prompt()`). If implementation surfaces a need for more than that, stop and raise it rather than proceeding.
