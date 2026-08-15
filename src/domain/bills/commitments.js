// domain/bills/commitments.js
//
// Commitment Read Model — read-only. Implements the approved semantic
// contract (Commitment Dataset Contract, this session): Committed Spending
// and Committed Saving/Investing are returned as two separate arrays, never
// merged. Debt Service (t.type==="cc_emi", liability rollups) is explicitly
// OUT OF SCOPE for this module — it already has its own clean, separate
// system (confirmed during the Bills & Subscriptions evidence pass) and is
// not touched here, per the contract's own instruction not to fold it in.
//
// CRITICAL SEMANTIC RULE, per the approved contract: `bill.recurring` is NOT
// the definition of whether a Bill is a commitment. It only reflects whether
// the Bill uses Arth's own auto-regeneration mechanism. The real household
// data audited during the evidence pass confirmed genuine recurring utility
// bills exist with `recurring:false` — every Bill record, regardless of its
// `recurring` flag, is included in Committed Spending. The `recurring` flag
// is preserved as metadata on the output record, never used as a filter.
//
// Does NOT redesign or migrate any underlying storage — `bills` and
// `recurringSchedules` remain exactly as they are. This module only reads
// and re-labels.
import { getNetBillAmount } from "./refunds.js";

const RECHARGE_CATEGORIES = ["Mobile Prepaid", "Fastag", "Metro Recharge", "NCMC Recharge", "EV Recharge", "Prepaid Meter", "DTH"];

export const isRechargeBiller = (billerCategory) => RECHARGE_CATEGORIES.includes(billerCategory);

/**
 * Household's own share of a Bill's amount — faithful reproduction of the
 * existing getMyBillShare logic found live in App.jsx (Outlook), replicated
 * here as a pure function taking `groups` explicitly rather than closing
 * over a `getGroup` helper, per the Function Extraction Checklist. Proven
 * equivalent to the real inline logic via the characterization tests.
 */
const getMyBillShare = (b, groups, refundTotalsByBill = {}) => {
  const netAmount = getNetBillAmount(b, refundTotalsByBill);
  const owedTotal = Object.values(b.splitPeople || {}).reduce((sum, info) => sum + (info.mode === "owes" ? Number(info.amount || 0) : 0), 0);
  const fallbackShare = Math.max(0, netAmount - owedTotal - Number(b.groupCollectiveAmount || 0));
  const storedShare = Number(b.myShare);
  const group = b.groupId ? (groups || []).find(g => g.id === b.groupId) : null;
  const meExcluded = group?.includeMe === false;
  return Number.isFinite(storedShare) && (storedShare > 0 || fallbackShare <= 0 || meExcluded) ? storedShare : fallbackShare;
};

/**
 * Maps every real Bill record to a Committed Spending entry, regardless of
 * its `recurring` flag (per the critical semantic rule above). Household
 * share computed via getMyBillShare; refunds already netted via
 * getNetBillAmount inside that function.
 */
const mapBillToCommittedSpending = (b, groups, refundTotalsByBill) => ({
  sourceType: "bill",
  sourceId: b.id,
  category: "committedSpending",
  subCategory: isRechargeBiller(b.billerCategory) ? "recharge" : "scheduledObligation",
  name: b.name || "Bill",
  amount: getMyBillShare(b, groups, refundTotalsByBill),
  date: b.dueDate || null,
  status: b.status || "unpaid",
  recurs: Boolean(b.recurring), // metadata only — NOT used as an inclusion filter
});

/**
 * Maps a CC account's current outstanding statement (if any) to a Committed
 * Spending entry. Synthetic — never stored, computed fresh each call via the
 * supplied getCardSummary function (injected, not imported directly, so this
 * module stays a pure function of its explicit inputs).
 */
const mapCcAccountToCommittedSpending = (account, accounts, txns, toDateOnly, getCardSummary) => {
  if (account.type !== "cc") return null;
  const summary = getCardSummary(account, accounts, txns, toDateOnly);
  if (!summary?.currentDue || summary.currentDue <= 0) return null;
  return {
    sourceType: "ccStatement",
    sourceId: `ccstmt_${account.id}`,
    category: "committedSpending",
    subCategory: "scheduledObligation",
    name: `${account.name || "Card"} Statement`,
    amount: summary.currentDue,
    date: summary.dueOn ? (summary.dueOn.toISOString ? summary.dueOn.toISOString().slice(0, 10) : summary.dueOn) : null,
    status: "unpaid", // synthetic entries only exist when currentDue > 0, so always unpaid by construction
    recurs: true, // a card statement is inherently a recurring obligation
  };
};

/**
 * Maps an active recurringSchedule to a Committed Saving/Investing entry.
 * Inactive schedules (active === false) are EXCLUDED entirely — per the
 * approved contract's inclusion rule, an inactive schedule does not
 * represent a live commitment and must not appear in the output at all.
 */
const mapScheduleToCommittedSaving = (r) => ({
  sourceType: "recurringSchedule",
  sourceId: r.id,
  category: "committedSaving",
  subCategory: undefined,
  name: r.name ? `${r.name} SIP` : "SIP",
  amount: Number(r.amount || 0),
  date: null, // day-of-month only (r.day) — no single "next date" computed here; that's a
              // consumer-side concern (e.g. Cash Flow's own nextDue projection), not this
              // read model's job, since two different consumers may want different date logic
  status: r.active !== false ? "active" : "inactive",
  recurs: true,
});

/**
 * Commitment Read Model. Returns Committed Spending and Committed
 * Saving/Investing as two SEPARATE arrays — never merged, per the approved
 * semantic contract. Debt Service is explicitly out of scope (see file
 * header) and never appears in either array.
 *
 * @param {Array} bills
 * @param {Array} recurringSchedules
 * @param {Array} accounts
 * @param {Array} txns
 * @param {Array} groups
 * @param {Function} toDateOnly - date-normalization helper, passed through to getCardSummary
 * @param {Function} getCardSummary - injected, not imported, keeps this module pure
 * @param {Object} refundTotalsByBill - pre-computed refund map (from computeRefundTotalsByBill)
 * @returns {{ committedSpending: Array, committedSaving: Array }}
 */
export const getCommitments = (bills, recurringSchedules, accounts, txns, groups, toDateOnly, getCardSummary, refundTotalsByBill = {}) => {
  const billEntries = (bills || []).map(b => mapBillToCommittedSpending(b, groups, refundTotalsByBill));
  const ccEntries = (accounts || [])
    .map(a => mapCcAccountToCommittedSpending(a, accounts, txns, toDateOnly, getCardSummary))
    .filter(Boolean);
  const scheduleEntries = (recurringSchedules || [])
    .filter(r => r.active !== false)
    .map(mapScheduleToCommittedSaving);

  return {
    committedSpending: [...billEntries, ...ccEntries],
    committedSaving: scheduleEntries,
  };
};
