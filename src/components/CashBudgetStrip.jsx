import React from "react";
import { FONT, RADIUS } from "../constants/theme";

// Shared by Next-month readiness and the Spread sheet (Plan Ahead). CASH is the solid chip, BUDGET the
// outline chip; the two are always separate columns and never added together.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Chip({ T, solid, children }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: RADIUS.pill || 999,
      background: solid ? T.text : "transparent", color: solid ? T.bg : T.text, border: `1px solid ${solid ? T.text : T.borderStrong || T.border}` }}>{children}</span>
  );
}

// More than three months side by side use a short form (₹5K) so the strip never scrolls sideways.
const short = n => { const v = Math.abs(Number(n) || 0); if (v >= 100000) return `${(v / 100000).toFixed(2).replace(/\.?0+$/, "")}L`; if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`; return String(Math.round(v)); };

/** CASH row + BUDGET row across the months involved (PA7). `months` = [{key, cash, budget}]; null = dashed empty cell. */
export function CashBudgetStrip({ T, sym, fmt, months }) {
  const compact = months.length > 3;
  const cell = (v, T, note) => (
    <div style={{ minWidth: 0, textAlign: "right", fontFamily: FONT.mono, fontSize: compact ? 12 : 13, fontWeight: 700, color: v == null ? T.sub : T.text,
      border: v == null ? `1px dashed ${T.border}` : "none", borderRadius: 8, padding: "6px 2px", overflowWrap: "anywhere" }}>{v == null ? (note || "—") : `${sym}${compact ? short(v) : fmt(v)}`}</div>
  );
  const cols = `${compact ? 52 : 56}px repeat(${months.length}, minmax(0, 1fr))`;
  return (
    <div data-testid="cash-budget-strip" style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center" }}>
      <span />{months.map(m => <div key={m.key} style={{ color: T.sub, fontSize: 11, fontWeight: 700, textAlign: "right" }}>{MONTH_SHORT[Number(m.key.split("-")[1]) - 1]}</div>)}
      <Chip T={T} solid>CASH</Chip>{months.map(m => <React.Fragment key={m.key}>{cell(m.cash, T, m.cashNote)}</React.Fragment>)}
      <Chip T={T}>BUDGET</Chip>{months.map(m => <React.Fragment key={m.key}>{cell(m.budget, T)}</React.Fragment>)}
    </div>
  );
}
