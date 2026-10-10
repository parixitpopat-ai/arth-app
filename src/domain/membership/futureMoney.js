// domain/membership/futureMoney.js
//
// WP4 (Arth IA §7) — the Outlook sibling of domain/bills/renewalReminders.js's
// getMembershipRenewalReminders: same underlying data (a non-School membership-type Biller
// Account, joined to memberships[] via getCurrentPeriod, using the latest-ending current
// period — getPeriodEffectiveEnd, unchanged), but with NO forward-window cap. Outlook needs to
// see a renewal 90 days out just as much as Payments needs to see one due in 3 — the
// Payments-vs-Outlook split happens later, at the composed-list boundary
// (domain/futureMoney/horizon.js's isWithinPaymentsHorizon), never inside this adapter.
//
// Produces the same canonical Future Money event shape every other source (Bills, School Fees,
// Debt/EMI) already produces (domain/futureMoney/compose.js), so Outlook composes them
// identically — never a second, bespoke rendering path for Membership specifically.
//
// Never a Bill, never written to bills[] — Membership stays its own domain-specific record,
// exactly like the Payments-side adapter and the rest of this session's Membership work.

import { getPeriodEffectiveEnd } from "../../helpers/dateHelpers.js";

/**
 * How many months one payment of this period covers, from the period's own dates (not its label: labels
 * like "Period 2" say nothing). 1 = monthly, 3 = quarterly, 6, 12. null when the dates can't say.
 * A period 16 Sep to 15 Dec is 91 days: 91 / 30.4 = 3.
 */
export function getPeriodCycleMonths(period) {
  const from = Date.parse(`${period?.from}T12:00:00`), to = Date.parse(`${period?.to}T12:00:00`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  const days = Math.round((to - from) / 86400000) + 1;
  return Math.max(1, Math.round(days / 30.4375));
}

const NON_SCHOOL_MEMBERSHIP_TYPES = ["Gym / Fitness", "Club Membership", "Other Subscription", "Society Maintenance", "Rental"];

// Lifecycle gate (confirmed product decision): a Paused or Ended Financial Relationship
// (domain/membership/relationship.js's membershipRelationships[], status active/paused/ended)
// must stop projecting a future payment into Committed Spending/Outlook — only an Active
// relationship may. An account with NO relationship record at all (predates the relationship
// model, or one was simply never created for it) is left ungated, exactly as before this fix —
// this never retroactively blocks an account nobody has ever paused. Historical memberships[]
// payment records and bills/txns are never touched by this; only the forward projection is gated.
//
// WP15 (Membership Regression Audit) — exported so every surface that signals an upcoming
// membership renewal, not just this Outlook adapter, applies the identical gate. The audit found
// two more call sites still showing a Paused/Ended membership's renewal with no lifecycle
// awareness at all — the Payments renewal-reminders list (domain/bills/renewalReminders.js) and
// the Bills-home biller "Due Soon" tiles (App.jsx) — because WP13's fix only ever reached this
// one file. Same function, reused, not reimplemented, per the "one authoritative calculation" rule.
export function hasLiveMembershipRelationship(billerAccountId, relationships) {
  const forAccount = (relationships || []).filter(r => String(r.billerAccountId) === String(billerAccountId));
  if (!forAccount.length) return true;
  return forAccount.some(r => r.status === "active");
}

/**
 * Project one Biller Account's memberships into a Future Money event, or null if it's not a
 * non-School membership type, has no derivable current period at all, or has no live (Active)
 * Financial Relationship — see hasLiveMembershipRelationship above.
 *
 * @param {Object} billerAccount
 * @param {Array} memberships
 * @param {Function} getCurrentPeriod - the existing, unmodified (m) => period|null
 * @param {Array} [relationships] - membershipRelationships[]; omit to leave ungated (legacy behavior)
 * @returns {Object|null}
 */
export function mapMembershipToCommitment(billerAccount, memberships, getCurrentPeriod, relationships) {
  if (!billerAccount || !NON_SCHOOL_MEMBERSHIP_TYPES.includes(billerAccount.type)) return null;
  if (!hasLiveMembershipRelationship(billerAccount.id, relationships)) return null;
  const withEff = (memberships || [])
    .filter(m => m && String(m.billerAccountId) === String(billerAccount.id))
    .map(m => { const period = getCurrentPeriod(m); return { m, period, eff: getPeriodEffectiveEnd(period) }; })
    .filter(x => x.eff);
  if (!withEff.length) return null;

  // Same rule as getMembershipRenewalStatus: the latest-ending period across every payment on
  // this account is the live signal — an older, already-superseded period is just history.
  const latest = [...withEff].sort((a, b) => String(b.eff).localeCompare(String(a.eff)))[0];

  return {
    sourceType: "membership",
    sourceId: billerAccount.id,
    category: "committedSpending",
    subCategory: "membership",
    name: billerAccount.name || "Membership",
    amount: Number(latest.m.amount || 0),
    date: latest.eff,
    status: "unpaid",
    recurs: true,
    // Months one payment covers (1 monthly, 3 quarterly...). Lets Outlook show a quarterly fee once, in the
    // month it falls due, instead of counting it every month (futureMoney/rhythm.js).
    cycleMonths: getPeriodCycleMonths(latest.period),
  };
}

/**
 * Project a whole collection of Biller Accounts' memberships into Future Money events, silently
 * dropping anything that isn't a non-School membership type or has no derivable period.
 *
 * @param {Array} billerAccounts
 * @param {Array} memberships
 * @param {Function} getCurrentPeriod
 * @param {Array} [relationships] - membershipRelationships[]; omit to leave ungated (legacy behavior)
 * @returns {Array}
 */
export function projectMembershipsToCommitments(billerAccounts, memberships, getCurrentPeriod, relationships) {
  return (billerAccounts || [])
    .map(ba => mapMembershipToCommitment(ba, memberships, getCurrentPeriod, relationships))
    .filter(Boolean);
}
