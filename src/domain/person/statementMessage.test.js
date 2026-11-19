import test from "node:test";
import assert from "node:assert/strict";
import { buildStatementMessage, shortDate, periodLabel } from "./statementMessage.js";

const st = (o = {}) => ({ from: "2026-07-01", to: "2026-08-31", opening: 0, sections: [{ label: "Electricity", subtotal: 3000 }, { label: "Water", subtotal: 1000 }, { label: "Own expenses", subtotal: 950 }], movedTotal: 0, paymentsTotal: 1650, closing: 3300, settled: false, credit: 0, ...o });
const fmt = n => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("dates", () => {
  assert.equal(shortDate("2026-08-05"), "5 Aug"); assert.equal(shortDate("2026-08-05", true), "5 Aug 2026"); assert.equal(shortDate(""), "");
  assert.equal(periodLabel("2026-06-10", "2026-07-25"), "10 Jun – 25 Jul"); assert.equal(periodLabel("2026-06-10", ""), "");
});
test("the message: sections, paid, balance due, and the pay-to line", () => {
  const m = buildStatementMessage(st(), { name: "Ravi", fmt, upiHandle: "sample@upi" });
  assert.equal(m, ["Hi Ravi, statement 1 Jul 2026 – 31 Aug 2026:", "Electricity ₹3,000.00", "Water ₹1,000.00", "Own expenses ₹950.00", "Paid −₹1,650.00", "Balance due ₹3,300.00", "Pay to: sample@upi"].join("\n"));
});
test("brought forward and moved-away lines appear only when there is something", () => {
  const m = buildStatementMessage(st({ opening: 500, movedTotal: 150 }), { name: "Ravi", fmt });
  assert.match(m, /Brought forward ₹500\.00/); assert.match(m, /Moved to someone else −₹150\.00/);
  assert.doesNotMatch(buildStatementMessage(st(), { name: "Ravi", fmt }), /Brought forward|Moved/);
});
test("settled and credit: no balance due and no pay-to line", () => {
  const a = buildStatementMessage(st({ closing: 0, settled: true }), { name: "Sunny", fmt, upiHandle: "sample@upi" });
  assert.match(a, /settled/); assert.doesNotMatch(a, /Pay to/);
  const b = buildStatementMessage(st({ closing: -300, credit: 300 }), { name: "Ravi", fmt, upiHandle: "sample@upi" });
  assert.match(b, /Credit in your favour ₹300\.00/); assert.doesNotMatch(b, /Pay to|Balance due/);
});
test("no UPI handle saved: the pay-to line is left off, never invented", () => {
  assert.doesNotMatch(buildStatementMessage(st(), { name: "Ravi", fmt }), /Pay to/);
});
