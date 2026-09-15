// ACC-002 WP-02 — Stored-shape -> Account hydration (Step 2).
//
// Per the ACC-REVIEW-001 trace: migrateLegacyAccount() is a one-time
// migration operation, not a reusable hydration boundary — it goes through
// Account.create(), which unconditionally raises an "AccountCreated" event.
// That's correct for actual migration (old data genuinely becoming
// ADR-035-compliant for the first time), but wrong for reconstructing an
// account that already exists every time it's opened for editing — doing so
// would misrepresent an account's history with a false "just created" event
// on every edit.
//
// accountFromStoredShape() exists specifically for that second case: it
// reconstructs an Account instance from accounts[]'s current stored shape
// via the raw Account constructor (new Account(...)), which raises no event
// at all — the correct primitive for deserializing something that already
// exists.
//
// Reuses the exact same legacy `type` -> `behavior` mapping table as
// migrateLegacyAccount() (via legacyTypeMapping.js, Step 1) — one source of
// truth, not two copies that could drift apart.
//
// Per the approved WP-02 decision on existing accounts: an unresolved
// stored `type` is never converted to Bank/Cash/anything else here. This
// function only ever reports what it found — the caller (EditAccountModal,
// Step 4) decides what to do with an unresolved result. It must never guess.

import { Account, AccountValidationError } from "./Account.js";
import { mapLegacyTypeToBehavior } from "./legacyTypeMapping.js";
import { MIGRATION_STATE } from "./migrateLegacyAccount.js";

/**
 * Hydrates one stored account record (accounts[]'s shape: `type`,
 * `accountTypeId`, `typeLabel`, `typeIcon`, `typeBucket`, plus whatever
 * behavior-specific fields the record has) into an Account instance,
 * without raising any domain event.
 *
 * Returns one of:
 *   - { status: "hydrated", account: <Account instance> }
 *   - { status: "unresolved", migrationState: "NEEDS_BEHAVIOR", stored, classificationLabel }
 *       — the stored `type` doesn't match any of the 5 built-in behaviors.
 *         Never guessed, never converted. The stored record itself is
 *         untouched — this function does not mutate its input.
 *   - { status: "unresolved", migrationState: "INVALID_DATA", stored, reason }
 *       — the stored `type` maps to a real behavior, but the record fails
 *         some OTHER Account invariant (e.g. a debit account somehow
 *         missing linkedBank). Mirrors migrateLegacyAccount()'s existing
 *         two-failure-mode contract, so callers already handling one
 *         handle both the same way.
 */
export function accountFromStoredShape(stored) {
  const behavior = mapLegacyTypeToBehavior(stored.type);

  if (!behavior) {
    return {
      status: "unresolved",
      migrationState: MIGRATION_STATE.NEEDS_BEHAVIOR,
      stored,
      classificationLabel: stored.typeLabel ?? stored.accountTypeId ?? stored.type ?? "Unknown",
    };
  }

  try {
    const account = new Account({
      ...stored,
      behavior,
      classificationId: stored.accountTypeId ?? stored.type,
      classificationLabel: stored.typeLabel ?? null,
      icon: stored.typeIcon ?? null,
      bucket: stored.typeBucket ?? null,
    });
    return { status: "hydrated", account };
  } catch (err) {
    if (err instanceof AccountValidationError) {
      return {
        status: "unresolved",
        migrationState: MIGRATION_STATE.INVALID_DATA,
        stored,
        reason: err.message,
      };
    }
    throw err; // Genuinely unexpected error — do not swallow.
  }
}
