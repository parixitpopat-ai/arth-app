// domain/cashflow/runway.js
//
// Financial Runway (Outlook): how long the cash you hold lasts on essential outflows if expected income stops.
// Three measures stay distinct (locked, Outlook hierarchy):
//   Available Cash = cash you hold today (accounts/availableCash.js)
//   Buffer         = Available Cash less the obligations due in the forecast period (futureMoney/commitmentTimeline.js)
//   Runway         = Available Cash / essential monthly outflow, with no income assumed
//
// Essential monthly outflow, with no item counted twice:
//   living cost = the larger of
//        (a) the average of the last N complete months of spending in essential categories (cats[].fixed, the same
//            flag the Stats page calls "essential"), measured as MY share, refunds netted. Card purchases are
//            counted when they are charged (they are expenses); paying the card bill (cc_payment) is not an
//            expense, so purchase and settlement are never both counted. Bill payments are counted: rent and
//            utilities paid as bills are real living costs.
//        (b) the Mandatory Commitments the user has reserved for the month.
//      Taking the larger, not the sum, stops a commitment such as "Rent" being counted on top of the rent that
//      already shows up in (a).
//   + EMIs      = the monthly instalment of every active loan taken. Loan EMI payments recorded as expenses
//                 (linkedLoanId), card-EMI instalments created with a purchase (isAutoEmiInstallment) and logged card
//                 EMI instalments (cc_emi) are removed from (a) so an EMI is counted once, here.
// Not essential: investments/SIPs (cash outflows in the Buffer, but stoppable), transfers, loans given.

import { getCategoryAttributedTotal, getMandatoryCommitmentsTotal } from "../allocations/adapter.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

const FREQ_PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, "half-yearly": 2, halfyearly: 2, yearly: 1, annual: 1 };

/** An expected-income amount as a monthly figure (one-off / unknown frequencies are not recurring: 0). */
export function toMonthlyAmount(amount, frequency) {
  const perYear = FREQ_PER_YEAR[String(frequency || "monthly").toLowerCase()];
  return perYear ? r2((Number(amount) || 0) * perYear / 12) : 0;
}

const previousMonthKeys = (monthKey, n) => {
  const [y, m] = String(monthKey).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(y, m - 1 - (i + 1), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
};

/**
 * @param {{txns:Array, cats:Array, loans:Array, mandatoryCommitments:Array, monthKey:string, months?:number}} args
 * @returns {{essentialAverage:number, mandatoryFloor:number, livingCost:number, emi:number, total:number, monthsUsed:number}}
 */
export function getEssentialMonthlyOutflow({ txns, cats, loans, mandatoryCommitments, monthKey, months = 3 }) {
  const all = txns || [];
  const essentialCats = (cats || []).filter(c => c.fixed === true);
  const keys = previousMonthKeys(monthKey, months).filter(k => all.some(t => String(t.date || "").startsWith(k + "-")));
  const spendOnly = all.filter(t => !t.linkedLoanId && !t.isLoanDisbursal && !t.isAutoEmiInstallment && t.type !== "cc_emi");
  let sum = 0;
  for (const k of keys) {
    const monthTxns = spendOnly.filter(t => String(t.date || "").startsWith(k + "-"));
    for (const c of essentialCats) sum += getCategoryAttributedTotal(monthTxns, c.id, { allTransactions: all });
  }
  const essentialAverage = keys.length ? r2(sum / keys.length) : 0;
  const mandatoryFloor = r2(getMandatoryCommitmentsTotal(mandatoryCommitments));
  const livingCost = Math.max(essentialAverage, mandatoryFloor);
  const emi = r2((loans || []).filter(l => l.direction === "taken" && l.status === "active" && Number(l.outstanding || 0) > 0 && Number(l.emiAmount || 0) > 0).reduce((s, l) => s + Number(l.emiAmount), 0));
  return { essentialAverage, mandatoryFloor, livingCost, emi, total: r2(livingCost + emi), monthsUsed: keys.length };
}

/**
 * @param {{availableCash:number, essentialMonthly:number, expectedMonthlyIncome?:number, incomeStops?:boolean}} args
 * @returns {{status:"unknown"|"none"|"sustained"|"limited", months:number|null, days:number|null, netMonthlyBurn:number}}
 *   unknown   = no essential outflow recorded, so a runway cannot be stated.
 *   none      = no cash.
 *   sustained = income at least covers essential outflows, so cash is not being drawn down.
 */
export function getFinancialRunway({ availableCash, essentialMonthly, expectedMonthlyIncome = 0, incomeStops = true }) {
  const essential = Number(essentialMonthly) || 0;
  const cash = Number(availableCash) || 0;
  const netMonthlyBurn = r2(essential - (incomeStops ? 0 : Number(expectedMonthlyIncome) || 0));
  if (!(essential > 0)) return { status: "unknown", months: null, days: null, netMonthlyBurn };
  if (cash <= 0) return { status: "none", months: 0, days: 0, netMonthlyBurn };
  if (netMonthlyBurn <= 0) return { status: "sustained", months: null, days: null, netMonthlyBurn };
  const months = cash / netMonthlyBurn;
  return { status: "limited", months: Math.round(months * 10) / 10, days: Math.round(months * 30), netMonthlyBurn };
}
