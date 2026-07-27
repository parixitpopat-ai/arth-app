# Home Sprint — H002 through H008

Same template as H001. Volume 1 (Home + Money).

---

# H002 — Widget Customization

**Purpose:** Let the user reorder or hide Home widgets.
**Question Answered:** How do I make Home show what matters to me?
**Owner Engine:** Home (UI-only — no calculation, just widget-order preference storage)
**Priority:** P2
**Dependencies:** none functional — reads the same widget list H001 already renders
**Entry Points:** Home → "Arrange" (an existing affordance already referenced elsewhere in the app for card ordering) or a new edit-mode toggle
**Exit Points:** back to Home (H001)

**Components:** Drag-reorder list, per-widget visibility toggle. Reuses `Chip`/`EntityCard` patterns for list rows where applicable.

**Business Rules:**
1. Reordering/hiding widgets never changes what data they show — pure presentation preference.
2. At least one widget must remain visible — Home can't be hidden entirely.

**Empty States:** N/A — this screen operates on a fixed, always-present widget list.
**Error States:** if a save fails, revert to the last known order silently and show a brief toast — never leave Home in an inconsistent, half-reordered state.

**Navigation:** `Home → Arrange → (reorder/toggle) → Save → Home`

**Wireframe:**
```
┌─────────────────────────────┐
│ ← Arrange Home         Save │
├─────────────────────────────┤
│ ☰ Financial Health      👁  │
│ ☰ Safe to Spend          👁  │
│ ☰ Today's Focus          👁  │
│ ☰ Goals                  👁  │
│ ☰ Events                 👁  │
│ ☰ Recent Activity        👁  │
└─────────────────────────────┘
```

**Developer Notes:** **Current: doesn't exist.** A card-ordering mechanism (`cardOrder` state) already exists elsewhere in the app for a different screen — reuse that same pattern/state shape rather than inventing a second one.

**Acceptance Criteria:**
- [ ] Widget order persists across sessions
- [ ] Hidden widgets don't render on H001
- [ ] Cannot hide all widgets simultaneously

**Future Scope:** per-widget size/density options.

---

# H003 — Financial Health Detail

**Purpose:** Explain the Financial Health Score shown on Home.
**Question Answered:** Why is my score what it is, and how do I improve it?
**Owner Engine:** Analytics
**Priority:** P1
**Dependencies:** the existing Financial Health formula (already real, reused from Home and Profile)
**Entry Points:** Home → tap Financial Health widget
**Exit Points:** back to Home; may deep-link to Budget/Bills if a specific factor needs attention

**Components:** Score breakdown list, factor-by-factor detail, trend indicator (up/down since last period).

**Business Rules:**
1. Uses the exact same formula as Home's summary — never a second, slightly-different calculation.
2. Each contributing factor should be individually explained, not just a single opaque number.

**Empty States:** if too little transaction history exists to compute a meaningful score, state that plainly rather than showing a misleadingly confident number.
**Error States:** N/A beyond standard data-load failure handling.

**Navigation:** `Home → Financial Health widget → Detail → back`

