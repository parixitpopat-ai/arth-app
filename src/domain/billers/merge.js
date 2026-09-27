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
// relationships to the same target, i.e. the same bug in a new shape. The two relationships
// converge onto the survivor's row, but neither one's OWN history is discarded: their
// statusHistory arrays (pause/resume/end timelines — real facts about when a membership was
// actually paused) are merged chronologically into one combined timeline on the surviving row,
// and its current status is derived from that merged timeline's latest entry — not just
// whichever relationship happened to be picked as the survivor. Membership payment history is
// re-pointed at the (now history-merged) surviving relationship. A duplicate relationship to a
// DIFFERENT target than anything the survivor already has is kept, re-pointed onto the survivor
// unchanged — the 1:N model already supports a Provider having several.
//
// Pure and read-only: returns a new state slice, writes nothing itself. The caller applies it.

import { getRelationshipTarget } from "../membership/relationship.js";

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Combine two relationships' statusHistory into one chronological timeline — every entry from
 * both, sorted by (effectiveDate, timestamp), the same ordering lifecycle.js's own
 * getRelationshipStatusAsOfDate relies on. Exact duplicate entries (can happen if, implausibly,
 * both rows were touched by the same action) collapse to one.
 */
function mergeStatusHistory(a, b) {
  const combined = [...(a || []), ...(b || [])];
  const seen = new Set();
  const deduped = combined.filter(h => {
    const key = `${h.status}|${h.effectiveDate}|${h.timestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.sort((x, y) => String(x.effectiveDate || "").localeCompare(String(y.effectiveDate || "")) || (x.timestamp || 0) - (y.timestamp || 0));
}

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

  // Relationships that converged (survivorRel.id -> the duplicate relationship merged into it):
  // merge their statusHistory rather than silently keeping only the survivor's.
  const convergedFrom = new Map();
  for (const dupRel of duplicateRelationships) {
    const targetId = relationshipIdMap.get(dupRel.id);
    if (targetId !== dupRel.id) convergedFrom.set(targetId, dupRel);
  }

  const nextMembershipRelationships = [
    ...membershipRelationships.filter(r => !sameId(r.billerAccountId, duplicateId)).map(r => {
      const absorbedDupRel = convergedFrom.get(r.id);
      if (!absorbedDupRel) return r;
      const statusHistory = mergeStatusHistory(r.statusHistory, absorbedDupRel.statusHistory);
      const latest = statusHistory[statusHistory.length - 1];
      return { ...r, statusHistory, status: latest ? latest.status : r.status };
    }),
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
