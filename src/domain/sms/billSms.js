// domain/sms/billSms.js
//
// A bill notice from a provider (electricity, water, gas, broadband, a card statement SMS...): "Your bill of Rs.3045 for consumer no 1234567 is due on 28-Jul-26".
// The phone side queues such messages (SmsReceiver.looksLikeBill); this turns one into a PROPOSAL for a new Bill: amount, due date, consumer number and,
// when it can be told, which of your connections (billerAccounts) it is for. Nothing is added to the books here: the person accepts (the Add Bill form
// opens filled in) or discards. Formats are common Indian wording and are NOT verified against every provider, so a field that is not clearly there is
// left empty, never guessed. Pure.

import { extractDMonYDate } from "./smsFields.js";

const AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const OTP = /\b(otp|one[- ]time|verification code|cvv)\b/i;
const PROMO = /\b(offer|apply now|pre-?approved|eligible|win|click|t&c|loan up to|cashback)\b/i;
const BILL_WORD = /\b(bill|invoice)\b/i;
// A credit-card bill is not proposed: Arth already makes each card's statement bill from its own entries (domain/cards/statementBills.js).
const CARD_BILL = /\b(credit\s*card|card\s*(?:no\.?|number|ending)|minimum\s+(?:amount\s+)?due)\b/i;
const DUE_WORD = /\b(due|pay(?:ment)?\s+by|payable|last\s+date|outstanding|pay\s+before)\b/i;
// A message about money that already moved: that is the bank path, not a bill.
const MOVED = /\b(debited|credited|has been received|payment received|received your payment|thank you for (?:your )?payment|paid successfully|successfully paid)\b/i;

export const looksLikeBillSms = text => {
  const t = String(text || "");
  return AMOUNT.test(t) && BILL_WORD.test(t) && DUE_WORD.test(t) && !OTP.test(t) && !PROMO.test(t) && !MOVED.test(t) && !CARD_BILL.test(t);
};

const numericDate = s => {
  const m = String(s).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
  if (!m) return "";
  const day = Number(m[1]), month = Number(m[2]), y = Number(m[3]), year = y >= 100 ? y : (y >= 70 ? 1900 + y : 2000 + y);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const anyDate = s => extractDMonYDate(s) || numericDate(s);

/** The due date: the date that follows a due word ("due on 28-Jul-26", "pay by 28/07/2026"), else "". */
export function extractDueDate(text) {
  const t = String(text || "");
  const m = t.match(/\b(?:due(?:\s+date)?|pay(?:ment)?\s+by|payable\s+by|last\s+date|pay\s+before)\b[^\d]{0,16}([^\n]{0,24})/i);
  return m ? anyDate(m[1]) : "";
}

/** The amount that follows "bill of", "amount due", "payable" ... else the first amount in the message. */
export function extractBillAmount(text) {
  const t = String(text || "");
  const near = t.match(/\b(?:bill(?:\s+amount)?(?:\s+of)?|amount\s+(?:due|payable)|total\s+due|payable|outstanding(?:\s+amount)?)\b[^\d₹]{0,14}(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const m = near || t.match(AMOUNT);
  return m ? Number(String(m[1]).replace(/,/g, "")) : 0;
}

/** A consumer / account / customer number written after its label, else "". */
export function extractConsumerNo(text) {
  const m = String(text || "").match(/\b(?:consumer|customer|account|a\/c|ca|k)\s*(?:no\.?|number|id|#)?\s*[:\-]?\s*([A-Za-z0-9-]{5,20})\b/i);
  const v = m ? m[1] : "";
  return /\d{4,}/.test(v) ? v : "";
}

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Which of the person's connections this is for: the same consumer number, else a provider name that appears in the message or its sender. */
export function matchBillerAccount(msg, billerAccounts) {
  const list = (billerAccounts || []).filter(Boolean);
  const body = norm(msg.body), from = norm(msg.address);
  const consumer = norm(extractConsumerNo(msg.body));
  if (consumer) {
    const byNo = list.filter(b => norm(b.consumerNo) && (norm(b.consumerNo) === consumer || consumer.endsWith(norm(b.consumerNo)) || norm(b.consumerNo).endsWith(consumer)));
    if (byNo.length === 1) return byNo[0];
  }
  const byName = list.filter(b => { const p = norm(b.provider); return p.length >= 4 && (body.includes(p) || from.includes(p)); });
  return byName.length === 1 ? byName[0] : null;
}

/**
 * @param {{id:string,address?:string,body:string,date?:number|string}} msg  a queued phone message
 * @returns {object|null} a bill proposal, or null when the message is not a bill notice
 */
export function parseBillSms(msg, billerAccounts = []) {
  if (!msg || !looksLikeBillSms(msg.body)) return null;
  const amount = extractBillAmount(msg.body);
  if (!(amount > 0)) return null;
  const ba = matchBillerAccount(msg, billerAccounts);
  return {
    id: String(msg.id), kind: "bill", amount, dueDate: extractDueDate(msg.body), consumerNo: extractConsumerNo(msg.body),
    billerAccountId: ba ? String(ba.id) : "", title: ba ? (ba.name || ba.provider || "Bill") : "New bill", from: String(msg.address || ""),
    receivedAt: msg.date ? Number(msg.date) || 0 : 0, text: String(msg.body || "").slice(0, 400),
  };
}
