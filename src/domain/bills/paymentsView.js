// domain/bills/paymentsView.js
//
// UI-2C M2 PY-18 / PY-27 — the Bills list's view model. Read-only: every
// state comes from billBalance.js (ADR-038) and every "For" from the Bill's
// own snapshot (billFor.js). Nothing here writes.
//
// Groups kept from today's Payments: Overdue, Due today, Due tomorrow,
// Upcoming, Paid, plus Cancelled (left out of totals). Each row carries its
// single D-16 badge. Expected items (M5) are not Bills and never appear here.

import { getBillBadge } from "../obligations/billBalance.js";
import { getBillSplitSource } from "./splitSource.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymdParts = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };

export function formatDayMonth(ymd) {
  const p = ymdParts(ymd);
  return p ? `${p[2]} ${MONTHS[p[1] - 1]}` : "";
}

/** "October" (or "Sep statement" for a card statement), from the Bill's period, else its due date. */
export function getBillPeriodLabel(bill) {
  const from = bill?.periodFrom || bill?.periodStart || bill?.billPeriodFrom || bill?.validFrom;
  const to = bill?.periodTo || bill?.periodEnd || bill?.billPeriodTo || bill?.validUntil;
  if (bill?.isCcStatement) {
    const p = ymdParts(to || bill?.dueDate);
    return p ? `${MONTHS[p[1] - 1]} statement` : "Statement";
  }
  const p = ymdParts(to || from || bill?.billDate || bill?.dueDate);
  return p ? MONTHS_LONG[p[1] - 1] : "";
}

export function getBillPeriodRange(bill) {
  const from = bill?.periodFrom || bill?.periodStart || bill?.billPeriodFrom || bill?.validFrom;
  const to = bill?.periodTo || bill?.periodEnd || bill?.billPeriodTo || bill?.validUntil;
  if (!from && !to) return "";
  return [formatDayMonth(from), formatDayMonth(to)].filter(Boolean).join(" – ");
}

/** The single badge text and tone for a row (D-16 wording). */
export function getBadgeText(badge, bill) {
  switch (badge.kind) {
    case "cancelled": return { text: "Cancelled", tone: "muted" };
    case "paid": return { text: `✓ Paid${bill?.paidDate ? ` ${formatDayMonth(bill.paidDate)}` : ""}`, tone: "positive" };
    case "overdue": return { text: `${badge.days} day${badge.days === 1 ? "" : "s"} overdue`, tone: "negative" };
    case "partial": return { text: "Partially paid", tone: "attention" };
    case "due": return { text: `Due ${formatDayMonth(bill?.dueDate)}`, tone: "attention" };
    default: return { text: "Unpaid", tone: "muted" };
  }
}

/**
 * "split 3 ways · 1 of 2 settled", or "" for a Bill with no split. Reads whichever copy of the
 * split is currently authoritative (see splitSource.js) — once a Bill is paid, that's the paying
 * Transaction's own `people`, not the Bill's now-stale splitPeople snapshot, so this reflects real
 * settlements made against that Transaction instead of always showing "0 settled".
 */
export function getSplitProgressText(bill, txns) {
  const people = getBillSplitSource(bill, txns).people;
  const owing = Object.entries(people || {}).filter(([pid, i]) => pid !== "__me__" && i && i.mode === "owes");
  if (!owing.length) return "";
  const ways = Object.keys(people).filter(pid => pid !== "__me__").length + 1;
  const settled = owing.filter(([, i]) => i.settled).length;
  return `split ${ways} ways · ${settled} of ${owing.length} settled`;
}

export function getCardVerificationText(bill) {
  if (!bill?.isCcStatement) return "";
  if (bill.verification === "matched") return "Matched with bank";
  if (bill.verification === "mismatch") return "Doesn't match";
  return "Needs verification";
}

const matchesFor = (bill, forFilter) => {
  if (!forFilter || forFilter === "all") return true;
  if (forFilter === "unassigned") return !bill.forType || bill.forType === "unassigned";
  const [type, id] = String(forFilter).split(":");
  return bill.forType === type && String(bill.forId) === id;
};

