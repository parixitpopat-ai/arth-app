# Home Module — H009 through H015

Same template. Grounded against actual current state, not assumed.

---

# H009 — Notification Centre
**Purpose:** Central location for all financial notifications (full history, not just top-3 priorities).
**Question Answered:** What notifications have I received?
**Owner Engine:** Forecast
**Priority:** P0
**Entry Points:** Bell icon (Home), push notification (future), deep link
**Exit Points:** Transaction, Outlook, Money, Settings
**Sections:** Today / Yesterday / Earlier
**Notification Types (target):** Bill Due, Credit Card, Salary, Insurance, SIP, Goal, Budget, System
**Actions:** Swipe right → Mark Read, Swipe left → Archive, Tap → open related screen
**Empty State:** "You're all caught up." — reuses the exact copy already live today.

**Business Rules:**
1. Max 90 days retained locally.
2. Read/unread synced across devices.
3. Forecast Engine owns notification generation (same centralization principle as O016 — these are not two separate alert systems, H009 is the *history view* of the same alerts O016/H004 surface as top-3).

**Developer Notes:** **Current: Partial, not New as originally labeled.** A real `NotificationsModal` already exists and is wired to the bell icon — confirmed by checking the code. But it only shows **budget-over alerts** (`activeBudgetAlerts`) — none of the other 7 notification types, no Today/Yesterday/Earlier grouping, no swipe actions, no read/unread state, no 90-day retention. The empty-state copy ("You're all caught up") is already exactly right and should be kept as-is.

**Status:** Partial | **Complexity:** L | **Migration Impact:** Requires Alert Centralization (O016) to exist first — H009 is the natural "view full history" screen off the same centralized alert source, and building it before O016 means building against the same incomplete, budget-only data source that exists today.

**Acceptance Criteria:**
- [ ] Opens under 500ms
- [ ] Shows all 7 notification types, not just budget
- [ ] Correct deep linking per type
- [ ] Read state persists across sessions and devices

---

# H010 — Notification Detail
**Purpose:** Full context for one notification before acting on it.
**Owner Engine:** Forecast
**Priority:** P1
**Entry Points:** H009 → tap a notification
**Exit Points:** Pay Now → Transaction flow; Dismiss → back to H009
**Components:** Amount, account, due date, Pay Now / Dismiss actions.
**Developer Notes:** **Current: New.** No detail drill-in exists today — the existing panel's rows are tap-to-navigate directly, no intermediate detail screen.
**Status:** New | **Complexity:** M | **Migration Impact:** Depends on H009 existing in its fuller form first.

---

# H011 — Quick Search Results
**Purpose:** Instant results while typing, before committing to a full search.
**Owner Engine:** Ledger (primary), Manage entities (secondary)
**Priority:** P0
**Searches:** Transactions, Bills, Accounts, People, Groups, Assets, Categories.
**Developer Notes:** **Current: Existing, needs this spec written down — not new work.** The universal search overlay already returns live results as you type; this "screen" is really documenting behavior that already exists, per the user's own note.
**Status:** Existing (needs spec, not new build) | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None — documentation only.

---

# H012 — Universal Search
**Purpose:** One search across the entire application.
**Owner Engine:** Ledger + Manage
**Priority:** P0
**Developer Notes:** **Current: Refactor.** The search overlay already exists and already searches transactions/bills/people/groups (confirmed earlier this session). "Refactor" here means extending its result types to match H011's full list (Assets, Categories not yet confirmed as searchable) — not building search from scratch.
**Status:** Refactor | **Complexity:** M | **Migration Impact:** Extend existing search's result-type coverage; no new search infrastructure needed.

---

# H013 — Empty Home State
**Purpose:** First-time user experience before any data exists.
**Owner Engine:** Home (presentation only)
**Priority:** P0
**Copy:** "Welcome to Arth. Let's record your first transaction."
**Developer Notes:** **Current: New.** Confirmed — no onboarding/first-run experience exists anywhere in the app (0% built, per the original Screen Inventory). This is a real, standalone gap, not a refinement of something existing.
**Status:** New | **Complexity:** M | **Migration Impact:** None architecturally — purely a first-run UI state, no engine work required, just needs a "has the user ever added data" check to trigger it.

---

