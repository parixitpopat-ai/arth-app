// domain/billers/merge.js
//
// Merge two Biller Accounts (Providers) that turned out to be the same real-world thing —
// the exact "Parixit"/"Me" duplicate reported live: one real gym, created twice under two
// different nicknames, each with its own Financial Relationship and membership payment history.
//
// `survivorId` is kept; `duplicateId` is retired. Every record that pointed at duplicateId is
// re-pointed at survivorId. The one genuine subtlety: if BOTH accounts already have an active
// Financial Relationship to the exact same target (person or group) — which is precisely how
// this duplicate happens — merging them naively would leave the survivor with two active
// relationships to the same target, i.e. the same bug in a new shape. Instead, the duplicate's
// relationship is dropped and its membership payment history is re-pointed at the survivor's
// existing relationship for that target, so history is kept but ownership converges onto one row.
// A duplicate relationship to a DIFFERENT target than anything the survivor already has is kept,
// re-pointed onto the survivor — the 1:N model already supports a Provider having several.
//
// Pure and read-only: returns a new state slice, writes nothing itself. The caller applies it.

import { getRelationshipTarget } from "../membership/relationship.js";

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * @param {Object} state - { billerAccounts, bills, memberships, membershipRelationships, txns, feeSchedules }
 * @param {string} survivorId - kept
 * @param {string} duplicateId - retired
 * @returns {Object} { billerAccounts, bills, memberships, membershipRelationships, txns, feeSchedules }
 * @throws {Error} if survivorId===duplicateId, or either account doesn't exist
 */
export function mergeBillerAccounts(state, survivorId, duplicateId) {
  const { billerAccounts = [], bills = [], memberships = [], membershipRelationships = [], txns = [], feeSchedules = [] } = state || {};
  if (sameId(survivorId, duplicateId)) throw new Error("mergeBillerAccounts: survivorId and duplicateId must be different accounts");
  const survivorAccount = billerAccounts.find(ba => sameId(ba.id, survivorId));
  const duplicateAccount = billerAccounts.find(ba => sameId(ba.id, duplicateId));
  if (!survivorAccount) throw new Error("mergeBillerAccounts: survivorId not found");
  if (!duplicateAccount) throw new Error("mergeBillerAccounts: duplicateId not found");

  const survivorRelationships = membershipRelationships.filter(r => sameId(r.billerAccountId, survivorId));
  const duplicateRelationships = membershipRelationships.filter(r => sameId(r.billerAccountId, duplicateId));

  // old duplicate relationship id -> the relationship id its history should now point at
  // (a matching survivor relationship if one already covers the same target, else itself).
  const relationshipIdMap = new Map();
  const keptDuplicateRelationships = [];
  for (const dupRel of duplicateRelationships) {
    const dupTarget = getRelationshipTarget(dupRel);
    const matching = survivorRelationships.find(r => {
      const t = getRelationshipTarget(r);
      return t.targetType === dupTarget.targetType && String(t.targetId) === String(dupTarget.targetId);
    });
    if (matching) {
      relationshipIdMap.set(dupRel.id, matching.id);
    } else {
      relationshipIdMap.set(dupRel.id, dupRel.id);
      keptDuplicateRelationships.push({ ...dupRel, billerAccountId: survivorId });
    }
  }

  const nextMembershipRelationships = [
    ...membershipRelationships.filter(r => !sameId(r.billerAccountId, duplicateId)),
    ...keptDuplicateRelationships,
  ];

  const nextMemberships = memberships.map(m => {
    if (!sameId(m.billerAccountId, duplicateId)) return m;
    const nextRelId = m.membershipRelationshipId ? (relationshipIdMap.get(m.membershipRelationshipId) || m.membershipRelationshipId) : m.membershipRelationshipId;
    return { ...m, billerAccountId: survivorId, membershipRelationshipId: nextRelId };
  });

  const nextBills = bills.map(b => sameId(b.billerAccountId, duplicateId) ? { ...b, billerAccountId: survivorId } : b);
  const nextTxns = txns.map(t => sameId(t.billerLinkId, duplicateId) ? { ...t, billerLinkId: survivorId } : t);
  const nextFeeSchedules = feeSchedules.map(fs => sameId(fs.billerAccountId, duplicateId) ? { ...fs, billerAccountId: survivorId } : fs);

  // Fill in any of the survivor's own fields that are empty, from the duplicate — never
  // overwrites something the survivor already has.
  const mergedSurvivor = {
    ...survivorAccount,
    consumerNo: survivorAccount.consumerNo || duplicateAccount.consumerNo || "",
    provider: survivorAccount.provider || duplicateAccount.provider || "",
    note: survivorAccount.note || duplicateAccount.note || "",
  };

  const nextBillerAccounts = billerAccounts
    .filter(ba => !sameId(ba.id, duplicateId))
    .map(ba => sameId(ba.id, survivorId) ? mergedSurvivor : ba);

  return {
    billerAccounts: nextBillerAccounts,
    bills: nextBills,
    memberships: nextMemberships,
    membershipRelationships: nextMembershipRelationships,
    txns: nextTxns,
    feeSchedules: nextFeeSchedules,
  };
}
