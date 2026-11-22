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

/** What a line is called: "Vendor - Item" (e.g. "Amazon - Coffee"), the vendor being who it was paid to and the item what it was for. Only one of them when only one is
 *  known, or when one already says the other ("Amazon order" from Amazon). No extra words. */
const vendorOf = t => {
  const v = String(t.merchant || "").trim(), d = String(t.desc || "").trim();
  if (v && d) { const lv = v.toLowerCase(), ld = d.toLowerCase(); if (lv === ld || ld.includes(lv)) return d; if (lv.includes(ld)) return v; return `${v} - ${d}`; }
  return v || d || "Expense";
};

const dateOfBill = b => String(b.billDate || b.createdDate || b.dueDate || "").slice(0, 10);

/**
 * @param {{groupId:any, memberIds:string[], txns:Array, bills:Array, from:string, to:string, nameOf?:(id:string)=>string}} a  from/to inclusive "YYYY-MM-DD"
 * @returns {{items:Array<{key:string,kind:"expense"|"bill",id:any,date:string,title:string,total:number,payer:string,note:string,shares:Array<{personId:string,name:string,amount:number,remaining:number}>,memberTotal:number,due:number,groupAmount:number,yourShare:number|null}>,
 *           totals:{count:number,total:number,memberTotal:number,due:number}}}
 */
