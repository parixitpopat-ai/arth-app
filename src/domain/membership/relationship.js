// domain/membership/relationship.js
//
// The persistent Membership relationship: Provider/Biller -> Person.
// This is a NEW, separate entity from the existing per-payment coverage
// records (still stored in memberships[], untouched by this file). The
// trace found the two are genuinely different things: a payment record
// describes what a specific payment bought; this entity describes the
// ongoing relationship that payments happen against, and carries the
// lifecycle (active/paused/ended) that relationship, not any one payment,
// owns.
//
// This module never touches memberships[], txns[], or getCommitments().
// It composes with lifecycle.js (unmodified) rather than duplicating its
// transition logic.

import { pauseMembership, resumeMembership, endMembership, getRelationshipStatusAsOfDate, isDateActiveMembershipCoverage } from "./lifecycle.js";
import { toLocalDateStr } from "../../helpers/dateHelpers.js";

// Arth 2.0 IA — this file is now the canonical Financial Relationship store, not a
// Membership-only one. `targetType`/`targetId` generalize the original person-only `personId` to
// "one Provider (billerAccount) can have N Financial Relationships, to a person OR a group".
// `personId` is KEPT on every record (mirroring targetId when targetType is "person") purely for
// backward compatibility: every existing reader of a membershipRelationships[] record
// (MembershipDetailModal, migrateMembershipRelationships, correctSelfSentinel) still reads
// `.personId` and needs zero changes. A record with no `targetType` at all is a pre-generalization
// row; every reader must treat that as targetType "person" (targetId = personId) rather than
// requiring a rewrite of existing data — see getRelationshipTarget below.

// WP-C1 Step 1 (approved, option b): getRelationshipStatusAsOfDate and
// isDateActiveMembershipCoverage now live in lifecycle.js — they were
// already purely status/statusHistory-based, zero coupling to
// billerAccountId or anything else Membership-specific. Re-exported here,
// unchanged in behavior, so the existing App.jsx import
// (`import { ..., isDateActiveMembershipCoverage, ... } from
// "./domain/membership/relationship"`) keeps working with zero changes.
export { getRelationshipStatusAsOfDate, isDateActiveMembershipCoverage };

/**
 * Read a relationship's owner generically, whatever generation created it: a
 * pre-generalization row (personId only) reads as targetType "person".
 * @param {object} relationship
 * @returns {{targetType: "person"|"group", targetId: string}}
 */
export function getRelationshipTarget(relationship) {
  if (relationship?.targetType) return { targetType: relationship.targetType, targetId: relationship.targetId };
  return { targetType: "person", targetId: relationship?.personId };
}

/**
 * Create a new, active Financial Relationship: a Provider (billerAccount) to a person or a
 * group. One billerAccountId can now have several of these at once — this is the 1:N change.
 * @param {object} params
 * @param {string} params.billerAccountId - the existing BillerAccount (Provider) this belongs to
 * @param {"person"|"group"} params.targetType
 * @param {string} params.targetId - a person id ("__me__" for self, see constants/appConstants.js's
 *   ME.id — NEVER the literal string "self", a historical bug, see correctSelfSentinel below) or a
 *   group id
 * @param {string} params.startDate - date string, when the relationship began
 * @param {function} params.genId - id generator, injected (no internal fallback)
 * @throws {Error} if genId, billerAccountId, targetType, targetId, or startDate is missing/invalid
 */
export function createRelationship({ billerAccountId, targetType, targetId, startDate, genId }) {
  if (typeof genId !== "function") throw new Error("createRelationship: genId is required");
  if (!billerAccountId) throw new Error("createRelationship: billerAccountId is required");
  if (targetType !== "person" && targetType !== "group") throw new Error("createRelationship: targetType must be \"person\" or \"group\"");
  if (!targetId) throw new Error("createRelationship: targetId is required");
  if (!startDate) throw new Error("createRelationship: startDate is required");

  return {
    id: genId(),
    billerAccountId,
    targetType,
    targetId,
    personId: targetType === "person" ? targetId : null,
    status: "active",
    statusHistory: [{ status: "active", effectiveDate: startDate, timestamp: Date.now() }],
    createdAt: Date.now(),
  };
}