# H014 — Offline Mode
**Purpose:** Communicate offline status and queue changes for sync.
**Owner Engine:** Settings (sync)
**Priority:** P1
**Components:** "Offline — changes will sync automatically" banner, change queue, retry, conflict resolution.
**Developer Notes:** **Current: New, but with real infrastructure to build on.** No offline banner/queue UI exists today, but the underlying sync-conflict handling (fixed this session — `syncConflictPendingRef`, pre-sync backups) is exactly the mechanism this screen would need to surface visually. This is a UI layer over already-real conflict-handling logic, not new engine work.
**Status:** New | **Complexity:** L | **Migration Impact:** None to the sync engine itself (already hardened this session) — this is presentation work making existing conflict states visible to the user instead of silent.

---

# H015 — Home Error Recovery
**Purpose:** Graceful failure instead of a crash if Home can't load.
**Owner Engine:** Home
**Priority:** P1
**Copy:** "We couldn't load your dashboard." Actions: Retry, Continue Offline, Send Diagnostics.
**Developer Notes:** **Current: New.** No dedicated error-boundary/recovery screen exists for Home specifically.
**Status:** New | **Complexity:** M | **Migration Impact:** Standard React error boundary pattern — no domain/engine work, purely a resilience layer.

---

## Developer Rules for the Home Module (confirmed, restated)

1. Home owns zero business logic.
2. Home performs zero calculations.
3. Home reads from engines only.
4. Today's Focus: max 3 cards.
5. Recent Activity: max 5 transactions.
6. Home loads incrementally — critical widgets first, secondary after.

## Home Module — Final Summary (H001–H015)

| Status | Count | Screens |
|---|---|---|
| Existing | 7 | H001, H003, H005, H006, H007, H008, H011 |
| Partial | 2 | H004, H009 |
| Refactor | 1 | H012 |
| New | 5 | H002, H010, H013, H014, H015 |

**Home is now genuinely 15/15 documented** — but "documented" and "production-ready" aren't the same thing: H004 and H009 share the exact same real gap (no centralized alert source yet), and H013 (onboarding) is a completely greenfield addition with no existing code to lean on at all.

---

# ADS Review — Applied Refinements

## Alert Relationship (frozen architectural rule, prevents 3 competing notification systems)

```
Forecast Engine
      |
      v
  O016 Alerts
      |
      +----> H004 Today's Focus     (today's prioritized top-3 subset)
      |
      +----> H009 Notification Centre (complete history, all types, Today/Yesterday/Earlier)
```

H004 and H009 are two *views* over the same O016 alert source — never two
separate alert-generating systems.

## H010 — Actions vary by notification type (not one generic detail page)

| Type | Primary Action |
|---|---|
| Bill | Pay Now |
| Salary | View Income |
| Insurance | View Policy |
| Credit Card | Open Card |
| Goal | Open Goal |

## H011/H012 — Merged into one screen with states (not two screens)

**H011 renamed/absorbed into H012.** Universal Search is one screen, four states:
- **State A — Idle:** search bar empty, recent searches shown
- **State B — Typing:** live results appear (what was previously called "Quick Search Results")
- **State C — Results:** full result set, grouped by type
- **State D — No Results:** clear empty state, not a blank screen

Quick Results were never a second screen — they're a state of the same one, exactly like Spotlight.

## H013 — Suggested Quick Start (added)

Empty Home now includes one of: **Connect Bank / Add First Transaction / Create Budget** — encourages action instead of a passive welcome message alone.

## H014 — Richer offline state (not just "Offline")

```
Offline
3 pending changes
Last synced: 8:42 AM
[Retry]
```
Confirms *what's* queued and *when* it last synced — matters directly given this session's real sync-conflict incident; a bare "Offline" label gives no confidence about data safety.

## H015 — Copy Error action (added)

Error Recovery now includes **Copy Error** alongside Retry/Continue Offline/Send Diagnostics — developers can get the exact error text without needing device logs.

## Home Loading Order (frozen)

```
Home Opens -> Skeleton -> Financial Health -> Safe to Spend ->
Today's Focus -> Quick Actions -> Goals -> Events -> Recent Activity
```
If one widget fails, everything else still loads — no single widget failure should take down the whole screen.

## Home Performance Budget

| Metric | Target |
|---|---|
| Cold Start | < 2 sec |
| Warm Start | < 700 ms |
| Widget Refresh | < 200 ms |

## Home Analytics Events (post-launch instrumentation)

Home Opened, Widget Clicked, Quick Action Used, Notification Opened, Search Used.

## Home Module Completion Scorecard

| Category | Status |
|---|---|
| Architecture | ✅ |
| UX Spec | ✅ |
| Wireframe | ⏳ |
| High Fidelity | ⏳ |
| Development | ⏳ |
| QA | ⏳ |

**Decision: ✅ Home Module Approved.**
