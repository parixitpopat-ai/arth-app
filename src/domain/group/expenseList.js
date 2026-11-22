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
import { billMonthTitle, meterNicknamer } from "../bills/billMonthTitle.js";

const P = n => Math.round((Number(n) || 0) * 100);
const R = p => Math.round(p) / 100;
/** How an expense divides across categories: line items with a category count by their own amount; whatever is left (tax, rounding, items without a category)
 *  goes to the expense's main category, or to "no category". No line items: the whole amount to its category. Always adds up to `total` (in paise). */
export function categorySplit(t, totalPaise) {
  const main = t.catId || (Array.isArray(t.catIds) && t.catIds[0]) || null;
  const lines = Array.isArray(t.lineItems) ? t.lineItems : [];
  const out = new Map(); let used = 0;
  for (const li of lines) {
    if (!li || !li.catId) continue;
    const amt = P((parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0));
    if (!(amt > 0)) continue;
    used += amt;
    const cur = out.get(li.catId) || { catId: li.catId, paise: 0, labels: [] };
    cur.paise += amt; if (li.label) cur.labels.push(String(li.label)); out.set(li.catId, cur);
  }
  if (used > totalPaise) { out.clear(); used = 0; }          // the lines add up to more than the expense: do not trust them, use the main category
  const rest = totalPaise - used;
  if (rest > 0 || !out.size) { const k = main || "__none__"; const cur = out.get(k === "__none__" ? null : k) || { catId: main, paise: 0, labels: [] }; cur.paise += rest; out.set(main, cur); }
  return [...out.values()].filter(x => x.paise > 0).map(x => ({ catId: x.catId, amount: R(x.paise), labels: x.labels }));
}

const dateOfBill = b => String(b.billDate || b.createdDate || b.dueDate || "").slice(0, 10);

/**
 * @param {{groupId:any, memberIds:string[], txns:Array, bills:Array, from:string, to:string, nameOf?:(id:string)=>string}} a  from/to inclusive "YYYY-MM-DD"
 * @returns {{items:Array<{key:string,kind:"expense"|"bill",id:any,date:string,title:string,total:number,payer:string,note:string,shares:Array<{personId:string,name:string,amount:number,remaining:number}>,memberTotal:number,due:number,groupAmount:number,yourShare:number|null}>,
 *           totals:{count:number,total:number,memberTotal:number,due:number}}}
 */
