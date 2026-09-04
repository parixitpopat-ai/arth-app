// src/screens/SchoolFeesScreen.helpers.js
//
// PPL-006 WP-4 — pure-function extraction of AddSchoolYearModal's Person/
// biller-account resolution logic, so it's testable with plain `node --test`
// and no React/DOM harness — same discipline as BudgetInsights.helpers.js.
// AddSchoolYearModal itself calls this and applies the result; this file
// contains no state, no JSX, and creates nothing itself — it only decides
// what SHOULD exist and returns instructions for the caller to act on.

import { createSchoolRelationship, endSchoolRelationship, isSchoolRelationshipCurrent } from "../domain/school/relationship.js";
import { todayStr } from "../helpers/dateHelpers.js";

/**
 * Given a selected person (or none) and the app's existing billerAccounts/
 * schoolRelationships collections, decide what School identity to use for
 * a new fee schedule — reusing an existing "School Fees" biller account +
 * relationship for that person if one already exists (same reuse-before-
 * create discipline as AddMembershipModal), or describing what new records
 * to create if not. Never creates a Person, never requires one — per the
 * locked "financial attribution != saved Person" invariant, `personId` may
 * be falsy, in which case this returns the "no attribution" result exactly
 * matching today's pre-WP-4 behaviour (both ids null, nothing to create).
 *
 * @param {Object} params
 * @param {string} [params.personId] - falsy means "not linked to a saved person"
 * @param {string} params.schoolName - used only as the NEW biller account's
 *   display name if one needs to be created; ignored when reusing an existing one
 * @param {string} params.startDate - passed through to createSchoolRelationship
 *   if a new relationship needs to be created
 * @param {Array} params.billerAccounts - existing billerAccounts[] collection, untouched
 * @param {Array} params.schoolRelationships - existing schoolRelationships[] collection, untouched
 * @param {function} params.genId - id generator, injected
 * @returns {{
 *   billerAccountId: string|null,
 *   newBillerAccount: object|null,
 *   newRelationship: object|null,
 * }} billerAccountId is what the fee schedule should reference (or null for
 *   "not linked"). newBillerAccount/newRelationship are non-null only when
 *   this call determined a genuinely new record is needed — the caller
 *   (AddSchoolYearModal) is responsible for actually adding them to state;
 *   this function never mutates or writes anything itself.
 */
export function resolveSchoolAttribution({ personId, schoolName, startDate, billerAccounts, schoolRelationships, genId }) {
  if (!personId) {
    return { billerAccountId: null, newBillerAccount: null, newRelationship: null };
  }
  if (typeof genId !== "function") {
    throw new Error("resolveSchoolAttribution: genId is required when personId is provided");
  }

  const existingAccount = (billerAccounts || []).find(ba =>
    ba && ba.type === "School Fees" && ba.attributeType === "person" && String(ba.attributedTo) === String(personId)
  );

  let billerAccountId;
  let newBillerAccount = null;
  if (existingAccount) {
    billerAccountId = existingAccount.id;
  } else {
    newBillerAccount = {
      id: genId(), billerId: null, name: (schoolName || "").trim(), type: "School Fees",
      consumerNo: "", provider: "", attributedTo: personId, attributeType: "person",
      note: "", createdAt: Date.now(),
    };
    billerAccountId = newBillerAccount.id;
  }

  const existingRel = (schoolRelationships || []).find(r =>
    r && r.billerAccountId === billerAccountId && r.personId === personId
  );
  const newRelationship = existingRel
    ? null
    : createSchoolRelationship({ billerAccountId, personId, startDate, genId });

  return { billerAccountId, newBillerAccount, newRelationship };
}

// --- PPL-006 WP-6 -----------------------------------------------------------
//
// The single, shared function behind BOTH reachable ways to change a School
// Fees biller account's Person attribution:
//   1. The School-specific "Change Person" UI in SchoolFeeScheduleDetailModal.
//   2. The generic BillerAccountModal's own edit path (the "escape hatch"
//      found during WP-6's trace — a School Fees account is a normal biller
//      account and was fully reachable through the generic edit screen with
//      zero awareness that schoolRelationships[] existed).
// Both call sites use this one function so the business rule — what's safe,
// what's refused, what happens to the relationship — is defined exactly
// once, per your explicit "no duplicated business rule" decision.

/**
 * Is this biller account referenced by more than one feeSchedules record?
 * Per the frozen decision: a shared account's attribution must never be
 * silently moved, because that would move every schedule referencing it,
 * not just the one being edited.
 *
 * @param {string} billerAccountId
 * @param {Array} feeSchedules
 * @param {string} [excludeScheduleId] - the schedule currently being edited
 *   (if editing via Path A) — excluded from the count, since it's expected
 *   to reference this billerAccountId and isn't "another" schedule sharing it.
 * @returns {boolean}
 */
export function isBillerAccountSharedAcrossSchedules(billerAccountId, feeSchedules, excludeScheduleId) {
  if (!billerAccountId) return false;
  const referencing = (feeSchedules || []).filter(fs => fs && fs.billerAccountId === billerAccountId);
  if (excludeScheduleId) {
    // We know exactly which schedule we're operating on (Guard 1 — editing
    // a specific schedule's attribution) — "shared" means at least one
    // OTHER schedule also references this account.
    return referencing.some(fs => fs.id !== excludeScheduleId);
  }
  // No specific schedule in context (Guard 2 — editing the biller account
  // directly) — a single referencing schedule is the normal, expected
  // case. "Shared" means MORE THAN ONE schedule currently references it.
  return referencing.length > 1;
}

