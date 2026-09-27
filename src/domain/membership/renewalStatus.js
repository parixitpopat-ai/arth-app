// domain/membership/renewalStatus.js
//
// Membership renewal visibility (audit finding, folded into the Gym fix per the user's own
// scoping): the existing nudge only ever looked 7 days forward and showed nothing once a period
// had actually lapsed — a lapsed Gym/Club/Society/Rental membership had no "overdue" signal
// anywhere in the app, unlike a real Bill. This does NOT invent a Bill/Expected representation
// for memberships (that's a separate, still-open architectural decision) — it only extends the
// existing "how close is the next renewal" read to also cover the overdue side, and to work for
// Biller Accounts with no billerId shell (most personal ones — the shelled branch was the only
// one that ever computed this at all).

import { getPeriodEffectiveEnd, addDaysToDateStr } from "../../helpers/dateHelpers.js";

/**
 * @param {Array<{m:Object, period:Object|null|undefined}>} membershipsWithPeriods - one entry per
 *   payment record, `period` from getCurrentPeriod(m) (may be null/undefined; excluded here).
 * @param {string} today - "YYYY-MM-DD"
 * @param {number} forwardDays - how far ahead "renewing soon" looks (default 7, matches existing)
 * @returns {{kind:"overdue"|"renewing", m:Object, days:number}|null} `days` is days-until-due for
 *   "renewing" (>=0), days-since-lapsed for "overdue" (>0). null when nothing to report — covered
 *   further out than forwardDays, or the account has no derivable period at all.
 */
export function getMembershipRenewalStatus(membershipsWithPeriods, today, forwardDays = 7) {
  const withEff = (membershipsWithPeriods || [])
    .filter(x => x?.period)
    .map(x => ({ ...x, eff: getPeriodEffectiveEnd(x.period) }));
  if (!withEff.length) return null;

  // The latest-ending period across every payment on this account is the one whose lapse (or
  // nearing it) is the live signal — an older, already-superseded period's own end date is just
  // history, never a duplicate "overdue" alongside the real current one.
  const latest = [...withEff].sort((a, b) => String(b.eff || "").localeCompare(String(a.eff || "")))[0];
  if (!latest?.eff) return null;

  if (latest.eff < today) {
    const daysOverdue = Math.round((new Date(today) - new Date(latest.eff)) / 86400000);
    return { kind: "overdue", m: latest.m, days: daysOverdue };
  }
  const forwardLimit = addDaysToDateStr(today, forwardDays);
  if (latest.eff <= forwardLimit) {
    const daysLeft = Math.round((new Date(latest.eff) - new Date(today)) / 86400000);
    return { kind: "renewing", m: latest.m, days: daysLeft };
  }
  return null;
}
