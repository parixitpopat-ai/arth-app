// src/domain/person/personStatement.js — a person's (or a family's) STATEMENT from one date to another. Pure; reads only; never changes any record.
//
//   closing = brought forward + charges in the period − moved to someone else − payments applied (+ nothing else)
//
// Charges are the person's own shares, read from the same places the person's page reads them (domain/person/financialPosition.js), but with the FULL share
// and its history, not only what is still open: an expense or paid-bill share in a transaction's `people`, a person-tagged expense, a tagged item, and the split
// of an unpaid bill. A bill is placed by its generation date (billDate, else createdDate, else dueDate); the reading period and due date are carried along.
// Payments are the dated "repayment received" entries (settlement_in, not a refund). Each part of one is linked to an item AND to the person whose share it
// settles (link.personId, else the payer), so a payment recorded under a group is divided among the members who owe: only the parts for the person asked about count.
// A debt moved with "Transfer debt" shows as a MOVE (never as a payment); the new owner's "Transferred from" expense is an ordinary charge.
// Refunds are not netted here, exactly as the person's page does not net them. Amounts are held in paise so nothing drifts.
import { billMonthTitle } from "../bills/billMonthTitle.js";
import { getBillSplitSource } from "../bills/splitSource.js";
import { getFinancialPositionBreakdown } from "./financialPosition.js";

const P = n => Math.round((Number(n) || 0) * 100);
const R = p => Math.round(p) / 100;
const dateOf = b => String(b.billDate || b.createdDate || b.dueDate || "");
const kindBase = k => String(k || "").replace(/^group-/, "");

function chargeOf(t, personId, bills) {
  if (!t || t.type !== "expense") return null;
  const map = { ...(t.splitPeople || {}), ...(t.people || {}) };
  const info = map[personId];
  let amount = 0, transferredTo = null;
  if (info && info.mode === "owes") { amount = P(info.amount); transferredTo = info.transferredTo || null; }
  else if (t.forPerson && t.forPerson === personId) amount = P(Number(t.tagPersonAmount || 0) > 0 ? t.tagPersonAmount : (t.tagMode === "person" ? t.amount : 0));
  else {
    const item = (t.tagItems || []).find(i => i.targetType === "person" && i.targetId === personId && Number(i.amount || 0) > 0);
    if (item) amount = P(item.amount);
  }
  if (!(amount > 0)) return null;
  const bill = (bills || []).find(b => b.paidByTxnId != null && String(b.paidByTxnId) === String(t.id)) || (t.paidBillId != null ? (bills || []).find(b => String(b.id) === String(t.paidBillId)) : null);
  const src = bill || t;
  return { keys: [`txn:${t.id}`, ...(bill ? [`bill:${bill.id}`] : [])], kind: bill ? "bill" : "txn", sourceId: bill ? bill.id : t.id, billId: bill ? bill.id : null, txnId: t.id,
    date: bill ? dateOf(bill) || String(t.date || "") : String(t.date || ""), title: bill ? billMonthTitle(bill.name || bill.merchant ? bill : { ...bill, name: t.desc || "Bill" }) : (t.desc || t.merchant || "Expense"),
    billDate: bill ? dateOf(bill) : "", dueDate: bill ? String(bill.dueDate || "") : "", periodFrom: bill ? String(bill.billPeriodFrom || "") : "", periodTo: bill ? String(bill.billPeriodTo || "") : "",
    billerAccountId: bill ? bill.billerAccountId || null : null, bill, amount, transferredTo, note: String(t.note || ""), txnDate: String(t.date || "") };
}

/**
 * @param {{personId:string, txns:Array, bills:Array, from:string, to:string, nameOf?:(id:string)=>string, labelOf?:(charge:object)=>string}} args
 *   from/to are YYYY-MM-DD, inclusive. labelOf groups a charge into a section ("Electricity"); the default puts bills under "Bills" and the rest under "Own expenses".
 */
