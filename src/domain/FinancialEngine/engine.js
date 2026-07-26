// The Financial Engine — a service, not a screen. Per the architecture decision (see
// ARCHITECTURE_DECISIONS.md ADR-017): nothing writes directly to Cash Flow. Every screen that
// shows a financial number is a view over these outputs, computed fresh from Inputs each time —
// never stored, per the "Safe to Spend = a calculation, never stored" principle (ADR-016).
//
// Inputs (all pure data, passed in — this module owns no state):
//   accounts, txns, bills, expectedIncome
//
// Outputs (this file, growing over time — see each function's status below):
//   calculateExpectedIncomeTotal      — ✅ real, Phase 1
//   calculateCommittedOutflow         — ✅ real
//   calculateProjectedBalance         — ✅ real
//   calculateSafeToSpend              — ✅ real
//   averageOfLastNMonthsVariableSpend — ✅ real, added to close O014's spec gap
//   buildCashFlowTimeline             — ✅ real, added to close O014's spec gap
//   hasTransientNegativeBalance       — ✅ real, added for O016 (Alerts)
//   calculateRecognition              — 🚧 stub — genuinely blocked on schema, not effort:
//                                        Bill has no recognitionMethod/recognitionDuration fields yet
// Forecast Engine v1: complete except calculateRecognition (blocked on Bill schema, Insurance work).
//
// Every function takes explicit parameters, no closures over component state — same Function
// Extraction Checklist discipline as domain/bills, domain/cards. This module can be unit tested
// with plain objects, no React involved.

import { getMonthBounds } from "../../helpers/dateHelpers";

/**
 * Total expected income for a given month that hasn't been marked received yet.
 * @param {Array} expectedIncome - expected income entries: { id, name, amount, frequency, nextDate, status }
 * @param {string} monthKey - "YYYY-MM", defaults to current month via getMonthBounds
 * @returns {number}
 */
export const calculateExpectedIncomeTotal = (expectedIncome, monthKey) => {
  const { start, end } = getMonthBounds(monthKey);
  return (expectedIncome||[])
    .filter(e => e.status !== "received" && e.nextDate >= start && e.nextDate <= end)
    .reduce((sum, e) => sum + Number(e.amount||0), 0);
};

/**
 * Sum of unpaid Bills due within the given month. Per ADR-016 ("Cash Flow consumes Bills, not a
 * new Commitments entity") — reads Bill directly, no separate entity. Uses each bill's net amount
 * (after refunds) via getNetBillAmount if a refund map is supplied, otherwise the raw amount —
 * callers with refund data should pass it; this function doesn't fetch it itself (pure, no I/O).
 */
export const calculateCommittedOutflow = (bills, monthKey, refundTotalsByBill = {}) => {
  const { start, end } = getMonthBounds(monthKey);
  return (bills||[])
    .filter(b => b.status !== "paid" && b.dueDate >= start && b.dueDate <= end)
    .reduce((sum, b) => {
      const refunded = (refundTotalsByBill[b.id] || 0);
      return sum + Math.max(0, Number(b.amount||0) - refunded);
    }, 0);
};

/**
 * Projected balance at the end of the given month: Opening Balance + Expected Income - Committed
 * Outflow - Estimated Variable Spend. Deliberately takes `openingBalance` as a parameter rather
 * than `accounts`/`txns` - balance computation belongs to the Balance Engine (per the Engine
 * Ownership table), not re-derived here. `estimatedVariableSpend` is also a parameter, not
 * computed here - deciding HOW to estimate variable spend (e.g. average of last 3 months) is a
 * product decision for the caller, not something this pure function should silently assume.
 * Returns null (not 0) if openingBalance is not a valid number - callers must distinguish
 * "not enough data yet" from "genuinely zero balance projected."
 */
export const calculateProjectedBalance = (openingBalance, bills, expectedIncome, estimatedVariableSpend, monthKey, refundTotalsByBill) => {
  if (typeof openingBalance !== "number" || Number.isNaN(openingBalance)) return null;
  const income = calculateExpectedIncomeTotal(expectedIncome, monthKey);
  const outflow = calculateCommittedOutflow(bills, monthKey, refundTotalsByBill);
  const variable = Number(estimatedVariableSpend||0);
  return openingBalance + income - outflow - variable;
};

/**
 * Safe to Spend, Financial-Engine version. Does NOT replace the existing Safe Spend Today formula
 * already live elsewhere in the app (ADR-016: "upgrade in place, don't replace") - this is the
 * parallel, engine-driven version, to be wired into Home/Outlook once callers are ready to switch.
 * Same null-vs-zero distinction as calculateProjectedBalance.
 */
export const calculateSafeToSpend = (openingBalance, bills, expectedIncome, estimatedVariableSpend, monthKey, refundTotalsByBill) => {
  const projected = calculateProjectedBalance(openingBalance, bills, expectedIncome, estimatedVariableSpend, monthKey, refundTotalsByBill);
  if (projected === null) return null;
  return Math.max(0, projected);
};

