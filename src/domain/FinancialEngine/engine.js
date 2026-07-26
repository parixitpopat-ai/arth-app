// The Financial Engine — a service, not a screen. Per the architecture decision (see
// ARCHITECTURE_DECISIONS.md ADR-017): nothing writes directly to Cash Flow. Every screen that
// shows a financial number is a view over these outputs, computed fresh from Inputs each time —
// never stored, per the "Safe to Spend = a calculation, never stored" principle (ADR-016).
//
// Inputs (all pure data, passed in — this module owns no state):
//   accounts, txns, bills, expectedIncome
//
// Outputs (this file, growing over time — see each function's status below):
//   calculateExpectedIncomeTotal  — ✅ real, Phase 1
//   calculateCommittedOutflow     — ✅ real, implemented this pass
//   calculateProjectedBalance     — ✅ real, implemented this pass
//   calculateSafeToSpend          — ✅ real, implemented this pass
//   calculateRecognition          — 🚧 stub — genuinely blocked on schema, not effort:
//                                    Bill has no recognitionMethod/recognitionDuration fields yet
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