export function buildPersonStatement({ personId, txns = [], bills = [], from, to, nameOf = id => String(id), labelOf }) {
  const label = labelOf || (c => (c.billId ? "Bills" : "Own expenses"));
  const charges = [];
  for (const t of txns) { const c = chargeOf(t, personId, bills); if (c) charges.push(c); }
  for (const b of bills) {
    if (!b) continue;
    const src = getBillSplitSource(b, txns);
    if (src.kind === "txn") continue;                                    // a paid bill's share lives on its payment entry, counted above
    const info = src.people && src.people[personId];
    if (!info || info.mode !== "owes" || !(Number(info.amount) > 0)) continue;
    charges.push({ keys: [`bill:${b.id}`], kind: "bill", sourceId: b.id, billId: b.id, txnId: null, date: dateOf(b), title: billMonthTitle(b), billDate: dateOf(b), dueDate: String(b.dueDate || ""),
      periodFrom: String(b.billPeriodFrom || ""), periodTo: String(b.billPeriodTo || ""), billerAccountId: b.billerAccountId || null, bill: b, amount: P(info.amount), transferredTo: info.transferredTo || null, note: "", txnDate: "" });
  }

  // payments applied to this person, part by part
  const parts = [], unappliedPerson = [];
  for (const t of txns) {
    if (!t || t.type !== "settlement_in" || t.isRefund) continue;
    const date = String(t.date || "");
    let linked = 0;
    for (const l of t.settlementLinks || []) {
      const owner = l.personId || t.fromPersonId;
      const amt = P(l.amount);
      if (!(amt > 0)) continue;
      linked += amt;
      if (owner === personId) parts.push({ txnId: t.id, date, amount: amt, linkKey: `${kindBase(l.kind)}:${l.id}`, title: l.title || "", fromGroup: Boolean(t.fromGroupId) });
    }
    if (t.fromPersonId === personId) {
      const extra = P(t.extraAmount);
      if (extra > 0) parts.push({ txnId: t.id, date, amount: extra, linkKey: null, title: "Extra kept as advance", advance: true });
      const left = P(t.amount) - linked - extra;
      if (!(t.settlementLinks || []).length && P(t.appliedAmount || t.amount) > 0 && left > 0) unappliedPerson.push({ txnId: t.id, date, amount: P(t.appliedAmount != null ? t.appliedAmount : t.amount) - extra });
    }
  }
  for (const u of unappliedPerson) if (u.amount > 0) parts.push({ txnId: u.txnId, date: u.date, amount: u.amount, linkKey: null, title: "Applied to your balance, no bill chosen", noBill: true });

  // what has been paid on each charge (as of the end date)
  for (const c of charges) c.paid = parts.filter(p => p.linkKey && p.date <= to && c.keys.includes(p.linkKey)).reduce((s, p) => s + p.amount, 0);
  // a moved debt: everything not yet paid when it was moved. Dated by the transfer entry ("Debt transferred from <name>") when it can be found, else by the charge itself.
  for (const c of charges) {
    c.moved = 0; c.movedOn = null;
    if (c.transferredTo) {
      const tr = txns.filter(x => x.type === "expense" && String(x.note || "") === `Debt transferred from ${nameOf(personId)}` && x.people && x.people[c.transferredTo]).map(x => String(x.date || "")).sort()[0];
      c.movedOn = tr || c.date;
      const paidBefore = parts.filter(p => p.linkKey && c.keys.includes(p.linkKey) && p.date <= c.movedOn).reduce((s, p) => s + p.amount, 0);
      c.moved = Math.max(0, c.amount - paidBefore);
      c.paid = Math.min(c.paid, c.amount - c.moved);
    }
    c.due = c.amount - c.paid - c.moved;
  }

  const inRange = d => d >= from && d <= to;
  const before = d => d < from;
  const opening = charges.filter(c => before(c.date)).reduce((s, c) => s + c.amount, 0)
    - charges.filter(c => c.moved && before(c.movedOn)).reduce((s, c) => s + c.moved, 0)
    - parts.filter(p => before(p.date)).reduce((s, p) => s + p.amount, 0);
  const periodCharges = charges.filter(c => inRange(c.date));
  const moves = charges.filter(c => c.moved && inRange(c.movedOn));
  const periodParts = parts.filter(p => inRange(p.date));
  const sections = [];
  for (const c of periodCharges.sort((a, b) => a.date.localeCompare(b.date) || String(a.title).localeCompare(String(b.title)))) {
    const name = label(c);
    let s = sections.find(x => x.label === name);
    if (!s) { s = { label: name, items: [], subtotal: 0 }; sections.push(s); }
    s.items.push({ id: c.sourceId, kind: c.kind, title: c.title, date: c.date, billDate: c.billDate, dueDate: c.dueDate, periodFrom: c.periodFrom, periodTo: c.periodTo, note: c.note,
      amount: R(c.amount), paid: R(c.paid), moved: R(c.moved), movedTo: c.transferredTo, movedOn: c.movedOn, due: R(c.due), transferredFrom: /^Debt transferred from /.test(c.note) ? c.note.replace(/^Debt transferred from /, "") : null });
    s.subtotal += c.amount;
  }
  sections.forEach(s => { s.subtotal = R(s.subtotal); });
  const chargesTotal = periodCharges.reduce((s, c) => s + c.amount, 0), movedTotal = moves.reduce((s, c) => s + c.moved, 0), paidTotal = periodParts.reduce((s, p) => s + p.amount, 0);
  const byTxn = new Map();
  for (const p of periodParts.sort((a, b) => a.date.localeCompare(b.date))) {
    const e = byTxn.get(p.txnId) || { id: p.txnId, date: p.date, amount: 0, applied: [] };
    e.amount += p.amount;
    const ch = p.linkKey ? charges.find(c => c.keys.includes(p.linkKey)) : null;
    e.applied.push({ title: ch ? ch.title : p.title, billDate: ch ? ch.billDate : "", periodFrom: ch ? ch.periodFrom : "", periodTo: ch ? ch.periodTo : "", amount: R(p.amount), noBill: Boolean(p.noBill), advance: Boolean(p.advance) });
    byTxn.set(p.txnId, e);
  }
  const payments = [...byTxn.values()].map(e => ({ ...e, amount: R(e.amount) }));
  const closing = opening + chargesTotal - movedTotal - paidTotal;
  return { personId, from, to, opening: R(opening), sections, chargesTotal: R(chargesTotal), moved: moves.map(c => ({ title: c.title, to: c.transferredTo, on: c.movedOn, amount: R(c.moved) })), movedTotal: R(movedTotal),
    payments, paymentsTotal: R(paidTotal), closing: R(closing), settled: Math.abs(closing) < 0.005, credit: closing < -0.005 ? R(-closing) : 0 };
}

