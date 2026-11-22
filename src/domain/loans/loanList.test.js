import test from "node:test";
import assert from "node:assert/strict";
import { summariseLoans } from "./loanList.js";

const loans = [
  { id: "a", name: "Car loan", direction: "taken", status: "active", outstanding: 300000, interestRate: 9, hasInterest: true, dueDate: "2026-12-05" },
  { id: "b", name: "Raj", direction: "given", status: "active", outstanding: 15000 },
  { id: "c", name: "Old", direction: "taken", status: "closed", outstanding: 0 },
  { id: "d", name: "Written off", direction: "given", status: "written_off", outstanding: 500 },
  { id: "e", name: "TV EMI", direction: "taken", status: "active", outstanding: 54000, autoScheduled: true },
  { id: "f", name: "Friend", direction: "given", status: "active", outstanding: 20000 },
];
test("open loans only, split into owed and given, biggest first, with totals", () => {
  const s = summariseLoans(loans, l => l.autoScheduled === true);
  assert.deepEqual(s.taken.map(x => x.name), ["Car loan"]); assert.equal(s.takenTotal, 300000);
  assert.deepEqual(s.given.map(x => x.name), ["Friend", "Raj"]); assert.equal(s.givenTotal, 35000);
  assert.equal(s.taken[0].interest, 9); assert.equal(s.given[0].interest, 0); assert.equal(s.hasAny, true);
});
test("a closed, written-off or card-backed loan is not listed, and nothing gives an empty answer", () => {
  assert.equal(summariseLoans(loans, l => l.autoScheduled === true).taken.some(x => x.name === "TV EMI"), false);
  assert.equal(summariseLoans(loans).taken.some(x => x.name === "TV EMI"), true);
  const e = summariseLoans([]); assert.deepEqual([e.taken, e.given, e.takenTotal, e.hasAny], [[], [], 0, false]);
  assert.equal(summariseLoans(undefined).hasAny, false);
});
