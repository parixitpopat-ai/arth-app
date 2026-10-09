import { test } from "node:test";
import assert from "node:assert/strict";
import { getEssentialMonthlyOutflow, getFinancialRunway, toMonthlyAmount } from "./runway.js";

const cats = [{ id: "housing", fixed: true }, { id: "groceries", fixed: true }, { id: "food", fixed: false }, { id: "financial", fixed: true }];
const exp = (id, amount, date, catId, extra = {}) => ({ id, type: "expense", amount, date, catId, catIds: [catId], ...extra });
// Jul, Aug, Sep 2026 behind an October reference month
const history = [
  exp(1, 15000, "2026-07-05", "housing"), exp(2, 6000, "2026-07-10", "groceries"), exp(3, 4000, "2026-07-12", "food"),
  exp(4, 15000, "2026-08-05", "housing"), exp(5, 9000, "2026-08-10", "groceries"),
  exp(6, 15000, "2026-09-05", "housing"), exp(7, 6000, "2026-09-10", "groceries"),
];
const essential = (extra = {}) => getEssentialMonthlyOutflow({ txns: history, cats, loans: [], mandatoryCommitments: [], monthKey: "2026-10", ...extra });

test("essential living cost = average of essential categories over the last 3 months; non-essential spending is left out", () => {
  const e = essential();
  assert.equal(e.essentialAverage, (21000 + 24000 + 21000) / 3); // 22,000
  assert.equal(e.livingCost, 22000);
  assert.equal(e.total, 22000);
  assert.equal(e.monthsUsed, 3);
});

test("only months that have history are averaged", () => {
  const e = getEssentialMonthlyOutflow({ txns: [exp(1, 12000, "2026-09-05", "housing")], cats, loans: [], mandatoryCommitments: [], monthKey: "2026-10" });
  assert.equal(e.essentialAverage, 12000);
  assert.equal(e.monthsUsed, 1);
});

test("EMIs are added once; an EMI paid as a loan-linked expense is not also counted in living cost", () => {
  const loans = [{ direction: "taken", status: "active", outstanding: 80000, emiAmount: 5000 }, { direction: "taken", status: "closed", outstanding: 0, emiAmount: 9999 }, { direction: "given", status: "active", outstanding: 1000, emiAmount: 700 }];
  const emiPaid = [exp(20, 5000, "2026-09-18", "financial", { linkedLoanId: "L1" }), exp(21, 5000, "2026-08-18", "financial", { linkedLoanId: "L1" })];
  const e = getEssentialMonthlyOutflow({ txns: [...history, ...emiPaid], cats, loans, mandatoryCommitments: [], monthKey: "2026-10" });
  assert.equal(e.essentialAverage, 22000); // EMI payments not in the average
  assert.equal(e.emi, 5000);
  assert.equal(e.total, 27000);
});

test("Mandatory Commitments are a floor, not an addition: rent reserved AND rent paid is counted once", () => {
  const withFloorBelow = essential({ mandatoryCommitments: [{ amount: 15000 }] });
  assert.equal(withFloorBelow.livingCost, 22000); // actual essential spend already covers it
  const withFloorAbove = essential({ mandatoryCommitments: [{ amount: 18000 }, { amount: 7000 }] });
  assert.equal(withFloorAbove.livingCost, 25000); // user reserves more than history shows
});

test("card purchases count once (when charged); card-bill payments, investments, transfers and loans given are not essential spend", () => {
  const extra = [
    exp(30, 3000, "2026-09-12", "groceries", { accId: "cc1" }), // groceries bought on a card
    { id: 31, type: "cc_payment", amount: 3000, date: "2026-09-25", fromAccId: "b1", toAccId: "cc1" }, // paying that bill
    { id: 32, type: "investment", amount: 10000, date: "2026-09-02", accId: "b1", catId: "financial" },
    { id: 33, type: "transfer", amount: 5000, date: "2026-09-03", fromAccId: "b1", toAccId: null, isLoanDisbursal: true },
  ];
  const e = getEssentialMonthlyOutflow({ txns: [...history, ...extra], cats, loans: [], mandatoryCommitments: [], monthKey: "2026-10" });
  assert.equal(e.essentialAverage, (21000 + 24000 + 24000) / 3); // only the 3,000 purchase, once
});

test("income-stop vs income-continuing runway", () => {
  const stop = getFinancialRunway({ availableCash: 120000, essentialMonthly: 27000 });
  assert.equal(stop.status, "limited");
  assert.equal(stop.months, 4.4); // 120,000 / 27,000
  assert.equal(stop.days, 133);
  const partial = getFinancialRunway({ availableCash: 120000, essentialMonthly: 27000, expectedMonthlyIncome: 20000, incomeStops: false });
  assert.equal(partial.netMonthlyBurn, 7000);
  assert.equal(partial.months, 17.1);
  const covered = getFinancialRunway({ availableCash: 120000, essentialMonthly: 27000, expectedMonthlyIncome: 85000, incomeStops: false });
  assert.equal(covered.status, "sustained");
  assert.equal(covered.months, null);
});

test("expected income is never added to cash: the income-stop runway ignores it entirely", () => {
  const a = getFinancialRunway({ availableCash: 50000, essentialMonthly: 25000 });
  const b = getFinancialRunway({ availableCash: 50000, essentialMonthly: 25000, expectedMonthlyIncome: 85000 }); // incomeStops defaults to true
  assert.deepEqual(a, b);
  assert.equal(a.months, 2);
});

test("no essentials recorded -> unknown; no cash -> none", () => {
  assert.equal(getFinancialRunway({ availableCash: 1000, essentialMonthly: 0 }).status, "unknown");
  assert.equal(getFinancialRunway({ availableCash: -500, essentialMonthly: 20000 }).status, "none");
  assert.equal(getFinancialRunway({ availableCash: 0, essentialMonthly: 20000 }).months, 0);
});

test("expected income converts to a monthly figure; one-offs are not recurring", () => {
  assert.equal(toMonthlyAmount(85000, "monthly"), 85000);
  assert.equal(toMonthlyAmount(12000, "quarterly"), 4000);
  assert.equal(toMonthlyAmount(120000, "yearly"), 10000);
  assert.equal(toMonthlyAmount(1000, "weekly"), 4333.33);
  assert.equal(toMonthlyAmount(5000, "once"), 0);
});
