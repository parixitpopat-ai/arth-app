// WP-2 (ADR-037) — Shared Budget Period Selector.
//
// Pure prop-driven: receives viewMonth/setViewMonth from the caller and never
// creates or owns period state itself (BUD-002 PR-1 — "no mode, screen, or
// future feature maintains an independent period state"). Label is sourced
// from the Financial Calendar's getCalendarMonthBounds, replacing the inline
// `new Date(viewMonth+"-01").toLocaleString(...)` construction that used to
// live directly in BudgetPage's Dashboard sub-tab — same discipline as every
// other repoint this cycle: one canonical source, not a local reimplementation.
//
// Does not touch Fiscal Year, Quarter, Custom, or Billing Cycle — Calendar
// Month only, matching the current WP-2 minimum slice.

import { getCalendarMonthBounds } from "../domain/financialCalendar/calendarMonth";

export const shiftMonthKey = (monthKey, direction) => {
  const [y, mo] = monthKey.split("-").map(Number);
  // direction: -1 for previous, +1 for next. Native Date month-index overflow
  // (mo-1-1 or mo-1+1 landing outside 0-11) resolves December/January rollover
  // automatically — same technique used throughout this codebase's existing
  // date arithmetic (summaries.js, calendarMonth.js).
  const d = new Date(y, (mo - 1) + direction, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function PeriodSelector({ viewMonth, setViewMonth, T }) {
  const { label } = getCalendarMonthBounds(viewMonth);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button
          onClick={() => setViewMonth(m => shiftMonthKey(m, -1))}
          style={{ background: "none", border: "none", color: T.accent, fontSize: 20, cursor: "pointer", padding: "0 6px" }}
        >‹</button>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 900 }}>{label}</div>
        <button
          onClick={() => setViewMonth(m => shiftMonthKey(m, 1))}
          style={{ background: "none", border: "none", color: T.accent, fontSize: 20, cursor: "pointer", padding: "0 6px" }}
        >›</button>
      </div>
    </div>
  );
}
