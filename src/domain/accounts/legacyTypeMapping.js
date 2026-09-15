// ACC-002 WP-02 — Shared legacy `type` -> `behavior` mapping.
//
// Factored out of migrateLegacyAccount.js during WP-02 so migrateLegacyAccount()
// and accountFromStoredShape() share one table instead of maintaining two
// copies that could silently drift apart. No behavior change from what
// migrateLegacyAccount.js already did — this is a pure extraction.
//
// Deterministic mapping for the 5 built-in legacy `type` values — matches
// ACC_TYPES exactly. Per the migration decision table: High confidence,
// built-in types were always unambiguous 1:1.

import { VALID_ACCOUNT_BEHAVIORS } from "./Account.js";

const BUILT_IN_TYPE_TO_BEHAVIOR = {
  bank: "bank",
  cash: "cash",
  cc: "cc",
  debit: "debit",
  upi: "upi",
};

/**
 * Returns the behavior a legacy `type` string maps to, or undefined if it
 * doesn't match any of the 5 built-in values. Never guesses, never falls
 * back to a default — an undefined result means the caller must treat this
 * as an explicit unresolved case, not silently pick something.
 */
export function mapLegacyTypeToBehavior(type) {
  return BUILT_IN_TYPE_TO_BEHAVIOR[type];
}

/**
 * True if `baseType` is one of the 5 closed, system-owned Account behaviors.
 * Thin wrapper on Account.js's own exported enum — used wherever App.jsx or
 * the domain layer needs to check resolution without duplicating the enum
 * check inline.
 */
export function isResolvedBehavior(baseType) {
  return VALID_ACCOUNT_BEHAVIORS.includes(baseType);
}
