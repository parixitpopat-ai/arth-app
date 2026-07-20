// Bills' billing-period date logic. Extracted per the Function Extraction Checklist
// (CODING_STANDARDS.md) — both pure, no signature changes. Split out from the original
// calculations.js, which mixed these with remainingShare (not a date calculation, and not
// Bills-specific — see domain/shared/remainingShare.js).

export const computeNextDueDate = (bill, paidDate) => {
  const base = bill.billingModel === "prorata"
    ? new Date(paidDate || bill.dueDate || bill.activationDate || new Date())
    : new Date(bill.periodEnd || bill.dueDate || new Date());
  const next = new Date(base);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") next.setMonth(next.getMonth() + 1);
  else if(freq === "quarterly") next.setMonth(next.getMonth() + 3);
  else if(freq === "halfyearly") next.setMonth(next.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if(freq === "custom" && bill.validityDays) next.setDate(next.getDate() + Number(bill.validityDays));
  return next.toISOString().split("T")[0];
};

export const computeNextPeriod = (bill, paidDate) => {
  if(bill.billingModel !== "calendar" || !bill.periodStart || !bill.periodEnd) return null;
  const start = new Date(bill.periodEnd); start.setDate(start.getDate() + 1);
  const end = new Date(start);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") end.setMonth(end.getMonth() + 1);
  else if(freq === "quarterly") end.setMonth(end.getMonth() + 3);
  else if(freq === "halfyearly") end.setMonth(end.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { periodStart: start.toISOString().split("T")[0], periodEnd: end.toISOString().split("T")[0] };
};
