import test from "node:test";
import assert from "node:assert/strict";
import { getCardUnbilledEvents } from "./unbilledCommitments.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";

const cards = [{ id: "c1", name: "Coral", type: "cc", statementDate: 15, dueDate: 5 }, { id: "c2", name: "Empty", type: "cc", statementDate: 15, dueDate: 5 }, { id: "b1", type: "bank" }];
const today = new Date(2026, 10, 22, 12);

test("a card with unbilled spending gets one entry due on the next statement's due date; empty cards and banks get none", () => {
  const e = getCardUnbilledEvents({ accounts: cards, unbilledOf: c => (c.id === "c1" ? 6000 : 0), today });
  assert.deepEqual(e.map(x => [x.sourceId, x.amount, x.date, x.category]), [["c1", 6000, "2027-01-05", "committedSpending"]]);
});

test("it counts in Money Required once its due date is inside the window", () => {
  const e = getCardUnbilledEvents({ accounts: cards, unbilledOf: () => 6000, today });
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: { committedSpending: e }, today: "2026-12-10", horizonDays: 30 }).spendingTotal, 12000 /* two cards */);
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: { committedSpending: e }, today: "2026-11-22", horizonDays: 30 }).spendingTotal, 0);
});
