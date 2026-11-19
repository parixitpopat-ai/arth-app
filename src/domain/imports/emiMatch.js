// src/domain/imports/emiMatch.js — what Arth already holds for a recognised EMI group (see emiRows.js). Pure; reads only; proposes, never writes.
//   already-imported : one of the group's rows was imported before (its key is stored)
//   recorded         : the card's plan already has THIS instalment (same number, same total): nothing to add
//   recorded-differs : the plan has this instalment number but another amount: shown, never overwritten
//   match            : one entry on this card with exactly the group total within DAY_WINDOW days (for example the instalment entered as a plain expense). It can be LINKED.
//   record           : no entry, but the card has an active plan this instalment belongs to: it can be recorded as instalment n of that plan
//   none             : nothing to tie it to (no plan on this card)
import { accountMovements, DAY_WINDOW } from "./matchStatement.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** @returns {{status:string, txnId?:any, plan?:object, warnings:string[]}} */
export function matchEmiGroup(group, { transactions, accountId, linkedIds = [], plans = [], importedKeys = [], claimedIds = [] }) {
  const warnings = [];
  const keys = new Set(importedKeys || []);
  if (group.rowKeys.some(k => keys.has(k))) return { status: "already-imported", warnings };
  const txns = Array.isArray(transactions) ? transactions : [];
  const mineId = id => id != null && (String(id) === String(accountId) || (linkedIds || []).some(l => String(l) === String(id)));
  const myPlans = (plans || []).filter(p => p && mineId(p.cardId) && p.status !== "closed");
  const totalRupees100 = group.totalPaise;
  const planOf = n => myPlans.find(p => txns.some(t => t.type === "cc_emi" && t.ccEmiPlanId === p.id && Number(t.installmentNo) === n));
  const installments = txns.filter(t => t.type === "cc_emi" && mineId(t.accId) && Number(t.installmentNo) === group.n && (!t.ccEmiTenure || Number(t.ccEmiTenure) === group.N));
  const same = installments.find(t => near(Math.round(Number(t.amount) * 100), totalRupees100, 100));
  if (same) return { status: "recorded", txnId: same.id, warnings };
  if (installments.length) return { status: "recorded-differs", txnId: installments[0].id, warnings: [`Arth has instalment ${group.n} as ${installments[0].amount}, the statement shows ${(totalRupees100 / 100).toFixed(2)}`] };

  const claimed = new Set((claimedIds || []).map(String));
  const moves = accountMovements(txns, accountId, linkedIds).filter(m => !claimed.has(String(m.id)) && m.amountPaise === -totalRupees100 && Math.abs(dayNum(m.date) - dayNum(group.date)) <= DAY_WINDOW)
    .sort((a, b) => Math.abs(dayNum(a.date) - dayNum(group.date)) - Math.abs(dayNum(b.date) - dayNum(group.date)));
  if (moves.length) return { status: "match", txnId: moves[0].id, warnings };

  const fits = myPlans.filter(p => Number(p.tenure) === group.N);
  const pool = fits.length ? fits : myPlans.filter(p => near(Math.round(Number(p.monthlyAmount) * 100), totalRupees100, 100));
  if (pool.length === 1) {
    const plan = pool[0];
    if (Number(plan.tenure) !== group.N) warnings.push(`Your plan says ${plan.tenure} instalments, the statement says ${group.N}`);
    if (Number(plan.monthlyAmount) > 0 && !near(Math.round(Number(plan.monthlyAmount) * 100), totalRupees100, 100)) warnings.push(`Your plan's monthly amount is ${plan.monthlyAmount}, the statement shows ${(totalRupees100 / 100).toFixed(2)}`);
    if (planOf(group.n) && planOf(group.n).id !== plan.id) warnings.push("Another plan already has this instalment number");
    return { status: "record", plan, installmentNo: group.n, warnings };
  }
  if (pool.length > 1) warnings.push("More than one plan on this card could fit; none is chosen for you");
  return { status: "none", warnings };
}
