// domain/futureMoney/rhythm.js
//
// Outlook redesign (handoff: "Arth · Outlook, Budget and Insights") — "The long list is
// organised by rhythm first, then by date. Anything with recurs = monthly is shown once, in
// Every month. Everything else sits under its month... Each month total still includes them,
// so the totals match a flat sum of the events."
//
// No new occurrences are ever fabricated here. The existing `recurs` field on a Future Money
// event (domain/futureMoney/compose.js) is a boolean — true for every source that recurs at
// all, including annual ones like insurance (which sets recurs:true because it renews every
// year, not every month). The handoff's "recurs = monthly" needs a narrower signal than that
// boolean alone gives, so this file adds the one further distinction actually needed: which
// recurring source types are monthly-cadence BY CONSTRUCTION, independent of any date on the
// record — Bills that auto-regenerate, card statements, SIPs, loan EMIs and (non-School)
// memberships are monthly in this app's real domain; insurance premiums and school fee terms
// are not (annual and per-term respectively), so they're never folded into the "Every month"
// rhythm — each one sits as its own dated, one-off event in whichever real future month it
// falls, and that month's total is computed as everyMonthTotal + that month's one-off events,
// exactly as the handoff specifies. No stored field was added to make this distinction; it's a
// closed, small list of source types that are inherently monthly, unlikely to need per-record
// override (a Bill's own `recurring` boolean already gates whether it's monthly at all).
const MONTHLY_RHYTHM_SOURCE_TYPES = ["bill", "ccStatement", "recurringSchedule", "debt", "membership"];

export function isMonthlyRhythm(event) {
  return Boolean(event?.recurs) && MONTHLY_RHYTHM_SOURCE_TYPES.includes(event?.sourceType);
}

const monthKeyOf = (dateStr) => (dateStr || "").slice(0, 7);
const daysBetween = (fromDate, dateStr) => Math.ceil((new Date(dateStr) - fromDate) / (1000 * 60 * 60 * 24));

/**
 * Groups a composed Future Money result (`{ committedSpending, committedSaving, debtService }`,
 * the exact, unmodified output of composeFutureMoneyCommitments) by rhythm: the next 30 days,
 * the monthly rhythm baseline, and one calendar-month bucket per month beyond that.
 *
 * @param {{committedSpending?:Array, committedSaving?:Array, debtService?:Array}} futureMoney
 * @param {string} fromDateStr - YYYY-MM-DD, "today" for this grouping (Outlook's own reference date)
 * @param {{monthsAhead?:number, monthsShownIndividually?:number}} [opts]
 * @returns {{
 *   next30: Array,
 *   next30CutoffDate: Date,
 *   everyMonthEvents: Array,
 *   everyMonthTotal: number,
 *   monthBuckets: Array<{monthKey:string, monthDate:Date, items:Array, total:number, hidden:boolean}>
 * }}
 */
export function groupFutureMoneyByRhythm(futureMoney, fromDateStr, opts = {}) {
  const { monthsAhead = 12, monthsShownIndividually = 5 } = opts;
  const fromDate = new Date(fromDateStr); fromDate.setHours(0, 0, 0, 0);

  const allEvents = [
    ...((futureMoney && futureMoney.committedSpending) || []),
    ...((futureMoney && futureMoney.committedSaving) || []),
    ...((futureMoney && futureMoney.debtService) || []),
  ].filter(e => e && e.date);

  const next30Cutoff = new Date(fromDate); next30Cutoff.setDate(next30Cutoff.getDate() + 30);
  // The 30-day window's own end date can fall mid-month (e.g. cutoff 28 Oct). Rather than leave
  // the last few days of that calendar month (29-31 Oct) uncovered by either this list or the
  // first month bucket, "next 30 days" also includes the rest of that cutoff month — nothing is
  // silently dropped in the gap. Month buckets then start from the month AFTER the cutoff's
  // month, matching the handoff's own example (cutoff 28 Oct -> first bucket is November).
  const cutoffMonthKey = monthKeyOf(next30Cutoff.toISOString().slice(0, 10));

  const next30 = allEvents
    .filter(e => { const d = daysBetween(fromDate, e.date); return d >= 0 && (d <= 30 || monthKeyOf(e.date) === cutoffMonthKey); })
    .sort((a, b) => a.date.localeCompare(b.date));

  const everyMonthEvents = allEvents.filter(isMonthlyRhythm);
  const everyMonthTotal = everyMonthEvents.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // One-off events: not part of the monthly rhythm, and due after the next-30-days window
  // (including its cutoff-month extension above) — these are what each future month bucket adds
  // on top of the everyMonth baseline.
  const oneOffs = allEvents.filter(e => !isMonthlyRhythm(e) && !next30.includes(e));

  const bucketStartMonth = next30Cutoff.getMonth() + 1; // month after the cutoff's own month
  const monthBuckets = [];
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(next30Cutoff.getFullYear(), bucketStartMonth + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const items = oneOffs.filter(e => monthKeyOf(e.date) === monthKey).sort((a, b) => a.date.localeCompare(b.date));
    const total = everyMonthTotal + items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    monthBuckets.push({ monthKey, monthDate, items, total, hidden: i >= monthsShownIndividually });
  }

  return { next30, next30CutoffDate: next30Cutoff, everyMonthEvents, everyMonthTotal, monthBuckets };
}
