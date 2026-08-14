// src/screens/BudgetInsights.jsx
//
// BUD-002 Insights shell. Read-only throughout — see BudgetInsights.helpers.js
// for all pure calculation logic and its own header notes on canonical
// function usage and open ambiguities. This file is presentation only.
//
// Category → Subcategory (this change): shows a breakdown of the focused
// category's subcategories for the CURRENT selected period only (not a
// trend — that's the existing series above it). Per the explicit product
// decision governing this slice: subcategories are attribution tags, not
// monetary allocation dimensions. A transaction tagged with exactly one
// subcategory contributes its full amount to that subcategory,
// unambiguously. A transaction tagged with two or more subcategories
// contributes NO fabricated split — its amount is held in a separate,
// visible "multi-category" bucket, and the transaction is only shown as a
// count reference against each subcategory it touches, never as money.
// See buildSubcategoryBreakdown's own header for the full accounting rule
// and the test suite's explicit non-additive proof.
//
// Transaction drill-down is NOT implemented in this slice — deliberately,
// per instruction, since doing so under the multi-tag case would require
// deciding which subcategory a multi-tag transaction "belongs to" in a
// list, and that decision hasn't been made. This section shows rollup
// figures only.
//
// Person View relevance filter — flagged, not silently decided: the old
// Budgets tab filtered people via getPersonModules(p).includes("budget"),
// a helper defined inside App.jsx and not currently passed to this
// component. Rather than duplicate that filter (risking drift from the
// real one) or show every person regardless of relevance,
// buildPersonRows (helpers file) shows people with a nonzero planning
// allocation OR nonzero attributed spend this period. If the module-gate
// filter is preferred instead, pass a pre-filtered `people` list (or the
// helper itself) from the caller.
import React, { useState, useMemo } from "react";
import { getCategoryAttributedTotal, getCategoryPlanningAllocation } from "../../domain/allocations/adapter";
import PeriodSelector from "../components/PeriodSelector";
import { buildCategorySeries, buildPersonRows, buildSubcategoryBreakdown } from "./BudgetInsights.helpers";

const STATUS_LABEL = { onTrack: "Within Budget", close: "Approaching Budget", over: "Over Budget", no_budget: "No Budget Set" };

export default function BudgetInsights({ viewMonth, setViewMonth, cats, txns, people, T, sym, fmt }) {
  const [insightsSubView, setInsightsSubView] = useState("month");
  const [focusedCategoryId, setFocusedCategoryId] = useState(null);

  const openCategory = (catId) => {
    setFocusedCategoryId(catId);
    setInsightsSubView("category");
  };

  const focusedCategory = cats.find(c => c.id === focusedCategoryId) || null;

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

  const subcategoryBreakdown = useMemo(() => {
    if (!focusedCategory || !focusedCategory.subs || focusedCategory.subs.length === 0) return null;
    const periodTxns = txns.filter(t => t.date && t.date.startsWith(viewMonth));
    return buildSubcategoryBreakdown(focusedCategory, periodTxns, txns);
  }, [focusedCategory, txns, viewMonth]);

  const personRows = useMemo(() => {
    const periodTxns = txns.filter(t => t.date && t.date.startsWith(viewMonth));
    return buildPersonRows(people, periodTxns, viewMonth);
  }, [people, txns, viewMonth]);

  const tabs = [
    ["month", "Month"],
    ["category", "Category"],
    ["person", "Person"],
    ["summary", "Summary"],
  ];

  const healthColor = (status) => status === "over" ? T.danger : status === "close" ? T.warn : status === "onTrack" ? T.success : T.sub;

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

      {/* Reused as-is, no local period state. Governs Month, Category, and Person identically. */}
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

          {/* Category → Subcategory breakdown, current period only.
              See buildSubcategoryBreakdown's header for the accounting
              rule — multi-tag transactions never appear as fabricated
              money in any single row here. */}
          {subcategoryBreakdown && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: T.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                By Subcategory
              </div>
              {subcategoryBreakdown.subcategories.map(row => (
                <div key={row.subId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", borderBottom: "1px solid " + T.border }}>
                  <span style={{ color: T.text, fontSize: 12 }}>
                    {row.name}
                    {row.multiTagCount > 0 && (
                      <span style={{ color: T.sub, fontSize: 10, marginLeft: 6 }}>
                        (+{row.multiTagCount} multi-category)
                      </span>
                    )}
                  </span>
                  <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>
                    {row.singleTagCount > 0 ? `${sym}${fmt(row.attributedAmount)}` : "—"}
                    {row.singleTagCount > 0 && <span style={{ color: T.sub, fontSize: 10, marginLeft: 4 }}>({row.singleTagCount})</span>}
                  </span>
                </div>
              ))}
              {subcategoryBreakdown.multiTagCount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px solid " + T.border }}>
                  <span style={{ color: T.sub, fontSize: 12, fontStyle: "italic" }}>
                    Tagged to multiple subcategories ({subcategoryBreakdown.multiTagCount})
                  </span>
                  <span style={{ color: T.sub, fontSize: 12, fontWeight: 700 }}>{sym}{fmt(subcategoryBreakdown.multiTagAmount)}</span>
                </div>
              )}
              {subcategoryBreakdown.untaggedCount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px" }}>
                  <span style={{ color: T.sub, fontSize: 12, fontStyle: "italic" }}>
                    No subcategory ({subcategoryBreakdown.untaggedCount})
                  </span>
                  <span style={{ color: T.sub, fontSize: 12, fontWeight: 700 }}>{sym}{fmt(subcategoryBreakdown.untaggedAmount)}</span>
                </div>
              )}
              <div style={{ color: T.sub, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
                Subcategory figures are tags, not a budget split — amounts shown only where a transaction is tagged to exactly one subcategory.
              </div>
            </div>
          )}

          <div style={{ color: T.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Trend
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
        <div>
          {!people ? (
            <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Person data unavailable.
            </div>
          ) : personRows.length === 0 ? (
            <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Nothing to report yet for this period.
            </div>
          ) : (
            personRows.map(r => (
              <div key={r.person.id} style={{ padding: "10px 4px", borderBottom: "1px solid " + T.border }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{r.person.emoji || "👤"} {r.person.name}</span>
                  <span style={{ color: healthColor(r.status), fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: T.sub }}>
                    {sym}{fmt(r.actual)} {r.hasBudget ? `of ${sym}${fmt(r.planned)}` : "(no budget set)"}
                  </span>
                  {r.hasBudget && (
                    <span style={{ color: r.isOver ? T.danger : T.success, fontWeight: 700 }}>
                      {r.isOver ? "−" : ""}{sym}{fmt(Math.abs(r.variance))} {r.isOver ? "over" : "remaining"}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {insightsSubView === "summary" && (
        <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "30px 0" }}>
          Summary view — not yet built (deferred, out of this slice's scope).
        </div>
      )}
    </div>
  );
}