export function buildGroupExpenseList({ groupId, memberIds = [], meId = null, includePeople = false, txns = [], bills = [], billerAccounts = [], from, to, nameOf = id => String(id) }) {
  const gid = String(groupId);
  const inRange = d => d && d >= from && d <= to;
  const members = new Set((memberIds || []).map(String));
  const sharesOf = map => Object.entries(map || {})
    .filter(([pid, info]) => members.has(String(pid)) && info && info.mode === "owes" && Number(info.amount) > 0 && !info.transferredTo)
    .map(([pid, info]) => ({ personId: pid, name: nameOf(pid), amount: R(P(info.amount)), remaining: R(P(remainingShare(info))) }));
  const nick = meterNicknamer(billerAccounts);
  const billTitle = b => billMonthTitle(b, { nickname: nick(b) });          // "July Water Bill (Office)", the same naming the statements use
  const isMe = id => meId != null && String(id) === String(meId);
  // Whose part each expense is. Members with a share each have theirs; the person using Arth has what is left of the total (yourShare). With no split it is the
  // person it is tagged to (a member, or the person using Arth: "attributed to my name"), else it belongs to the group as a whole (personId null).
  const partsOf = ({ shares, total, yourShare, forPerson }) => {
    const out = shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount }));
    if (shares.length) { if (yourShare > 0 && meId != null) out.push({ personId: meId, name: nameOf(meId), amount: yourShare }); return out; }
    if (forPerson && (members.has(String(forPerson)) || isMe(forPerson))) return [{ personId: String(forPerson), name: nameOf(forPerson), amount: total }];
    return [{ personId: null, name: "", amount: total }];
  };
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
    const paidBill = t.paidBillId != null ? (bills || []).find(b => b && String(b.id) === String(t.paidBillId)) : null;
    const yourShare = shares.length && !(Number(t.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null;
    items.push({ key: `txn:${t.id}`, kind: "expense", scope: "group", id: t.id, date, title: paidBill ? billTitle(paidBill) : (t.paidBillName || t.desc || t.merchant || "Expense"), total,
      payer: t.paidByPersonId ? nameOf(t.paidByPersonId) : "you", note: String(t.note || ""), shares, memberTotal, due: R(shares.reduce((s, x) => s + P(x.remaining), 0)),
      groupAmount: R(P(t.groupCollectiveAmount)), yourShare, parts: partsOf({ shares, total, yourShare, forPerson: t.forPerson }), categories: categorySplit(t, P(total)) });
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
    const yourShareB = shares.length && !(Number(b.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null;
    items.push({ key: `bill:${b.id}`, kind: "bill", scope: "group", id: b.id, date, title: billTitle(b), total, payer: "not paid yet", note: "", shares, memberTotal,
      due: R(shares.reduce((s, x) => s + P(x.remaining), 0)), groupAmount: R(P(b.groupCollectiveAmount)), yourShare: yourShareB, parts: partsOf({ shares, total, yourShare: yourShareB, forPerson: null }), categories: categorySplit({ catId: b.catId, catIds: b.catIds }, P(total)) });
  }
  // Expenses tagged to the group's PEOPLE rather than to the group (a member's own K Auto, a bill split to a member), when asked for: one statement for both.
  // Only what the members bear is counted (their shares, or the amount tagged to them), never the whole expense, and anything tagged to ANOTHER group is left to that group.
  if (includePeople) {
    const taken = new Set(items.map(i => i.key));
    for (const t of txns || []) {
      if (!t || t.type !== "expense" || t.isRefund || String(t.groupId || "") !== "") continue;
      const date = String(t.date || "").slice(0, 10);
      if (!inRange(date) || taken.has(`txn:${t.id}`)) continue;
      const shares = sharesOf({ ...(t.splitPeople || {}), ...(t.people || {}) });
      const tagged = !shares.length && t.forPerson && members.has(String(t.forPerson));
      if (!shares.length && !tagged) continue;
      if (t.paidBillId != null) paidBillIds.add(String(t.paidBillId));
      const total = R(P(t.amount));
      const parts = shares.length ? shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount })) : [{ personId: String(t.forPerson), name: nameOf(t.forPerson), amount: total }];
      const mine = R(parts.reduce((sum, x) => sum + P(x.amount), 0));
      const paidBill = t.paidBillId != null ? (bills || []).find(b => b && String(b.id) === String(t.paidBillId)) : null;
      items.push({ key: `txn:${t.id}`, kind: "expense", scope: "people", id: t.id, date, title: paidBill ? billTitle(paidBill) : (t.paidBillName || t.desc || t.merchant || "Expense"), total: mine,
        payer: t.paidByPersonId ? nameOf(t.paidByPersonId) : "you", note: String(t.note || ""), shares, memberTotal: mine, due: R(shares.reduce((sum, x) => sum + P(x.remaining), 0)),
        groupAmount: 0, yourShare: null, parts, categories: categorySplit(t, P(mine)) });
    }
    for (const b of bills || []) {
      if (!b || String(b.groupId || "") !== "" || b.status === "cancelled" || b.skipped || paidBillIds.has(String(b.id)) || b.paidByTxnId != null) continue;
      if ((txns || []).some(t => t && t.paidBillId != null && String(t.paidBillId) === String(b.id))) continue;
      const date = dateOfBill(b);
      if (!inRange(date)) continue;
      const shares = sharesOf(getBillSplitSource(b, txns).people);
      if (!shares.length) continue;
      const mine = R(shares.reduce((sum, x) => sum + P(x.amount), 0));
      items.push({ key: `bill:${b.id}`, kind: "bill", scope: "people", id: b.id, date, title: billTitle(b), total: mine, payer: "not paid yet", note: "", shares, memberTotal: mine,
        due: R(shares.reduce((sum, x) => sum + P(x.remaining), 0)), groupAmount: 0, yourShare: null, parts: shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount })), categories: categorySplit({ catId: b.catId, catIds: b.catIds }, P(mine)) });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || String(a.key).localeCompare(String(b.key)));
  const sum = k => R(items.reduce((s, i) => s + P(i[k]), 0));
  return { items, totals: { count: items.length, total: sum("total"), memberTotal: sum("memberTotal"), due: sum("due") } };
}
