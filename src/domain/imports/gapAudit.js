// src/domain/imports/gapAudit.js - WHERE does the difference between a card statement's total due and Arth's figure for the cycle come from?
// An exact accounting identity (all in paise), so every rupee is either named or reported as "not explained":
//   total due - Arth amount =  carry-over (previous balance - payments/credits printed on the statement)
//                            + statement purchase rows that match an entry on ANOTHER account (not counted on this card)
//                            + statement purchase rows Arth does not have at all
//                            - entries on this card that the statement does not have (Arth counts them, the bank does not)
//                            + refunds recorded on this card in the cycle (Arth takes them off, the bank only does if it credited them)
//                            + not explained (e.g. a card EMI instalment, an entry whose amount was edited)
// Read-only; it only reports. Pure.
import { accountMovements } from "./matchStatement.js";
import { unmatchedInArth } from "./arthOnly.js";

const paise = n => Math.round(Number(n) * 100);

/**
 * @param {{results:Array, transactions:Array, accountId:string, linkedIds?:Array, from:string, to:string,
 *   summary?:{previousBalancePaise?:number, paymentsPaise?:number}, bankAmount:number, arthAmount:number, accountName?:(id:any)=>string}} a  from/to inclusive
 * @returns {{gapPaise:number, carryPaise:number|null, lines:Array<{id:string, label:string, paise:number, items:Array}>, explainedPaise:number, notExplainedPaise:number}}
 */
export function auditStatementGap({ results, transactions, accountId, linkedIds = [], from, to, summary = {}, bankAmount, arthAmount, accountName = () => "" }) {
  const gapPaise = paise(bankAmount) - paise(arthAmount);
  const inRange = d => d >= from && d <= to;
  const byId = new Map((transactions || []).map(t => [String(t.id), t]));
  const ids = new Set([String(accountId), ...(linkedIds || []).map(String)]);
  const lines = [];

  const carryPaise = typeof summary.previousBalancePaise === "number" && typeof summary.paymentsPaise === "number" ? summary.previousBalancePaise - summary.paymentsPaise : null;
  if (carryPaise) lines.push({ id: "carry", label: "Carried from the last statement (previous balance less payments and credits)", paise: carryPaise, items: [] });

  const otherAcc = (results || []).filter(r => r.status === "probable-match" && r.otherAccount && r.row.amountPaise < 0 && inRange(r.row.date));
  if (otherAcc.length) lines.push({ id: "other", label: "Statement purchases recorded in Arth on a DIFFERENT account", paise: otherAcc.reduce((s, r) => s - r.row.amountPaise, 0),
    items: otherAcc.map(r => { const t = byId.get(String(r.matchId)); return { txnId: r.matchId, date: r.row.date, text: r.row.desc || "(no description)", paise: -r.row.amountPaise, where: t ? accountName(t.accId) : "" }; }) });

  const fresh = (results || []).filter(r => r.status === "new" && r.row.amountPaise < 0 && inRange(r.row.date));
  if (fresh.length) lines.push({ id: "new", label: "Statement purchases Arth does not have", paise: fresh.reduce((s, r) => s - r.row.amountPaise, 0),
    items: fresh.map(r => ({ txnId: null, date: r.row.date, text: r.row.desc || "(no description)", paise: -r.row.amountPaise })) });

  const { arthOnly } = unmatchedInArth({ results, transactions, accountId, linkedIds, from, to });
  const extra = arthOnly.filter(a => a.amountPaise < 0);
  if (extra.length) lines.push({ id: "extra", label: "Entries on this card that the statement does not have", paise: extra.reduce((s, a) => s + a.amountPaise, 0),
    items: extra.map(a => ({ txnId: a.id, date: a.date, text: a.label, paise: a.amountPaise })) });

  const refunds = (transactions || []).filter(t => t && t.type === "settlement_in" && t.isRefund && ids.has(String(t.accId)) && t.date && inRange(t.date));
  if (refunds.length) lines.push({ id: "refunds", label: "Refunds recorded on this card in the cycle (Arth takes them off)", paise: refunds.reduce((s, t) => s + paise(t.amount), 0),
    items: refunds.map(t => ({ txnId: t.id, date: t.date, text: t.merchant || t.desc || "Refund", paise: paise(t.amount) })) });

  const explainedPaise = lines.reduce((s, l) => s + l.paise, 0);
  return { gapPaise, carryPaise, lines, explainedPaise, notExplainedPaise: gapPaise - explainedPaise };
}