/**
 * STUB — genuinely blocked, not deferred by choice. Recognition is a property of a Bill
 * (ADR-016), not of Transactions/Budget/Cash Flow - this function will read a bill's
 * recognitionMethod/recognitionDuration once those fields exist. Confirmed by checking the Bill
 * record's actual current shape: neither field exists yet. Implementing this now would mean
 * inventing a schema shape here that the real Bill record might not end up matching - the field
 * addition has to land on Bill first (Insurance module work, Sprint A item 2), then this function
 * becomes real.
 */
export const calculateRecognition = (_bill) => null;

/**
 * Average discretionary (variable) spend over the last N months — feeds calculateProjectedBalance/
 * calculateSafeToSpend's `estimatedVariableSpend` parameter, which had no function supplying it
 * until this pass (found while writing O014's spec, not before).
 *
 * Only counts type==="expense" transactions that are NOT bill payments (`isBillPayment !== true`)
 * — Bills are already counted separately via calculateCommittedOutflow, so including bill-payment
 * expenses here would double-count them. Per ADR-017's frozen 8 transaction types, transfer/
 * investment/cc_payment/cc_emi/settlement_in/settlement_out are all excluded by construction,
 * since only "expense" is even considered.
 *
 * @param {Array} txns - transaction records
 * @param {number} months - how many trailing months to average (default 3)
 * @param {string} refMonthKey - "YYYY-MM" to count back FROM (defaults to current month, exclusive - doesn't include the current/reference month itself, only completed prior months)
 * @returns {number}
 */
export const averageOfLastNMonthsVariableSpend = (txns, months = 3, refMonthKey) => {
  const ref = refMonthKey || new Date().toISOString().slice(0,7);
  const [refYear, refMonth] = ref.split("-").map(Number);
  let total = 0;
  for (let i = 1; i <= months; i++) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const { start, end } = getMonthBounds(monthKey);
    const monthSpend = (txns||[])
      .filter(t => t.type === "expense" && !t.isBillPayment && t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + Number(t.amount||0), 0);
    total += monthSpend;
  }
  return months > 0 ? total / months : 0;
};

/**
 * Builds a chronological list of balance-changing events (unpaid Bills + pending Expected Income)
 * within the given day window from today, with a running balance after each event. This is the
 * "Timeline" behind O014's Today/Tomorrow/7-Day/30-Day/Month-End views — each of those is just a
 * slice of this same timeline, not a separate calculation (per O014's spec).
 *
 * @param {number} openingBalance
 * @param {Array} bills
 * @param {Array} expectedIncome
 * @param {number} days - how many days forward to project (default 30)
 * @param {Object} refundTotalsByBill
 * @returns {Array<{date, label, amount, runningBalance}>}
 */
export const buildCashFlowTimeline = (openingBalance, bills, expectedIncome, days = 30, refundTotalsByBill = {}) => {
  if (typeof openingBalance !== "number" || Number.isNaN(openingBalance)) return [];
  const todayStr = new Date().toISOString().slice(0,10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const horizonStr = horizon.toISOString().slice(0,10);

  const billEvents = (bills||[])
    .filter(b => b.status !== "paid" && b.dueDate >= todayStr && b.dueDate <= horizonStr)
    .map(b => ({
      date: b.dueDate, label: b.name || "Bill",
      amount: -Math.max(0, Number(b.amount||0) - (refundTotalsByBill[b.id]||0)),
    }));

  const incomeEvents = (expectedIncome||[])
    .filter(e => e.status !== "received" && e.nextDate >= todayStr && e.nextDate <= horizonStr)
    .map(e => ({ date: e.nextDate, label: e.name || "Income", amount: Number(e.amount||0) }));

  const sorted = [...billEvents, ...incomeEvents].sort((a,b) => a.date.localeCompare(b.date));

  let running = openingBalance;
  return sorted.map(ev => {
    running += ev.amount;
    return { ...ev, runningBalance: running };
  });
};

/**
 * Walks a timeline (from buildCashFlowTimeline) and detects whether the running balance dips
 * below zero at ANY point - not just whether the final/month-end balance is negative. This is
 * the exact distinction O016 (Alerts) needs: a month can end healthy while still going negative
 * for a few days in between, and that's the case worth alerting on.
 *
 * @param {Array} timeline - output of buildCashFlowTimeline
 * @returns {{ negative: boolean, firstNegativeDate: string|null, firstNegativeAmount: number|null }}
 */
export const hasTransientNegativeBalance = (timeline) => {
  const firstNegative = (timeline||[]).find(ev => ev.runningBalance < 0);
  return {
    negative: Boolean(firstNegative),
    firstNegativeDate: firstNegative?.date || null,
    firstNegativeAmount: firstNegative ? firstNegative.runningBalance : null,
  };
};
