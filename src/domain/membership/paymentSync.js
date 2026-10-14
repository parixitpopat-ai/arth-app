// domain/membership/paymentSync.js
//
// Editing a membership payment keeps its real expense in step. Only the expense this membership itself created (it carries linkedMembershipId = the
// membership's id) follows the edit; a transaction the user linked by hand is theirs and is never rewritten.
export function withMembershipPaymentSynced(txns, { txnId, membershipId, amount, accId, catId }) {
  return (txns || []).map(t =>
    String(t.id) === String(txnId) && t.linkedMembershipId != null && String(t.linkedMembershipId) === String(membershipId)
      ? { ...t, amount, accId, catId, catIds: [catId] }
      : t);
}