export function buildGroupExpenseList({ groupId, memberIds = [], meId = null, includePeople = false, groupName = "", groupNameOf = () => "", txns = [], bills = [], billerAccounts = [], from, to, nameOf = id => String(id) }) {
  const gid = String(groupId);
  const inRange = d => d && d >= from && d <= to;
  const members = new Set((memberIds || []).map(String));
  const sharesOf = map => Object.entries(map || {})
    .filter(([pid, info]) => members.has(String(pid)) && info && info.mode === "owes" && Number(info.amount) > 0 && !info.transferredTo)
    .map(([pid, info]) => ({ personId: pid, name: nameOf(pid), amount: R(P(info.amount)), remaining: R(P(remainingShare(info))) }));
  const nick = meterNicknamer(billerAccounts);
  // "July Water Bill (Office)": the statements' own naming, with the meter's nickname. For a family the person is NOT part of, a bill that is entirely theirs reads
  // "(Suryamandal)" instead (the group's name), while a bill they only share in keeps its meter, e.g. "(Common Meter)".
  const billTitle = (b, forThemOnly = false) => (meId == null && forThemOnly && groupName ? billMonthTitle(b, { nickname: groupName }) : billMonthTitle(b, { nickname: nick(b) }));
  const isMe = id => meId != null && String(id) === String(meId);
  // Whose part each expense is. Members with a share each have theirs; the person using Arth has what is left of the total (yourShare). With no split it is the
  // person it is tagged to (a member, or the person using Arth: "attributed to my name"), else it belongs to the group as a whole (personId null).
  // How much of an expense is THIS group's. A purchase can be split across groups ("Txn break up": groupAllocations), or tagged to one group with an owed amount
  // (groupCollectiveAmount: say 547 of a 1,150 purchase); tagged only, with no amount, the whole of it belongs to the group. Returns null when it is not this group's.
  const groupPart = t => {
    const alloc = (t.groupAllocations || []).find(g => String(g.groupId) === gid && Number(g.amount) > 0);
    if (alloc) {
      const amt = P(alloc.amount), owed = alloc.mode === "owes", tc = P(t.groupCollectiveAmount), ts = P(t.groupCollectiveSettledAmt);
      return { amt, owed, settled: owed ? (tc > 0 ? Math.min(amt, Math.round((ts * amt) / tc)) : 0) : 0 };
    }
    if (String(t.groupId || "") === gid) { const c = P(t.groupCollectiveAmount); return c > 0 ? { amt: c, owed: true, settled: Math.min(c, P(t.groupCollectiveSettledAmt)) } : { amt: 0, owed: false, settled: 0 }; }
    return null;
  };
  // each part also says how much of it is still unpaid (`remaining`): a member's unpaid share, the group's unpaid allocation; the person's own part and a bare tag owe nothing
  // What a person tagged on an expense (no share recorded) owes: the same rule the balances use (tagPersonAmount, else the whole amount for a "they owe me back" tag, else nothing: a bare tag)
  const tagClaim = t => { const a = Number(t.tagPersonAmount || 0); return R(a > 0 ? P(a) : (t.tagMode === "person" ? P(t.amount) : 0)); };
  const partsOf = ({ shares, total, yourShare, forPerson, groupAmt = 0, groupRem = 0, tagRem = 0 }) => {
    const out = shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount, remaining: x.remaining }));
    if (shares.length) { if (yourShare > 0 && meId != null) out.push({ personId: meId, name: nameOf(meId), amount: yourShare, remaining: 0 }); return out; }
    if (forPerson && (members.has(String(forPerson)) || isMe(forPerson))) return [{ personId: String(forPerson), name: nameOf(forPerson), amount: total, remaining: isMe(forPerson) ? 0 : tagRem }];
    return [{ personId: null, name: "", amount: groupAmt > 0 ? groupAmt : total, remaining: groupRem }];   // the group's own part: what was allocated to it, else the whole
  };
  const items = [];
  const paidBillIds = new Set();
  for (const t of txns || []) {
    if (!t || t.type !== "expense" || t.isRefund) continue;
    const gp = groupPart(t);
    if (!gp) continue;
    const date = String(t.date || "").slice(0, 10);
    if (!inRange(date)) continue;
    if (t.paidBillId != null) paidBillIds.add(String(t.paidBillId));
    const shares = sharesOf({ ...(t.splitPeople || {}), ...(t.people || {}) });
    const memberTotal = R(shares.reduce((s, x) => s + P(x.amount), 0));
    const total = R(P(t.amount));
    const paidBill = t.paidBillId != null ? (bills || []).find(b => b && String(b.id) === String(t.paidBillId)) : null;
    const yourShare = shares.length && !(Number(t.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null;
    items.push({ key: `txn:${t.id}`, kind: "expense", scope: "group", isBill: t.paidBillId != null, id: t.id, date, title: paidBill ? billTitle(paidBill, !shares.length || P(memberTotal) >= P(total) - 1) : (t.paidBillName || vendorOf(t)), total,
      payer: t.paidByPersonId ? nameOf(t.paidByPersonId) : "you", note: String(t.note || ""), shares, memberTotal, due: R(shares.reduce((s, x) => s + P(x.remaining), 0) + (gp.owed ? gp.amt - gp.settled : 0) + (!shares.length && t.forPerson && !isMe(t.forPerson) && !(gp.owed) ? tagClaim(t) : 0)),
      groupAmount: R(gp.amt), yourShare, parts: partsOf({ shares, total, yourShare, forPerson: t.forPerson, groupAmt: R(gp.amt), groupRem: gp.owed ? R(gp.amt - gp.settled) : 0, tagRem: t.forPerson && !shares.length ? tagClaim(t) : 0 }), categories: categorySplit(t, P(total)) });
  }
  for (const b of bills || []) {
    if (!b || String(b.groupId || "") !== gid || b.status === "cancelled" || b.skipped) continue;
    if (paidBillIds.has(String(b.id)) || b.paidByTxnId != null) continue;   // its payment entry is already in the list (or out of the period)
    // a bill with a payment entry is that entry, unless the bill is still open (the balances still count it) and its payment is not in this list (not tagged to the group): then the bill carries the claim
    if (b.status !== "unpaid" && (txns || []).some(t => t && t.paidBillId != null && String(t.paidBillId) === String(b.id))) continue;
    const date = dateOfBill(b);
    if (!inRange(date)) continue;
    const src = getBillSplitSource(b, txns);
    const shares = sharesOf(src.people);
    const memberTotal = R(shares.reduce((s, x) => s + P(x.amount), 0));
    const total = R(P(b.amount));
    const yourShareB = shares.length && !(Number(b.groupCollectiveAmount) > 0) ? Math.max(0, R(P(total) - P(memberTotal))) : null;
    items.push({ key: `bill:${b.id}`, kind: "bill", scope: "group", id: b.id, date, title: billTitle(b, !shares.length || P(memberTotal) >= P(total) - 1), total, payer: "not paid yet", note: "", shares, memberTotal,
      due: R(shares.reduce((s, x) => s + P(x.remaining), 0) + Math.max(0, P(b.groupCollectiveAmount) - P(b.groupCollectiveSettledAmt))), groupAmount: R(P(b.groupCollectiveAmount)), yourShare: yourShareB, parts: partsOf({ shares, total, yourShare: yourShareB, forPerson: null, groupAmt: R(P(b.groupCollectiveAmount)), groupRem: R(Math.max(0, P(b.groupCollectiveAmount) - P(b.groupCollectiveSettledAmt))) }), categories: categorySplit({ catId: b.catId, catIds: b.catIds }, P(total)) });
  }
  // Expenses tagged to the group's PEOPLE rather than to the group (a member's own K Auto, a bill split to a member), when asked for: one statement for both.
  // Only what the members bear is counted (their shares, or the amount tagged to them), never the whole expense, and anything tagged to ANOTHER group is left to that group.
  if (includePeople) {
    const taken = new Set(items.map(i => i.key));
    for (const t of txns || []) {
      if (!t || t.type !== "expense" || t.isRefund || groupPart(t)) continue;   // (this group's own are already listed; another group's count too: a member bears them)
      const date = String(t.date || "").slice(0, 10);
      if (!inRange(date) || taken.has(`txn:${t.id}`)) continue;
      const shares = sharesOf({ ...(t.splitPeople || {}), ...(t.people || {}) });
      const tagged = !shares.length && t.forPerson && members.has(String(t.forPerson));
      // amounts tagged to a member item by item (tagItems), counted by the balances unless that member already has an open share on the expense
      const shareIds = new Set(shares.map(x => String(x.personId)));
      const itemParts = (t.tagItems || []).filter(it => it && it.targetType === "person" && it.targetId != null && members.has(String(it.targetId)) && !shareIds.has(String(it.targetId)) && Number(it.amount || 0) > 0)
        .map(it => ({ personId: String(it.targetId), name: nameOf(it.targetId), amount: R(P(it.amount)), remaining: R(P(it.amount)) }));
      if (!shares.length && !tagged && !itemParts.length) continue;
      if (t.paidBillId != null) paidBillIds.add(String(t.paidBillId));
      const total = R(P(t.amount));
      const parts = [...(shares.length ? shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount, remaining: x.remaining })) : (tagged ? [{ personId: String(t.forPerson), name: nameOf(t.forPerson), amount: total, remaining: tagClaim(t) }] : [])), ...itemParts];
      const mine = R(parts.reduce((sum, x) => sum + P(x.amount), 0));
      const paidBill = t.paidBillId != null ? (bills || []).find(b => b && String(b.id) === String(t.paidBillId)) : null;
      items.push({ key: `txn:${t.id}`, kind: "expense", scope: "people", isBill: t.paidBillId != null, fromGroup: t.groupId ? groupNameOf(t.groupId) || "another group" : "", id: t.id, date, title: paidBill ? billTitle(paidBill, !t.groupId && P(mine) >= P(total) - 1) : (t.paidBillName || vendorOf(t)), total: mine,
        payer: t.paidByPersonId ? nameOf(t.paidByPersonId) : "you", note: String(t.note || ""), shares, memberTotal: mine, due: R(parts.reduce((sum, x) => sum + P(x.remaining), 0)),
        groupAmount: 0, yourShare: null, parts, categories: categorySplit(t, P(mine)) });
    }
    for (const b of bills || []) {
      if (!b || String(b.groupId || "") === gid || b.status === "cancelled" || b.skipped || paidBillIds.has(String(b.id)) || b.paidByTxnId != null) continue;
      if ((txns || []).some(t => t && t.paidBillId != null && String(t.paidBillId) === String(b.id))) continue;
      const date = dateOfBill(b);
      if (!inRange(date)) continue;
      const shares = sharesOf(getBillSplitSource(b, txns).people);
      if (!shares.length) continue;
      const mine = R(shares.reduce((sum, x) => sum + P(x.amount), 0));
      items.push({ key: `bill:${b.id}`, kind: "bill", scope: "people", fromGroup: b.groupId ? groupNameOf(b.groupId) || "another group" : "", id: b.id, date, title: billTitle(b, !b.groupId && P(mine) >= P(b.amount) - 1), total: mine, payer: "not paid yet", note: "", shares, memberTotal: mine,
        due: R(shares.reduce((sum, x) => sum + P(x.remaining), 0)), groupAmount: 0, yourShare: null, parts: shares.map(x => ({ personId: x.personId, name: x.name, amount: x.amount, remaining: x.remaining })), categories: categorySplit({ catId: b.catId, catIds: b.catIds }, P(mine)) });
    }
  }
  // A group the person using Arth is NOT part of (a neighbour's family): the statement is the family's, so an item counts at what the family bears (its parts), and the
  // rest of a shared bill, which is the person's own, is not in it. `wholeTotal` keeps what the expense cost.
  if (meId == null) {
    for (const i of items) {
      i.wholeTotal = i.total; i.total = R(i.parts.reduce((sum, x) => sum + P(x.amount), 0));
      if (i.wholeTotal > 0 && i.total !== i.wholeTotal) {                                   // the categories follow the family's part of the expense
        const r = i.total / i.wholeTotal; let left = P(i.total);
        i.categories = i.categories.map((c, k, arr) => { const paise = k === arr.length - 1 ? left : Math.round(P(c.amount) * r); left -= paise; return { ...c, amount: R(paise) }; }).filter(c => c.amount > 0);
      }
    }
  }
  for (const i of items) i.soloName = i.kind === "expense" && i.parts.length === 1 && i.parts[0].personId != null && !i.isBill ? i.parts[0].name : "";   // "Person B - Vendor - amount"; bills are never named after a person
  items.sort((a, b) => a.date.localeCompare(b.date) || String(a.key).localeCompare(String(b.key)));
  const sum = k => R(items.reduce((s, i) => s + P(i[k]), 0));
  return { items, totals: { count: items.length, total: sum("total"), memberTotal: sum("memberTotal"), due: sum("due") } };
}

