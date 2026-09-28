// domain/futureMoney/horizon.js
//
// WP4 (Arth IA — Payments, Outlook, Budget & Insights, §6/§7) — the one rule that decides which
// screen shows a Future Money event: Payments owns anything overdue or due within `horizonDays`
// (default 30); Outlook owns everything beyond that. One composed list (compose.js), windowed
// two ways here — never two separate objects for the same real-world event, and never a second,
// drifting copy of this rule inside either screen's own component.
//
// `event.date` follows the same canonical Future Money event shape every source (Bills, School
// Fees, Debt/EMI, Membership, Insurance) already produces (compose.js). An event with no date at
// all can't be confirmed as safely far off, so — matching Bills' own "no due date = Unpaid now"
// convention — it stays on the Payments side rather than silently vanishing into Outlook.
//
// Deliberately separate from the Bills list's own 14-day "due soon" badge (domain/obligations/
// billBalance.js's getBillBadge) — that's a different question (how urgent does one Bill row
// look) answered at a different layer, untouched by this WP.

// The one number both sides read — Payments' renewal reminders (Membership/School/Insurance)
// pass this explicitly so their own window stays complementary with Outlook's, never drifting
// into a gap or an overlap.
export const PAYMENTS_HORIZON_DAYS = 30;

export function isWithinPaymentsHorizon(event, today, horizonDays = PAYMENTS_HORIZON_DAYS) {
  if (!event?.date) return true;
  const daysUntil = Math.ceil((new Date(event.date) - new Date(today)) / 86400000);
  return daysUntil <= horizonDays; // covers overdue (negative days) and due-soon in one comparison
}
