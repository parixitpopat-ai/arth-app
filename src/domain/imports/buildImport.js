// src/domain/imports/buildImport.js — turns chosen statement rows into transaction records. Pure; never touches existing records.
// Debit -> expense (no category, so it surfaces under "Needs details"); credit -> income.
// A debit whose narration says it pays a credit card bill becomes a cc_payment to that card (matched by last four digits) so it is not
// counted as spending a second time. When no card can be matched it stays an expense and is flagged `cardBillUnmatched` for the preview.
import { extractUpiMerchant } from "../sms/smsFields.js";
import { parseUpiNarration, describeUpiNarration } from "./upiNarration.js";
import { extractUtr } from "./utr.js";

const BILL_WORDS = /\b(?:credit\s*card|cc|card)\b/i, PAY_WORDS = /\b(?:bill|payment|paid|dues?|statement|autopay)\b/i;

export function looksLikeCardBill(text) { const t = String(text || ""); return BILL_WORDS.test(t) && PAY_WORDS.test(t); }

export function findCardByText(text, cards) {
  const t = String(text || "");
  const hit = (cards || []).find(a => { const l = String(a.last4 || "").replace(/\D/g, ""); return l && new RegExp(`(?:^|[^0-9])${l}(?:[^0-9]|$)`).test(t); });
  return hit || ((cards || []).length === 1 ? cards[0] : null);
}

// a card statement prints the merchant as the description ("ZOMATO CYBS DELHI"): keep it as the vendor, in readable case (merge vendors later if needed)
const titleCase = s => String(s || "").toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\s+/g, " ").trim();

/** A card statement prints "UPI-211737389994-VIPULACH AL ENTERPRISE IN" or "ZOMATO CYBS NEWDELHI IN": drop the UPI prefix and the trailing country code. */
// A card statement writes a UPI payment made with the card as just "UPI-UPI-<reference>": no shop name at all. Say so instead of showing the raw text.
const cardVendor = d => { const c = cleanCardMerchant(d); return c === "UPI payment" ? c : titleCase(c); };
const BARE_UPI = /^\s*UPI[-/]UPI[-/]\d{6,16}\s*$/i;
export function cleanCardMerchant(desc) {
  if (BARE_UPI.test(String(desc || ""))) return "UPI payment";
  return String(desc || "").replace(/^.{0,80}?(?<![a-z])UPI[-/_]\d{9,14}[-/_]/i, "").replace(/\s+IN\s*$/i, "").replace(/\s+/g, " ").trim();
}

/** Entries an earlier version named "Dr"/"Cr" (the UPI/DR/… segment taken as the vendor) or with a "Upi-<ref>-…" vendor, with the name they should have. Read-only plan. */
export function planNameRepairs(txns) {
  const out = [];
  for (const t of txns || []) {
    if (!t || !t.importKey || t.type !== "expense") continue;
    const m = String(t.merchant || "");
    const raw = t.bankNarration || t.desc || "";
    let next = null;
    if (BARE_UPI.test(m)) next = "UPI payment";
    else if (/^(dr|cr)$/i.test(m)) { const p = parseUpiNarration(raw); next = p && p.name ? titleCase(p.name) : null; }
    else if (/^.{0,80}?(?<![a-z])upi[-/_]\d{9,14}[-/_]/i.test(m)) next = cardVendor(m);
    // no vendor at all, only the raw "UPI-<ref>-NAME" text (the screen then shows that text as the title): take the name from it
    else if (!m.trim() && /^.{0,80}?(?<![a-z])upi[-/_]\d{9,14}[-/_]/i.test(raw)) { const n = extractUpiMerchant(raw) || cardVendor(raw); if (n && !/^upi\b/i.test(n)) next = n; }
    if (next && next !== m) out.push({ id: t.id, from: m, to: next });
  }
  return out;
}

/** Entries a merge gave a reference that is not the UPI reference (a card statement's SerNo): the UTR is still in the import key's text. Read-only plan. */
export function planRefRepairs(txns) {
  const out = [];
  for (const t of txns || []) {
    if (!t || !t.importMerged || !t.importSetRef || !t.transactionRef) continue;
    const text = String(t.importKey || "");
    const m = /\b(?:upi|imps)\b[^|]*?(?<!\d)(\d{12})(?!\d)/i.exec(text);
    if (m && String(t.transactionRef) !== m[1] && !/^\d{12}$/.test(String(t.transactionRef))) out.push({ id: t.id, field: "transactionRef", from: t.transactionRef, to: m[1] });
  }
  // imported entries whose UPI / bank reference box is EMPTY although the statement or SMS text they came from carries one (e.g. "UPI-UPI-11104450178")
  const have = new Set(out.map(c => String(c.id)));
  for (const t of txns || []) {
    if (!t || !t.importKey || t.transactionRef || have.has(String(t.id))) continue;
    const ref = extractUtr({ desc: String(t.bankNarration || t.desc || "") });
    if (ref) out.push({ id: t.id, field: "transactionRef", from: "", to: ref, filled: true });
  }
  return out;
}

