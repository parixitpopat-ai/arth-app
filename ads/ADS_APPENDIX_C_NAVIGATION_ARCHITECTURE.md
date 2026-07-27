# ADS Appendix C — Navigation Architecture

The final specification document before UI design begins.

---

## Section 1 — Primary Navigation

**Corrected from the original draft:** there is no mandatory
Authentication gate before Home — confirmed by checking the code.
`hasAppPin` only gates the **Money tab specifically**, and only if a PIN
has been set; it's optional and screen-scoped, not an app-launch step.

```
APP LAUNCH
    |
    v
H001 HOME
    |
    +---------------+---------------+---------------+
    v               v               v               v
  MONEY          OUTLOOK         INSIGHTS        SETTINGS
 (PIN gate,        |               |               |
  if set)          |               |               |
    |              |               |               |
    +--------------+-------+-------+---------------+
                           v
                  UNIVERSAL SEARCH (H011/H012)
```

---

## Section 2 — Home Navigation

```
Home
  |
  +-- Financial Health -> H003
  +-- Today's Focus -> O016 / O003 / O014  (Partial: still Action Centre, not yet querying O016)
  +-- Goals -> Goals Detail (own module)
  +-- Events -> own module
  +-- Recent Activity -> Timeline
  +-- Notification Bell -> H009 (Partial: budget-only today, not all 7 types)
  +-- Search -> H011/H012 (merged, 4 states)
  +-- Quick Actions -> Add Flow (A001+)
```

Every arrow here reflects an **actually implemented** path, not a
conceptual one — the two "Partial" flags above are real, confirmed
gaps, not omissions.

---

## Section 3 — Money Navigation

```
Money Dashboard (M001)
  |
  +-- Net Worth (M002)
  +-- Assets (M003) -> Asset Detail (M004)
  +-- Liabilities (M006) -> Liability Detail (M007)
  +-- Accounts (M008) -> Account Detail (M009)
  +-- Investments (M011) -> Investment Detail (M012)
  +-- Credit Cards (M013) -> Card Detail (M014)
  +-- Loans (M015) -> Loan Detail (M016)
  +-- Money to Receive (M017)
  +-- Money You Owe (M018)
  +-- Vehicles (M019) -> Vehicle Detail (M020)
  +-- Property (M021)          [placeholder only]
  +-- Business Assets (M022)   [placeholder only]
```

---

## Section 4 — Outlook Navigation ⭐ (largest page, the planning hub)

```
Outlook Dashboard (O001)  [Partial - placeholder today]
  |
  +-- Overview (O002)
  +-- Bills (O003) -> Bill Detail (O004)
  +-- Budget (O005)
  +-- Subscriptions (O007) -> Subscription Detail (O008)
  +-- Investment Plans (O009) -> SIP Detail (O010)
  +-- Insurance (O011)              [Existing - confirmed live]
  +-- EMIs (O012)
  +-- Scheduled Income (O013)
  +-- Cash Forecast (O014) *** HERO ***
  |     +-- Calendar (O015)
  |     +-- Alerts (O016)           [Partial - still inline in Action Centre]
  |     +-- Monthly Planner (O017)
  +-- Forecast Timeline (O018)
  +-- Commitment Detail (O019)      [Partial - Skip/Snooze not built]
```

**Real build-order note, not just a navigation fact:** O014 must exist
before O001, O017, and O018 can be genuinely finished (per the Critical
Path in the Outlook module spec) — this diagram shows the navigation
structure, not the build sequence; don't read the tree order as
implementation order.

---

## Section 5 — Cross-Module Navigation ⭐ (what changes where)

**Pay Bill:**
```
Bill Detail -> Pay
    |
    v
Transaction Created
    |
    v
Timeline Updated -> Forecast Updated -> Home Updated
    |
    v
Money: UNCHANGED (position is read fresh next time it's viewed — no
        separate "update" event needed, since Money never caches)
```

**Salary Received:**
```
Expected Income -> Mark Received
    |
    v
Transaction Created
    |
    v
Balance Engine (fresh read) -> Forecast (Safe to Spend) -> Home
    |
    v
Insights: UNCHANGED TODAY — Analytics Engine doesn't exist yet, so this
          arrow is aspirational, not real. Flagging rather than
          implying Insights already reacts to anything.
```

---

## Section 6 — Universal Search

```
Search (H011/H012)
  |
  +-- Transactions -> Timeline
  +-- Bills -> Bill Detail (O004)
  +-- Accounts -> Account Detail (M009)
  +-- People -> Person Detail
  +-- Groups -> Group Detail
  +-- Insurance -> Insurance Detail (O011)   [entity confirmed live; search-indexing status not yet checked]
  +-- Vehicles -> Vehicle Detail (M020)      [not confirmed indexed today]
  +-- Properties -> (N/A — module doesn't exist yet)
  +-- Business Assets -> (N/A — module doesn't exist yet)
```

**Honest gap:** the last 4 result types are aspirational — confirmed
search today covers Transactions/Bills/People/Groups reliably; Accounts/
Vehicles indexing isn't confirmed, and Insurance/Properties/Business
Assets can't be searched because the entities don't exist yet.

---

## Section 7 — Timeline

```
Timeline
  |
  v
Transaction
  |
  v
Related Entity (if linked: Bill, Policy, Vehicle, Person)
  |
  +-- Money (if it's a plain expense/income/transfer)
  +-- Outlook (if linked to a Bill/Commitment)
  +-- Settings/Manage (if linked to a Person/Vehicle/Policy)
```

Timeline is never a dead end — confirmed by design (every transaction
row is tappable and routes somewhere), though not every linked-entity
route has been individually verified screen-by-screen.

---

## Section 8 — Deep Links (documented now, even where not yet implemented)

| Deep Link | Target | Status |
|---|---|---|
| `arth://bill/{id}` | Bill Detail (O004) | Not implemented — no deep-link scheme exists in the app today |
| `arth://insurance/{id}` | Insurance Detail (O011) | Deep-link scheme itself still not implemented anywhere in the app — but no longer blocked on the entity, which is confirmed live |
| `arth://forecast` | Cash Forecast (O014) | Not implemented |
| `arth://account/{id}` | Account Detail (M009) | Not implemented |

**Confirmed: zero deep-link scheme exists in the app today.** Documenting
the target shape now (per the ADS's own reasoning) prevents ad-hoc,
inconsistent routing if/when this gets built — but none of this is a
retrofit of something real; it's a clean-slate design for later.

---

## Section 9 — Navigation Rules (frozen)

1. Every screen must have at least one entry point.
2. No screen may be a dead end.
3. Search always deep-links to the owning module.
4. Home surfaces information; it never owns it.
5. Timeline is an activity log, not a navigation hub.
6. Money never shows schedules.
7. Outlook owns every date-driven workflow.
8. Settings never contains business data — it configures the product.

---

## ADS Documentation Phase — Complete

| Deliverable | Status |
|---|---|
| Foundation | ✅ |
| Information Architecture | ✅ |
| Screen Inventory | ✅ |
| All Module Specifications | ✅ |
| Shared Design Patterns | ✅ |
| User Journeys (Appendix A) | ✅ |
| Business Rules (Appendix B) | ✅ |
| Navigation Architecture (Appendix C) | ✅ This document |

**No further specification documents planned.** From here: high-fidelity
mockups, interactive prototype, developer handoff, QA validation against
this ADS.
