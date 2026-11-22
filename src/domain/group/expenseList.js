// domain/group/expenseList.js
//
// A group's EXPENSES, itemised: every expense and bill tagged to the group in a period, each with its total, who paid, and what each member owes for it.
// The family statement (domain/person/personStatement.js) is built from each member's own shares; an expense tagged to the group that has no per-member
// split (the group as a whole) never appears there. This list does not depend on member shares: if it is tagged to the group, it is here.
// Pure; reads only; never changes a record. Amounts are held in paise so nothing drifts.
//   expense : a transaction of type "expense" (refunds left out) with groupId = the group. A bill that was paid is covered by its payment entry here.
//   bill    : a bill with groupId = the group that has not been paid yet (a paid one is its payment entry), shares from the bill's split.
//   shares  : members whose share is mode "owes" (they owe the person using Arth). remaining = what of it is still open.

import { remainingShare } from "../shared/remainingShare.js";
import { getBillSplitSource } from "../bills/splitSource.js";

const P = n => Math.round((Number(n) || 0) * 100);
const R = p => Math.round(p) / 100;
const dateOfBill = b => String(b.billDate || b.createdDate || b.dueDate || "").slice(0, 10);

/**
 * @param {{groupId:any, memberIds:string[], txns:Array, bills:Array, from:string, to:string, nameOf?:(id:string)=>string}} a  from/to inclusive "YYYY-MM-DD"
 * @returns {{items:Array<{key:string,kind:"expense"|"bill",id:any,date:string,title:string,total:number,payer:string,note:string,shares:Array<{personId:string,name:string,amount:number,remaining:number}>,memberTotal:number,due:number,groupAmount:number,yourShare:number|null}>,
 *           totals:{count:number,total:number,memberTotal:number,due:number}}}
 */
export function buildGroupExpenseList({ groupId, memberIds = [], txns = [], bills = [], from, to, nameOf = id => String(id) }) {
  const gid = String(groupId);
  const inRange = d => d && d >= from && d <= to;
  const members = new Set((memberIds || []).map(String));
  const sharesOf = map => Object.entries(map || {})
    .filter(([pid, info]) => members.has(String(pid)) && info && info.mode === "owes" && Number(info.amount) > 0 && !info.transferredTo)
    .map(([pid, info]) => ({ personId: pid, name: nameOf(pid), amount: R(P(info.amount)), remaining: R(P(remainingShare(info))) }));
  const items = [];
  const paidBillIds = new Set();
  for (const t of txns || []) {
    if (!t || t.type !== "expense" || t.isRefund || String(t.groupId || "") !== gid) continue;
    const date = String(t.date || "").slice(0, 10);
    if (!inRange(date)) continue;
    if (t.paidBillId != null) paidBillIds.add(String(t.paidBillId));
    const shares = sharesOf({ ...(t.splitPeople || {}), ...(t.people || {}) });
    const memberTotal = R(shares.reduce((s, x) => s + P(x.amount), 0));
    const total = R(P(t.amount));
    items.push({ key: `txn:${t.id}`, kind: "expense", id: t.id, date, title: t.paidBillName || t.desc || t.merchant || "Expense", total,
      payer: t.paidByPersonId ? nameOf(t.paidByPersonId) : "you", note: String(t.note || ""), shares, memberTotal, due: R(shares.reduce((s, x) => s + P(x.remaining), 0)),
      groupAmount: R(P(t.groupCollectiveAmount)), yourShare: shares.length && !(Number(t.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null });
  }
  for (const b of bills || []) {
    if (!b || String(b.groupId || "") !== gid || b.status === "cancelled" || b.skipped) continue;
    if (paidBillIds.has(String(b.id)) || b.paidByTxnId != null) continue;   // its payment entry is already in the list (or out of the period)
    if ((txns || []).some(t => t && t.paidBillId != null && String(t.paidBillId) === String(b.id))) continue;
    const date = dateOfBill(b);
    if (!inRange(date)) continue;
    const src = getBillSplitSource(b, txns);
    const shares = sharesOf(src.people);
    const memberTotal = R(shares.reduce((s, x) => s + P(x.amount), 0));
    const total = R(P(b.amount));
    items.push({ key: `bill:${b.id}`, kind: "bill", id: b.id, date, title: b.name || b.merchant || "Bill", total, payer: "not paid yet", note: "", shares, memberTotal,
      due: R(shares.reduce((s, x) => s + P(x.remaining), 0)), groupAmount: R(P(b.groupCollectiveAmount)), yourShare: shares.length && !(Number(b.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || String(a.key).localeCompare(String(b.key)));
  const sum = k => R(items.reduce((s, i) => s + P(i[k]), 0));
  return { items, totals: { count: items.length, total: sum("total"), memberTotal: sum("memberTotal"), due: sum("due") } };
}
