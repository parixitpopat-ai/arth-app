# Arth v2.0 — Phase 2.5: Navigation & User Flows

**Status: COMPLETE (v1).** Achieved its purpose — validated architecture
against real behaviour, identified missing automation, separated UI gaps
from engine gaps, confirmed which flows already work, produced a
prioritised roadmap below.

## UX Package Numbering (permanent, adopted going forward)

| ID | Flow | Priority | Package status |
|---|---|---|---|
| UX-004 | Insurance Policy Lifecycle | P1 | ✅ Approved — see `UX-004_INSURANCE_POLICY_LIFECYCLE.md` |
| UX-005 | Buy Vehicle | P1 | ✅ Approved — see `UX-005_BUY_VEHICLE.md` (also the reusable "entity → suggested setup → commitments" template) |
| UX-001 | Record Expense | P2 | ✅ Approved — see `UX-001_RECORD_EXPENSE.md` (overwhelmingly reuse — least new work of any package so far) |
| UX-002 | Resolve Financial Commitment | P3 | ✅ Approved — see `UX-002_RESOLVE_COMMITMENT.md` (Skip/Snooze confirmed genuinely new — only unpaid/paid exists today) |
| UX-003 | Salary Received | P2 | Not yet packaged |
| UX-006 | Create Person | P4 | Not yet packaged |
| UX-007 | Split Expense | P4 | Not yet packaged |

Order reflects the reprioritization after UX-004/005: both new
architectural patterns are now validated, so the highest-volume everyday
journeys (Record Expense, Pay Bill) come next. Future flows continue the
ID sequence (UX-008+) regardless of priority order. Reference flows by
number in discussion from here on, not by name.

## Priority & Wireframe Order

| Flow | Status | Priority | Reason |
|---|---|---|---|
| 4. Renew Insurance | Large Gap | **P1** | New entity + new workflow |
| 5. Buy Vehicle | Large Gap | **P1** | New automation, cross-module |
| 3. Salary Received | Mostly Complete | P2 | Notification + Forecast refinement |
| 1. Record Expense | Mostly Complete | P2 | Core flow works, needs new-nav adaptation |
| 2. Pay Bill | Complete | P3 | Navigation only |
| 6. Create Person | Complete | P4 | No work required — validate nav only |
| 7. Split Expense | Complete | P4 | No work required — validate nav only |

**Wireframe in this order** — highest-return-first: Flow 4 and 5 tackle
genuinely new product behaviour; 1-3 need real but smaller refinement;
6-7 are navigation-only validation passes, done last.

Each flow marked per step: ✅ works exactly like this today, 🟡 mostly
works but needs the domain reorganization from Phase 1, ❌ this step
doesn't happen automatically yet — it's the target behavior, not current
reality. Flows expose navigation and automation gaps that the IA
document alone can't. **Gap type is split explicitly** (UI vs Logic vs
Both) so planning knows whether a fix is frontend, backend, or both.

---

## Flow 1 — Record an Expense

```
Home -> + -> Expense -> Category -> Account -> Save -> Timeline
```

| Step | Status | Gap type |
|---|---|---|
| Home → FAB → Expense | ✅ | — |
| Category, Account selection | ✅ | — |
| Save | ✅ | — |
| → Timeline | ✅ appears immediately | — |
| → Money updated | ✅ computed fresh on every read (`accountBalance`), no explicit refresh event needed | — |
| → Outlook recalculated | 🟡 Budget Progress reflects it immediately; Cash Forecast doesn't exist | UI only (Cash Forecast screen missing) |
| → Insights updated | ❌ No Insights screens exist yet | UI only (no logic needed yet either, since nothing consumes it) |

**Gap exposed:** the flow's later steps describe screens (Outlook Cash Forecast, Insights) that don't exist. Nothing broken — just confirms Insights/Forecast are real Phase 3+ work, not integration bugs to fix now.

---

## Flow 2 — Pay an Electricity Bill

```
Outlook -> Upcoming Bills -> Electricity -> Pay -> Transaction Created -> Bill Marked Paid -> Forecast Updated -> Timeline Updated
```

| Step | Status | Gap type |
|---|---|---|
| Upcoming Bills → Electricity → Pay | ✅ Bills screen fully built | — |
| → Transaction Created | ✅ real mechanism: `isBillPayment: true`, `paidBillId`, `paidBillName` | — |
| → Bill Marked Paid | ✅ | — |
| → Forecast Updated | 🟡 due-date logic real; Cash Forecast *screen* doesn't exist | UI only |
| → Timeline Updated | ✅ | — |

**This flow is the most solid of all seven** — every step except the Cash Forecast *screen* (not the underlying due-date logic) already works exactly as drawn.

---

## Flow 3 — Salary Received

```
Notification -> Add Income -> Salary -> Save -> Money Updated -> Safe to Spend Updated -> Forecast Updated -> Home Refresh
```

| Step | Status | Gap type |
|---|---|---|
| Notification | ❌ doesn't exist for "salary expected" | UI only (Expected Income schedule data already exists, just no notification surfaced from it) |
| Add Income → Salary → Save | ✅ | — |
| Expected Income "Mark Received" | ✅ real, event-driven, already built | — |
| → Money Updated | ✅ (same "always fresh on read" caveat as Flow 1) | — |
| → Safe to Spend Updated | 🟡 today's formula updates; the Financial-Engine version is a stub | Logic (Forecast Engine's `calculateSafeToSpend`) |
| → Forecast/Home Refresh | ✅ Home reads fresh state on every render | — |

