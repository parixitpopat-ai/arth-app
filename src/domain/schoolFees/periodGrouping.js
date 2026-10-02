// domain/schoolFees/periodGrouping.js
//
// Payments v2 (WP18c) — E1. Pure, read-only composition for the Education detail screen
// (SchoolFeeScheduleDetailModal). WP18 built buildManualFeePeriods (arbitrary-length periods,
// each carrying its own real-date-range label, never a "Q#" quarter number) but explicitly left
// the DISPLAY of those periods as a flat list — this file is that missing piece.
//
// What "grouping" means here: a school year is created one ROW at a time in AddSchoolYearModal
// (WP18) — a tuition period for "Oct – Dec", plus any one-time fees (registration, uniform,
// books, …) that belong to that same stretch of the year, entered as separate rows that share
// that row's periodStart. Nothing in the stored data links a one-time fee to "the Q3 tuition
// period" by id — the only fact connecting them is that whoever created the schedule gave them
// the same periodStart (the natural, lightweight way to say "this one-time fee belongs to this
// stretch of the year" without inventing a new parent-id field). This function's grouping key is
// exactly that: periods sharing the same periodStart are one card. A one-time fee entered with a
// different periodStart (e.g. a registration fee spanning the whole school year) simply becomes
// its own group, headed by its own label — still never a Q# label, since nothing here invents one;
// every label displayed is always the period's own buildManualFeePeriods-produced label.
//
// No business logic is duplicated here — calculateOutstanding (outstanding.js) is the only source
// of a period's remaining balance, same as every other screen in this domain.

import { calculateOutstanding } from "./outstanding.js";

/**
 * @param {Array} periods - feePeriods[] already filtered to one schedule
 * @returns {{current:Array, earlier:Array}}
 *   Each group: { key, label, periodStart, periodEnd, dueDate, lines, totalObligation,
 *   totalPaid, totalOutstanding, allSettled, anyUndeclared }
 *   `lines` is the group's periods, tuition-kind lines first, then one-time lines (kind!=="tuition"),
 *   each line annotated with `outstanding`/`settled`/`undeclared` for the caller's convenience.
 *   `current` holds every group that isn't fully settled (or still has an undeclared line) —
 *   sorted by periodStart ascending (soonest/oldest due first). `earlier` holds fully-settled
 *   groups (every line declared and calculateOutstanding<=0) — sorted by periodStart descending
 *   (most recently finished first), meant to collapse to one summary row each in the UI.
 */
export function groupFeePeriodsForDisplay(periods) {
  const list = Array.isArray(periods) ? periods : [];
  const byStart = new Map();
  list.forEach(p => {
    const key = p.periodStart;
    if (!byStart.has(key)) byStart.set(key, []);
    byStart.get(key).push(p);
  });

  const groups = [...byStart.entries()].map(([periodStart, groupPeriods]) => {
    const lines = groupPeriods
      .map(p => ({
        ...p,
        undeclared: !p.startingStateDeclared,
        outstanding: p.startingStateDeclared ? calculateOutstanding(p) : null,
        settled: p.startingStateDeclared && calculateOutstanding(p) <= 0,
      }))
      .sort((a, b) => {
        const aTuition = a.kind === "tuition" || !a.kind;
        const bTuition = b.kind === "tuition" || !b.kind;
        if (aTuition !== bTuition) return aTuition ? -1 : 1;
        return String(a.label || "").localeCompare(String(b.label || ""));
      });
    const headLine = lines.find(l => l.kind === "tuition" || !l.kind) || lines[0];
    const totalObligation = lines.reduce((s, l) => s + Number(l.obligationAmount || 0), 0);
    const totalPaid = lines.reduce((s, l) => s + Number(l.paidAmount || 0), 0);
    const anyUndeclared = lines.some(l => l.undeclared);
    const totalOutstanding = lines.reduce((s, l) => s + (l.undeclared ? 0 : Math.max(0, l.outstanding || 0)), 0);
    const allSettled = !anyUndeclared && lines.every(l => l.settled);
    const periodEnd = groupPeriods.map(p => p.periodEnd).sort().slice(-1)[0];
    const dueDate = groupPeriods.map(p => p.dueDate).filter(Boolean).sort()[0] || periodStart;
    return {
      key: periodStart,
      label: headLine?.label || periodStart,
      periodStart,
      periodEnd,
      dueDate,
      lines,
      totalObligation,
      totalPaid,
      totalOutstanding,
      allSettled,
      anyUndeclared,
    };
  });

  groups.sort((a, b) => String(a.periodStart || "").localeCompare(String(b.periodStart || "")));

  const current = groups.filter(g => !g.allSettled).sort((a, b) => String(a.periodStart || "").localeCompare(String(b.periodStart || "")));
  const earlier = groups.filter(g => g.allSettled).sort((a, b) => String(b.periodStart || "").localeCompare(String(a.periodStart || "")));

  return { current, earlier };
}
