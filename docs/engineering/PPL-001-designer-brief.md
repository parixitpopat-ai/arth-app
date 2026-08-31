# PPL-001 — People & Groups Designer Brief

**Status:** ✅ Frozen (30 Aug 2026) — §9 corrected per review to distinguish existing edit capability from additive enhancement, matching PPL-000's trace exactly. Next: PPL-002 Engineering Brief.
**Depends on:** PPL-000 (Frozen) — this brief defines experience on top of the existing, already-sound identity model. It does not propose any schema, data-model, or attribution changes.
**Not in scope here:** pixels, component names, React structure, CSS, database/schema changes, implementation mechanics. Those belong to PPL-002.

---

## 1. Product objective: the Relationship Ledger

People & Groups is not a contacts screen. It is the subsystem that answers, at a glance:

> Who am I financially connected to, in what context, and where do we currently stand?

This is Option C ambition — People & Groups should feel like a core Arth subsystem, on par with Money and Outlook, not a settings-adjacent address book.

---

## 2. Design principles

- **Balance first, evidence second.** Every screen leads with the current financial position, not with a transaction list the user has to mentally total up themselves.
- **Balance → context → evidence**, never transactions → settlements → derived balance.
- **Group-scoped, not collapsed.** A person's position in one group is a distinct fact from their position in another. Never sum across groups unless the user is explicitly looking at the person's overall picture.
- **IDs and financial history are permanent. Names and presentation are not.** Editing a person or group's display details never touches their identity or their history.
- **Archive, not delete.** Removing a person or group from active use is a lifecycle state, not destruction. (Per PPL-000 §10 — already frozen, not re-litigated here.)
- **No duplicated numbers on one screen.** If a balance is shown once at the top, don't restate it a second way further down the same screen.

---

## 3. Core relationship model (for design reference only — not new, not proposed here)

- **Person** = persistent identity
- **Group** = persistent collection/context of people
- **Transaction** = actual money movement
- **Attribution** = who/what the money relates to
- **Settlement** = resolution of an obligation

This is PPL-000's existing frozen model, restated here only so the design work below has a shared vocabulary — no part of it is being changed or re-decided.

---

## 4. Person experience

**First thing answered on opening a person: what do we currently owe each other?**

Not a transaction feed. Not a settlement history. A balance.

```
PERSON DETAIL

[Parth]                         [Edit]

You owe me                      ₹2,000
I owe them                        ₹500
---------------------------------------
Net                             ₹1,500

GROUPS
Family                         ₹2,000
Goa Trip                       ₹1,250

[View relationship history]
```

- **Balance block** — "You owe me" / "I owe them" / "Net", the person's *overall*, cross-group position. This is the one place cross-group aggregation is correct — it's explicitly the whole-relationship view, not a group view.
- **Groups block** — every group this person belongs to, each showing that group's own scoped balance next to it (not the person's overall net). This is what tells the user *where the relationship comes from* — Family and Goa Trip are different contexts with different numbers, shown side by side, not folded together.
- **Transactions and settlements** — available, but as supporting detail behind an explicit action ("View relationship history"), not dumped onto the primary screen.

## 5. Group experience

**A group is a financial context, not a list of people.**

Priority order on the Group screen:

1. **Members** — who's in this group, at a glance.
2. **Group transactions** — the shared spend that happened in this context.
3. **Individual balance within this group** — each member's position, scoped strictly to this group.

```
GROUP DETAIL

[Goa Trip]                      [Edit]

MEMBERS
Parth                          ₹1,250
Nidhi                            ₹800
Rahul Sharma                  – Settled –

[Add / manage members]

GROUP TRANSACTIONS
✈️ Flights                    ₹18,000
🏨 Hotel                       ₹9,600
...

[View all group activity]
```

**Critical requirement, stated explicitly because it's easy to get wrong in implementation:** a member's balance shown here is *this group's* number only. Parth owing ₹1,250 in Goa Trip and ₹2,000 in Family are two separate facts. The Group screen must never collapse them into a single ₹3,250 — that number only ever appears on the Person screen's overall balance block (§4), never here.

## 6. Person ↔ Group relationship model (experience-level)

