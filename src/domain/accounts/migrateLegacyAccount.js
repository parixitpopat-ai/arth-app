// ACC-002 WP-02a — Legacy account migration.
//
// Answers: "How does a legacy account become ADR-035 compliant without
// changing its meaning?" — a deterministic transformation, not a rewrite.
//
// Per ADR-035's implementation note: a classification without a behavior is
// a valid migration state, but not a valid steady state. This module NEVER
// constructs an Account for data it can't confidently map — Account.js's
// invariant (behavior must be in the closed enum, no exceptions) stays
// exactly as strict as frozen. Legacy data that can't be mapped is returned
// as an explicit unresolved record instead, never guessed into existence.
//
// Two failure modes are treated differently, per the migration decision
// table:
//   - INVALID_DATA: the legacy `type` maps deterministically to a behavior,
//     but the record fails some OTHER Account invariant (e.g. a debit
//     account with no linkedBank). This is a real data-integrity problem
//     in the existing store, not a behavior-mapping ambiguity — surfaced
//     with the real validation error, not silently dropped.
//   - NEEDS_BEHAVIOR: the legacy `type` doesn't match any of the 5
//     built-in values at all (a user-defined custom behavior with no
//     mapping — see ADR-035's origin discovery). Never inferred from the
//     name, never defaulted to "bank". Requires an explicit decision,
//     which is WP-02b's job (resolution UX), not this module's.

import { Account, AccountValidationError } from "./Account.js";

// Deterministic mapping for the 5 built-in legacy `type` values — matches
// ACC_TYPES exactly. Per the migration decision table: High confidence,
// built-in types were always unambiguous 1:1.
const BUILT_IN_TYPE_TO_BEHAVIOR = {
  bank: "bank",
  cash: "cash",
  cc: "cc",
  debit: "debit",
  upi: "upi",
};

export const MIGRATION_STATE = {
  NEEDS_BEHAVIOR: "NEEDS_BEHAVIOR",
  INVALID_DATA: "INVALID_DATA",
};

/**
 * Migrates one legacy account record (App.jsx's stored shape: `type`,
 * `accountTypeId`, `typeLabel`, `typeIcon`, `typeBucket`, plus whatever
 * behavior-specific fields the record already has) to either:
 *   - { status: "migrated", account: <Account instance> }
 *   - { status: "unresolved", migrationState, legacy, ...details }
 */
export function migrateLegacyAccount(legacy) {
  const behavior = BUILT_IN_TYPE_TO_BEHAVIOR[legacy.type];

  if (!behavior) {
    // Per ADR-035: do not guess. Not "everything becomes bank", not
    // inferred from the classification label/name. Recorded as a valid
    // migration state, not a valid steady state.
    return {
      status: "unresolved",
      migrationState: MIGRATION_STATE.NEEDS_BEHAVIOR,
      legacy,
      classificationLabel: legacy.typeLabel ?? legacy.accountTypeId ?? legacy.type ?? "Unknown",
    };
  }

  try {
    const account = Account.create({
      ...legacy,
      behavior,
      classificationId: legacy.accountTypeId ?? legacy.type,
      classificationLabel: legacy.typeLabel ?? null,
      icon: legacy.typeIcon ?? null,
      bucket: legacy.typeBucket ?? null,
    });
    return { status: "migrated", account };
  } catch (err) {
    if (err instanceof AccountValidationError) {
      // Deterministic behavior mapping succeeded, but some other invariant
      // failed (e.g. debit with no linkedBank) — a real data problem in the
      // existing store, distinct from a behavior-mapping ambiguity.
      return {
        status: "unresolved",
        migrationState: MIGRATION_STATE.INVALID_DATA,
        legacy,
        reason: err.message,
      };
    }
    throw err; // Genuinely unexpected error — do not swallow.
  }
}

/**
 * Migrates a full array of legacy accounts, per the MigrationResult shape:
 * migratedAccounts, unresolvedAccounts, warnings — deterministic,
 * testable, repeatable. No mutation of the input array.
 */
