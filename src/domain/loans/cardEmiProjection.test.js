import test from "node:test";
import assert from "node:assert/strict";
import { projectCardEmiInstalments } from "./cardEmiProjection.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";

const accounts = [{ id: "cc1", type: "cc", statementDate: 15, dueDate: 5 }];
const dates = ["2026-12-15", "2027-01-15", "2027-02-15"];
const txns = dates.map((d, i) => ({ id: `i${i}`, date: d, amount: 6000, accId: "cc1", emiInstallmentNum: i + 1, emiTotalInstallments: 3 }));
const loans = [{ id: "L", name: "TV", direction: "taken", autoScheduled: true, status: "active", outstanding: 18000, scheduledInstallmentIds: ["i0", "i1", "i2"] }];

test("each instalment still ahead is due on its statement's due date, and named n/total", () => {
  const e = projectCardEmiInstalments({ loans, accounts, txns, today: "2026-12-10" });
  assert.deepEqual(e.map(x => [x.name, x.date, x.amount]), [["TV EMI 1/3", "2027-01-05", 6000], ["TV EMI 2/3", "2027-02-05", 6000], ["TV EMI 3/3", "2027-03-05", 6000]]);
});

test("an instalment dated today or earlier is already on a statement and is not projected again", () => {
  const e = projectCardEmiInstalments({ loans, accounts, txns, today: "2026-12-15" });
  assert.deepEqual(e.map(x => x.name), ["TV EMI 2/3", "TV EMI 3/3"]);
});

test("closed, finished or non-card loans project nothing", () => {
  assert.equal(projectCardEmiInstalments({ loans: [{ ...loans[0], status: "closed" }], accounts, txns, today: "2026-12-10" }).length, 0);
  assert.equal(projectCardEmiInstalments({ loans: [{ ...loans[0], autoScheduled: false }], accounts, txns, today: "2026-12-10" }).length, 0);
  assert.equal(projectCardEmiInstalments({ loans: [{ ...loans[0], direction: "given" }], accounts, txns, today: "2026-12-10" }).length, 0);
});

test("Money Required inside 30 days shows only the next EMI, the rest is later", () => {
  const e = projectCardEmiInstalments({ loans, accounts, txns, today: "2026-12-10" });
  const r = getMoneyRequiredForPeriod({ futureMoney: { debtService: e }, today: "2026-12-10", horizonDays: 30 });
  assert.equal(r.debtServiceTotal, 6000);
});