- From a **Person**, groups are a supporting list — enough to see *where* the relationship comes from, each with its own scoped number.
- From a **Group**, members are the primary list — each with their own scoped number, in this group's context only.
- The same underlying fact (Parth's Goa Trip balance) is shown identically from both directions — this is one number with two entry points, not two separately-maintained numbers.

## 7. Balance-first information hierarchy — summary

| Screen | Leads with | Follows with | Detail behind an action |
|---|---|---|---|
| Person | Overall you-owe / I-owe / net | Groups (scoped) | Transactions, settlements |
| Group | Members (scoped balances) | Group transactions | Full group activity history |

## 8. Group-scoped balances

Both directions belong on the Group member list (§5): what each member owes into this group, and what the user owes each member within this group. Design should treat both as equally present — don't design only the receivable direction and leave the payable direction as an afterthought.

**Known engineering dependency for PPL-002 — recorded now so it isn't rediscovered later:**
`getGroupMemberOwed(groupId, pid)` already exists in the codebase and already computes the group-scoped receivable ("what this person owes me, within this group") correctly. The reverse — a group-scoped `iOwe` ("what I owe this person, within this group") — does **not** currently exist anywhere in the traced code; today's `settlements[pid].iOwe` is a global, cross-group figure only. This is an engineering gap, not a design problem — PPL-002 needs to add the missing read computation (mirroring the pattern `getGroupMemberOwed` already establishes), not invent a new financial model. Design should proceed as if both directions will be available at the group level; PPL-002 is where that becomes true.

## 9. Edit Person / Edit Group

Both entities need a proper edit experience, not a form bolted onto the detail screen as an afterthought.

**Existing edit capability** (confirmed by PPL-000's trace — already works, design on top of this, don't imply it needs building):
- Person: name, emoji, relation, color, personType, creditLimit, spendBudget, favorite, modules.
- Group: name, manualLimit, members, includeMe, typeId/type/icon/defaultIntent.

**Design requirement / additive enhancement** (PPL-000 found no existing edit path for these — the design should include controls for them, but they are new surface area, not a reskin of something that already works):
- Person: `defaultSettlement`.
- Group: `color`, `modules`.

- Never editable, never touched by editing, for either category above: the identity ID, and anything already recorded in financial history. Editing a name must not require, trigger, or imply any rewrite of past transactions, attribution, settlements, loans, or memberships.
- Edit should feel like updating a record, not recreating one — the user should never get a sense that "editing" risks their history.

## 10. Archive Person / Archive Group

Per PPL-000 §10 (already frozen — restated here only as a design constraint):

- Removed from normal active lists.
- Removed from normal new-transaction / new-split / new-member selection.
- Remains resolvable in historical records — past transactions, bills, settlements continue to show the real name, not a placeholder.
- Remains searchable through history (§11).
- Financial history and identity/ID are untouched and permanent.
- Restoration (un-archiving) should be considered as part of this UX — design should propose where and how a user finds and restores an archived person/group, even though the exact mechanics are an open engineering question (PPL-000 §10 flagged this as unspecified).

**Do not design toward today's hard-delete behavior as any part of the target experience** — there is no "permanently remove" action in scope here.

## 11. Search / history behavior

- Global search should continue to surface people and groups by name (already true today) and should not exclude archived ones from search — an archived person should still be findable, just not offered as an active selection target.
- Historical resolution (a past transaction showing "paid by Parth") must work identically whether Parth is active or archived — no visual "ghost" or degraded state for archived-but-historically-referenced identities.

## 12. Empty / error / archived states

- **Empty state — no people yet / no groups yet:** should orient the user toward what this subsystem is for (a relationship ledger, not a form to fill in), not just an empty list with an add button.
- **Archived state:** an archived person/group should be visually distinct wherever it's shown (e.g. in a group's member list, in search results) — clearly marked, not silently absent or indistinguishable from active.
- **Error state:** if a historical reference can't resolve (an edge case PPL-000 flagged as still possible for genuinely orphaned data, e.g. imported records), the experience should degrade gracefully — a clearly-labeled "unknown" state, not a broken layout or a silent zero.

## 13. APK / Web considerations

- This is a PWA with Capacitor mobile wrapping (per existing Arth stack) — the Person/Group detail screens and their edit flows should work identically across both, no web-only or mobile-only interaction patterns assumed without calling it out.
- Group member management (adding/removing/archiving) involves confirmation-style interactions (per PPL-000's finding that member removal already prompts when there's an outstanding balance) — these should be designed as proper in-app UI, not the current raw `window.prompt()`, which does not render usably on mobile.

## 14. Explicit historical-data invariants

Restated from PPL-000, binding on this design:

- A person or group's `id` never changes and is never reused.
- Editing display fields (name, emoji, color, etc.) never alters any historical transaction, bill, settlement, loan, or membership record.
- Archiving never alters, deletes, or rewrites financial history.
- A group's balance, wherever shown, is scoped to that group unless the screen is explicitly the person's cross-group overall view (§4).
- No design in this brief should require or imply a schema change, a migration, or a change to how attribution is recorded.

---

## 15. Known dependency for PPL-002 (consolidated)

- `getGroupMemberOwed(groupId, pid)` — exists today, correct, group-scoped receivable.
- A group-scoped `iOwe` equivalent — does not exist today. PPL-002 must add this as a read computation, following the existing pattern, not as a new model or schema change.
- Restoration (un-archive) mechanics — flagged in PPL-000 §10 as unspecified; this brief expects a restoration path to exist in the experience (§10) but does not prescribe how; PPL-002 should make this explicit.
- Archived-state visual treatment (§12) and the `window.prompt()` replacement (§13) are both real UI work items, not schema work — noted here so they aren't lost between this brief and PPL-002's scope.

---

Next artifact after this brief is approved/frozen: **PPL-002 — Engineering Brief.**