/**
 * "Only what is still unpaid": keeps the items with something still owed, and cuts each down to what is still owed: members with an unpaid share, at that unpaid
 * amount; the group's own allocation, at what is left of it. Parts that owe nothing (the person's own, a bare tag) and settled shares drop out. Pure; returns new items.
 * Meant for items built with meId = null (a family the person is not part of), but safe for any.
 */
export function unpaidOnly(items) {
  const out = [];
  for (const i of items || []) {
    const parts = (i.parts || []).filter(p => (Number(p.remaining) || 0) > 0.004).map(p => ({ ...p, amount: R(P(p.remaining)) }));
    if (!parts.length) continue;
    const total = R(parts.reduce((s, p) => s + P(p.amount), 0));
    out.push({ ...i, parts, total, wholeTotal: i.wholeTotal || i.total, categories: i.total > 0 && total !== i.total ? scaleCats(i.categories, total / i.total, total) : i.categories });
  }
  return out;
}
function scaleCats(cats, r, total) {
  let left = P(total);
  return (cats || []).map((c, k, arr) => { const paise = k === arr.length - 1 ? left : Math.round(P(c.amount) * r); left -= paise; return { ...c, amount: R(paise) }; }).filter(c => c.amount > 0);
}

/**
 * What the cards say is owed that no listed entry explains, one item per person (and one for the group itself), so a statement that is meant to
 * reach the card total can say so openly instead of leaving it out. `cardParts` = { byPerson: {pid: owed}, group: owed }, the figures the group page
 * shows; the listed side is the unpaid amount on this list's items. Only a positive difference becomes an item (a smaller card figure is paybacks
 * or petty cash netted off, which are not entries). Pure.
 */
