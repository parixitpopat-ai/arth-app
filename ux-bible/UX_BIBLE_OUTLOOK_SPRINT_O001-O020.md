# Sprint 3C — Outlook (O001–O020)

**Outlook is the critical path** — highest implementation risk, since it's
where the Forecast Engine's unfinished stubs live. Presented in priority
order (O014 → O017 → O001 → everything else), not strict ID order.

---

# ⭐ O014 — Cash Forecast (FLAGSHIP)

**Purpose:** Project future cash position across upcoming days/weeks.
**Question Answered:** Will I have enough money for what's coming?
**Owner Engine:** Forecast
**Forecast Dependencies:** Accounts, Bills, Scheduled Income, Investment Plans, Budget, Forecast Engine
**Entry Points:** Outlook Dashboard (hero position), Home (Today's Focus, once wired), Notification (future)
**Exit Points:** tap a projected event → its source screen (Bill Detail, Scheduled Income)
**Components:** Daily/weekly balance projection chart, "Safe to Spend" figure (Forecast Engine's version, not Home's current formula), list of contributing upcoming events.

**Business Rules:**
1. Projection = Opening Balance + Expected Income − Upcoming Bills − Estimated Variable Spend, computed forward day-by-day, not just a single end-of-month number.
2. Must visibly distinguish confirmed commitments (Bills with a real due date/amount) from estimates (variable spend, inferred from history) — never present a guess with the same visual confidence as a real number.
3. Never fabricates a number when insufficient data exists — shows "Not enough data yet" rather than a misleadingly precise projection.

**Empty States:** "Not enough history to project yet" — needs a minimum amount of transaction/bill history before showing any curve.
**Error States:** if Accounts or Bills data is unavailable, Cash Forecast should not render a partial/misleading chart — fail to a clear "unavailable" state instead.

**Navigation:** `Outlook Dashboard → Cash Forecast → tap an event → source screen`

**Wireframe:**
```
┌─────────────────────────────┐
│ ← Cash Forecast               │
├─────────────────────────────┤
│ Projected Balance              │
│      ╱╲___╱╲___                │
│     ╱      ╲    ╲___           │
│                                │
│ Safe to Spend Today   ₹18,450  │
├─────────────────────────────┤
│ Confirmed                       │
│ • Electricity Bill  -₹1,240    │
│ • Salary           +₹75,000    │
│ Estimated                       │
│ • Groceries (est.)  -₹6,000    │
└─────────────────────────────┘
```

**Developer Notes:** **Current: does not exist.** `calculateProjectedBalance` and `calculateSafeToSpend` in `domain/financialEngine/engine.js` are explicit stubs returning `null` — this is genuinely new engine work, not a UI task layered over existing logic. `calculateExpectedIncomeTotal` (the one real function in that engine) is a direct input this screen needs and can already reuse.

**Status:** New | **Priority:** P0 | **Complexity:** **XL** | **Migration Impact:** Requires implementing the two stubbed engine functions for real — the single largest piece of net-new logic in the entire UX Bible so far.

**Acceptance Criteria:**
- [ ] Projects at least 7 days forward using real Bills + Expected Income data
- [ ] Visually distinguishes confirmed vs. estimated amounts
- [ ] Shows "not enough data" rather than a fabricated number when history is thin
- [ ] Safe to Spend figure matches the Forecast Engine's calculation, not Home's current separate formula

---

# O017 — Monthly Planner

**Purpose:** Plan the month ahead — income, commitments, and discretionary budget in one view.
**Question Answered:** How should I plan to spend this month?
**Owner Engine:** Forecast
**Forecast Dependencies:** Cash Forecast (O014), Budget, Scheduled Income, Bills
**Entry Points:** Outlook Dashboard
**Exit Points:** Budget Detail, Cash Forecast, individual Bill/Income items
**Components:** Month-at-a-glance summary, editable discretionary budget allocation, week-by-week breakdown.

**Business Rules:** builds directly on O014's projection — never a second, independent forecast calculation.

**Empty States:** depends entirely on Cash Forecast having real data — if O014 shows "not enough data," this screen inherits the same state.
**Error States:** same dependency chain as O014.

**Navigation:** `Outlook Dashboard → Monthly Planner`

**Developer Notes:** **Current: does not exist.** Depends entirely on O014 being real first — building this before Cash Forecast's engine work is done would mean building on top of stubs.

**Status:** New | **Priority:** P1 | **Complexity:** L | **Migration Impact:** Depends on O014's engine work landing first; this screen itself is presentation over that engine output, not additional new engine logic.

---

# O001 — Outlook Dashboard

**Purpose:** Entry point and overview for everything future-facing.
**Question Answered:** What's coming up across all my commitments and plans?
**Owner Engine:** Forecast
**Forecast Dependencies:** Bills, Budget, Scheduled Income, Cash Forecast, Alerts
**Entry Points:** Bottom Nav → Outlook, Drawer → Outlook
**Exit Points:** every other Outlook screen
**Components:** currently a placeholder (built Sprint 1) — 3 "Already Available" links (Bills/Budget/Scheduled Income) + "Coming Soon" list.

**Business Rules:** internal grouping per this sprint's structure — Overview / Commitments / Planning / Intelligence (not new screens, just organization).

**Developer Notes:** **Current: Partial — placeholder only.** Real version depends on O014 (its hero card) and O016 (its alert summary) being built first.

**Status:** Partial | **Priority:** P0 | **Complexity:** M | **Migration Impact:** Mostly assembly of other Outlook screens' summaries once they exist — not new logic itself, but blocked on O014/O016.

---

## Group 1 — Existing (navigation refactor only)

# O003 — Upcoming Bills
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills, Billers
**Developer Notes:** Current: Existing, fully built. Moving under Outlook is navigation-only.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

# O004 — Bill Detail
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

# O005 — Budget Progress
**Owner Engine:** Forecast | **Forecast Dependencies:** Budget, Transactions
**Developer Notes:** Loses its standalone top-level tab per the frozen IA — real navigation change, logic unchanged.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None (navigation only).

# O006 — Budget Detail
**Owner Engine:** Forecast
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

# O012 — EMI
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills (CC EMI flow)
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

# O013 — Scheduled Income
**Owner Engine:** Forecast | **Forecast Dependencies:** Expected Income (Financial Engine Phase 1, real)
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

## Group 2 — Refactor (existing data, new presentation)

# O007 — Subscriptions
**Derives from:** `Bill.type = "subscription"` — filtered view, per ADR-021. **No separate entity — do not create a Subscription table/model.**
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills
**Status:** Refactor | **Priority:** P1 | **Complexity:** S | **Migration Impact:** Requires the Bill `type` field enhancement (still an open gap since ADR-016/018) to properly filter by type.

# O008 — Subscription Detail
Same basis as O007 — a Bill Detail view filtered/labeled for this type.
**Status:** Refactor | **Priority:** P1 | **Complexity:** S | **Migration Impact:** Same as O007.

# O009 — Investment Plans (SIPs)
**Derives from:** `Bill.type = "sip"` per ADR-021 — Money shows holdings (M011), Outlook shows the schedule.
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills, Investments (Balance)
**Status:** Refactor | **Priority:** P1 | **Complexity:** S | **Migration Impact:** Same Bill-type field gap as O007.

# O010 — SIP Detail
**Status:** Refactor | **Priority:** P2 | **Complexity:** S | **Migration Impact:** Same as O009.

---

## Group 3 — New Engine Work (highest priority after the flagship)

# O015 — Calendar
**Purpose:** Chronological view of all upcoming financial events.
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills, Scheduled Income, Events
**Developer Notes:** Current: does not exist.
**Status:** New | **Priority:** P2 | **Complexity:** L | **Migration Impact:** Presentation over existing Bill/Income due-date data — doesn't require new stubbed-engine work like O014 does, just a calendar-shaped view that doesn't exist yet.

# O016 — Alerts
**Purpose:** Centralized source for every commitment-related alert.
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills, Budget, Scheduled Income, Investments, Insurance
**Business Rules:** owns ALL alert generation in one place (Bills Due, SIP Tomorrow, Budget Exceeded, Salary Expected, Insurance Renewal, Low Cash Forecast, Credit Card Due, Investment Installment) — Home's Today's Focus (H004) only queries this, never generates its own.
**Developer Notes:** **Current: Partial — alert logic exists, but inline in the old Action Centre, not centralized here.** This is the other half of H004's flagged gap — fixing one without the other leaves them out of sync.
**Status:** Partial | **Priority:** P0 | **Complexity:** L | **Migration Impact:** Requires extracting/centralizing alert generation out of the current inline Action Centre code — a real migration, not new logic from scratch.

# O018 — Forecast Timeline
**Purpose:** Chronological view specifically of projected cash events (distinct from O015's general calendar).
**Owner Engine:** Forecast | **Forecast Dependencies:** Cash Forecast (O014)
**Status:** New | **Priority:** P1 | **Complexity:** M | **Migration Impact:** Depends on O014 existing first — presentation layer over it.

# O019 — Commitment Detail (renamed from "Decision Detail")
**Purpose:** Generic drill-in for any Bill.type — one template, not per-type screens.
**Owner Engine:** Forecast | **Forecast Dependencies:** Bills
**Developer Notes:** this is UX-002's "Resolve Financial Commitment" package, already designed — Skip/Snooze confirmed genuinely new (only `unpaid`/`paid` status exists on Bill today).
**Status:** Partial (Pay/Edit exist; Skip/Snooze don't) | **Priority:** P1 | **Complexity:** M | **Migration Impact:** Requires two new fields on Bill for per-instance Skip/Snooze, distinct from the existing whole-series `isPaused`.

---

## Group 4 — Deferred

# O020 — AI Recommendation
**Owner Engine:** AI
**Developer Notes:** deliberately parked until the AI Engine is formalized — do not build ahead of that decision.
**Status:** New | **Priority:** **P3 / Deferred** | **Complexity:** XL | **Migration Impact:** Entire AI Engine doesn't exist yet; this screen is blocked on that, not just its own logic.

---

## Sprint 3C Summary

| Status | Count |
|---|---|
| Existing | 6 |
| Refactor | 4 |
| Partial | 3 (O001, O016, O019) |
| New | 7 |

**The real critical path, in order:** O014 (Cash Forecast) must land first — it's the one screen requiring genuinely new engine logic (the two stubbed functions), and O001, O017, and O018 all depend on it existing. O016 (Alerts centralization) is the second priority — it's what actually closes the gap flagged back in H004, and nothing about Today's Focus can be considered "done" until this exists.

---

## Critical Path — Implementation Dependency Chain

```
Forecast Engine
  |
  +-- calculateCommittedOutflow      [DONE - implemented]
  +-- calculateExpectedIncomeTotal   [DONE]
  +-- calculateProjectedBalance      [DONE - implemented]
  +-- calculateSafeToSpend           [DONE - implemented]
  +-- calculateRecognition           [BLOCKED - Bill schema fields don't exist, not an effort gap]
        |
        v
  O014 Cash Forecast
        |
        +--------------+
        v              v
  O017 Monthly     O001 Outlook
  Planner          Dashboard
        |              |
        +------+-------+
               v
        O016 Alerts
               v
        H004 Today's Focus
```

**Updated:** 4 of 5 engine functions are now real (implemented directly
in code, not just documented as planned). `calculateRecognition` remains
genuinely blocked — it needs `recognitionMethod`/`recognitionDuration`
fields added to the Bill record first (Insurance module work), not an
effort gap. **O014 (Cash Forecast) can now actually be built** — its
engine dependencies are real, not stubbed. The functions consume an
`openingBalance` parameter rather than re-deriving it from
accounts/transactions, per the Engine Ownership boundary (Balance owns
balance calculations, Forecast consumes them).
