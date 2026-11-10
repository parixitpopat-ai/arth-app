// src/domain/imports/duplicatePairs.js — repeats that are ALREADY in the books: an entry you made by hand and an entry a statement import added for the same
// money movement on this account (same amount and direction, dates within DAY_WINDOW days). Merging keeps YOUR entry (category, people, notes) and gives it the
// import's link fields, so the next import recognises the row; the import's copy is removed. A category/sub-category the copy has and yours lacks is carried over.
// "Yours" may be any kind of entry that moves this account's money: an expense/investment (money out), income/settlement (money in), a transfer (out of or into
// this account), a card payment. A transfer between two of my accounts is one entry that two statements each show a leg of, so it can be merged into twice
// (once per statement) and then carries two import keys. Pure; undoable.

import { DAY_WINDOW } from "./matchStatement.js";
import { canTakeAnotherLink } from "./buildImport.js";
import { extractUtr } from "./utr.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const paiseOf = t => Math.round(Number(t.amount) * 100);
const isMine = (id, accountId, linkedIds) => id != null && (String(id) === String(accountId) || (linkedIds || []).some(l => String(l) === String(id)));
const hasCat = t => (t.catIds && t.catIds.length) || t.catId;

/** The effect of an entry on one account in paise (+ money in, − money out), or 0 when it does not touch it. */
export function effectOn(t, accountId, linkedIds) {
  const a = paiseOf(t);
  switch (t.type) {
    case "expense": case "investment": case "cc_emi": return isMine(t.accId, accountId, linkedIds) ? -a : 0;
    case "income": case "settlement_in": return isMine(t.accId, accountId, linkedIds) ? a : 0;
    case "transfer": return (isMine(t.fromAccId, accountId, linkedIds) ? -a : 0) + (isMine(t.toAccId, accountId, linkedIds) ? a : 0);
    case "cc_payment": return (isMine(t.fromAccId, accountId, linkedIds) ? -a : 0) + (isMine(t.toAccId, accountId, linkedIds) ? a : 0);
    default: return 0;
  }
}

/** @returns {Array<{manual:object, imported:object}>} one-to-one, closest dates first */
export function findImportedDuplicates({ txns, accountId, linkedIds }) {
  const list = (txns || []).filter(t => t && t.date && Number.isFinite(Number(t.amount)));
  const imported = list.filter(t => t.importKey && !t.importMerged && t.importSource === "bank-statement" && (t.type === "expense" || t.type === "income") && isMine(t.accId, accountId, linkedIds));
  const manual = list.filter(t => t.id != null && canTakeAnotherLink(t));
  const used = new Set(), pairs = [];
  for (const imp of imported) {
    const want = effectOn(imp, accountId, linkedIds);
    const cand = manual.filter(m => !used.has(m.id) && m.id !== imp.id && !(m.importKey && m.importBatchId === imp.importBatchId && m.type === imp.type) && effectOn(m, accountId, linkedIds) === want && Math.abs(dayNum(m.date) - dayNum(imp.date)) <= DAY_WINDOW)
      .sort((a, b) => Math.abs(dayNum(a.date) - dayNum(imp.date)) - Math.abs(dayNum(b.date) - dayNum(imp.date)))[0];
    if (cand) { used.add(cand.id); pairs.push({ manual: cand, imported: imp }); }
  }
  return pairs;
}

/** @returns {{txns:Array, undo:{removed:Array, before:Array}}} */
export function applyDuplicateMerge(txns, pairs) {
  const byManual = new Map(pairs.map(p => [String(p.manual.id), p.imported])), drop = new Set(pairs.map(p => String(p.imported.id)));
  const before = [], next = [];
  for (const t of txns || []) {
    if (drop.has(String(t.id))) continue;
    const imp = byManual.get(String(t.id));
    if (!imp) { next.push(t); continue; }
    before.push(t);
    const refToSet = extractUtr({ desc: imp.bankNarration || imp.desc, ref: "" }) || imp.transactionRef || "";
    const setRef = !t.transactionRef && Boolean(refToSet);
    const keys = [...new Set([...(t.importKeys || (t.importKey ? [t.importKey] : [])), imp.importKey])];
    const merged = { ...t, importKey: t.importKey || imp.importKey, importKeys: keys, importBatchId: imp.importBatchId, importSource: "bank-statement", importMerged: true, ...(setRef ? { transactionRef: refToSet, importSetRef: true } : {}) };
    if ((t.type === "expense" || t.type === "income") && !hasCat(t) && hasCat(imp)) { merged.catId = imp.catId; merged.catIds = imp.catIds; merged.subId = imp.subId; merged.subIds = imp.subIds; }
    next.push(merged);
  }
  return { txns: next, undo: { removed: pairs.map(p => p.imported), before } };
}

export function undoDuplicateMerge(txns, undo) {
  const orig = new Map(undo.before.map(t => [String(t.id), t]));
  const out = (txns || []).map(t => orig.get(String(t.id)) || t);
  return [...undo.removed, ...out];
}
