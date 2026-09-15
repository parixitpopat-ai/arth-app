// domain/identity/masterUserSetup.js
//
// P1 — Master User / Signup. Pure decision logic for:
//   1. "Meaningful data" detection (P1-002 §4) — deliberately excludes
//      accounts/cats/measureUnits (ship with real-looking seed data on every
//      fresh install — see DEFAULT_ACCOUNTS/DEFAULT_CATS in appConstants.js)
//      and wealthSnapshots (auto-records once per calendar day regardless of
//      user activity — App.jsx's daily-snapshot effect).
//   2. The first-auth migration matrix (P1-002 §5) — which action to take
//      the first time a given device authenticates against a given account.
//      This function is NOT used for the ordinary returning-session path
//      (an already-restored Supabase session skips this entirely and uses
//      the existing pullCloudSnapshot/offline-capable behavior unchanged).
//
// No React, no Supabase, no App.jsx state — everything here takes plain
// data in and returns plain values out, so it's fully unit-testable.

// Deliberately excludes accounts/cats/measureUnits/wealthSnapshots — see
// file header. These are the only arrays in the snapshot shape that never
// carry seed or auto-generated data; presence of any one of them is real
// user-created Arth activity.
export const MEANINGFUL_ARRAY_KEYS = [
  "txns", "investments", "bills", "loans",
  "memberships", "feePayments", "gifts", "goals",
];

/**
 * @param {Object} stateLike - an object with some/all of MEANINGFUL_ARRAY_KEYS
 *   as array-valued properties (a live App state slice or a cloud snapshot).
 * @returns {boolean} true if the state contains any substantive user-created
 *   Arth record. Never inspects accounts/cats/measureUnits/wealthSnapshots.
 */
export function hasMeaningfulData(stateLike) {
  if (!stateLike || typeof stateLike !== "object") return false;
  return MEANINGFUL_ARRAY_KEYS.some(
    key => Array.isArray(stateLike[key]) && stateLike[key].length > 0
  );
}

/**
 * @param {Object} snapshotLike - a cloud snapshot or equivalent local state.
 * @returns {boolean} the explicit masterUserSetupComplete flag, read as-is.
 *   Deliberately does NOT infer completion from name/emoji/relation or
 *   equality with the hardcoded ME constant — P1-002 §3 establishes this is
 *   unreliable (confirmed: the one live account's Master User record is
 *   {name:"Me", emoji:"👤"}, not even byte-identical to the hardcoded
 *   default, yet was never genuinely set up).
 */
export function isMasterUserSetupComplete(snapshotLike) {
  return Boolean(snapshotLike?.masterUserSetupComplete);
}

export const FIRST_AUTH_ACTIONS = Object.freeze({
  SETUP: "setup",                             // both sides empty
  PUSH_LOCAL_THEN_SETUP: "push-local-then-setup", // local meaningful, cloud empty/new
  PULL_CLOUD_THEN_CHECK: "pull-cloud-then-check", // local empty, cloud meaningful
  CONFLICT: "conflict",                       // both meaningful
  BLOCKED_OFFLINE: "blocked-offline",         // cloud state unknown, no trustworthy local fallback
});

/**
 * The first-auth migration matrix (P1-002 §5), as a pure function.
 *
 * @param {Object} params
 * @param {boolean} params.networkOk - whether the cloud snapshot fetch for
 *   this account succeeded (false = fetch threw/timed out/offline).
 * @param {boolean} params.cloudRowExists - whether a snapshot row exists at
 *   all for this account (false = brand-new signup, nothing to pull).
 * @param {boolean} params.cloudMeaningful - hasMeaningfulData() on the
 *   fetched cloud snapshot. Ignored if cloudRowExists is false.
 * @param {boolean} params.localMeaningful - hasMeaningfulData() on this
 *   device's current local state.
 * @returns {string} one of FIRST_AUTH_ACTIONS. When networkOk is false,
 *   always returns BLOCKED_OFFLINE — per P1-002 §5/§7, this function is
 *   only ever called for a device with no trustworthy local fallback in the
 *   first place (a device WITH trustworthy local state that goes offline
 *   uses the existing, unmodified offline-capable path and never reaches
 *   this function — that branch is decided in the caller, not here).
 */
export function determineFirstAuthAction({ networkOk, cloudRowExists, cloudMeaningful, localMeaningful }) {
  if (!networkOk) return FIRST_AUTH_ACTIONS.BLOCKED_OFFLINE;

  const cloudHasData = Boolean(cloudRowExists) && Boolean(cloudMeaningful);

  if (!localMeaningful && !cloudHasData) return FIRST_AUTH_ACTIONS.SETUP;
  if (localMeaningful && !cloudHasData) return FIRST_AUTH_ACTIONS.PUSH_LOCAL_THEN_SETUP;
  if (!localMeaningful && cloudHasData) return FIRST_AUTH_ACTIONS.PULL_CLOUD_THEN_CHECK;
  return FIRST_AUTH_ACTIONS.CONFLICT;
}

/**
 * Builds the small, non-financial summary shown on the conflict-resolution
 * screen (P1-002 §6) — counts only, never raw record content.
 * @param {Object} stateLike
 * @returns {Object<string, number>} e.g. { txns: 12, investments: 0, ... }
 */
export function summarizeMeaningfulData(stateLike) {
  const summary = {};
  for (const key of MEANINGFUL_ARRAY_KEYS) {
    summary[key] = Array.isArray(stateLike?.[key]) ? stateLike[key].length : 0;
  }
  return summary;
}

/**
 * Master User profile fields collected by MasterUserProfileScreen
 * (P1-002 final review: name, emoji, phone, dob — no relation/personType/
 * creditLimit/spendBudget/favorite/modules/color/anniversary/notes/email).
 * Profile email is deliberately excluded: the authenticated Supabase email
 * remains the canonical account identity and is never treated as ordinary
 * Person email (final review rule #1).
 */
export const MASTER_USER_PROFILE_FIELDS = ["name", "emoji", "phone", "dob"];

/**
 * Merges only MASTER_USER_PROFILE_FIELDS onto the existing __me__ record —
 * a deliberate partial merge, not a full overwrite like EditPersonModal's
 * save(). Every other existing field (relation, personType, creditLimit,
 * spendBudget, favorite, modules, color, email, anniversary, notes,
 * sectionOrder, etc.) passes through untouched.
 *
 * @param {Object} existingMePerson - the current people[] record with isMe.
 * @param {Object} fields - subset of { name, emoji, phone, dob }.
 * @returns {Object} the next __me__ record, with masterUserSetupComplete
 *   NOT set here — the caller sets that flag separately at the App level,
 *   since it belongs on the snapshot, not on the person record (P1-002 §3).
 */
export function mergeMasterUserProfileFields(existingMePerson, fields) {
  const next = { ...(existingMePerson || {}) };
  for (const key of MASTER_USER_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields || {}, key)) {
      next[key] = fields[key];
    }
  }
  return next;
}
