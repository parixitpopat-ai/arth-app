// src/domain/person/repaymentCheck.js — finds repayments from a person that are recorded but not reflected in what they owe, and applies a fix the person confirms. Pure.
//
// Two kinds of problem (both leave a share showing as owed although the money was received):
//   "unreduced" : a repayment's links say "₹X was paid against this item" but the item's live share (its settledAmt) was never raised to match. This happened when a
//                 repayment against a PAID bill updated only the bill's stale copy, not the payment entry that holds the live split (see domain/bills/splitSource.js).
//   "unlinked"  : a repayment saved without choosing any item has no links, so it is counted neither as paid nor as an advance (the person's page ignores it).
// A fix only ever RAISES a share's settled amount, capped at the share, and never touches the repayment's money (amount, account, date). Every fix returns an undo.
import { getBillSplitSource } from "../bills/splitSource.js";

const P = n => Math.round((Number(n) || 0) * 100);
const R = p => Math.round(p) / 100;
const base = k => String(k || "").replace(/^group-/, "");
const settledOf = info => (info && info.settled && info.settledAmt == null ? P(info.amount) : P(info && info.settledAmt));
const isRepayment = t => t && t.type === "settlement_in" && !t.isRefund && t.fromPersonId;

/** The record that holds this person's LIVE share for a link: a transaction's people entry, a bill's split, or (for a paid bill) its payment entry. */
export function liveShare(link, personId, txns, bills) {
  if (base(link.kind) === "txn") {
    const t = (txns || []).find(x => String(x.id) === String(link.id));
    const info = t && ((t.people && t.people[personId]) || (t.splitPeople && t.splitPeople[personId]));
    return info ? { recordKind: "txn", recordId: t.id, info, title: t.desc || t.merchant || "Expense", date: String(t.date || "") } : null;
  }
  const b = (bills || []).find(x => String(x.id) === String(link.id));
  if (!b) return null;
  const src = getBillSplitSource(b, txns);
  const info = src.people && src.people[personId];
  return info ? { recordKind: src.kind, recordId: src.id, info, title: b.name || b.merchant || "Bill", date: String(b.billDate || b.createdDate || b.dueDate || "") } : null;
}

/**
 * @returns {{unreduced:Array, unlinked:Array}}
 *  unreduced: [{ key, personId, recordKind, recordId, title, shareAmount, settledNow, settleTo, diff, repayments:[{id,date,amount}] }]
 *  unlinked : [{ key, id, date, desc, amount, candidates:[{kind,id,title,date,remaining}], suggested:{...}|null, ambiguous:boolean }]
 */
export function findRepaymentProblems({ personId, txns = [], bills = [] }) {
  // 1) links that say "paid" but whose live share was not raised
  const byRecord = new Map();
  for (const t of txns) {
    if (!isRepayment(t)) continue;
    for (const l of t.settlementLinks || []) {
      const owner = l.personId || t.fromPersonId;
      if (owner !== personId || !(P(l.amount) > 0)) continue;
      const live = liveShare(l, personId, txns, bills);
      if (!live) continue;
      const key = `${live.recordKind}:${live.recordId}`;
      const e = byRecord.get(key) || { live, linked: 0, repayments: [] };
      e.linked += P(l.amount); e.repayments.push({ id: t.id, date: String(t.date || ""), amount: R(P(l.amount)) });
      byRecord.set(key, e);
    }
  }
  const unreduced = [];
  for (const [key, e] of byRecord) {
    const info = e.live.info;
    if (info.mode !== "owes" || info.transferredTo) continue;
    const amount = P(info.amount), now = settledOf(info), to = Math.min(amount, e.linked);
    if (to - now > 0) unreduced.push({ key, personId, recordKind: e.live.recordKind, recordId: e.live.recordId, title: e.live.title, shareAmount: R(amount), settledNow: R(now), settleTo: R(to), diff: R(to - now), repayments: e.repayments });
  }

  // 2) repayments with no links at all, and the open items they could belong to (exact amount first)
  const open = [];
  for (const t of txns) {
    if (t.type !== "expense") continue;
    const info = (t.people && t.people[personId]) || (t.splitPeople && t.splitPeople[personId]);
    if (info && info.mode === "owes" && !info.transferredTo && P(info.amount) - settledOf(info) > 0) open.push({ kind: "txn", id: t.id, title: t.desc || t.merchant || "Expense", date: String(t.date || ""), remaining: R(P(info.amount) - settledOf(info)) });
  }
  for (const b of bills) {
    const src = getBillSplitSource(b, txns);
    if (src.kind !== "bill") continue;
    const info = src.people && src.people[personId];
    if (info && info.mode === "owes" && !info.transferredTo && P(info.amount) - settledOf(info) > 0) open.push({ kind: "bill", id: b.id, title: b.name || b.merchant || "Bill", date: String(b.billDate || b.createdDate || b.dueDate || ""), remaining: R(P(info.amount) - settledOf(info)) });
  }
  const used = new Set(), unlinked = [];
  const reps = txns.filter(t => isRepayment(t) && t.fromPersonId === personId && !(t.settlementLinks || []).length && !t.againstTxnId && !t.linkedLoanId && P(t.amount) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const t of reps) {
    const amt = P(t.amount);
    const exact = open.filter(o => P(o.remaining) === amt && !used.has(`${o.kind}:${o.id}`));
    const suggested = exact.length === 1 ? exact[0] : null;
    if (suggested) used.add(`${suggested.kind}:${suggested.id}`);
    unlinked.push({ key: `rep:${t.id}`, id: t.id, date: String(t.date || ""), desc: t.desc || "Repayment", amount: R(amt), candidates: open.filter(o => !used.has(`${o.kind}:${o.id}`) || o === suggested), suggested, ambiguous: exact.length > 1 });
  }
  return { unreduced, unlinked };
}

