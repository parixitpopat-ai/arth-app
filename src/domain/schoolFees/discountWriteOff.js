// domain/schoolFees/discountWriteOff.js
//
// Pure functions for I-5 WP-6 (discount / write-off). No state, no side
// effects, no persistence, no Transaction creation. Discount and write-off
// are separate semantic actions per decision #6 — this module keeps them as
// two distinct functions rather than one parameterized one, so a caller
// can never accidentally conflate them.
//
// Locked rules:
// - each action requires a reason (decision #6's "user specifies the
//   amount being discounted/written off" implies accountability — a reason
//   is required, not optional, so there's always a stated basis for it);
// - neither action touches paidAmount — discount/write-off reduce what's
//   outstanding without pretending money changed hands;
// - neither action may exceed what's currently outstanding at the time of
//   the action — rejected outright, never capped;
// - every application is recorded in its own audit array (discountEntries /
//   writeOffEntries) — the aggregate field (discountAmount/writeOffAmount)
//   stays the arithmetic source of truth for calculateOutstanding, the
//   entries array exists purely so "why" is never lost, matching the
//   traceability decision #6 implies.

import { calculateOutstanding } from "./outstanding.js";

function applyReduction(period, amount, reason, field, entriesField, label) {
  if (!period || typeof period !== "object") {
    throw new Error(`${label}: a period object is required`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label}: amount must be a positive number`);
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error(`${label}: a reason is required`);
  }
  if (!period.startingStateDeclared) {
    throw new Error(`${label}: this period has not been declared yet (WP-3) — its status is unknown, it cannot be discounted/written off until declared`);
  }
  const currentOutstanding = calculateOutstanding(period);
  const EPS = 1e-9;
  if (amount - currentOutstanding > EPS) {
    throw new Error(`${label}: amount (${amount}) exceeds current outstanding (${currentOutstanding}) — refusing to over-reduce`);
  }

  return {
    ...period,
    [field]: (period[field] || 0) + amount,
    [entriesField]: [...(period[entriesField] || []), { amount, reason, appliedAt: Date.now() }],
  };
}

/**
 * Apply a discount to a fee period's outstanding balance.
 * @throws {Error} if amount is invalid, reason is missing, or amount
 *   exceeds the period's current outstanding balance.
 */
export function applyDiscount(period, amount, reason) {
  return applyReduction(period, amount, reason, "discountAmount", "discountEntries", "applyDiscount");
}

/**
 * Apply a write-off to a fee period's outstanding balance.
 * @throws {Error} same conditions as applyDiscount.
 */
export function applyWriteOff(period, amount, reason) {
  return applyReduction(period, amount, reason, "writeOffAmount", "writeOffEntries", "applyWriteOff");
}
