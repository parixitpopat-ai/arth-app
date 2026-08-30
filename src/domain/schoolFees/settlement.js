// domain/schoolFees/settlement.js
//
// Pure functions for I-5 WP-5 (settlement / payment allocation). No state,
// no side effects, no persistence, no Transaction creation, no Bills/
// Membership/getCommitments() interaction. This module never creates a
// transaction — it takes an already-created, real txnId as input and
// computes how that payment distributes across the selected periods. The
// caller (a future UI/service layer) is responsible for actually creating
// the Transaction record; keeping that outside this module is what makes
// "do not create synthetic transactions" true by construction, not by
// convention.
//
// Locked rules this module enforces:
// - selecting multiple periods and computing their combined outstanding
//   total is the starting point, always computed fresh, never cached;
// - if actualAmount equals the selected total, allocation is fully
//   deterministic — each period receives exactly its own outstanding, no
//   prompt, no ambiguity to resolve;
// - if actualAmount differs, explicit per-period allocations are REQUIRED —
//   this module never guesses, splits proportionally, or applies oldest-
//   first; it throws if allocations aren't supplied;
// - no allocation may exceed the period's own outstanding balance — over-
//   allocation is rejected outright, never capped or silently redistributed;
// - allocations must sum exactly to actualAmount — a mismatch is rejected,
//   not adjusted;
// - a period that receives a partial allocation stays partially outstanding
//   — nothing here ever marks a period "settled" by fiat, "settled" is
//   always just calculateOutstanding(period) === 0, read live;
// - every touched period's settlementLinks[] grows by exactly one entry
//   ({txnId, amount}) — this is the only record of what this settlement
//   did, and it's per-period, never a single blob covering the whole
//   multi-period action.

import { calculateOutstanding } from "./outstanding.js";

/**
 * Sum of currently-outstanding amounts across a set of selected periods.
 *
 * @param {Array} periods - the full feePeriods[] collection
 * @param {Array<string>} periodIds - ids of the periods being selected
 * @returns {number} combined outstanding total
 * @throws {Error} if any id doesn't exist, or if any selected period has
 *   zero outstanding already — selecting an already-settled period is
 *   treated as a caller error, not silently ignored.
 */
export function calculateSelectedOutstandingTotal(periods, periodIds) {
  if (!Array.isArray(periodIds) || periodIds.length === 0) {
    throw new Error("calculateSelectedOutstandingTotal: at least one periodId is required");
  }
  let total = 0;
  for (const id of periodIds) {
    const period = periods.find(p => p.id === id);
    if (!period) throw new Error(`calculateSelectedOutstandingTotal: period ${id} not found`);
    if (!period.startingStateDeclared) {
      throw new Error(`calculateSelectedOutstandingTotal: period ${id} has not been declared yet (WP-3) — its status is unknown, it cannot be selected until declared`);
    }
    const out = calculateOutstanding(period);
    if (out <= 0) throw new Error(`calculateSelectedOutstandingTotal: period ${id} has no outstanding balance — nothing to select`);
    total += out;
  }
  return total;
}

/**
 * Resolve the final per-period allocation for a settlement, without applying
 * it — same validation as settleFeePeriods, extracted so the application
 * layer can get the resolved {periodId, amount}[] BEFORE creating the real
 * Transaction (needed to attach the correct reverse link on the transaction
 * itself, including in the deterministic case where the caller doesn't
 * already know the per-period split). settleFeePeriods calls this
 * internally — behavior is identical, this is a pure extraction.
 *
 * @returns {Array<{periodId:string, amount:number}>} the resolved
 *   allocation, one entry per selected period, in periodIds order (or
 *   allocations order in the explicit case). May include zero-amount
 *   entries for periods selected but given nothing — same as before.
 * @throws {Error} identical conditions to settleFeePeriods.
 */