/**
 * Groups, totals and the For chips for the Bills list.
 * `forLabel(bill)` returns the display text of the Bill's own For.
 * `expectedItems` (ADR-039 — domain/obligations/expected.js's getExpectedItems, computed by the
 * caller) render as their own group, dashed, "not bills yet" (Arth 2.0 IA Redesign.dc.html's D1).
 * They never count toward totalUnpaid/openCount and are never Due/Overdue/paid/cancelled — they
 * are not Bills.
 * `renewalItems` (domain/bills/renewalReminders.js — School Fees/Subscription/Membership
 * renewals, computed by the caller) render as their own group too, same reasoning: they're not
 * Bills either (ADR-039 §9 keeps that data in memberships[]/feePeriods, deliberately), but per
 * the user's own explicit direction, showing them here too — without becoming Bills — beats being
 * invisible in the one screen a person actually checks what's due.
 */
export function buildPaymentsView({ bills, contributions, refDate = new Date(), forFilter = "all", forLabel = () => "", expectedItems = [], renewalItems = [] }) {
  const all = (bills || []).filter(Boolean);
  const chipMap = new Map();
  let hasUnassigned = false;
  all.forEach(b => {
    if (b.forType === "person" || b.forType === "group") chipMap.set(`${b.forType}:${b.forId}`, forLabel(b));
    else hasUnassigned = true;
  });
  const forChips = [
    { id: "all", label: "Everyone" },
    ...[...chipMap.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })),
    ...(hasUnassigned ? [{ id: "unassigned", label: "Unassigned" }] : []),
  ];

  const rows = all.filter(b => matchesFor(b, forFilter)).map(b => {
    const badge = getBillBadge(b, contributions, refDate);
    return { bill: b, badge, badgeText: getBadgeText(badge, b), forText: forLabel(b) };
  });
  const byDue = (a, b) => String(a.bill.dueDate || "9999").localeCompare(String(b.bill.dueDate || "9999"));
  // Open = something is still owed. A ₹0 Bill (e.g. a card statement with nothing due) has
  // nothing to pay, so it neither counts nor blocks "All bills paid" (PY-27).
  const open = rows.filter(r => r.badge.kind !== "paid" && r.badge.kind !== "cancelled" && r.badge.balance.remaining > 0.005);
  const groups = {
    overdue: open.filter(r => r.badge.kind === "overdue").sort(byDue),
    dueToday: open.filter(r => r.badge.kind !== "overdue" && r.badge.days === 0).sort(byDue),
    dueTomorrow: open.filter(r => r.badge.kind !== "overdue" && r.badge.days === 1).sort(byDue),
    upcoming: open.filter(r => r.badge.kind !== "overdue" && r.badge.days !== 0 && r.badge.days !== 1).sort(byDue),
    paid: rows.filter(r => r.badge.kind === "paid").sort((a, b) => String(b.bill.paidDate || "").localeCompare(String(a.bill.paidDate || ""))),
    cancelled: rows.filter(r => r.badge.kind === "cancelled"),
  };
  const totalUnpaid = Math.round(open.reduce((s, r) => s + r.badge.balance.remaining, 0) * 100) / 100;
  const lastPaid = groups.paid[0] || null;

  const expectedRows = (expectedItems || [])
    .filter(e => matchesFor({ forType: e.targetType, forId: e.targetId }, forFilter))
    .map(e => ({ expected: e, forText: forLabel({ forType: e.targetType, forId: e.targetId }) }))
    .sort((a, b) => String(a.expected.dueDate || "9999").localeCompare(String(b.expected.dueDate || "9999")));
  groups.expected = expectedRows;

  // The For filter applies to renewals/fees too: an item carries forType/forId when its owner is known and is
  // otherwise "Unassigned" — selecting a person or group must not keep showing everyone else's.
  groups.renewals = [...(renewalItems || [])].filter(r => matchesFor(r, forFilter)).sort((a, b) => {
    if (a.kind === "overdue" && b.kind !== "overdue") return -1;
    if (a.kind !== "overdue" && b.kind === "overdue") return 1;
    return (b.days || 0) - (a.days || 0);
  });

  return { forChips, groups, totalUnpaid, openCount: open.length, lastPaid };
}
