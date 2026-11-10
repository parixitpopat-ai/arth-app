// src/domain/cards/statementFromPdf.js — set a card's statement Bill from the figures printed on the statement PDF (total due, due date, cycle dates).
// Pure: returns what WOULD be written; the caller writes it on the person's tap, and can put things back with `undo`.
//   Arth's own figure (arthAmount) is recomputed from the card's entries for the PRINTED cycle (the bill's period convention: dated AFTER periodFrom and
//   ON OR BEFORE periodTo, so periodFrom is the day before the cycle's first day).
//   The bank's figure (bankAmount) is the printed total due. recordBankAmount decides matched / mismatch exactly as the existing "enter the bank's amount" step.
//   An existing bill for the same statement (its period end within 3 days of the printed one) is updated in place; otherwise one is created. No entry is touched.

import { computePeriodAmount } from "./statementBills.js";
import { recordBankAmount } from "./reconciliation.js";
import { getEffectiveBillingConfig } from "./billingConfig.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const pad = n => String(n).padStart(2, "0");
const dayBefore = iso => { const t = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) - 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const monthBefore = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10); const t = new Date(Date.UTC(y, m - 2, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`; };
const rupees = p => Math.round(p) / 100;

/**
 * @param {{card:object, accounts:Array, txns:Array, bills:Array, summary:object, toDateOnly:Function, genId:Function, today:string}} a
 *   summary: the card statement summary read from the PDF (statementDate, dueDate, totalDuePaise, periodFrom, periodTo, …)
 * @returns {{ok:false, reason:string} | {ok:true, action:"create"|"update"|"unchanged", bill:object, prev:object|null, arthAmount:number, bankAmount:number, difference:number, periodFrom:string, periodTo:string, notes:string[]}}
 */
export function planStatementBillFromPdf({ card, accounts, txns, bills, summary, toDateOnly, genId, today }) {
  if (!card || card.type !== "cc") return { ok: false, reason: "This is not a credit card." };
  if (!summary || typeof summary.totalDuePaise !== "number") return { ok: false, reason: "The PDF's total due could not be read, so there is nothing to set the bill from." };
  const periodTo = summary.periodTo || summary.statementDate;
  if (!periodTo) return { ok: false, reason: "The statement's closing date could not be read from the PDF." };
  const firstDay = summary.periodFrom || monthBefore(periodTo);            // without a printed start: one month back, same day
  const periodFrom = summary.periodFrom ? dayBefore(summary.periodFrom) : firstDay;
  const arthAmount = computePeriodAmount(card, accounts, txns, toDateOnly(periodFrom), toDateOnly(periodTo), toDateOnly);
  const bankAmount = rupees(summary.totalDuePaise);
  const existing = (bills || []).find(b => b.isCcStatement && b.accId === card.id && b.periodTo && Math.abs(dayNum(b.periodTo) - dayNum(periodTo)) <= 3) || null;
  const cfg = getEffectiveBillingConfig(card, periodTo);
  const base = existing || {
    id: genId(), isCcStatement: true, accId: card.id, billerCategory: "Credit Card", name: `${card.name || "Card"} Statement`,
    status: "unpaid", verification: "needs_verification", bankAmount: null, verifiedAt: null, billingConfigVersion: cfg && cfg.effectiveFrom, adjustments: [], createdAt: today,
  };
  const adjustments = [...(base.adjustments || [])];
  if (existing && Math.abs(Number(existing.arthAmount ?? existing.amount ?? 0) - arthAmount) > 0.004) adjustments.push({ at: today, from: existing.arthAmount, to: arthAmount });
  const withFigures = { ...base, periodFrom, periodTo, arthAmount, amount: arthAmount, dueDate: summary.dueDate || base.dueDate, adjustments };
  const bill = recordBankAmount(withFigures, bankAmount, new Date(`${today}T12:00:00`));
  const same = existing && ["periodFrom", "periodTo", "arthAmount", "amount", "dueDate", "bankAmount", "verification"].every(k => String(existing[k]) === String(bill[k]));
  const notes = [];
  const printedDay = +periodTo.slice(8, 10);
  if (cfg && cfg.statementDay && cfg.statementDay !== printedDay) notes.push(`This statement closed on day ${printedDay}, but the card's statement day in Arth is ${cfg.statementDay}. Change the card's billing settings so future statements are cut on the right day.`);
  return { ok: true, action: same ? "unchanged" : existing ? "update" : "create", bill, prev: existing, arthAmount, bankAmount, difference: Math.round((bankAmount - arthAmount) * 100) / 100, periodFrom, periodTo, notes };
}