**Wireframe:**
```
┌─────────────────────────────┐
│ ← Financial Health           │
├─────────────────────────────┤
│        82/100  Excellent     │
│        ▲ +4 vs last month    │
├─────────────────────────────┤
│ Savings Rate         ✓ Good  │
│ Budget Adherence     ✓ Good  │
│ Bill Payment History ⚠ Fair  │
│ Debt Ratio           ✓ Good  │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Existing.** Already built and reused in Profile — this spec's job is to confirm Home's tap-through reaches the *same* existing detail view, not to design a new one.

**Acceptance Criteria:**
- [ ] Score matches Home's summary exactly
- [ ] Every listed factor has a plain-language explanation

**Future Scope:** historical score trend chart (belongs to Insights, I012, once built).

---

# H004 — Today's Focus

**Purpose:** Surface the 3 most important things needing attention today.
**Question Answered:** What should I actually pay attention to right now?
**Owner Engine:** Forecast (Home only asks it a question, never calculates)
**Priority:** P0
**Dependencies:** Forecast Engine's alert generation (Bills Due, SIP Tomorrow, Budget Exceeded, Salary Expected, Insurance Renewal, Low Cash Forecast, Credit Card Due, Investment Installment)
**Entry Points:** Home, always visible near the top
**Exit Points:** tapping an item routes to its source screen (Outlook for bills/EMIs, Money for budget alerts, etc.)

**Components:** 3-item priority list, time-of-day-aware grouping (Morning/Afternoon/Evening) per the frozen IA's example.

**Business Rules:**
1. Never more than 3 items shown, even if more alerts exist — Home asks Forecast Engine "give me the top 3," it doesn't decide priority itself.
2. Zero items should read as a positive, calm state — not an empty/broken one.

**Empty States:** "You're all caught up" — reuses the existing pattern already seen in the Notifications panel.
**Error States:** if the Forecast Engine's alert source is unavailable, Today's Focus should degrade to hidden rather than show a broken/error widget on the most-viewed screen in the app.

**Navigation:** `Home (Today's Focus) → tap item → relevant Outlook/Money screen`

**Wireframe:**
```
┌─────────────────────────────┐
│ Today's Focus                │
│ • Electricity Bill due today │
│ • Salary expected tomorrow   │
│ • Grocery budget at 81%      │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Inline Action Centre logic — this screen still calculates its own alerts directly, not sourced from a centralized Forecast Engine alert list.**
**Target: Forecast Engine owns all alert generation in one place (Bills Due, SIP Tomorrow, Budget Exceeded, Salary Expected, Insurance Renewal, Low Cash Forecast, Credit Card Due, Investment Installment); Today's Focus only asks it "give me the top 3 today" and displays the answer, never generating or ranking alerts itself.**
This is the single most consequential gap in the entire Home module — flagged here rather than glossed over, per the standing discipline.

**Acceptance Criteria:**
- [ ] Never shows more than 3 items
- [ ] All alert data sourced from Forecast Engine, zero local calculation
- [ ] Empty state reads positively

**Future Scope:** user-dismissible/snoozable individual Focus items (ties to the Skip/Snooze pattern already designed for UX-002).

---

# H005 — Goals Preview

**Purpose:** Show progress on active savings goals at a glance.
**Question Answered:** How close am I to my goals?
**Owner Engine:** Goals
**Priority:** P0
**Dependencies:** Goals Engine (already real — Goals is a fully extracted screen)
**Entry Points:** Home, always visible
**Exit Points:** "View All" → full Goals list; tap a specific goal → that goal's detail

**Components:** Progress bar per goal, capped to a small number shown (e.g. top 2-3 active goals), "View All" link.

**Business Rules:**
1. Only active (non-completed) goals show here — completed goals move to history, not clutter Home.
2. Progress percentage always matches the real Goals screen exactly — no separate calculation.

**Empty States:** "No goals yet" with a CTA to create one — reuses `EmptyState`.
**Error States:** N/A.

**Navigation:** `Home (Goals Preview) → View All → Goals list` or `→ tap goal → Goal Detail`

**Wireframe:**
```
┌─────────────────────────────┐
│ Goals                View All│
│ ▓▓▓▓▓▓▓░░░ Emergency 72%     │
│ ▓▓▓░░░░░░░ Vacation 34%      │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Existing.** Already a fully extracted, working screen (`screens/GoalsScreen.jsx`) — this Home widget is a thin preview over it, no new logic.

**Acceptance Criteria:**
- [ ] Shows only active goals
- [ ] Progress matches the Goals screen exactly
- [ ] Empty state shown correctly when no goals exist

**Future Scope:** none beyond what Goals Engine itself will grow into (milestones, per ADR discussion).

---

# H006 — Events Preview

**Purpose:** Show upcoming trips/events and their budget status.
**Question Answered:** What's coming up, and am I on budget for it?
**Owner Engine:** Forecast (Calendar-adjacent)
**Priority:** P1
**Dependencies:** Events Engine data (already real — Events is a fully extracted screen with budget tracking)
**Entry Points:** Home, always visible
**Exit Points:** tap → Events list or specific Event detail

**Components:** Upcoming event card(s), budget-used indicator.

**Business Rules:** same principle as Goals Preview — thin preview, no separate calculation from the real Events screen.

**Empty States:** "No upcoming trips or events" with CTA.
**Error States:** N/A.

**Navigation:** `Home (Events Preview) → tap → Events list/detail`

**Wireframe:**
```
┌─────────────────────────────┐
│ Trips & Outings              │
│ Goa Trip · ₹12,500 / ₹20,000 │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Existing.** Extracted screen (`screens/EventsScreen.jsx`), Home shows a thin preview.

**Acceptance Criteria:**
- [ ] Only upcoming (not past) events shown
- [ ] Budget figures match the Events screen exactly

**Future Scope:** none identified.

---

# H007 — Recent Activity

**Purpose:** Show the most recent transactions at a glance.
**Question Answered:** What did I just spend/receive?
**Owner Engine:** Ledger
**Priority:** P0
**Dependencies:** Ledger Engine (Transactions)
**Entry Points:** Home, always visible
**Exit Points:** "See all" → Timeline; tap a transaction → Transaction Details (expanded inline or full screen)

**Components:** Transaction row list (reuses the existing shared `TxnRow`-equivalent component already used in Timeline).

**Business Rules:** shows the N most recent transactions across all types (expense/income/transfer) — no filtering beyond recency.

**Empty States:** "No transactions yet" with a "+ Add First Expense" CTA — already built, reuses `EmptyState`.
**Error States:** N/A.

**Navigation:** `Home (Recent Activity) → See all → Timeline` or `→ tap row → Transaction Details`

**Wireframe:**
```
┌─────────────────────────────┐
│ Recent Activity        See all│
│ DMart              -₹850      │
│ Salary            +₹75,000    │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Existing.** Already built, already migrated to `EmptyState` this session.

**Acceptance Criteria:**
- [ ] Shows genuinely most-recent transactions, correctly sorted
- [ ] Tap-through to Transaction Details works
- [ ] Empty state already confirmed working

**Future Scope:** none identified.

---

# H008 — Search

**Purpose:** Find a specific transaction, bill, person, or group quickly.
**Question Answered:** Where is that specific thing I'm looking for?
**Owner Engine:** Ledger (primarily; also touches Manage entities like People/Billers)
**Priority:** P1
**Dependencies:** Ledger Engine, Manage entities (People, Groups, Billers)
**Entry Points:** Home header search icon
**Exit Points:** result tap → Timeline (transactions/bills) or People (person/group)

**Components:** Search input, result list grouped by type (already built — confirmed result `kind` values include `txn`, `bill`, `person`, `group`).

**Business Rules:** search is global (not scoped to Home specifically) — same underlying search already used elsewhere in the app, not a second implementation.

**Empty States:** "No results" — not yet explicitly confirmed as its own designed state; likely needs verifying during implementation.
**Error States:** N/A.

**Navigation:** `Home (search icon) → type query → tap result → relevant screen`

**Wireframe:**
```
┌─────────────────────────────┐
│ 🔍 Search transactions...    │
├─────────────────────────────┤
│ DMart · ₹850 · Today          │
│ 👤 Amit                       │
└─────────────────────────────┘
```

**Developer Notes:** **Current: Existing.** The universal search overlay already exists and already routes correctly by result `kind`. This spec's contribution is confirming Home is one of its entry points, not building new search logic.

**Acceptance Criteria:**
- [ ] Search accessible from Home header
- [ ] Results correctly typed and routed
- [ ] No-results state is clear, not blank

**Future Scope:** none beyond what's already planned for the shared Search pattern (X001).
