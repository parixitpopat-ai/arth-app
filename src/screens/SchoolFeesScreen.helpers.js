// src/screens/SchoolFeesScreen.helpers.js
//
// PPL-006 WP-4 — pure-function extraction of AddSchoolYearModal's Person/
// biller-account resolution logic, so it's testable with plain `node --test`
// and no React/DOM harness — same discipline as BudgetInsights.helpers.js.
// AddSchoolYearModal itself calls this and applies the result; this file
// contains no state, no JSX, and creates nothing itself — it only decides
// what SHOULD exist and returns instructions for the caller to act on.

import { createSchoolRelationship } from "../domain/school/relationship.js";

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
