// WP-2 — extracted from PeriodSelector.jsx so this logic can be tested with
// plain `node --test`, without requiring a JSX-capable loader. Pure function,
// no React, no JSX — genuinely has no reason to live in the .jsx file besides
// proximity.
export const shiftMonthKey = (monthKey, direction) => {
  const [y, mo] = monthKey.split("-").map(Number);
  // direction: -1 for previous, +1 for next. Native Date month-index overflow
  // (mo-1-1 or mo-1+1 landing outside 0-11) resolves December/January rollover
  // automatically — same technique used throughout this codebase's existing
  // date arithmetic (summaries.js, calendarMonth.js).
  const d = new Date(y, (mo - 1) + direction, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};