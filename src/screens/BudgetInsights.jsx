// src/screens/BudgetInsights.jsx
//
// BUD-002 Insights shell - Gate 3 minimum slice (Category View data path only).
// Read-only throughout: only imports read-side Allocation Engine functions
// (getCategoryAttributedTotal, getCategoryPlanningAllocation) and the
// Financial Calendar's read-only period helpers. No import path to any
// Allocation Engine write/producer interface (BUD-002 D.3 Engineering Notes).
//
// Deliberately minimal, per Gate 3 scope - nothing here is Trend Chart work:
//   - Month view: category list with this period's attributed total per
//     category, tap to drill in. No Variance Bar, no Planning-Allocation
//     progress indicator, no Health tile - later WP-5 work, not this slice.
//   - Category View: category identity + a plain period-series list (label,
//     attributed total). No chart, no styling beyond what Month view already
//     uses - the actual Trend Chart is the next gate, explicitly deferred.
//   - Person / Summary sub-views: placeholders only. No Person/Group
//     attribution wiring in this slice (explicitly out of scope).
//
// Shared Period Selector (PeriodSelector.jsx) is reused as-is - viewMonth/
// setViewMonth are lifted from the caller (BudgetPage), same prop-driven
// contract PeriodSelector already has. No new period state is created here.
//
// Repo note: this file sits at src/screens/, so it reaches
// domain/allocations/adapter.js (repo-root domain/, two levels up) and
// src/domain/financialCalendar/calendarMonth.js (one level up, src/domain/)
// via two different relative depths - that's a real inconsistency in the
// repo's own domain/ placement, not a mistake in this file (confirmed by
// inspecting PeriodSelector.jsx's and calendarMonth.js's own import
// statements, not assumed).
//
// Three semantic questions are explicitly NOT resolved by this component,
// carried forward from the Gate 1 / Gate 2 evidence passes rather than
// settled implicitly by writing code:
//   1. catAllocations netting (Gate 1) - this component calls into the
//      adapter, it doesn't reimplement it, so a transaction with an
//      explicit split reflects the adapter's current unnetted behavior
//      for that path, unchanged by anything here.
//   2. excludeFromSpend x catAllocations (Gate 1) - same as above.
//   3. "fewer than 6 periods" (Gate 2) - this component always renders a
//      full 6-period trailing window and does NOT truncate based on
//      attribution history, since truncating would require picking one of
//      the two competing interpretations. A period with zero attribution
//      for the selected category still renders as a zero row, not omitted.

import React, { useState, useMemo } from "react";
import { getCategoryAttributedTotal, getCategoryPlanningAllocation } from "../../domain/allocations/adapter";
import { getCalendarMonthBounds } from "../domain/financialCalendar/calendarMonth";
import PeriodSelector, { shiftMonthKey } from "../components/PeriodSelector";

const TRAILING_WINDOW = 6;

// Builds a fixed 6-period trailing series ending at viewMonth (inclusive),
// oldest first. Does not consult attribution data to decide how many
// periods to include - see item 3 above.
const buildCategorySeries = (categoryId, viewMonth, txns) => {
  const keys = [];
  for (let i = TRAILING_WINDOW - 1; i >= 0; i--) {
    let k = viewMonth;
    for (let s = 0; s < i; s++) k = shiftMonthKey(k, -1);
    keys.push(k);
  }
  return keys.map(key => {
    const { label } = getCalendarMonthBounds(key);
    const periodTxns = txns.filter(t => t.date && t.date.startsWith(key));
    const attributedTotal = getCategoryAttributedTotal(periodTxns, categoryId, { allTransactions: txns });
    return { key, label, attributedTotal };
  });
};

export default function BudgetInsights({ viewMonth, setViewMonth, cats, txns, T, sym, fmt }) {
  const [insightsSubView, setInsightsSubView] = useState("month");
  const [focusedCategoryId, setFocusedCategoryId] = useState(null);

  const openCategory = (catId) => {
    setFocusedCategoryId(catId);
    setInsightsSubView("category");
  };

  const focusedCategory = cats.find(c => c.id === focusedCategoryId) || null;

  // Month view - category list for the current period, drill-in entry only.
  const monthCategoryRows = useMemo(() => {
    const periodTxns = txns.filter(t => t.date && t.date.startsWith(viewMonth));
    return cats
      .map(c => ({ cat: c, amt: getCategoryAttributedTotal(periodTxns, c.id, { allTransactions: txns }) }))
      .filter(r => r.amt > 0)
      .sort((a, b) => b.amt - a.amt);
  }, [cats, txns, viewMonth]);

  const categorySeries = useMemo(() => {
    if (!focusedCategoryId) return [];
    return buildCategorySeries(focusedCategoryId, viewMonth, txns);
  }, [focusedCategoryId, viewMonth, txns]);

  const tabs = [
    ["month", "Month"],
    ["category", "Category"],
    ["person", "Person"],
    ["summary", "Summary"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + T.border, marginBottom: 12, overflowX: "auto" }}>
        {tabs.map(([id, lbl]) => {
          const disabled = id === "category" && !focusedCategoryId;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setInsightsSubView(id)}
              style={{
                flex: 1,
                textAlign: "center",
                background: "none",
                border: "none",
                padding: "8px 4px",
                fontSize: 12,
                fontWeight: 800,
                cursor: disabled ? "not-allowed" : "pointer",
                color: disabled ? T.sub + "66" : insightsSubView === id ? T.accent : T.sub,
                borderBottom: insightsSubView === id ? ("2px solid " + T.accent) : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >{lbl}</button>
          );
        })}
      </div>

      {/* Reused as-is, no local period state - same contract as the Dashboard sub-tab. */}
      <PeriodSelector viewMonth={viewMonth} setViewMonth={setViewMonth} T={T} />

      {insightsSubView === "month" && (
        <div>
          {monthCategoryRows.length === 0 ? (
            <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Nothing to report yet for this period.
            </div>
          ) : (
            monthCategoryRows.map(({ cat, amt }) => (
              <div
                key={cat.id}
                onClick={() => openCategory(cat.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 4px",
                  borderBottom: "1px solid " + T.border,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: T.text, fontSize: 13 }}>{cat.icon} {cat.name}</span>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{sym}{fmt(amt)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {insightsSubView === "category" && focusedCategory && (
        <div>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 900, marginBottom: 10 }}>
            {focusedCategory.icon} {focusedCategory.name}
          </div>
          <div style={{ color: T.sub, fontSize: 11, marginBottom: 12 }}>
            Planning allocation: {sym}{fmt(getCategoryPlanningAllocation(focusedCategory))}
          </div>
          {categorySeries.length === 0 ? (
            <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Nothing to report yet for this category.
            </div>
          ) : (
            categorySeries.map(row => (
              <div
                key={row.key}
                style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px solid " + T.border }}
              >
                <span style={{ color: T.sub, fontSize: 12 }}>{row.label}</span>
                <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{sym}{fmt(row.attributedTotal)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {insightsSubView === "person" && (
        <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "30px 0" }}>
          Person view - not yet built (deferred, out of Gate 3 scope).
        </div>
      )}

      {insightsSubView === "summary" && (
        <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "30px 0" }}>
          Summary view - not yet built (deferred, out of Gate 3 scope).
        </div>
      )}
    </div>
  );
}