# Sprint 3D — Insights (I001–I015)

Purely a consumer module — creates no data of its own, only reads from
Ledger/Balance/Analytics. Organized in the three sections frozen in the IA.

---

## 1. Spending

# I002 — Spending Dashboard
**Purpose:** Overview of spending patterns.
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine | **Refresh Trigger:** any transaction
**Drill-down:** `Spending Dashboard → Category → Merchant → Transactions → Transaction Detail`
**Status:** New | **Priority:** P1 | **Complexity:** L | **Migration Impact:** Analytics Engine doesn't exist as a distinct engine yet — calculations would need to be built, not just a screen wrapped around existing values (unlike Money/Outlook's mostly-reuse pattern).

# I003 — Categories
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Categories → tap category → Merchant breakdown within it → Transactions`
**Status:** New | **Priority:** P1 | **Complexity:** M | **Migration Impact:** Bill Analytics/Budget Insights fragments exist and likely feed this — not starting from zero data, but no unified screen exists.

# I004 — Merchants
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Merchants → tap merchant → Transactions with that merchant → Transaction Detail`
**Status:** New | **Priority:** P2 | **Complexity:** M | **Migration Impact:** None beyond Analytics Engine itself existing.

# I005 — Trends
**Owner Engine:** Analytics
**Data Freshness:** Real-time (recalculated per view, not cached — trends need multi-period comparison) | **Depends on:** Ledger Engine
**Drill-down:** `Trends → tap a period spike/dip → that period's Transactions`
**Status:** New | **Priority:** P2 | **Complexity:** L | **Migration Impact:** Requires period-over-period comparison logic — genuinely new, not a simple aggregate.

# I006 — Heatmaps
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Heatmap → tap a day → that day's Transactions`
**Status:** New | **Priority:** P3 | **Complexity:** M | **Migration Impact:** Recharts already available as a library — reduces new-code burden vs. building charting from scratch.

---

## 2. Income

# I007 — Income Dashboard
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine, Expected Income (Forecast)
**Drill-down:** `Income Dashboard → Source → Transactions`
**Status:** New | **Priority:** P2 | **Complexity:** M | **Migration Impact:** None beyond Analytics existing.

# I008 — Sources
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Sources → tap source → Transactions`
**Status:** New | **Priority:** P2 | **Complexity:** S | **Migration Impact:** None.

# I009 — Salary History
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine, Expected Income
**Drill-down:** `Salary History → tap a month → that Transaction`
**Status:** New | **Priority:** P2 | **Complexity:** S | **Migration Impact:** None.

# I010 — Passive Income
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Passive Income → tap entry → Transaction Detail`
**Status:** New | **Priority:** P3 | **Complexity:** M | **Migration Impact:** Requires a definition of what counts as "passive" — a real product decision, not just a filter, likely needs a category/tag convention that doesn't exist yet.

---

## 3. Wealth

# I011 — Net Worth Growth
**Owner Engine:** Analytics
**Data Freshness:** Daily (Net Worth is a point-in-time snapshot, doesn't need per-transaction recalculation for a growth *chart*) | **Depends on:** Balance Engine
**Drill-down:** `Net Worth Growth → tap a point → Money Dashboard as of that date (if historical snapshots exist)`
**Status:** New | **Priority:** P2 | **Complexity:** L | **Migration Impact:** Requires historical Net Worth snapshots over time — `wealthSnapshots` already exists as a data structure (confirmed in the app), reducing this from XL to L.

# I012 — Financial Health (history view)
**Owner Engine:** Analytics
**Data Freshness:** Daily | **Depends on:** Analytics Engine (the score itself already exists and is real)
**Drill-down:** `Financial Health → tap a factor → that factor's detail (reuses H003)`
**Status:** Refactor | **Priority:** P1 | **Complexity:** M | **Migration Impact:** The *score* is already real (reused from H001/H003/Profile) — this screen only needs a historical trend view added, not a new scoring engine.

# I013 — Saving Rate
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine, Balance Engine
**Drill-down:** `Saving Rate → tap a month → Income Dashboard + Spending Dashboard for that month`
**Status:** New | **Priority:** P2 | **Complexity:** M | **Migration Impact:** None beyond Analytics existing.

# I014 — Reports
**Owner Engine:** Analytics
**Data Freshness:** Real-time or on-demand generation (likely on-demand for exportable reports, not live-recalculated)
**Drill-down:** `Reports → tap a line item → source Transactions`
**Status:** New | **Priority:** P1 | **Complexity:** L | **Migration Impact:** Confirmed 0% built — no dedicated screen, only scattered fragments (Bill Analytics, Budget Insights).

# I015 — Comparison
**Owner Engine:** Analytics
**Data Freshness:** Real-time | **Depends on:** Ledger Engine
**Drill-down:** `Comparison → tap a category in either period → Transactions for that category/period`
**Status:** New | **Priority:** P3 | **Complexity:** M | **Migration Impact:** None beyond Analytics existing.

---

## Sprint 3D Summary

| Status | Count |
|---|---|
| New | 14 |
| Refactor | 1 (I012 — score already real, only history view is new) |

**Confirms the prediction exactly** — Insights is ~15% existing (only I012's underlying score), the rest genuinely new. Unlike Outlook, where most screens were "refactor existing Bill data," Insights has almost no existing calculation layer to lean on — the Analytics Engine itself needs to be built essentially from scratch.
