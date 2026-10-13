// domain/reports/fiscalYear.js
//
// Reports (Web v1): the household financial-year summary and the per-person financial-year report.
// READ-SIDE ONLY. Nothing here defines a new rule:
//   - Household: the sum of the 12 getMonthlyCashFlow results for the FY, so the year always reconciles with the months
//     (Came in = income transactions; Went out = the household's own share, refunds netted; "Not counted" = movements
//     that are neither). It is not a forecast and it does not use the forecast-based saving rate.
//   - Person: the Budget "Annual Person View" definition — per-transaction attribution through the injected
//     getPersonAttributedAmount (the people map, tagItems, allocations, forPerson, one contribution per transaction),
//     a category split equally across a transaction's categories, and the planned amount from getPersonPlanningAllocation.
//     Both are injected: this module never re-derives how a transaction is attributed.

import { getMonthlyCashFlow, fyMonthKeys, describeLeftOver } from "../cashflow/monthlyCashFlow.js";

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const UNCATEGORISED = "__uncategorised__";

/**
 * @returns {{fyStartYear, months, cameIn, wentOut, leftOver, keptPercent, incomeBySource, wentOutByCategory, notCounted,
 *            txnCount, activeMonths, hasActivity}}
 *   months[] = { monthKey, cameIn, wentOut, leftOver, hasActivity }
 *   keptPercent = left over as a % of what came in (whole number), or null when nothing came in. Not a saving-rate forecast.
 */
export function getHouseholdFiscalYearSummary({ txns, cats, fyStartYear }) {
  const monthly = fyMonthKeys(fyStartYear).map(monthKey => getMonthlyCashFlow({ txns, cats, monthKey }));
  const cameIn = round2(monthly.reduce((s, m) => s + m.cameIn, 0));
  const wentOut = round2(monthly.reduce((s, m) => s + m.wentOut, 0));

  const income = new Map();
  monthly.forEach(m => m.incomeBySource.forEach(r => income.set(r.key, round2((income.get(r.key) || 0) + r.amount))));
  const incomeBySource = [...income.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);

  const byCat = new Map();
  monthly.forEach(m => m.wentOutByCategory.forEach(r => {
    if (r.id === UNCATEGORISED) return;
    const cur = byCat.get(r.id) || { id: r.id, name: r.name, icon: r.icon, amount: 0 };
    cur.amount = round2(cur.amount + r.amount);
    byCat.set(r.id, cur);
  }));
  const rows = [...byCat.values()].sort((a, b) => b.amount - a.amount);
  const remainder = round2(wentOut - rows.reduce((s, r) => s + r.amount, 0));
  const wentOutByCategory = remainder > 0.5 ? [...rows, { id: UNCATEGORISED, name: "Uncategorised", icon: "", amount: remainder }] : rows;

  const nc = new Map();
  monthly.forEach(m => m.notCounted.forEach(r => {
    const cur = nc.get(r.type) || { type: r.type, label: r.label, amount: 0, count: 0 };
    cur.amount = round2(cur.amount + r.amount); cur.count += r.count; nc.set(r.type, cur);
  }));

  const leftOver = describeLeftOver(cameIn, wentOut);
  return {
    fyStartYear,
    months: monthly.map(m => ({ monthKey: m.monthKey, cameIn: m.cameIn, wentOut: m.wentOut, leftOver: m.leftOver, hasActivity: m.hasActivity })),
    cameIn, wentOut, leftOver,
    keptPercent: cameIn > 0 ? Math.round(((cameIn - wentOut) / cameIn) * 100) : null,
    incomeBySource, wentOutByCategory,
    notCounted: [...nc.values()],
    txnCount: monthly.reduce((s, m) => s + m.txnCount, 0),
    activeMonths: monthly.filter(m => m.hasActivity).length,
    hasActivity: monthly.some(m => m.hasActivity),
  };
}

/**
 * Per-person FY report. People with no spend and no planned budget in the year are left out; the household member
 * "__me__" is not a person row. Sorted by spend, largest first.
 *
 * @param {Object} p
 * @param {Array} p.people
 * @param {Array} p.txns
 * @param {Array} p.cats
 * @param {number} p.fyStartYear
 * @param {(t:Object, personId:string)=>number} p.getPersonAttributedAmount injected (App's own function)
 * @param {(person:Object, monthKey:string)=>number} p.getPersonPlanningAllocation injected (allocations adapter)
 * @returns {{fyStartYear, rows:Array, totalSpent:number, totalBudget:number}}
 *   row = { person, spent, budget, remaining, usedPercent, txnCount, months:[{monthKey,spend,budget}], categories:[{id,name,icon,amount}] }
 */
export function getPersonFiscalYearReport({ people, txns, cats, fyStartYear, getPersonAttributedAmount, getPersonPlanningAllocation }) {
  const keys = fyMonthKeys(fyStartYear);
  const expensesByMonth = new Map(keys.map(k => [k, (txns || []).filter(t => t && t.type === "expense" && String(t.date || "").startsWith(k))]));
  const catById = new Map((cats || []).map(c => [String(c.id), c]));

  const rows = (people || [])
    .filter(p => p && p.id !== "__me__" && !p.isMe)
    .map(person => {
      let txnCount = 0;
      const catTotals = new Map();
      const months = keys.map(monthKey => {
        let spend = 0;
        expensesByMonth.get(monthKey).forEach(t => {
          const amt = Number(getPersonAttributedAmount(t, person.id)) || 0;
          if (amt <= 0) return;
          spend += amt; txnCount += 1;
          const tCats = (t.catIds || [t.catId]).filter(Boolean);
          if (tCats.length) tCats.forEach(cid => catTotals.set(String(cid), (catTotals.get(String(cid)) || 0) + amt / tCats.length));
          else catTotals.set(UNCATEGORISED, (catTotals.get(UNCATEGORISED) || 0) + amt);
        });
        return { monthKey, spend: round2(spend), budget: round2(getPersonPlanningAllocation(person, monthKey)) };
      });
      const spent = round2(months.reduce((s, m) => s + m.spend, 0));
      const budget = round2(months.reduce((s, m) => s + m.budget, 0));
      const categories = [...catTotals.entries()].map(([id, amount]) => {
        const c = catById.get(id);
        return { id, name: c ? c.name : "Uncategorised", icon: c?.icon || "", amount: round2(amount) };
      }).sort((a, b) => b.amount - a.amount);
      return {
        person, spent, budget, remaining: round2(budget - spent),
        usedPercent: budget > 0 ? Math.round((spent / budget) * 100) : null,
        txnCount, months, categories,
      };
    })
    .filter(r => r.spent > 0 || r.budget > 0)
    .sort((a, b) => b.spent - a.spent);

  return {
    fyStartYear, rows,
    totalSpent: round2(rows.reduce((s, r) => s + r.spent, 0)),
    totalBudget: round2(rows.reduce((s, r) => s + r.budget, 0)),
  };
}
