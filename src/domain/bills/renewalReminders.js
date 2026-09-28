// domain/bills/renewalReminders.js
//
// Presentation-only surface for the Bills tab, per the user's own explicit direction: School
// Fees, Subscriptions and Membership fees (Gym/Fitness, Club Membership, Other Subscription,
// Insurance, Society Maintenance, Rental) are deliberately NOT Bills (ADR-039 §9 — they keep
// their own separate payment-period tracking, memberships[]/feePeriods, and reconciling that with
// the Bill/Expected/Schedule system is explicitly out of scope). But a real renewal due soon or
// already lapsed had NO visibility in the one place a person actually goes to see what's due —
// the Bills tab — because it isn't a Bill. This computes read-only reminder items from that
// existing data so the Bills tab can show them alongside real Bills, without creating a Bill,
// without touching bills[], and without duplicating either renewal-status calculation
// (getMembershipRenewalStatus, calculateOutstanding) that already exists and is already used
// elsewhere (the Bills-home biller list, School's own settlement screens).
//
// Both functions return the same-shaped item so the caller (paymentsView.js's buildPaymentsView)
// can merge and sort them as one list:
//   { billerAccountId, name, amount, kind:"overdue"|"renewing", days, forText }

import { getMembershipRenewalStatus } from "../membership/renewalStatus.js";
import { calculateOutstanding } from "../schoolFees/outstanding.js";
import { addDaysToDateStr } from "../../helpers/dateHelpers.js";

// Insurance deliberately excluded: per its own dedicated screen/data path (setShowInsuranceList
// in App.jsx — "don't write to billerAccountId in practice"), it doesn't populate memberships[]
// the way Gym/Club/Subscription/Society/Rental do, so this list is scoped to the types that
// actually do, plus what the user explicitly asked about.
const NON_SCHOOL_MEMBERSHIP_TYPES = ["Gym / Fitness", "Club Membership", "Other Subscription", "Society Maintenance", "Rental"];

/**
 * One reminder per Biller Account of a non-School membership type, whichever of its memberships[]
 * payment records has the latest-ending current period (getMembershipRenewalStatus's own rule —
 * unchanged, just reused). Nothing returned for an account with no derivable period, or one whose
 * next renewal is neither overdue nor within forwardDays.
 *
 * @param {Object} params
 * @param {Array} params.billerAccounts
 * @param {Array} params.memberships
 * @param {Function} params.getCurrentPeriod - the existing, unmodified (m) => period|null
 * @param {Function} [params.forLabel] - (billerAccount) => display text of who it's for
 * @param {string} params.today - "YYYY-MM-DD"
 * @param {number} [params.forwardDays] - default 7, same default as getMembershipRenewalStatus
 * @returns {Array<{billerAccountId, name, amount, kind, days, forText}>}
 */
export function getMembershipRenewalReminders({ billerAccounts, memberships, getCurrentPeriod, forLabel, today, forwardDays = 7 }) {
  return (billerAccounts || [])
    .filter(ba => ba && NON_SCHOOL_MEMBERSHIP_TYPES.includes(ba.type))
    .map(ba => {
      const memsForAcc = (memberships || []).filter(m => String(m.billerAccountId) === String(ba.id));
      if (!memsForAcc.length) return null;
      const status = getMembershipRenewalStatus(memsForAcc.map(m => ({ m, period: getCurrentPeriod(m) })), today, forwardDays);
      if (!status) return null;
      return {
        id: `membership:${ba.id}`,
        billerAccountId: ba.id,
        sourceType: "membership",
        name: ba.name || "Membership",
        amount: Number(status.m.amount || 0),
        kind: status.kind,
        days: status.days,
        forText: forLabel ? forLabel(ba) : "",
      };
    })
    .filter(Boolean);
}

/**
 * One reminder per School/Education Fees feePeriod that's both still owed (calculateOutstanding >
 * 0 — the existing, unmodified, single source of truth for that) and due/overdue/within
 * forwardDays. A period with no dueDate at all is skipped rather than guessed.
 *
 * WP5 (Arth IA — School Fees wiring gap) — an undeclared period (startingStateDeclared !== true)
 * is now skipped here too, same as it already was in domain/schoolFees/futureMoney.js's Outlook
 * adapter. startingState.js's own locked rule is that an undeclared period is "invisible
 * everywhere downstream" until the user explicitly says whether it was already paid — this
 * function was the one consumer still violating that, showing a real, non-zero amount for a
 * period Arth genuinely doesn't know the status of. Fixing it here, rather than loosening the
 * rule, keeps Payments and Outlook consistent for the same underlying period.
 *
 * @param {Object} params
 * @param {Array} params.feeSchedules
 * @param {Array} params.feePeriods
 * @param {Array} params.billerAccounts
 * @param {Function} [params.forLabel] - (billerAccount) => display text of who it's for
 * @param {string} params.today - "YYYY-MM-DD"
 * @param {number} [params.forwardDays] - default 7, same window as membership reminders
 * @returns {Array<{billerAccountId, name, amount, kind, days, forText}>}
 */
export function getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts, forLabel, today, forwardDays = 7 }) {
  const forwardLimit = addDaysToDateStr(today, forwardDays);
  const items = [];
  (feeSchedules || []).forEach(sch => {
    if (!sch) return;
    const ba = (billerAccounts || []).find(b => String(b.id) === String(sch.billerAccountId));
    (feePeriods || []).filter(p => p && p.scheduleId === sch.id).forEach(p => {
      if (!p.startingStateDeclared) return;
      const outstanding = calculateOutstanding(p);
      if (!(outstanding > 0) || !p.dueDate) return;
      const isOverdue = p.dueDate < today;
      if (!isOverdue && p.dueDate > forwardLimit) return;
      const days = Math.round((new Date(isOverdue ? today : p.dueDate) - new Date(isOverdue ? p.dueDate : today)) / 86400000);
      items.push({
        id: `school:${p.id}`,
        billerAccountId: sch.billerAccountId,
        sourceType: "school",
        name: p.label || ba?.name || "School Fees",
        amount: outstanding,
        kind: isOverdue ? "overdue" : "renewing",
        days,
        forText: forLabel && ba ? forLabel(ba) : "",
      });
    });
  });
  return items;
}
