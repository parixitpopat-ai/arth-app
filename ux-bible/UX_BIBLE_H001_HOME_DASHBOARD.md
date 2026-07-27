# H001 — Home Dashboard

**Screen ID:** H001
**Volume:** 1 (Home + Money)

**Purpose:** Financial Command Centre.

**Question Answered:** What needs my attention today?

**Owner Engine:** Home (owns nothing — consumes from every engine below; see ADR/IA "Home owns nothing" principle)

**Dependencies:** Forecast Engine, Analytics Engine, Goals Engine, Balance Engine, Activity/Ledger Engine

**Priority:** P0

**Entry Points:** App launch (default screen), Bottom Nav → Home tap from any other tab

**Exit Points:** Money (Net Worth tap), Outlook (Today's Focus items, Bills/Budget quick actions), Insights (from Budget Insights "View all Insights" link), Timeline (Recent Activity, "See all", any transaction row)

## Widgets (real status, checked against the app, not assumed)

| Widget | Source Engine | Status |
|---|---|---|
| Financial Health Score | Analytics | ✅ Existing — real formula |
| Safe to Spend | Forecast | 🟡 Existing (current formula); Forecast Engine's version (`calculateSafeToSpend`) is a stub |
| Today's Focus | Forecast | 🟡 Partial — still named/shaped as the original Action Centre; the "ask Forecast Engine for top 3, never calculate locally" rework isn't done |
| Goals Preview | Goals | ✅ Existing, extracted screen |
| Events Preview | Forecast (Calendar) | ✅ Existing, extracted screen |
| Recent Activity | Ledger | ✅ Existing |
| Quick Actions | — (routes to Ledger via Add) | ✅ Existing — Expense/Income/Transfer/Bill grid + FAB long-press speed menu |

## Business Rules

1. Home never performs its own calculation — every widget's number is read from its owning engine, never derived locally on this screen. (Today's Focus is the one widget not yet compliant with this — flagged above, not hidden.)
2. No raw account balances, Net Worth graphs, or budget tables appear directly on Home — those belong to Money/Outlook. Confirmed still true in the current build.
3. Today's Focus shows at most 3 items, prioritized, not a full alert list — matches the "Good Morning: Electricity Bill due today / Salary expected tomorrow / Grocery budget at 81%" example from the frozen IA. Not yet built this way (see Partial status above); today it's a flat alert list (Action Centre).
4. AI Insight (if present) shows at most one card — deterministic rule-based, never more than one competing insight shown simultaneously. Already enforced in the current build.

## Edge Cases

- **First-time user, no data yet:** Financial Health Score, Safe to Spend, Recent Activity all need defined empty/zero states — not currently designed as a first-run experience (Onboarding is 0% built, per the Screen Inventory).
- **Cloud sync in progress:** the ambient sync spinner (built earlier) must remain visible on Home specifically, since Home is the most-viewed screen and syncs often happen while it's open.
- **Today's Focus has zero items:** should read as "nothing needs attention" positively, not as an empty/broken state.

## Navigation

```
Home
 ├── tap Net Worth widget      → Money (M001)
 ├── tap Today's Focus item    → routes to the relevant Outlook/Timeline screen for that item
 ├── tap Goals Preview         → Goals list
 ├── tap Events Preview        → Events list
 ├── tap Recent Activity item  → Timeline, transaction expanded
 ├── tap "See all"             → Timeline (H008 Search entry point also lives here)
 └── Quick Actions / FAB       → Add (A001+)
```

## Wireframe

```
┌─────────────────────────────────┐
│ Arth                        🔔  │
│ PERSONAL FINANCE                │
├─────────────────────────────────┤
│ Good Morning, [Name]            │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ Financial Health    Excellent│ │
│ │ ●●●●●●●●●○  82/100          │ │
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ Safe to Spend                │ │
│ │ ₹18,450   (next 7 days)      │ │
│ └─────────────────────────────┘ │
│                                  │
│ Today's Focus                    │
│ • Electricity Bill due today     │
│ • Salary expected tomorrow       │
│                                  │
│ [Expense][Income][Transfer][Bill]│
│                                  │
│ Goals                    View All│
│ ▓▓▓▓▓▓▓░░░ Emergency Fund 72%    │
│                                  │
│ Recent Activity           See all│
│ DMart          -₹850             │
│ Salary        +₹75,000           │
└─────────────────────────────────┘
```

## Mockup

Not built this pass — per this session's established discipline, a full
visual mockup is worth producing once the spec itself is confirmed
correct, not before. Can build on request.

## Acceptance Criteria

- [ ] Home renders all 7 widgets with real data, zero hardcoded/fake values
- [ ] Today's Focus shows ≤3 items, sourced from Forecast Engine (not calculated on Home)
- [ ] No account balances, Net Worth graph, or budget table appear directly on this screen
- [ ] All 5 exit points navigate correctly
- [ ] First-time (empty-data) state doesn't show broken/undefined widgets
- [ ] AI Insight card (if shown) never exceeds one card

## Future Scope

- Widget Customization (H002) — reordering/hiding widgets, P2
- Search (H008) — currently routes through Timeline's existing search, not a distinct Home-level search experience yet
