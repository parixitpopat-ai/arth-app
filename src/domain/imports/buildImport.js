// src/domain/imports/buildImport.js — turns chosen statement rows into transaction records. Pure; never touches existing records.
// Debit -> expense (no category, so it surfaces under "Needs details"); credit -> income.
// A debit whose narration says it pays a credit card bill becomes a cc_payment to that card (matched by last four digits) so it is not
// counted as spending a second time. When no card can be matched it stays an expense and is flagged `cardBillUnmatched` for the preview.
import { extractUpiMerchant } from "../sms/smsFields.js";

const BILL_WORDS = /\b(?:credit\s*card|cc|card)\b/i, PAY_WORDS = /\b(?:bill|payment|paid|dues?|statement|autopay)\b/i;

export function looksLikeCardBill(text) { const t = String(text || ""); return BILL_WORDS.test(t) && PAY_WORDS.test(t); }

export function findCardByText(text, cards) {
  const t = String(text || "");
  const hit = (cards || []).find(a => { const l = String(a.last4 || "").replace(/\D/g, ""); return l && new RegExp(`(?:^|[^0-9])${l}(?:[^0-9]|$)`).test(t); });
  return hit || ((cards || []).length === 1 ? cards[0] : null);
}

export function cleanMerchant(desc) {
  const upi = extractUpiMerchant(desc);
  if (upi) return upi;
  return "";
}

/** @param {{row:object,status:string,matchId?:string}[]} chosen rows to import (each row has importKey)
 *  @param {{accountId:string, batchId:string, cards:Array, newId:()=>string}} ctx */
export function buildImportTxns(chosen, { accountId, batchId, cards, newId }) {
  return chosen.map(({ row }) => {
    const abs = Math.abs(row.amountPaise) / 100, base = { id: newId(), date: row.date, amount: abs, desc: row.desc || "", importKey: row.importKey, importBatchId: batchId, importSource: "bank-statement", transactionRef: row.ref || null, catId: null, catIds: [], subId: null, subIds: [], people: {} };
    if (row.amountPaise > 0) return { ...base, type: "income", accId: accountId, merchant: "" };
    if (looksLikeCardBill(row.desc)) {
      const card = findCardByText(row.desc, cards);
      if (card) return { ...base, type: "cc_payment", fromAccId: accountId, toAccId: card.id, accId: null, note: "Statement payment", merchant: "" };
      return { ...base, type: "expense", accId: accountId, merchant: "", cardBillUnmatched: true };
    }
    return { ...base, type: "expense", accId: accountId, merchant: cleanMerchant(row.desc) };
  });
}

/** Ids of everything a given batch created, so it can be undone as a unit. */
export const batchTxnIds = (txns, batchId) => (txns || []).filter(t => t.importBatchId === batchId).map(t => t.id);
export const importedKeysOf = txns => (txns || []).map(t => t.importKey).filter(Boolean);
