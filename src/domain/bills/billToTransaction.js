// "Not a bill, it is a purchase": turn an UNPAID, plain, one-off bill into an ordinary expense on an account (typically the credit card it was bought on).
// Only a bill that nothing else depends on can be converted: no payment against it, no connection, no split with other people, not recurring, not a card
// statement. Anything else is refused with the reason, never half-converted. Pure.
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** @returns {{ok:true}|{ok:false, reason:string}} */
export function canConvertBillToTxn(bill, contributions = []) {
  if (!bill) return { ok: false, reason: "This bill could not be found." };
  if (bill.isCcStatement) return { ok: false, reason: "A card statement is built from the card's transactions. It cannot be turned into one." };
  if (bill.status === "paid" || bill.status === "cancelled" || bill.paidByTxnId) return { ok: false, reason: "This bill already has a payment or was cancelled. Delete the payment first, or add the purchase by hand." };
  if ((contributions || []).some(c => c && c.obligationType === "bill" && String(c.obligationId) === String(bill.id))) return { ok: false, reason: "Part of this bill is already paid. Delete that payment first." };
  if (bill.billerAccountId) return { ok: false, reason: "This bill belongs to a connection (a provider you pay regularly). Edit or delete it there instead." };
  if (bill.recurring) return { ok: false, reason: "This is a recurring bill: it makes the next one by itself. Turn recurring off first." };
  const others = Object.values(bill.splitPeople || {}).some(p => p && Number(p.amount) > 0);
  if (others || bill.groupId || Number(bill.groupCollectiveAmount) > 0) return { ok: false, reason: "This bill is split with other people or a group. Remove the split first, or add the purchase by hand." };
  if (!(Number(bill.amount) > 0)) return { ok: false, reason: "This bill has no amount." };
  return { ok: true };
}

/** The expense the bill becomes. `accId` is where it was paid / charged (a credit card makes it an unpaid card purchase). */
export function billToExpense({ bill, accId, date, genId, now = Date.now() }) {
  const subId = bill.subId || null;
  return {
    id: genId(), type: "expense",
    desc: bill.name || bill.merchant || "Purchase", merchant: bill.merchant || bill.name || "",
    amount: r2(bill.amount), date, accId,
    catId: bill.catId || (bill.catIds && bill.catIds[0]) || null, catIds: Array.isArray(bill.catIds) ? [...bill.catIds] : (bill.catId ? [bill.catId] : []),
    subId, subIds: subId ? [subId] : [],
    note: bill.invoiceNo ? `Moved from a bill (invoice ${bill.invoiceNo})` : "Moved from a bill",
    ...(bill.imageBase64 ? { imageBase64: bill.imageBase64 } : {}),
    createdAt: now,
  };
}