/**
 * Unchanged signature/behavior for the one existing caller (membership signup) — now a thin
 * wrapper over createRelationship so person-targeted relationships share one code path with
 * group-targeted ones instead of a second, diverging implementation.
 * @deprecated for new call sites — call createRelationship with targetType:"person" directly.
 */
export function createMembershipRelationship({ billerAccountId, personId, startDate, genId }) {
  if (!personId) throw new Error("createMembershipRelationship: personId is required");
  return createRelationship({ billerAccountId, targetType: "person", targetId: personId, startDate, genId });
}

/**
 * Arth 2.0 IA — one-time, idempotent migration: every billerAccount whose own attribution
 * (attributeType "person"|"group" + attributedTo) has no matching Financial Relationship yet gets
 * exactly one, active, created. Non-destructive: `billerAccounts` themselves are never touched or
 * returned — attributeType/attributedTo stays exactly as it is, as the legacy Bill-For bridge (see
 * billFor.js). house/vehicle/unset attribution is out of scope for this migration; it creates
 * relationships only, never removes or edits one.
 *
 * The effective-start date is a real known fact (the billerAccount's own createdAt) rather than a
 * guess at when the attribution itself was set — it may predate a later reassignment, and that
 * imprecision is accepted rather than fabricating a more "accurate-looking" date.
 *
 * @param {Array} billerAccounts
 * @param {Array} existingRelationships - membershipRelationships[], any generation of row shape
 * @param {function} genId
 * @returns {Array} a new array (existingRelationships plus additions), or the same reference
 *   (existingRelationships) if nothing needed migrating.
 */
export function migrateBillerAccountAttributions(billerAccounts, existingRelationships, genId) {
  if (typeof genId !== "function") throw new Error("migrateBillerAccountAttributions: genId is required");
  const relationships = existingRelationships || [];
  const hasPair = (billerAccountId, targetType, targetId) => relationships.some(r => {
    if (String(r.billerAccountId) !== String(billerAccountId)) return false;
    const t = getRelationshipTarget(r);
    return t.targetType === targetType && String(t.targetId) === String(targetId);
  });
  const additions = [];
  (billerAccounts || []).forEach(ba => {
    if (!ba) return;
    const targetType = ba.attributeType;
    if (targetType !== "person" && targetType !== "group") return;
    const targetId = ba.attributedTo;
    if (targetId === undefined || targetId === null || targetId === "") return;
    if (hasPair(ba.id, targetType, targetId)) return;
    additions.push(createRelationship({
      billerAccountId: ba.id,
      targetType,
      targetId,
      startDate: toLocalDateStr(new Date(ba.createdAt || Date.now())),
      genId,
    }));
  });
  return additions.length ? [...relationships, ...additions] : existingRelationships;
}

export function pauseRelationship(relationship, reason, effectiveDate) {
  return pauseMembership(relationship, reason, effectiveDate);
}

export function resumeRelationship(relationship, effectiveDate) {
  return resumeMembership(relationship, effectiveDate);
}

export function endRelationship(relationship, reason, effectiveDate) {
  return endMembership(relationship, reason, effectiveDate);
}

/**
 * One-time, idempotent migration: existing memberships[] payment records
 * predate this entity and have no relationship to link to. For each
 * distinct (billerAccountId, personId) pair with at least one existing
 * payment record and no existing relationship, create exactly one new
 * relationship.
 *
 * The ONLY fact this fabricates nothing beyond: status is "active", and
 * effectiveDate is the EARLIEST known coverage-period start date across
 * that pair's payment records — the earliest genuinely known fact in the
 * data, not a guess. No pause/resume/end history is invented; a migrated
 * relationship's statusHistory has exactly one entry, the initial active
 * one, exactly as a real createMembershipRelationship() would produce for
 * a signup dated to that earliest known coverage start.
 *
 * Existing payment records are returned with a new membershipRelationshipId
 * field added, linking them to their (possibly newly-created) relationship.
 * Nothing else on a payment record is touched. Idempotent: a pair that
 * already has a relationship is left alone; running this twice on the same
 * input produces the same output.
 *
 * @param {Array} memberships - existing payment/coverage records
 * @param {Array} existingRelationships - relationships already created
 * @param {function} getMembershipPeriods - the existing, unmodified period-derivation function
 * @param {function} genId - id generator, injected
 * @returns {{ relationships: Array, updatedMemberships: Array }}
 */
