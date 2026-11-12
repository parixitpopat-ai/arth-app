// src/domain/sms/smsInbox.js — turns bank/card SMS read from the phone's inbox into statement-style rows, so they go through the same matching,
// merge and undo as a statement file. Pure: no phone access here. A message that is not clearly a money message is left out; one that looks like
// money but cannot be read is returned in `unreadable` (never dropped silently).
// Formats are the common Indian bank wording ("Rs.222.14 spent on card XX1234 at ZOMATO on 10-11-26", "debited from A/c XX1234 … UPI Ref 104449304091");
// they are NOT verified against every bank, which is why a message that does not fit is reported instead of guessed.
import { extractDMonYDate, extractUpiMerchant } from "./smsFields.js";
import { parseStatementDate } from "../imports/statement.js";
import { extractUpiId } from "../imports/upiId.js";

const AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT = /\b(debited|spent|paid|purchase|withdrawn|sent|dr)\b/i;
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversal|cashback)\b/i;
const OTP = /\b(otp|one[- ]time|verification code|cvv)\b/i;
// "Your A/c XX5748 debited by Rs. 180.00 on 09/11/26; ICECREAM credited": the verb right after OUR account number is the direction; the second verb
// describes the other party. A message with a second leg that names another account ("… and credited to A/c XX1234") is a transfer and is not guessed.
const OWN_VERB = /\b(?:a\/c|acct|account|card)\b[^;.\d]{0,25}?\d{3,}\s+(?:is\s+|was\s+|has been\s+)?(debited|credited)\b/i;
const SECOND_LEG_TO_ACCOUNT = /\b(?:debited|credited)\b[^.;]{0,30}\b(?:a\/c|acct|account)\s*(?:no\.?)?\s*[x*]*\d{3,}/i;
const ownVerbOf = t => { const m = OWN_VERB.exec(t); return m ? m[1].toLowerCase() : ""; };
// Messages that mention an amount and "debited" but are NOT a money movement: a payment that WILL be taken, a statement/bill notice, a due-date reminder.
const NOT_A_MOVEMENT = [
  /\b(?:to be|will be|shall be|is going to be|going to be)\s+(?:debited|charged|deducted|auto-?debited)\b/i,
  /\b(?:upcoming|scheduled)\b[^.]{0,40}\b(?:debit|payment|mandate)\b/i,
  /\bstatement\b[^.]{0,60}\b(?:sent|generated|ready|available|due)\b/i,
  /\b(?:total|minimum|min\.?)\s+(?:amount\s+)?due\b/i,
  /\bdue\s+(?:date|on|by)\b/i,
  /\bpayment\s+(?:reminder|due)\b/i,
  /\bbill\b[^.]{0,30}\b(?:generated|due)\b/i,
];
const pad = n => String(n).padStart(2, "0");

/** True when the text is a notice (will-be-debited, statement sent, due reminder), not a money movement. */
export const isNotAMovement = text => NOT_A_MOVEMENT.some(rx => rx.test(String(text || "")));

/**
 * Entries an earlier version imported from such notices (they are not real transactions). Only entries the IMPORT created: never one the person
 * entered themselves and merely linked to a statement/SMS row (importMerged), and never one already given a category.
 * @returns {object[]} the entries (read-only plan; nothing is changed here)
 */
export function findNoticeEntries(txns) {
  return (txns || []).filter(t => t && t.importKey && !t.importMerged && (t.type === "expense" || t.type === "income")
    && !(t.catIds && t.catIds.length) && isNotAMovement([t.merchant, t.desc, t.bankNarration].filter(Boolean).join(" ")));
}

/** True for a message that looks like a money movement: an amount with ₹/Rs/INR and a debit/credit word, and not an OTP or promotion. */
export function looksLikeMoneySms(body) {
  const t = String(body || "");
  if (!AMOUNT.test(t) || OTP.test(t)) return false;
  if (NOT_A_MOVEMENT.some(rx => rx.test(t))) return false;
  if (/\b(offer|apply now|pre-?approved|eligible|win|click|t&c|loan up to)\b/i.test(t) && !/\b(debited|credited|spent)\b/i.test(t)) return false;
  return DEBIT.test(t) || CREDIT.test(t);
}

