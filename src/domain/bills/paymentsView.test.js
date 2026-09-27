import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentsView, getBillPeriodLabel, getSplitProgressText, getBadgeText, getCardVerificationText } from "./paymentsView.js";

const today = new Date(2026, 8, 26, 9, 0);
const c = (billId, txnId, amount) => ({ id: `c-${txnId}`, obligationType: "bill", obligationId: billId, txnId, amount });
const bills = [
  { id: "elec", name: "Goa Electricity", amount: 800, status: "unpaid", dueDate: "2026-09-20", forType: "group", forId: "g1" },
  { id: "cc", name: "HDFC Regalia", amount: 18420, status: "unpaid", dueDate: "2026-09-26", isCcStatement: true, periodTo: "2026-09-15", forType: "person", forId: "vyom" },
  { id: "air", name: "Airtel Fiber", amount: 1178, status: "unpaid", dueDate: "2026-09-27", forType: "group", forId: "g1", splitPeople: { a: { amount: 393, mode: "owes", settled: true }, b: { amount: 393, mode: "owes", settled: false } } },
  { id: "jio", name: "Jio Postpaid", amount: 699, status: "unpaid", dueDate: "2026-10-05", forType: "person", forId: "nidhi" },
  { id: "soc", name: "Society", amount: 3800, status: "unpaid", dueDate: "2026-10-08", forType: "group", forId: "g1" },
  { id: "lic", name: "LIC premium", amount: 12400, status: "unpaid", dueDate: "2026-10-28", forType: "unassigned", forId: null },
  { id: "tata", name: "Tata Power", amount: 2140, status: "paid", paidDate: "2026-09-03", forType: "group", forId: "g1" },
  { id: "x", name: "Old gym", amount: 900, status: "cancelled", dueDate: "2026-10-01" },
];
const contributions = [c("elec", "t1", 500), c("soc", "t2", 3500), c("tata", "t3", 2140)];
const names = { "group:g1": "Goa Household", "person:vyom": "Vyom", "person:nidhi": "Nidhi" };
const forLabel = b => names[`${b.forType}:${b.forId}`] || "Unassigned";

test("groups kept from today's Payments, each row with its one D-16 badge", () => {
  const v = buildPaymentsView({ bills, contributions, refDate: today, forLabel });
  const ids = k => v.groups[k].map(r => r.bill.id);
  assert.deepEqual(ids("overdue"), ["elec"]);
  assert.deepEqual(ids("dueToday"), ["cc"]);
  assert.deepEqual(ids("dueTomorrow"), ["air"]);
  assert.deepEqual(ids("upcoming"), ["jio", "soc", "lic"]);
  assert.deepEqual(ids("paid"), ["tata"]);
  assert.deepEqual(ids("cancelled"), ["x"]);
  const kinds = Object.fromEntries(Object.values(v.groups).flat().map(r => [r.bill.id, r.badge.kind]));
  assert.equal(kinds.elec, "overdue", "overdue wins over partially paid");
  assert.equal(kinds.soc, "partial");
  assert.equal(kinds.jio, "due");
  assert.equal(kinds.lic, "unpaid");
});

test("Total unpaid is what's still owed; paid and cancelled are left out", () => {
  const v = buildPaymentsView({ bills, contributions, refDate: today, forLabel });
  assert.equal(v.totalUnpaid, 300 + 18420 + 1178 + 699 + 300 + 12400);
  assert.equal(v.openCount, 6);
  assert.equal(v.lastPaid.bill.id, "tata");
});

test("For chips come from each Bill's own For, with Unassigned last", () => {
  const v = buildPaymentsView({ bills, contributions, refDate: today, forLabel });
  assert.deepEqual(v.forChips.map(ch => ch.label), ["Everyone", "Goa Household", "Nidhi", "Vyom", "Unassigned"]);
  const onlyG = buildPaymentsView({ bills, contributions, refDate: today, forLabel, forFilter: "group:g1" });
  assert.deepEqual(Object.values(onlyG.groups).flat().map(r => r.bill.id).sort(), ["air", "elec", "soc", "tata"]);
  const un = buildPaymentsView({ bills, contributions, refDate: today, forLabel, forFilter: "unassigned" });
  assert.deepEqual(Object.values(un.groups).flat().map(r => r.bill.id).sort(), ["lic", "x"]);
});

test("row texts", () => {
  assert.equal(getBillPeriodLabel({ periodTo: "2026-09-30" }), "September");
  assert.equal(getBillPeriodLabel({ isCcStatement: true, periodTo: "2026-09-15" }), "Sep statement");
  assert.equal(getSplitProgressText(bills[2]), "split 3 ways · 1 of 2 settled");
  assert.equal(getSplitProgressText(bills[3]), "");
  assert.equal(getBadgeText({ kind: "overdue", days: 6 }).text, "6 days overdue");
  assert.equal(getBadgeText({ kind: "due", days: 9 }, { dueDate: "2026-10-05" }).text, "Due 5 Oct");
  assert.equal(getBadgeText({ kind: "paid" }, { paidDate: "2026-09-03" }).text, "✓ Paid 3 Sep");
  assert.equal(getCardVerificationText(bills[1]), "Needs verification");
  assert.equal(getCardVerificationText({ isCcStatement: true, verification: "mismatch" }), "Doesn't match");
});

test("everything paid → no open rows, total 0 (PY-27 empty state)", () => {
  const v = buildPaymentsView({ bills: [bills[6]], contributions, refDate: today, forLabel });
  assert.equal(v.openCount, 0);
  assert.equal(v.totalUnpaid, 0);
});

test("a ₹0 open Bill (card statement with nothing due) is not counted as owed", () => {
  const zero = { id: "z", name: "Card statement", amount: 0, status: "unpaid", isCcStatement: true, dueDate: "2026-09-30" };
  const v = buildPaymentsView({ bills: [zero, bills[6]], contributions, refDate: today, forLabel });
  assert.equal(v.openCount, 0);
  assert.equal(Object.values(v.groups).flat().some(r => r.bill.id === "z"), false);
});

test("Expected items (ADR-039) get their own group, filtered by For, never counted in totals", () => {
  const expectedItems = [
    { relationshipId: "r1", billerAccountId: "ba1", targetType: "group", targetId: "g1", amount: 800, dueDate: "2026-10-05" },
    { relationshipId: "r2", billerAccountId: "ba2", targetType: "person", targetId: "vyom", amount: 1500, dueDate: "2026-10-01" },
  ];
  const v = buildPaymentsView({ bills, contributions, refDate: today, forLabel, expectedItems });
  assert.deepEqual(v.groups.expected.map(r => r.expected.relationshipId), ["r2", "r1"], "sorted by due date");
  assert.equal(v.groups.expected[0].forText, "Vyom");
  // Expected never affects totals — the whole point is "dashed, never payable" (ADR-039 §10b).
  const withoutExpected = buildPaymentsView({ bills, contributions, refDate: today, forLabel });
  assert.equal(v.totalUnpaid, withoutExpected.totalUnpaid);
  assert.equal(v.openCount, withoutExpected.openCount);
  const onlyGroup = buildPaymentsView({ bills, contributions, refDate: today, forLabel, expectedItems, forFilter: "group:g1" });
  assert.deepEqual(onlyGroup.groups.expected.map(r => r.expected.relationshipId), ["r1"]);
});
