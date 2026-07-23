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
//   calculateCommittedOutflow     — 🚧 stub, Phase 2 (Bills integration)
//   calculateProjectedBalance     — 🚧 stub, Phase 3
//   calculateSafeToSpend          — 🚧 stub, Phase 3
//   calculateRecognition          — 🚧 stub, later (Recognition-as-Bill-property)
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
 * STUB — Phase 2. Will read unpaid Bills due within the given month and sum them, per ADR-016
 * ("Cash Flow consumes Bills, not a new Commitments entity"). Returns 0 until Bills integration
 * lands — deliberately not estimated or guessed at now, so nothing downstream silently assumes a
 * real number where there isn't one yet.
 */
export const calculateCommittedOutflow = (_bills, _monthKey) => 0;

/**
 * STUB — Phase 3. Opening Balance + Expected Income − Committed Outflow − Estimated Variable.
 * Returns null (not 0) until real, so callers can distinguish "not built yet" from "genuinely
 * zero" — a UI showing "₹0 projected balance" would be actively misleading before this is real.
 */
export const calculateProjectedBalance = (_accounts, _txns, _bills, _expectedIncome, _monthKey) => null;

/**
 * STUB — Phase 3. This does NOT replace the existing Safe Spend Today calculation already live
 * elsewhere in the app (per ADR-016, "upgrade in place, don't replace") — this is the new,
 * Financial-Engine-driven version, to be wired in once Projected Balance is real.
 */
export const calculateSafeToSpend = (_accounts, _txns, _bills, _expectedIncome, _monthKey) => null;

/**
 * STUB — later. Recognition is a property of a Bill (ADR-016), not of Transactions/Budget/Cash
 * Flow — this function will read a bill's recognitionMethod/recognitionDuration once those
 * fields exist (currently absent from the Bill record, confirmed in ADR-016).
 */
export const calculateRecognition = (_bill) => null;