/**
 * Attempt to change a School Fees biller account's Person attribution —
 * the shared decision logic for both Guard 1 (School-specific edit) and
 * Guard 2 (generic BillerAccount edit). Never creates a new biller account
 * (unlike resolveSchoolAttribution, which is only for schedule CREATION) —
 * this operates on an EXISTING account's attribution only. Never touches
 * billerAccountId itself, never touches feeSchedules/feePeriods financial
 * fields, never touches txns — those stay structurally out of reach because
 * this function has no parameter or return value capable of referencing them.
 *
 * @param {Object} params
 * @param {string} params.billerAccountId - the EXISTING biller account being reattributed
 * @param {string|null} params.currentPersonId - who it's attributed to now (null = unattributed)
 * @param {string|null} params.targetPersonId - who it should be attributed to (null = unlink)
 * @param {string} [params.excludeScheduleId] - see isBillerAccountSharedAcrossSchedules
 * @param {string} params.startDate - passed through if a new relationship needs creating
 * @param {Array} params.feeSchedules
 * @param {Array} params.schoolRelationships
 * @param {function} params.genId
 * @returns {{
 *   ok: boolean,
 *   error: string|null,
 *   attributedTo: string|null,
 *   attributeType: string|null,
 *   endedRelationship: object|null,
 *   newOrReusedRelationship: object|null,
 * }} attributedTo/attributeType are the NEW values the caller should write
 *   onto the biller account (only meaningful when ok===true). endedRelationship
 *   is the OLD relationship, now ended (caller replaces it in schoolRelationships[]
 *   with this returned object). newOrReusedRelationship is non-null only when a
 *   genuinely NEW relationship was created (caller appends it) — null when an
 *   existing current one was reused (nothing to append) or when unlinking.
 */
export function attemptSchoolAttributionChange({
  billerAccountId, currentPersonId, targetPersonId, excludeScheduleId,
  startDate, feeSchedules, schoolRelationships, genId,
}) {
  if (!billerAccountId) {
    throw new Error("attemptSchoolAttributionChange: billerAccountId is required");
  }
  const normalizedCurrent = currentPersonId || null;
  const normalizedTarget = targetPersonId || null;

  if (normalizedCurrent === normalizedTarget) {
    return { ok: true, error: null, attributedTo: normalizedCurrent, attributeType: normalizedCurrent ? "person" : null, endedRelationship: null, newOrReusedRelationship: null };
  }

  if (isBillerAccountSharedAcrossSchedules(billerAccountId, feeSchedules, excludeScheduleId)) {
    return {
      ok: false,
      error: "This School account is shared with another fee schedule — separate them first before changing who it's linked to.",
      attributedTo: null, attributeType: null, endedRelationship: null, newOrReusedRelationship: null,
    };
  }

  // End the current relationship, if one exists for the pairing being replaced.
  // Per relationship.js's own documented pattern: end-old + create-new, never
  // resurrect or edit an ended relationship's identity in place.
  let endedRelationship = null;
  if (normalizedCurrent) {
    const currentRel = (schoolRelationships || []).find(r =>
      r && r.billerAccountId === billerAccountId && r.personId === normalizedCurrent && isSchoolRelationshipCurrent(r.statusHistory, todayStr())
    );
    if (currentRel) {
      endedRelationship = endSchoolRelationship(currentRel, "Person attribution changed", todayStr());
    }
  }

  if (!normalizedTarget) {
    // Unlinking — the legitimate "Not linked to a saved person" state.
    return { ok: true, error: null, attributedTo: null, attributeType: null, endedRelationship, newOrReusedRelationship: null };
  }

  // Reuse an existing CURRENT relationship for the new pairing if one
  // already exists (e.g., re-linking to a school the person was previously
  // linked to) — deliberately stricter than resolveSchoolAttribution's
  // find-any-status reuse check, since WP-6 is the first caller where an
  // ended relationship for the same pairing can realistically already
  // exist. Reusing an ended one would be wrong — a fresh relationship,
  // with its own new start date, is correct here.
  const existingCurrentRel = (schoolRelationships || []).find(r =>
    r && r.billerAccountId === billerAccountId && r.personId === normalizedTarget && isSchoolRelationshipCurrent(r.statusHistory, todayStr())
  );
  const newOrReusedRelationship = existingCurrentRel
    ? null
    : createSchoolRelationship({ billerAccountId, personId: normalizedTarget, startDate, genId });

  return { ok: true, error: null, attributedTo: normalizedTarget, attributeType: "person", endedRelationship, newOrReusedRelationship };
}

/**
 * Person -> School click-through (final acceptance item). Given the
 * schedules a relationship resolves to (via the already-tested
 * getFeeSchedulesForRelationship), pick the "most recent/current" one when
 * more than one matches — no picker, per explicit product decision. "Most
 * recent" is defined as the latest schoolYearEnd, not createdAt — schedules
 * for the same school are almost always sequential academic years, and
 * schoolYearEnd is the more semantically correct measure of "current" than
 * creation order (which could, in principle, differ from chronological
 * order for backfilled/historical data).
 *
 * @param {Array} schedules - feeSchedules[] entries already filtered to one relationship
 * @returns {Object|null} the schedule with the latest schoolYearEnd, or null if empty
 */
export function pickMostRecentSchedule(schedules) {
  if (!schedules || schedules.length === 0) return null;
  return schedules.slice().sort((a, b) => (b.schoolYearEnd || "").localeCompare(a.schoolYearEnd || ""))[0];
}
