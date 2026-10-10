// Audit + regression: how a card-EMI purchase (Add Expense > EMI > Credit card EMI) flows into monthly spending,
// card liability and future obligations. Findings these tests pin down:
//   * instalments are attributed to the month they fall in; nothing is attributed to the purchase month (except a down payment)
//   * card liability (billed / unbilled) only includes an instalment once its date has been reached
//   * the loan is excluded from debt-service projection, so an instalment is never a card charge AND a loan EMI
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getEmiInstalmentDates } from "./emiInstalments.js";
import { getHouseholdAttributedTotal } from "../../../domain/allocations/adapter.js";
import { getCardSummary } from "../cards/summaries.js";
import { projectLoansToDebtServiceEvents } from "../debt/futureMoney.js";

const setToday = (y, m, d) => { mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: new Date(y, m - 1, d, 12) }); };
beforeEach(() => setToday(2026, 10, 10));
afterEach(() => mock.timers.reset());

const toDateOnly = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const card = { id: "cc1", type: "cc", name: "Card", statementDate: 15, dueDate: 5, limit: 100000 };
const inst = dates => dates.map((date, i) => ({ id: `i${i + 1}`, type: "expense", amount: 10000, date, accId: "cc1", catId: "financial", catIds: ["financial"], isAutoEmiInstallment: true }));

test("first instalment is the first statement day AFTER the purchase; a purchase on the statement day starts next month", () => {
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-07-20", statementDay: 15, tenure: 3 }), ["2026-08-15", "2026-09-15", "2026-10-15"]);
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-07-15", statementDay: 15, tenure: 2 }), ["2026-08-15", "2026-09-15"]);
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-07-14", statementDay: 15, tenure: 2 }), ["2026-07-15", "2026-08-15"]);
});

test("month and year boundaries: December purchase rolls into January; day 31 clamps in short months without drifting", () => {
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-12-20", statementDay: 15, tenure: 3 }), ["2027-01-15", "2027-02-15", "2027-03-15"]);
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-12-20", statementDay: 31, tenure: 3 }), ["2026-12-31", "2027-01-31", "2027-02-28"]);
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-01-31", statementDay: 31, tenure: 3 }), ["2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2027-12-31", statementDay: 31, tenure: 2 }), ["2028-01-31", "2028-02-29"]); // leap year
  assert.deepEqual(getEmiInstalmentDates({ purchaseDate: "2026-07-20", statementDay: 15, tenure: 0 }), []);
});

test("spending: each instalment counts in its own month; the purchase month gets nothing, and the total is tenure x EMI", () => {
  const dates = getEmiInstalmentDates({ purchaseDate: "2026-07-20", statementDay: 15, tenure: 6 });
  const txns = inst(dates);
  const spendIn = month => getHouseholdAttributedTotal({ periodTransactions: txns.filter(t => t.date.startsWith(month)), allTransactions: txns });
  assert.equal(spendIn("2026-07"), 0, "not attributed to the purchase month");
  for (const m of ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]) assert.equal(spendIn(m), 10000, m);
  assert.equal(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].reduce((s, m) => s + spendIn(m), 0), 60000);
});

test("card liability: an instalment is billed on its statement day, never earlier; a future instalment is not a liability yet", () => {
  const txns = inst(getEmiInstalmentDates({ purchaseDate: "2026-07-20", statementDay: 15, tenure: 6 }));
  const at = (y, m, d) => { setToday(y, m, d); const s = getCardSummary(card, [card], txns, toDateOnly); return [s.totalOutstanding, s.currentCycleSpend]; };
  assert.deepEqual(at(2026, 8, 14), [0, 0]);        // purchase made, first instalment not yet due
  assert.deepEqual(at(2026, 8, 15), [10000, 0]);    // billed on the statement day
  assert.deepEqual(at(2026, 10, 10), [10000, 0]);   // Sep instalment billed; Oct 15 instalment is not a liability yet
  assert.deepEqual(at(2026, 10, 16), [10000, 0]);   // Oct instalment now the billed one: still exactly one instalment, not two
});

test("no double count: the EMI-purchase loan is not projected as debt service on top of the card charges", () => {
  const loan = { id: "L1", direction: "taken", status: "active", autoScheduled: true, emiAmount: 10000, outstanding: 40000, dueDay: 20 };
  assert.deepEqual(projectLoansToDebtServiceEvents([loan], [card], inst(["2026-10-15"]), toDateOnly, new Date()), []);
});
