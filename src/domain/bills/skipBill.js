// domain/bills/skipBill.js
//
// "Skip this month" for a bill. A skipped bill is not owed this cycle: it leaves Money Required,
// the open total and the due lists, but it is kept (shown under Skipped) and can be put back.
// Nothing is paid and no money moves. A card statement can't be skipped: skipping it would not
// change what the bank is owed.

/** Why a bill can't be skipped, or "" when it can. */
export function skipBlockedReason(bill) {
  if (!bill) return "No bill.";
  if (bill.isCcStatement) return "A card statement can't be skipped. The bank is still owed the money.";
  if (bill.status === "paid") return "This bill is already paid.";
  if (bill.status === "cancelled") return "This bill is cancelled.";
  if (bill.skipped) return "This bill is already skipped.";
  return "";
}
export const canSkipBill = bill => skipBlockedReason(bill) === "";

/** The bill, marked skipped. `reason` is "skipped" (nothing paid) or "rest" (part paid, rest skipped). */
export function skipBill(bill, { today, reason = "skipped" } = {}) {
  if (!canSkipBill(bill)) return bill;
  return { ...bill, skipped: true, skippedDate: today || null, skippedReason: reason };
}

/** Puts a skipped bill back as it was. */
export function unskipBill(bill) {
  if (!bill?.skipped) return bill;
  const { skipped, skippedDate, skippedReason, ...rest } = bill;
  return rest;
}

export const isSkipped = bill => Boolean(bill?.skipped);

/**
 * The next cycle's bill when a recurring bill is skipped (a paid bill makes its next one; a skipped one must too,
 * or the bill would vanish from the calendar). `fromDate` is the skipped bill's own due date, so the next bill
 * falls one cycle after it. Returns null when the bill doesn't renew or its schedule owns regeneration.
 */
export function buildNextBillAfterSkip(bill, { today, genId, scheduleOwnsRegeneration = false, computeNextDueDate, computeNextPeriod } = {}) {
  if (!bill?.recurring || bill.autoGenerate === false || scheduleOwnsRegeneration) return null;
  const fromDate = bill.dueDate || today;
  const nextDue = computeNextDueDate(bill, fromDate);
  const nextPeriod = computeNextPeriod(bill, fromDate);
  const prorata = bill.billingModel === "prorata";
  const validUntil = prorata && bill.validityDays ? (() => { const d = new Date(nextDue); d.setDate(d.getDate() + Number(bill.validityDays) - 1); return d.toISOString().split("T")[0]; })() : null;
  const { skipped, skippedDate, skippedReason, ...base } = bill;
  return {
    ...base, id: genId(), status: "unpaid", dueDate: nextDue, billDate: fromDate,
    paidDate: null, paidByTxnId: null, createdDate: today, createdAt: Date.now(),
    isPaused: false, pausedDate: null, resumeDate: null, pauseReason: null, pausedDays: 0,
    ...(nextPeriod || {}),
    ...(prorata ? { validFrom: nextDue } : {}),
    ...(validUntil ? { validUntil } : {}),
  };
}