const setShare = (rec, personId, settleTo) => {
  const field = rec.people && rec.people[personId] ? "people" : (rec.splitPeople && rec.splitPeople[personId] ? "splitPeople" : null);
  if (!field) return rec;
  const info = rec[field][personId], amount = P(info.amount), to = Math.min(amount, Math.max(P(settleTo), settledOf(info)));
  return { ...rec, [field]: { ...rec[field], [personId]: { ...info, settledAmt: R(to), remainingAmt: R(amount - to), settled: amount - to <= 0 } }, updatedAt: Date.now() };
};
const swap = (list, id, fn) => (list || []).map(x => (String(x.id) === String(id) ? fn(x) : x));

/**
 * Apply one fix. Returns { txns, bills, undo } (undo = the records as they were) or null when it does not apply.
 * fix: { type:"unreduced", personId, recordKind, recordId, settleTo }
 *   or { type:"link", personId, repaymentId, link:{kind,id,amount,title} }  (the live share is raised by link.amount, capped at the share)
 */
export function applyRepaymentFix({ txns, bills }, fix) {
  const was = { txns: [], bills: [] };
  const remember = (kind, id) => { const list = kind === "bill" ? bills : txns; const r = (list || []).find(x => String(x.id) === String(id)); if (r) was[kind === "bill" ? "bills" : "txns"].push(r); };
  if (fix.type === "unreduced") {
    remember(fix.recordKind === "bill" ? "bill" : "txn", fix.recordId);
    const t2 = fix.recordKind === "bill" ? txns : swap(txns, fix.recordId, r => setShare(r, fix.personId, fix.settleTo));
    const b2 = fix.recordKind === "bill" ? swap(bills, fix.recordId, r => setShare(r, fix.personId, fix.settleTo)) : bills;
    return was.txns.length || was.bills.length ? { txns: t2, bills: b2, undo: was } : null;
  }
  if (fix.type === "link") {
    const live = liveShare(fix.link, fix.personId, txns, bills);
    const rep = (txns || []).find(x => String(x.id) === String(fix.repaymentId));
    if (!live || !rep || (rep.settlementLinks || []).length) return null;
    remember("txn", rep.id); remember(live.recordKind === "bill" ? "bill" : "txn", live.recordId);
    const add = Math.min(P(fix.link.amount), P(live.info.amount) - settledOf(live.info));
    if (!(add > 0)) return null;
    const link = { kind: fix.link.kind, id: fix.link.id, personId: fix.personId, amount: R(add), title: fix.link.title || live.title };
    let t2 = swap(txns, rep.id, r => ({ ...r, settlementLinks: [link], appliedAmount: R(add), extraAmount: Math.max(0, R(P(r.amount) - add)), updatedAt: Date.now() }));
    let b2 = bills;
    if (live.recordKind === "bill") b2 = swap(bills, live.recordId, r => setShare(r, fix.personId, (settledOf(r.splitPeople[fix.personId]) + add) / 100));
    else t2 = swap(t2, live.recordId, r => setShare(r, fix.personId, (settledOf((r.people || r.splitPeople)[fix.personId]) + add) / 100));
    return { txns: t2, bills: b2, undo: was };
  }
  return null;
}

/** Put the records an applied fix changed back exactly as they were. */
export function undoRepaymentFix({ txns, bills }, undo) {
  const back = (list, olds) => (list || []).map(x => olds.find(o => String(o.id) === String(x.id)) || x);
  return { txns: back(txns, undo.txns || []), bills: back(bills, undo.bills || []) };
}
