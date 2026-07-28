# PG001 — Financial Relationships (formerly "People & Groups Home")

**Status: Design Frozen, Not Implemented.** Renamed per this review — the
navigation label stays "People & Groups" for familiarity; the domain
underneath is Financial Relationships.

---

## 1. Wireframe

```
+-----------------------------+
| <- Financial Relationships   |
+-----------------------------+
| Planning Summary              |
| Monthly Planning Budget       |
| Rs 65,000                     |
| Allocated   Rs 54,000          |
| Remaining   Rs 11,000           |
| [========......]  83%           |
+-----------------------------+
| PEOPLE                        |
| Wife         Alloc Rs10,000    |
|              Spent Rs 4,250    |
|              Remain Rs 5,750  >|
+-----------------------------+
| Vyom         Alloc Rs 8,000   |
|              Spent Rs 2,000    |
|              Remain Rs 6,000  >|
+-----------------------------+
| GROUPS                        |
| Family       Alloc Rs20,000   |
|              Remain Rs 7,500  >|
+-----------------------------+
| [+ Add Person]  [+ Add Group] |
+-----------------------------+
```

---

## 2. Component Map — reused vs. needs building

| Component | Status |
|---|---|
| Planning Summary Card | **Needs implementation** — no equivalent hero card exists on the current People screen |
| Person Card (with Allocation/Spent/Remaining) | **Needs implementation** — current rows don't show this breakdown |
| Group Card (same) | **Needs implementation** |
| Progress Bar | ✅ Reused — the same style already used elsewhere (Goals, Budget) |
| FAB (+ Add) | ✅ Reused — existing Add Person / Add Group entry points already exist, just need surfacing at this level |
| Search | **Not confirmed to exist on this screen today** — flagged, not assumed |
| Filter | **Not confirmed to exist on this screen today** — flagged, not assumed |

**No new components invented for this spec** — every "Needs implementation" item is a new arrangement of existing data, not a new interaction pattern.

---

## 3. Data Mapping — verified against real code, not guessed

| UI Field | Source | Status |
|---|---|---|
| Allocation (Person) | `Person.spendBudget` | ✅ Real field, confirmed |
| Allocation (Group) | `Group.manualLimit` | ✅ Real field, confirmed |
| Spent (Person) | `getPersonAttributedAmount(txn, personId)`, summed over the month's transactions | ✅ Real function, confirmed at line 1653 |
| Spent (Group) | — | 🟡 **Corrected — was wrongly marked missing.** Confirmed via deeper investigation: Group Spend already exists, duplicated across at least 4 separate places in the codebase, each checking a slightly different combination of fields (`groupId`/`tagGroup`/`taggedGroupId`/`groupAllocations`) — exactly the drift risk the equivalent Person-level function's own code comment already warned about. A canonical `getGroupAttributedAmount`/`groupSpend` now exists (implemented this session); migrating the 4 existing inline calculations to use it is real, separate follow-up work, not done in the same pass. |
| Remaining | `Allocation − Spent` | Derived, not stored — trivial once both sides are real |
| Person Name / Emoji | `Person.name` / `Person.emoji` | ✅ Real |
| Group Members | `Group.members[]` (Person IDs) | ✅ Real |
| Monthly Planning Budget | `annualBudget`/`monthOverrides`, same pool as Safe to Spend | ✅ Confirmed same pool, per this session's discussion — not a second budget |
| Owes Me / I Owe (shown on Person Detail, not PG001 itself) | `settlements[personId]` (`owesMe`/`iOwe`) | ✅ Real |
| Credit Limit progress (Person Detail) | `Person.creditLimit` vs `owesMe` | ✅ Real, but confirmed unrelated to `Account.limit` (different field, same-sounding name — a real prior mix-up, noted so it isn't repeated) |

**The one real gap this whole exercise surfaces:** ~~Group Spent has no
source today~~ **Corrected:** Group Spend exists, but duplicated across
4 places with inconsistent field-checking — a canonical function now
exists (`getGroupAttributedAmount`); the 4 existing call sites still
need migrating to it, which is the actual remaining gap, not absence
of the calculation itself.

---

## 4. Interaction Map

| Element | Destination |
|---|---|
| Tap Person row | Person Detail (existing screen) |
| Tap Group row | Group Detail (existing screen) |
| Tap Planning Summary | Budget (existing screen — same pool, confirmed) |
| Tap "+ Add Person" | Add Person wizard (existing, 3-step: Identity → Capabilities → Details) |
| Tap "+ Add Group" | Add Group wizard (existing) |

No new destinations — PG001 is a new *front door*, not new downstream screens.

---

## 5. Developer Notes — where this inserts, and the real complexity found

- **Insertion point:** replaces whatever currently renders as the default view of the existing `People` component (`subView` state machine) — exact render location **not yet located**, confirmed by direct tracing this session. The component is genuinely large (~1,200+ lines by the `subView`/wizard state alone) with `sortedPeople`/`listedPeople` computed but not yet found rendered as rows — this needs careful tracing before insertion, not a blind edit.
- **Real risk flagged, not hidden:** attempting to wire this in without first finding the actual render location risks the same class of mistake as earlier sessions (inventing a field/state that doesn't exist). This spec deliberately stops short of code for exactly that reason.
- **New calculation needed before Group cards are accurate:** a `getGroupAttributedAmount`-style function, mirroring the existing person-level one, summed across all members' transactions tagged to that group.

---

## Status

| Layer | Status |
|---|---|
| Wireframe | 🔒 Frozen |
| Component Map | 🔒 Frozen |
| Data Mapping | 🔒 Frozen — including the one honest gap (Group Spent) |
| Interaction Map | 🔒 Frozen |
| Code | 🔴 Not started — next step is tracing the render tree, then implementing |
