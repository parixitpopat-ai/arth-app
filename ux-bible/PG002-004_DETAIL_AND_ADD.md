# PG002 — Person Detail

**Status: Design Frozen, Not Implemented.**

## Wireframe
```
+-----------------------------+
| Wife                          |
| Spouse                         |
| [Overview][Planning][Money Flow][Transactions][Modules]
+-----------------------------+
| Allocation      Rs 10,000      |
| Spent           Rs 4,250        |
| Remaining       Rs 5,750        |
| [=======...]                    |
+-----------------------------+
| Owes Me   Rs 0    I Owe  Rs 0   |
+-----------------------------+
| Credit Limit    Rs 20,000       |
| Used            Rs 4,500        |
| [====.......]                    |
+-----------------------------+
| Recent Activity                 |
| ...                               |
+-----------------------------+
```

## Component Map
| Component | Status |
|---|---|
| Tab bar (Overview/Planning/Money Flow/Transactions/Modules) | **Needs implementation** — current Person screen is a single flat view, no tabs |
| Allocation/Spent/Remaining block | Reuses PG001's Person Card data, same source fields |
| Settlement (Owes Me/I Owe) | ✅ Already exists on the current screen |
| Credit Limit progress bar | ✅ Already exists (confirmed real, `Person.creditLimit` vs `owesMe`) |
| Recent Activity list | ✅ Already exists |

## Data Mapping
| UI Field | Source | Status |
|---|---|---|
| Allocation/Spent/Remaining | Same as PG001 | ✅ Real (Person only — Group Spent still missing, per PG001) |
| Owes Me / I Owe | `settlements[personId]` | ✅ Real, confirmed `useMemo`-derived (ADR-025) |
| Credit Limit / Used | `Person.creditLimit` vs `owesMe` | ✅ Real |
| **Carry Forward** (per-person) | — | 🔴 **New concept, does not exist.** A household-level `budgetCarryForward` toggle already exists (confirmed, line ~12621) but is a single global setting, not per-person. A per-person Carry Forward would be a genuinely separate, new field — flagging explicitly so it isn't confused with the existing one. |
| Planning Type (Monthly/Annual/Not Planned) | — | 🔴 New — no such field exists on Person today |
| Priority (Essential/etc.) | — | 🔴 New — no such field exists |

## Interaction Map
| Element | Destination |
|---|---|
| Tab switch | Same screen, different section (no navigation) |
| Recent Activity row | Transaction Detail (existing) |
| Edit | Existing Edit Person form |

## Developer Notes
Tabs are the main new structural element. Three fields (per-person
Carry Forward, Planning Type, Priority) are genuinely new schema, not
just new UI over existing data — these need to be added to the Person
object before PG002's Planning tab can be real, not just designed.

---

# PG003 — Group Detail

**Status: Design Frozen, Not Implemented.**

## Wireframe
```
+-----------------------------+
| Family                         |
| [Overview][Planning][Members][Transactions][Modules]
+-----------------------------+
| Allocation   Rs 20,000          |
| Spent        Rs 12,500 *NEW*    |
| Remaining    Rs 7,500 *NEW*      |
+-----------------------------+
| Members: Me, Wife, Vyom         |
+-----------------------------+
| Top Categories                   |
| Food / Shopping / Medical         |
+-----------------------------+
```

## Component Map
Mirrors PG002 — same tab bar pattern, same "Needs implementation" status for tabs.

## Data Mapping
| UI Field | Source | Status |
|---|---|---|
| Allocation | `Group.manualLimit` | ✅ Real |
| Spent | — | 🔴 **Same gap as PG001 — no group-level spend aggregation exists.** This is the single most-repeated gap across the whole People & Groups redesign; every screen that shows Group financials depends on this one missing function. |
| Remaining | Allocation − Spent | Derived, blocked on Spent |
| Members | `Group.members[]` | ✅ Real |
| Top Categories | — | 🔴 New — no per-group category breakdown exists; would need the same underlying data as Spent, just grouped differently |

## Developer Notes
**This package makes the priority obvious:** `getGroupAttributedAmount`
(or equivalent) isn't just needed for PG001's Group cards — it blocks
PG003's Overview, Planning, and Top Categories sections too. Building
this one function first unlocks three separate screen sections at once.

---

# PG004 — Add/Edit Person & Group

**Status: Design Frozen, Not Implemented.**

## Wireframe (Person, additions to the existing 3-step wizard)
```
Step 3 (Details) — existing steps unchanged, new fields added:
+-----------------------------+
| Planning Type                  |
| ( ) Monthly ( ) Annual ( ) Not Planned
+-----------------------------+
| Allocation      Rs 10,000       |
+-----------------------------+
| Carry Forward   [ON/OFF]        |
+-----------------------------+
| Priority        Essential ▾      |
+-----------------------------+
```

## Component Map
| Component | Status |
|---|---|
| Existing 3-step wizard (Identity → Capabilities → Details) | ✅ Real, unchanged structure |
| Planning Type radio group | 🔴 New UI, new field |
| Allocation field | 🟡 Partial — reuses the existing `spendBudget` input already in the wizard (confirmed present as `newSpendBudget` state), just relabeled "Allocation" |
| Carry Forward toggle | 🔴 New — same distinction as PG002, a per-person field, not the existing household one |
| Priority dropdown | 🔴 New field entirely |

## Data Mapping
| UI Field | Source | Status |
|---|---|---|
| Allocation | `newSpendBudget` (existing wizard state) | ✅ Real, just renamed in the UI |
| Planning Type | — | 🔴 New field needed on Person |
| Carry Forward (per-person) | — | 🔴 New field needed on Person |
| Priority | — | 🔴 New field needed on Person |

## Developer Notes
**This is the smallest of the four packages in terms of new schema** —
Allocation is a pure rename of an existing field, not new data. Only
three genuinely new fields (Planning Type, Carry Forward, Priority)
need adding to Person (and equivalently to Group) before this screen
can be real.

---

## Summary Across PG002–PG004

**Confirmed reusable, no new schema:**
- Allocation (Person & Group) — existing fields, just reframed
- Person Spent, Settlements, Credit Limit — all real today

**New schema required, same three fields repeated across every screen:**
- Planning Type (Monthly/Annual/Not Planned)
- Carry Forward (per-person/group — distinct from the existing household-level toggle)
- Priority

**The one function that unlocks the most screens at once:**
`getGroupAttributedAmount` — blocks Group Spent everywhere it's needed
(PG001's Group cards, PG003's Overview/Planning/Top Categories). This
is the highest-leverage piece of real implementation work across all
four packages — worth building before anything else once coding starts.
