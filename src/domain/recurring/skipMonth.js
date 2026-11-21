// domain/recurring/skipMonth.js
//
// "Skip this month" for a recurring schedule (a SIP). The schedule keeps `skippedMonths: ["2026-12", ...]`
// (the same month-key pattern budget commitments use). A skipped month's instalment is not owed: it leaves
// Money Required and the Safe to Spend reserve, and no "due today" reminder fires. The schedule itself is untouched
// and the following month carries on as normal. Nothing is paid and no entry is written.

export const monthKeyOf = ymd => String(ymd || "").slice(0, 7);

export const isMonthSkipped = (schedule, monthKey) => Array.isArray(schedule?.skippedMonths) && schedule.skippedMonths.includes(monthKey);

/** Adds the month (idempotent). */
export function skipMonth(schedule, monthKey) {
  if (!schedule || !/^\d{4}-\d{2}$/.test(String(monthKey)) || isMonthSkipped(schedule, monthKey)) return schedule;
  return { ...schedule, skippedMonths: [...(schedule.skippedMonths || []), monthKey].sort() };
}

/** Removes the month. */
export function putMonthBack(schedule, monthKey) {
  if (!isMonthSkipped(schedule, monthKey)) return schedule;
  return { ...schedule, skippedMonths: schedule.skippedMonths.filter(m => m !== monthKey) };
}

/** Months in the list that are already in the past are dropped, so the list never grows without end. */
export function pruneSkippedMonths(schedule, todayYmd) {
  if (!Array.isArray(schedule?.skippedMonths) || schedule.skippedMonths.length === 0) return schedule;
  const keep = schedule.skippedMonths.filter(m => m >= monthKeyOf(todayYmd));
  return keep.length === schedule.skippedMonths.length ? schedule : { ...schedule, skippedMonths: keep };
}