export function migrateLegacyAccounts(legacyAccounts) {
  const migratedAccounts = [];
  const unresolvedAccounts = [];
  const warnings = [];

  for (const legacy of legacyAccounts) {
    const result = migrateLegacyAccount(legacy);
    if (result.status === "migrated") {
      migratedAccounts.push(result.account);
    } else {
      unresolvedAccounts.push(result);
      warnings.push(
        result.migrationState === MIGRATION_STATE.NEEDS_BEHAVIOR
          ? `Account "${legacy.name || legacy.id}" has no recognized behavior (legacy type: "${legacy.type}") — needs a decision before it can be used as an Account.`
          : `Account "${legacy.name || legacy.id}" failed migration: ${result.reason}`
      );
    }
  }

  return { migratedAccounts, unresolvedAccounts, warnings };
}

/**
 * WP-02a Validation Pass — produces a MigrationReport summarizing the
 * outcome of migrateLegacyAccounts() against a real (or representative)
 * account dataset, without exposing individual account identity/name in
 * the summary counts. Intended to answer one question before WP-02b is
 * even considered: does this repo's real data actually contain any
 * NEEDS_BEHAVIOR or INVALID_DATA records, or does everything migrate
 * cleanly?
 *
 * Testable, loggable, suitable for telemetry or a one-time rollout check —
 * per the three possible outcomes:
 *   A. needsBehavior === 0 && invalidData === 0  -> WP-02b unnecessary,
 *      proceed straight to WP-02.
 *   B. needsBehavior === 0 && invalidData > 0    -> a data-repair problem,
 *      not a UX problem. No resolution wizard needed.
 *   C. needsBehavior > 0                          -> genuine ambiguous
 *      classifications exist. This is the only scenario where WP-02b's
 *      resolution UX is justified.
 */
export function generateMigrationReport(legacyAccounts) {
  const { migratedAccounts, unresolvedAccounts, warnings } = migrateLegacyAccounts(legacyAccounts);

  const needsBehaviorRecords = unresolvedAccounts.filter(r => r.migrationState === MIGRATION_STATE.NEEDS_BEHAVIOR);
  const invalidDataRecords = unresolvedAccounts.filter(r => r.migrationState === MIGRATION_STATE.INVALID_DATA);

  // Breakdown by classification label — the "which custom types actually
  // exist" table your review asked for — without including account id/name,
  // since a validation report is a reasonable thing to want to share/log
  // outside the immediate debugging session.
  const needsBehaviorByClassification = {};
  for (const r of needsBehaviorRecords) {
    const label = r.classificationLabel || "Unknown";
    needsBehaviorByClassification[label] = (needsBehaviorByClassification[label] || 0) + 1;
  }
  const invalidDataByReason = {};
  for (const r of invalidDataRecords) {
    invalidDataByReason[r.reason] = (invalidDataByReason[r.reason] || 0) + 1;
  }

  let scenario;
  if (needsBehaviorRecords.length === 0 && invalidDataRecords.length === 0) {
    scenario = "A"; // Everything migrates — WP-02b unnecessary
  } else if (needsBehaviorRecords.length === 0) {
    scenario = "B"; // Only invalid data — data-repair, not UX
  } else {
    scenario = "C"; // Genuine ambiguous classifications — WP-02b justified
  }

  // Report-level warnings are redacted (no account id/name) — the raw
  // `warnings` from migrateLegacyAccounts() above are for local debugging
  // only, deliberately not reused here, since this report is meant to be
  // shareable/loggable per WP-02a's validation-pass requirement.
  const reportWarnings = [
    ...needsBehaviorRecords.map(r => `Classification "${r.classificationLabel}" has no recognized behavior.`),
    ...invalidDataRecords.map(r => `A record failed migration: ${r.reason}`),
  ];

  return {
    totalAccounts: legacyAccounts.length,
    migrated: migratedAccounts.length,
    needsBehavior: needsBehaviorRecords.length,
    invalidData: invalidDataRecords.length,
    needsBehaviorByClassification,
    invalidDataByReason,
    scenario,
    warnings: reportWarnings,
  };
}