export function cleanMerchant(desc) {
  const upi = extractUpiMerchant(desc);
  if (upi) return upi;
  return "";
}

/** @param {{row:object,status:string,matchId?:string}[]} chosen rows to import (each row has importKey)
 *  @param {{accountId:string, batchId:string, cards:Array, newId:()=>string}} ctx */
export function buildImportTxns(chosen, { accountId, batchId, cards, newId, plainExpenses = false, accountType = "" }) {
  return chosen.map(({ row }) => {
    // A UPI narration carries the 12-digit UPI reference and the other party: use them (a reference the file already has is kept).
    const upi = parseUpiNarration(row.desc);
    const abs = Math.abs(row.amountPaise) / 100, base = { id: newId(), date: row.date, amount: abs, desc: upi ? describeUpiNarration(upi) : (row.desc || ""), importKey: row.importKey, importBatchId: batchId, importSource: "bank-statement", bankNarration: row.desc || "", transactionRef: extractUtr(row) || row.ref || null, catId: null, catIds: [], subId: null, subIds: [], people: {} };
    if (row.amountPaise > 0) return { ...base, type: "income", accId: accountId, merchant: "" };
    if (!plainExpenses && looksLikeCardBill(row.desc)) {
      const card = findCardByText(row.desc, cards);
      if (card) return { ...base, type: "cc_payment", fromAccId: accountId, toAccId: card.id, accId: null, note: "Statement payment", merchant: "" };
      return { ...base, type: "expense", accId: accountId, merchant: "", cardBillUnmatched: true };
    }
    // A bank debit whose narration carries a UPI reference was paid by UPI: say so in the entry's Payment Method (the same field the Add form fills for a bank account).
    const byUpi = accountType === "bank" && !plainExpenses && Boolean(extractUtr(row));
    return { ...base, type: "expense", accId: accountId, merchant: plainExpenses ? cardVendor(row.desc) : cleanMerchant(row.desc), ...(byUpi ? { paymentMethod: "UPI" } : {}) };
  });
}

/** Ids of everything a given batch created, so it can be undone as a unit. */
export const batchTxnIds = (txns, batchId) => (txns || []).filter(t => t.importBatchId === batchId).map(t => t.id);
// A transfer between two of my accounts is ONE entry that two statements each show a leg of, so it can carry two import keys (importKeys).
export const importedKeysOf = txns => [...new Set((txns || []).flatMap(t => [t.importKey, ...(Array.isArray(t.importKeys) ? t.importKeys : [])]).filter(Boolean))];
export const canTakeAnotherLink = t => !t.importKey || ((t.type === "transfer" || t.type === "cc_payment") && (t.importKeys || [t.importKey]).filter(Boolean).length < 2);

// ── merging a statement row into an entry the person already has ──────────────────────────────────────────────────────────────────
// "Merge" keeps the existing entry exactly as it is (category, people, notes, amount, date) and only adds the link fields below, so the same
// statement row is recognised next time (importKey) and the whole import can be undone. The statement's reference is copied only when the entry
// has none. An entry can be linked once: it is never merged into a second time.
const LINK_FIELDS = ["importKey", "importKeys", "importBatchId", "importSource", "importMerged", "importSetRef"];

/** @param {Array} txns @param {{txnId:string,row:{importKey:string,ref?:string}}[]} merges @returns {Array} new list; entries not merged are the same objects */
export function applyMerges(txns, merges, { batchId }) {
  const byId = new Map((merges || []).map(m => [String(m.txnId), m.row]));
  return (txns || []).map(t => {
    const row = byId.get(String(t.id));
    if (!row || !canTakeAnotherLink(t)) return t;
    const refToSet = extractUtr(row) || row.ref || "";               // a UPI payment's reference is its UTR; a card statement's SerNo is not a UPI reference
    const setRef = !t.transactionRef && Boolean(refToSet);
    const keys = [...new Set([...(t.importKeys || (t.importKey ? [t.importKey] : [])), row.importKey])];
    return { ...t, importKey: t.importKey || row.importKey, importKeys: keys, importBatchId: batchId, importSource: "bank-statement", importMerged: true, ...(setRef ? { transactionRef: refToSet, importSetRef: true } : {}) };
  });
}

/** Undo one import batch: entries it created are removed; entries it only linked are put back exactly (link fields removed, a copied reference removed). */
export function undoImportBatch(txns, batchId) {
  const out = [];
  for (const t of txns || []) {
    if (t.importBatchId !== batchId) { out.push(t); continue; }
    if (!t.importMerged) continue;
    const u = { ...t };
    if (u.importSetRef) u.transactionRef = null;
    LINK_FIELDS.forEach(k => { delete u[k]; });
    out.push(u);
  }
  return out;
}