export function migrateMembershipRelationships(memberships, existingRelationships, getMembershipPeriods, genId) {
  if (typeof genId !== "function") {
    throw new Error("migrateMembershipRelationships: genId is required");
  }
  const relationships = [...(existingRelationships || [])];
  const relationshipByPairKey = new Map(
    relationships.map(r => [`${r.billerAccountId}::${r.personId}`, r])
  );

  // First pass: for every pair with no existing relationship, find the
  // TRUE earliest known coverage start across ALL of that pair's payment
  // records — not just whichever record happens to appear first.
  const earliestByPairKey = new Map();
  for (const m of memberships) {
    const personId = m.personId || "__me__";
    const key = `${m.billerAccountId}::${personId}`;
    if (relationshipByPairKey.has(key)) continue;
    const periods = getMembershipPeriods(m) || [];
    const localEarliest = periods.map(p => p.from).filter(Boolean).sort()[0];
    if (!localEarliest) continue;
    const currentEarliest = earliestByPairKey.get(key);
    if (!currentEarliest || localEarliest < currentEarliest) {
      earliestByPairKey.set(key, localEarliest);
    }
  }

  for (const [key, earliestStart] of earliestByPairKey) {
    const [billerAccountId, personId] = key.split("::");
    const relationship = {
      id: genId(),
      billerAccountId,
      personId,
      status: "active",
      statusHistory: [{ status: "active", effectiveDate: earliestStart, timestamp: Date.now() }],
      createdAt: Date.now(),
    };
    relationships.push(relationship);
    relationshipByPairKey.set(key, relationship);
  }

  // Second pass: link every unlinked payment record to its (possibly
  // newly-created) relationship. Records with no derivable date at all
  // stay unlinked rather than getting a fabricated one.
  const updatedMemberships = memberships.map(m => {
    if (m.membershipRelationshipId) return m;
    const personId = m.personId || "__me__";
    const key = `${m.billerAccountId}::${personId}`;
    const relationship = relationshipByPairKey.get(key);
    if (!relationship) return m;
    return { ...m, membershipRelationshipId: relationship.id };
  });

  return { relationships, updatedMemberships };
}

/**
 * WP-A1 (ARTH-003): one-time, idempotent correction for relationships that
 * were already migrated before the self-sentinel bug was fixed — any
 * record carrying the literal string "self" as personId (from the old,
 * buggy `m.personId || "self"` fallback) instead of the app's real
 * self-identity sentinel, "__me__" (see constants/appConstants.js's
 * ME.id). Nothing else on a relationship is touched. A relationship whose
 * personId is already "__me__", or any other real person id, is returned
 * unchanged. Running this twice on the same input produces the same
 * output — a record with no remaining "self" values is a no-op pass.
 *
 * This is an identity-integrity fix, not a new feature: without it, any
 * self-attributed relationship migrated through the old code path has a
 * personId that getPerson() cannot resolve, silently degrading to the
 * {name:"?"} placeholder that PPL-000 exists to prevent.
 *
 * @param {Array} relationships - existing membershipRelationships[]
 * @returns {Array} a new array; only records with personId==="self" are
 *   replaced (with a new object, personId corrected); every other record
 *   is the exact same reference as the input, so a caller diffing by
 *   reference can see nothing else changed.
 */
export function correctSelfSentinel(relationships) {
  return (relationships || []).map(r =>
    r && r.personId === "self" ? { ...r, personId: "__me__" } : r
  );
}