**Gap exposed:** the flow assumes a Notification kicks this off — that's the one missing piece, not the rest of the mechanics.

---

## Flow 4 — Renew Insurance

```
Outlook -> Insurance Premium Due -> Pay -> Transaction -> Policy Updated -> Next Renewal Generated
```

| Step | Status | Gap type |
|---|---|---|
| Insurance Premium Due (Outlook) | 🟡 Insurance-as-Bill.type isn't built — currently a `Membership` record (ADR-020 legacy layer) | Logic (Bill.type + metadata store) |
| Pay → Transaction | ✅ mechanism exists (via Membership's `linkedTxnId`) | — |
| → Policy Updated | ❌ Insurance Policy Manage entity doesn't exist at all | Both — no entity, no UI to manage it |
| → Next Renewal Generated | ✅ `computeNextDueDate` already does this for Memberships, just not wired to a Policy | Logic (wiring only, the function itself is reusable) |

**This is the flow with the most real, unbuilt work** — the front half (paying) works via the legacy Membership mechanism; the back half (a real Policy entity per ADR-021) doesn't exist yet.

---

## Flow 5 — Buy a Vehicle

**Corrected target flow — no silent automation:**

```
Manage -> Vehicles -> Add Vehicle -> Save
   -> Money: Asset Added
   -> Prompt: "Create Insurance Policy for this vehicle?"
        YES -> Insurance Policy Created (Manage)
            -> First Premium Bill Generated (Outlook, Bill.type=Insurance Premium)
            -> Outlook Updated
        NO/SKIP -> nothing further happens
```

**Why prompt, not silent creation:** not every vehicle needs insurance
tracked in Arth (jurisdiction-dependent, or the user already tracks it
elsewhere) — auto-creating a Policy the user didn't ask for is worse UX
than asking once. Same principle should apply to any other
linked-object suggestion (e.g., "Add a Service Reminder?", "Add a PUC
Reminder?") — offer, never silently generate.

**Trigger:** Vehicle Created (Manage) → Vehicle Saved event → Money
updated → **offer** (not auto-create) Insurance Policy, Service
Reminder, PUC Reminder.

| Step | Status | Gap type |
|---|---|---|
| Manage → Vehicles → Add Vehicle | ✅ built this session | — |
| → Money: Asset Added | 🟡 value not surfaced in a unified Money hub yet | UI only (data exists, no display) |
| → Prompt: Create Insurance Policy? | ❌ doesn't exist | Both — no prompt UI, no Insurance Policy entity to create |
| → Insurance Policy Created | ❌ entity doesn't exist (confirmed New in Screen Inventory) | Logic — needs the Manage entity built first |
| → First Premium Bill Generated | ❌ needs Bill.type=Insurance Premium wired to the new Policy | Logic |
| → Outlook Updated | ✅ once the Bill exists, Outlook already reflects new Bills correctly | — |

**Real gap, checked not assumed:** confirmed by direct code check —
adding a vehicle does not auto-generate anything insurance-related
today. This is new automation to design, and per the correction above,
it should be prompt-based, not silent.

---

## Flow 6 — Create a Person

```
Manage -> People -> Create -> Available in Transactions
```

| Step | Status | Gap type |
|---|---|---|
| All steps | ✅ Fully built — People/Groups system is mature | — |

**Cleanest flow of the seven** — no gaps.

---

## Flow 7 — Split Expense

```
Transaction -> Split -> People -> Group -> Ledger Updated -> Money to Receive Updated
```

| Step | Status | Gap type |
|---|---|---|
| Transaction → Split → People | ✅ Multiple split modes already built | — |
| → Group | ✅ Quick Add's group-tagging (added this session) + Full Add's existing support | — |
| → Ledger Updated | ✅ | — |
| → Money to Receive Updated | ✅ People's settlement tracking already reflects this | — |

**Also clean** — this flow is fully real today, just needs the "Money to Receive" *label/placement* to match the frozen IA (currently under People, not yet surfaced inside a unified Money hub).

---

## Summary — where the real gaps are

| Flow | Real gap |
|---|---|
| 1. Record Expense | Insights screens don't exist to "update" |
| 2. Pay Bill | Nothing missing except the Cash Forecast *screen* |
| 3. Salary Received | No notification triggers the flow; Safe-to-Spend engine version stubbed |
| 4. Renew Insurance | **Insurance Policy entity doesn't exist at all** — biggest gap of the seven |
| 5. Buy a Vehicle | **Insurance-reminder auto-linkage doesn't exist** — confirmed by code check, not assumed |
| 6. Create Person | None — fully real |
| 7. Split Expense | None — fully real, just needs relabeling/placement to match the IA |

**Two flows (6, 7) need zero new work — they're navigation confirmations, not gaps.**
**Two flows (4, 5) expose the actual highest-priority build targets**, since they're the ones where the diagram describes something that plain doesn't happen yet, not just a missing screen around an already-working mechanism.