export function resolveSettlementAllocations(periods, periodIds, actualAmount, allocations = null) {
  if (!Array.isArray(periodIds) || periodIds.length === 0) {
    throw new Error("resolveSettlementAllocations: at least one periodId is required");
  }
  if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
    throw new Error("resolveSettlementAllocations: actualAmount must be a positive number");
  }

  const outstandingByPeriod = new Map();
  for (const id of periodIds) {
    const period = periods.find(p => p.id === id);
    if (!period) throw new Error(`resolveSettlementAllocations: period ${id} not found`);
    if (!period.startingStateDeclared) {
      throw new Error(`resolveSettlementAllocations: period ${id} has not been declared yet (WP-3) — its status is unknown, it cannot be settled until declared`);
    }
    const out = calculateOutstanding(period);
    if (out <= 0) throw new Error(`resolveSettlementAllocations: period ${id} has no outstanding balance — nothing to settle`);
    outstandingByPeriod.set(id, out);
  }
  const selectedTotal = [...outstandingByPeriod.values()].reduce((s, v) => s + v, 0);

  const EPS = 1e-9;

  if (Math.abs(actualAmount - selectedTotal) < EPS) {
    // Deterministic case — no prompt needed, no ambiguity. Each period
    // receives exactly its own outstanding amount.
    return periodIds.map(id => ({ periodId: id, amount: outstandingByPeriod.get(id) }));
  }

  if (!Array.isArray(allocations)) {
    throw new Error(
      `resolveSettlementAllocations: actualAmount (${actualAmount}) differs from the selected outstanding total (${selectedTotal}) — explicit per-period allocations are required, none were provided`
    );
  }
  const allocIds = allocations.map(a => a.periodId).slice().sort();
  const selectedIds = periodIds.slice().sort();
  if (JSON.stringify(allocIds) !== JSON.stringify(selectedIds)) {
    throw new Error("resolveSettlementAllocations: allocations must cover exactly the selected periods — no more, no less");
  }
  let allocSum = 0;
  for (const a of allocations) {
    if (!Number.isFinite(a.amount) || a.amount < 0) {
      throw new Error(`resolveSettlementAllocations: allocation for ${a.periodId} must be a non-negative number`);
    }
    const cap = outstandingByPeriod.get(a.periodId);
    if (a.amount - cap > EPS) {
      throw new Error(`resolveSettlementAllocations: allocation for ${a.periodId} (${a.amount}) exceeds its outstanding balance (${cap}) — refusing to over-allocate`);
    }
    allocSum += a.amount;
  }
  if (Math.abs(allocSum - actualAmount) > EPS) {
    throw new Error(`resolveSettlementAllocations: allocations sum to ${allocSum}, but actualAmount is ${actualAmount} — they must match exactly, nothing was auto-adjusted`);
  }
  return allocations;
}

/**
 * Settle one or more selected fee periods against a single actual payment.
 *
 * @param {Array} periods - the full feePeriods[] collection (only selected
 *   ids are touched; everything else passes through unchanged)
 * @param {Array<string>} periodIds - ids of the periods being settled
 * @param {number} actualAmount - the real amount actually paid
 * @param {string} txnId - id of the already-created, real Transaction this
 *   settlement is for. This module never creates one itself.
 * @param {Array<{periodId:string, amount:number}>} [allocations] - required
 *   ONLY when actualAmount differs from the selected outstanding total.
 *   Must cover exactly the selected periods (no more, no less), each
 *   amount non-negative and not exceeding that period's own outstanding,
 *   summing exactly to actualAmount.
 * @returns {Array} a new periods array — same length/order as the input,
 *   with touched periods replaced by updated copies. Never mutates input.
 * @throws {Error} on any invalid input — never caps, redistributes, or
 *   guesses its way to a valid result.
 */
export function settleFeePeriods(periods, periodIds, actualAmount, txnId, allocations = null) {
  if (!txnId) {
    throw new Error("settleFeePeriods: txnId is required — this module never creates a transaction, it links to one that already exists");
  }

  const finalAllocations = resolveSettlementAllocations(periods, periodIds, actualAmount, allocations);
  const allocByPeriod = new Map(finalAllocations.map(a => [a.periodId, a.amount]));

  return periods.map(period => {
    if (!allocByPeriod.has(period.id)) return period;
    const amount = allocByPeriod.get(period.id);
    if (amount === 0) return period; // selected but chose to apply nothing here — a real, valid case; no-op, no link recorded
    return {
      ...period,
      paidAmount: (period.paidAmount || 0) + amount,
      settlementLinks: [...(period.settlementLinks || []), { txnId, amount }],
    };
  });
}
