// domain/insurance/renewalNotice.js
//
// Payments v2 (WP18d) F4 "Add renewal notice" — the ONLY sanctioned way an Insurance Expected
// renewal (domain/insurance/renewalReminders.js) becomes a real Bill (Decision #6: "An insurance
// renewal becomes payable only once its notice is added as a Bill"). Pure and side-effect-free —
// callers own id generation and the clock, and are the ones who actually write bills[]/
// insurancePolicies[] (App.jsx, same as every other Bill-creation path in this codebase).
//
// buildRenewalNoticeBill + applyRenewalNoticeToPolicy together are what "replaces, never
// duplicates" means in practice: the Bill this creates carries the policy's id
// (insurancePolicyId), and setting policy.linkedBillId is exactly what makes
// getInsuranceRenewalReminders (unmodified) stop returning this policy's Expected row forever
// after — one write, read by two already-existing, untouched functions.
//
// The new Bill is deliberately `recurring:true` with `frequency` mapped from the policy's own
// premiumFrequency: this is what lets next year's premium regenerate itself through the existing,
// untouched confirmMarkBillPaid recurring-regeneration path — the exact same steady state a
// pre-WP2 policy's linkedBillId already lived in (see InsuranceScreen.jsx's own comments). No new
// auto-promotion code is added for that; it reuses a mechanism that already existed.

const FREQUENCY_TO_BILL_FREQUENCY = { monthly: "monthly", quarterly: "quarterly", halfyearly: "halfyearly", annual: "yearly" };

/**
 * @param {object} params
 * @param {object} params.policy - the insurance policy this notice is for
 * @param {number} params.amount - "Amount on notice" (required, >0)
 * @param {string} params.dueDate - "Due date" (required, YYYY-MM-DD)
 * @param {string} [params.documentBase64] - the uploaded notice document/photo, optional
 * @param {string} params.today - YYYY-MM-DD, the day the notice is being added
 * @param {string} params.id - caller-generated id for the new Bill
 * @returns {object} a new Bill record, ready to be prepended to bills[]
 */
export function buildRenewalNoticeBill({ policy, amount, dueDate, documentBase64, today, id }) {
  return {
    id,
    name: `${policy.name} Renewal`,
    merchant: policy.provider || policy.name,
    invoiceNo: "",
    amount: Number(amount) || 0,
    dueDate,
    catId: null,
    catIds: [],
    subId: null,
    recurring: true,
    frequency: FREQUENCY_TO_BILL_FREQUENCY[policy.premiumFrequency] || "yearly",
    status: "unpaid",
    paidDate: null,
    billDate: today,
    createdDate: today,
    createdAt: Date.now(),
    splitPeople: {},
    groupId: null,
    groupCollectiveAmount: 0,
    myShare: Number(amount) || 0,
    imageBase64: documentBase64 || null,
    billerAccountId: null,
    billerCategory: "Insurance",
    consumerNumber: null,
    lastPaidAmount: null,
    autoGenerate: true,
    isPaused: false,
    pausedDate: null,
    resumeDate: null,
    pauseReason: null,
    pausedDays: 0,
    forType: "unassigned",
    forId: null,
    // Insurance-specific linkage (additive — read only by Insurance's own screens/Home rows,
    // never required by the generic Bill machinery above).
    insurancePolicyId: policy.id,
    isInsuranceRenewal: true,
  };
}

/**
 * Replaces, never duplicates: points the policy at the new Bill. Once linkedBillId is set,
 * getInsuranceRenewalReminders (unmodified) stops producing an Expected row for this policy —
 * there is never a moment where both the Expected item and the new Bill are visible together.
 */
export function applyRenewalNoticeToPolicy(policy, bill) {
  return { ...policy, linkedBillId: bill.id, renewalNoticeAddedDate: bill.billDate };
}

/**
 * "Difference from the expected amount is shown as plain text, not a warning" (F4). Returns null
 * when there's nothing to say (no expected amount on record, or the entered amount matches it).
 * @returns {{amount:number, direction:"more"|"less"}|null}
 */
export function describeRenewalDifference(expectedAmount, enteredAmount) {
  const expected = Number(expectedAmount) || 0;
  const entered = Number(enteredAmount) || 0;
  if (!expected) return null;
  const diff = Math.round(entered - expected);
  if (diff === 0) return null;
  return { amount: Math.abs(diff), direction: diff > 0 ? "more" : "less" };
}
