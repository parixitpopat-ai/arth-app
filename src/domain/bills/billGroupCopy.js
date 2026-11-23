// src/domain/bills/billGroupCopy.js — a payment linked to a bill should carry the bill's group, split and amount to collect.
// Bills -> Pay already copies them; linking a payment to a bill from Transactions ("I already paid this", the Add form's Link to...) did not, so the group's claim
// vanished the moment the bill was marked paid. Also: an entry that carries a collect amount but is marked only "tag" has that amount reset to 0 when entries load
// (the loader keeps it only for split/allocate), so the payment is marked "split" whenever it carries one. Pure; nothing is written here.

const P = n => Math.round(Number(n || 0) * 100);
const R = p => Math.round(p) / 100;
const owesPeople = people => Object.entries(people || {}).filter(([pid, i]) => pid !== "__me__" && i && i.mode === "owes" && Number(i.amount || 0) > 0);
const hasOwn = t => Boolean(String(t.groupId || "")) || (t.groupAllocations || []).length > 0 || Number(t.groupCollectiveAmount || 0) > 0 || Boolean(t.forPerson) || owesPeople(t.people).length > 0;
const SPLIT_MODES = new Set(["split", "allocate"]);

/** What a bill carries that a payment should too: { groupId, collective, people } or null when it carries nothing. */
export function billClaim(bill) {
  if (!bill) return null;
  const collective = R(P(bill.groupCollectiveAmount));
  const hasPeople = owesPeople(bill.splitPeople).length > 0;
  if (!(collective > 0) && !hasPeople) return null;
  return { groupId: bill.groupId || null, collective, people: hasPeople ? { ...bill.splitPeople } : null };
}

/**
 * The fields to add to a payment entry that has none of its own. Empty object when the bill carries nothing, the entry already has a group / people / collect
 * amount / person of its own (never overwritten), or this is not the bill's first payment (only the first carries the claim, as Bills -> Pay does).
 */
export function copyFromBill(bill, txn, { isFirst = true } = {}) {
  const c = billClaim(bill);
  if (!c || !txn || !isFirst || hasOwn(txn)) return {};
  return { ...(c.groupId ? { groupId: c.groupId } : {}), ...(c.collective > 0 ? { groupCollectiveAmount: c.collective } : {}), ...(c.people ? { people: c.people } : {}), trackingMode: "split", billGroupCopied: true };
}

/** A payment that is in the bill's group but lost the collect amount (marked only "tag"): put it back. Empty object when it does not apply. */
export function restoreCollect(bill, txn) {
  const c = billClaim(bill);
  if (!c || !txn || !(c.collective > 0) || !c.groupId || String(txn.groupId || "") !== String(c.groupId)) return {};
  if (Number(txn.groupCollectiveAmount || 0) > 0 || (txn.groupAllocations || []).length || SPLIT_MODES.has(txn.trackingMode)) return {};
  return { groupCollectiveAmount: c.collective, trackingMode: "split", billGroupCopied: true, ...(owesPeople(txn.people).length === 0 && c.people ? { people: c.people } : {}) };
}

/**
 * Past payments linked to a bill whose group claim never reached them. Each: { txnId, billId, date, title, amount, kind: "copy"|"collect", patch, now, after }.
 * Only the bill's FIRST payment, only expenses, never one already fixed, never one that already has its own group/people/collect (kind "copy" needs an empty entry).
 */
export function findPaymentsMissingBillGroup(txns, bills) {
  const byBill = new Map();
  for (const t of txns || []) if (t && t.type === "expense" && t.paidBillId != null) { const k = String(t.paidBillId); (byBill.get(k) || byBill.set(k, []).get(k)).push(t); }
  const out = [];
  for (const b of bills || []) {
    if (!b || b.status === "cancelled" || !billClaim(b)) continue;
    const list = byBill.get(String(b.id)); if (!list || !list.length) continue;
    const first = b.paidByTxnId != null ? list.find(t => String(t.id) === String(b.paidByTxnId)) : [...list].sort((x, y) => String(x.date).localeCompare(String(y.date)) || String(x.id).localeCompare(String(y.id)))[0];
    if (!first || first.billGroupCopied) continue;
    let patch = copyFromBill(b, first), kind = "copy";
    if (!Object.keys(patch).length) { patch = restoreCollect(b, first); kind = "collect"; }
    if (!Object.keys(patch).length) continue;
    const c = billClaim(b);
    out.push({ txnId: first.id, billId: b.id, date: String(first.date || ""), title: first.paidBillName || first.desc || b.name || "Bill payment", amount: Number(first.amount || 0), kind, patch,
      now: { groupId: first.groupId || null, collect: Number(first.groupCollectiveAmount || 0) }, after: { groupId: c.groupId, collect: c.collective, people: c.people ? Object.keys(c.people).length : 0 } });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** The entries with the fixes for the chosen txn ids applied. Worked out again from the current data, so a stale list can never write something that no longer applies. */
export function applyBillGroupFixes(txns, bills, ids) {
  const want = new Set((ids || []).map(String));
  const patches = new Map(findPaymentsMissingBillGroup(txns, bills).filter(f => want.has(String(f.txnId))).map(f => [String(f.txnId), f.patch]));
  return (txns || []).map(t => (t && patches.has(String(t.id)) ? { ...t, ...patches.get(String(t.id)) } : t));
}
