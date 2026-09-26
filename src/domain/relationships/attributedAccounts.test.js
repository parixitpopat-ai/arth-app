import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpenBillBadge, getRelationshipBillState, getAttributedRelationships } from "./attributedAccounts.js";

const today = new Date(2026, 8, 26, 1, 0); // 26 Sep 2026, 01:00 local — early morning on purpose

test("D-16 badges: overdue, due within 14 days, unpaid later or undated", () => {
  assert.deepEqual(getOpenBillBadge({ dueDate: "2026-09-20" }, today), { kind: "overdue", days: 6 });
  assert.deepEqual(getOpenBillBadge({ dueDate: "2026-09-26" }, today), { kind: "due", days: 0 });
  assert.deepEqual(getOpenBillBadge({ dueDate: "2026-10-10" }, today), { kind: "due", days: 14 });
  assert.deepEqual(getOpenBillBadge({ dueDate: "2026-10-11" }, today), { kind: "unpaid", days: 15 });
  assert.deepEqual(getOpenBillBadge({ dueDate: "" }, today), { kind: "unpaid", days: null });
});

test("the most urgent open Bill wins, otherwise the newest paid one", () => {
  const bills = [
    { id: "a", billerAccountId: "ba1", status: "unpaid", dueDate: "2026-10-05" },
    { id: "b", billerAccountId: "ba1", status: "unpaid", dueDate: "2026-09-20" },
    { id: "c", billerAccountId: "ba1", status: "paid", paidDate: "2026-09-03" },
    { id: "d", billerAccountId: "ba2", status: "paid", paidDate: "2026-08-04" },
    { id: "e", billerAccountId: "ba2", status: "paid", paidDate: "2026-09-03" },
    { id: "f", billerAccountId: "ba3", status: "cancelled", dueDate: "2026-09-01" },
  ];
  assert.equal(getRelationshipBillState("ba1", bills, today).bill.id, "b");
  assert.equal(getRelationshipBillState("ba1", bills, today).kind, "overdue");
  assert.equal(getRelationshipBillState("ba2", bills, today).bill.id, "e");
  assert.equal(getRelationshipBillState("ba3", bills, today).kind, "none", "cancelled is ignored");
  assert.equal(getRelationshipBillState(7, [{ id: "g", billerAccountId: "7", status: "unpaid" }], today).kind, "unpaid", "ids as strings");
});

test("only relationships attributed to this person or group, attention first", () => {
  const billerAccounts = [
    { id: "ba1", name: "Jio", attributeType: "person", attributedTo: "p1" },
    { id: "ba2", name: "Cult.fit", attributeType: "person", attributedTo: "p1" },
    { id: "ba3", name: "Dr Sharma", attributeType: "person", attributedTo: "p1" },
    { id: "ba4", name: "Electricity", attributeType: "group", attributedTo: "p1" },
    { id: "ba5", name: "Other", attributeType: "person", attributedTo: "p2" },
  ];
  const bills = [
    { billerAccountId: "ba1", status: "unpaid", dueDate: "2026-10-05" },
    { billerAccountId: "ba2", status: "paid", paidDate: "2026-09-04" },
  ];
  const rows = getAttributedRelationships({ targetType: "person", targetId: "p1", billerAccounts, bills, refDate: today });
  assert.deepEqual(rows.map(r => r.billerAccount.id), ["ba1", "ba2", "ba3"]);
  assert.deepEqual(rows.map(r => r.state.kind), ["due", "paid", "none"]);
  assert.equal(getAttributedRelationships({ targetType: "group", targetId: "p1", billerAccounts, bills }).length, 1);
});
