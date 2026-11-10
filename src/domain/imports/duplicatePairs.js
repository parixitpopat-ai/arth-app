// src/domain/imports/duplicatePairs.js — repeats that are ALREADY in the books: an entry you made by hand and an entry a statement import added for the same payment
// (same account, same amount, dates within DAY_WINDOW days). Merging keeps YOUR entry (category, people, notes) and gives it the import's link fields, so the
// next import recognises the row; the import's copy is removed. A category/sub-category the import's copy has and yours lacks is carried over. Pure; undoable.

import { DAY_WINDOW } from "./matchStatement.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const signed = t => (t.type === "expense" ? -1 : 1) * Math.round(Number(t.amount) * 100);
const onAccount = (t, accountId, linkedIds) => [t.accId, t.fromAccId, t.toAccId].some(id => id != null && (String(id) === String(accountId) || (linkedIds || []).some(l => String(l) === String(id))));
const hasCat = t => (t.catIds && t.catIds.length) || t.catId;

/** @returns {Array<{manual:object, imported:object}>} one-to-one, closest dates first */
export function findImportedDuplicates({ txns, accountId, linkedIds }) {
  const list = (txns || []).filter(t => t && t.date && Number.isFinite(Number(t.amount)) && (t.type === "expense" || t.type === "income") && onAccount(t, accountId, linkedIds));
  const imported = list.filter(t => t.importKey && !t.importMerged && t.importSource === "bank-statement");
  const manual = list.filter(t => !t.importKey);
  const used = new Set(), pairs = [];
  for (const imp of imported) {
    const cand = manual.filter(m => !used.has(m.id) && m.type === imp.type && signed(m) === signed(imp) && Math.abs(dayNum(m.date) - dayNum(imp.date)) <= DAY_WINDOW)
      .sort((a, b) => Math.abs(dayNum(a.date) - dayNum(imp.date)) - Math.abs(dayNum(b.date) - dayNum(imp.date)))[0];
    if (cand) { used.add(cand.id); pairs.push({ manual: cand, imported: imp }); }
  }
  return pairs;
}

/** @returns {{txns:Array, undo:{removed:Array, before:Array}}} */
export function applyDuplicateMerge(txns, pairs) {
  const byManual = new Map(pairs.map(p => [String(p.manual.id), p.imported])), drop = new Set(pairs.map(p => String(p.imported.id)));
  const before = [];
  const next = [];
  for (const t of txns || []) {
    if (drop.has(String(t.id))) continue;
    const imp = byManual.get(String(t.id));
    if (!imp) { next.push(t); continue; }
    before.push(t);
    const setRef = !t.transactionRef && Boolean(imp.transactionRef);
    const merged = { ...t, importKey: imp.importKey, importBatchId: imp.importBatchId, importSource: "bank-statement", importMerged: true, ...(setRef ? { transactionRef: imp.transactionRef, importSetRef: true } : {}) };
    if (!hasCat(t) && hasCat(imp)) { merged.catId = imp.catId; merged.catIds = imp.catIds; merged.subId = imp.subId; merged.subIds = imp.subIds; }
    next.push(merged);
  }
  return { txns: next, undo: { removed: pairs.map(p => p.imported), before } };
}

export function undoDuplicateMerge(txns, undo) {
  const orig = new Map(undo.before.map(t => [String(t.id), t]));
  const out = (txns || []).map(t => orig.get(String(t.id)) || t);
  return [...undo.removed, ...out];
}