const last4Of = t => {
  const out = [];
  for (const rx of [/(?:a\/c|acct|account|card|ending(?:\s+with)?|last\s*4)[^\d]{0,12}(\d{4})\b/ig, /(?:xx|x{2,}|\*{2,})\s*(\d{4})\b/ig]) for (const m of t.matchAll(rx)) out.push(m[1]);
  return [...new Set(out)];
};
// "a/c ending XXXXXXXX748": some banks show only 3 digits. Used only when no 4-digit ending is present, and only to pick an account whose last 4 END with them.
const tail3Of = t => { const m = /[x*]{2,}\s*(\d{3})(?!\d)/i.exec(t); return m ? m[1] : ""; };
const dateOf = (t, receivedMs) => {
  const named = extractDMonYDate(t);
  if (named) return named;
  const m = /\b(\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2}))\b/.exec(t);
  const num = m && parseStatementDate(m[1]);
  if (num) return num;
  const d = new Date(Number(receivedMs) || 0);
  return receivedMs ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
};
const merchantOf = t => {
  const semi = /;\s*([A-Za-z0-9][A-Za-z0-9 &'._-]{1,38}?)\s+(?:credited|debited)\b/i.exec(t);
  if (semi) return semi[1].trim();
  const upi = extractUpiMerchant(t);
  if (upi) return upi;
  let m = /\b(?:at|to|towards|info:?)\s+([A-Za-z0-9][A-Za-z0-9 &'._-]{1,38}?)(?=\s+on\s+\d|\s+via\b|\s+ref\b|\s+avl\b|\s+bal\b|\.\s|,|$)/i.exec(t.replace(/\s+/g, " "));
  if (m && !/^(a\/c|acct|account|vpa|card)\b/i.test(m[1]) && !m[1].includes("@")) return m[1].trim();
  m = /\bto\s+(?:vpa\s+)?([a-z0-9._-]+@[a-z]{2,})/i.exec(t);
  return m ? m[1] : "";
};

/**
 * @param {{id?:any, address?:string, body:string, date?:number}} sms
 * @returns {{ok:true,row:object,last4s:string[],smsId:string}|{ok:false,why:string}|null} null = not a money message.
 */
export function parseMoneySms(sms) {
  const body = String((sms && sms.body) || "").replace(/\s+/g, " ").trim();
  if (!looksLikeMoneySms(body)) return null;
  const a = AMOUNT.exec(body), paise = Math.round(parseFloat(a[1].replace(/,/g, "")) * 100);
  const credit = CREDIT.test(body), debit = DEBIT.test(body);
  const own = ownVerbOf(body);
  if (/\b(debited|spent)\b/i.test(body) && /\b(credited|received)\b/i.test(body) && (!own || SECOND_LEG_TO_ACCOUNT.test(body))) return { ok: false, why: "says both debited and credited (a transfer?)" };
  if (!Number.isFinite(paise) || paise <= 0) return { ok: false, why: "amount not readable" };
  const date = dateOf(body, sms.date);
  if (!date) return { ok: false, why: "no date" };
  const utr = (/(?:ref(?:erence)?(?:\s*(?:no|number))?\.?|rrn|utr)[^\d]{0,10}(\d{12})\b/i.exec(body) || /(?<!\d)(\d{12})(?!\d)/.exec(body) || [])[1] || "";
  const who = merchantOf(body);
  const isUpi = /\bupi\b/i.test(body) || Boolean(utr);
  // same wording the statement reader produces, so the vendor, UTR and UPI matching rules apply unchanged
  const desc = isUpi ? `UPI-${utr || "0"}-${who || "UPI payment"}`.replace(/-0-/, "-") : (who || body.slice(0, 60));
  const isCredit = own ? own === "credited" : credit && !/\b(debited|spent)\b/i.test(body);
  return { ok: true, smsId: String(sms.id != null ? sms.id : `${sms.date}|${body.slice(0, 40)}`), last4s: last4Of(body), tail3: last4Of(body).length ? "" : tail3Of(body),
    row: { line: 0, date, valueDate: null, desc, ref: utr, upiId: extractUpiId(body), amountPaise: isCredit ? paise : -paise, balancePaise: null } };
}

/**
 * Group messages by the account whose last 4 digits they mention.
 * @param {Array} messages @param {Array<{id:any,last4?:string,name?:string}>} accounts
 * @returns {{byAccount:Map<string,object[]>, noAccount:object[], unreadable:{why:string,text:string}[], skippedSeen:number}}
 */
export function sortSmsToAccounts(messages, accounts, { seenIds = [] } = {}) {
  const seen = new Set(seenIds.map(String));
  const byAccount = new Map(), noAccount = [], unreadable = []; let skippedSeen = 0;
  for (const sms of messages || []) {
    const p = parseMoneySms(sms);
    if (!p) continue;
    if (!p.ok) { unreadable.push({ why: p.why, text: String(sms.body || "").slice(0, 60), id: String(sms.id != null ? sms.id : `${sms.date}|${String(sms.body || "").slice(0, 40)}`), date: sms.date }); continue; }
    if (seen.has(p.smsId)) { skippedSeen++; continue; }
    let hits = (accounts || []).filter(a => a && a.last4 && p.last4s.includes(String(a.last4)));
    if (!hits.length && p.tail3) hits = (accounts || []).filter(a => a && a.last4 && String(a.last4).endsWith(p.tail3));   // 3 visible digits: only if exactly one account fits
    if (hits.length !== 1) { noAccount.push(p); continue; }            // none or ambiguous: the person decides, never guessed
    const k = String(hits[0].id); byAccount.set(k, [...(byAccount.get(k) || []), p]);
  }
  return { byAccount, noAccount, unreadable, skippedSeen };
}

/** Rows (oldest first, numbered) ready for withImportKeys/matchStatement. */
export const smsRows = list => [...list].sort((x, y) => x.row.date.localeCompare(y.row.date)).map((p, i) => ({ ...p.row, line: i + 1, smsId: p.smsId }));