export function notItemised(items, cardParts, { nameOf = id => String(id), date = "" } = {}) {
  const listed = {}; let groupListed = 0;
  for (const i of items || []) for (const p of i.parts || []) {
    const r = Number(p.remaining) || 0;
    if (p.personId == null) groupListed += r; else listed[String(p.personId)] = (listed[String(p.personId)] || 0) + r;
  }
  const out = [];
  const add = (key, pid, name, diff) => {
    const total = R(P(diff));
    out.push({ key, kind: "expense", scope: pid == null ? "group" : "people", isBill: false, fromGroup: "", id: key, date, title: "Other balance (no entry to list)", total, payer: "", note: "", shares: [], memberTotal: total, due: total,
      groupAmount: pid == null ? total : 0, yourShare: null, parts: [{ personId: pid, name, amount: total, remaining: total }], categories: [{ catId: null, amount: total, labels: [] }], soloName: pid == null ? "" : name, notItemised: true });
  };
  for (const [pid, card] of Object.entries((cardParts && cardParts.byPerson) || {})) {
    const diff = Math.round((Number(card || 0) - (listed[String(pid)] || 0)) * 100) / 100;
    if (diff >= 0.5) add(`gap:${pid}`, String(pid), nameOf(pid), diff);
  }
  const gd = Math.round((Number((cardParts && cardParts.group) || 0) - groupListed) * 100) / 100;
  if (gd >= 0.5) add("gap:group", null, "", gd);
  return out;
}
