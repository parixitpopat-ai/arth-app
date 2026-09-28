// domain/insurance/futureMoney.js
//
// WP4 (Arth IA §7) — the Outlook sibling of domain/insurance/renewalReminders.js's Payments-side
// adapter: same underlying data (insurancePolicies[], skipping any policy that already has a
// linkedBillId — its Bill already projects it via domain/bills/commitments.js, so it's never
// shown twice), but with NO forward-window cap. Outlook needs to see a renewal 90 days out just
// as much as Payments needs to see one due in 8 — the Payments-vs-Outlook split happens later,
// at the composed-list boundary (domain/futureMoney/horizon.js's isWithinPaymentsHorizon), never
// inside this adapter.
//
// Produces the same canonical Future Money event shape every other source already produces
// (domain/futureMoney/compose.js), so Outlook composes them identically.

export function mapPolicyToCommitment(policy) {
  if (!policy || policy.status === "archived" || policy.linkedBillId || !policy.renewalDate) return null;
  return {
    sourceType: "insurancePolicy",
    sourceId: policy.id,
    category: "committedSpending",
    subCategory: "insurance",
    name: policy.name || "Insurance",
    amount: Number(policy.premiumAmount || 0),
    date: policy.renewalDate,
    status: "unpaid",
    recurs: true,
  };
}

export function projectPoliciesToCommitments(insurancePolicies) {
  return (insurancePolicies || []).map(mapPolicyToCommitment).filter(Boolean);
}
