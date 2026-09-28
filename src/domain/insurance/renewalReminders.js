// domain/insurance/renewalReminders.js
//
// WP2 (Arth IA — Payments, Outlook, Budget & Insights, §2) — the Insurance sibling of
// domain/bills/renewalReminders.js's membership adapter. Insurance Policies are their own
// domain-specific record (insurancePolicies[]), never a Bill, exactly like Membership never is
// (the IA's own guiding principle: "Nothing... turns... a future Recharge/Insurance record into
// a Bill merely so a screen can show it"). This computes read-only renewal reminders from that
// existing data so a premium due soon or already lapsed is visible in Payments, without creating
// a Bill and without touching bills[].
//
// A policy that already has a linkedBillId is a pre-WP2 policy whose premium is still tracked as
// a real Bill with its own payment history — that Bill already surfaces it in the Bills list, so
// this deliberately skips it rather than showing the same premium twice. Only policies created
// after WP2 (linkedBillId === null) are projected here.

import { addDaysToDateStr } from "../../helpers/dateHelpers.js";

export function getInsuranceRenewalReminders({ insurancePolicies, today, forwardDays = 7 }) {
  const forwardLimit = addDaysToDateStr(today, forwardDays);

  return (insurancePolicies || [])
    .filter(p => p && p.status !== "archived" && !p.linkedBillId && p.renewalDate)
    .map(p => {
      const isOverdue = p.renewalDate < today;
      if (!isOverdue && p.renewalDate > forwardLimit) return null;
      const days = Math.round((new Date(isOverdue ? today : p.renewalDate) - new Date(isOverdue ? p.renewalDate : today)) / 86400000);
      return {
        id: `insurance:${p.id}`,
        sourceType: "insurance",
        policyId: p.id,
        name: p.name || "Insurance",
        amount: Number(p.premiumAmount || 0),
        kind: isOverdue ? "overdue" : "renewing",
        days,
        forText: p.insuredPerson || "",
      };
    })
    .filter(Boolean);
}