/**
 * A family: each member's statement, the sums, and the family payments not applied to any member (recorded under the group with no member linked).
 * @param {{memberIds:string[], groupId?:string}} args
 */
export function buildFamilyStatement({ memberIds, groupId, txns = [], bills = [], from, to, nameOf, labelOf }) {
  const members = memberIds.map(id => buildPersonStatement({ personId: id, txns, bills, from, to, nameOf, labelOf }));
  const sum = k => R(members.reduce((s, m) => s + P(m[k]), 0));
  const unapplied = [];
  if (groupId != null) {
    for (const t of txns) {
      if (!t || t.type !== "settlement_in" || t.isRefund || String(t.fromGroupId || "") !== String(groupId)) continue;
      const d = String(t.date || ""); if (d < from || d > to) continue;
      const toMembers = (t.settlementLinks || []).filter(l => memberIds.includes(l.personId || t.fromPersonId)).reduce((s, l) => s + P(l.amount), 0);
      const left = P(t.amount) - toMembers;
      if (left > 0) unapplied.push({ id: t.id, date: d, amount: R(left) });
    }
  }
  // a debt moved from one member to another changes nothing for the family: the original charge and the "Transferred from" charge cancel, so neither is counted
  const movedWithin = R(members.reduce((t, m) => t + m.moved.filter(x => memberIds.includes(x.to)).reduce((u, x) => u + P(x.amount), 0), 0));
  return { memberIds, from, to, members, opening: sum("opening"), chargesTotal: R(P(sum("chargesTotal")) - P(movedWithin)), movedWithinFamily: movedWithin, movedTotal: R(P(sum("movedTotal")) - P(movedWithin)),
    paymentsTotal: sum("paymentsTotal"), closing: sum("closing"), unapplied };
}

/** Does the statement's closing balance equal what the person's page shows owed (for an end date at or after the last entry)? */
export function reconcileWithPosition(statement, { txns, bills, meId }) {
  const items = getFinancialPositionBreakdown(statement.personId, txns, bills, meId);
  const owesMe = R(items.filter(i => i.mode === "owesMe").reduce((s, i) => s + P(i.amount), 0));
  return { pageOwesMe: owesMe, closing: statement.closing, difference: R(P(statement.closing) - P(owesMe)), matches: P(statement.closing) === P(owesMe) };
}
