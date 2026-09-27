import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpenBillBadge, getRelationshipBillState, getAttributedRelationships } from "./attributedAccounts.js";

const today = new Date(2026, 8, 26, 1, 0); // 26 Sep 2026, 01:00 local — early morning on purpose

// Arth 2.0 IA step 3 — getAttributedRelationships now reads active Financial Relationship rows,
// not billerAccount.attributeType/attributedTo directly. This mirrors what
// migrateBillerAccountAttributions would have produced for each fixture billerAccount, one
// "active" relationship per (billerAccountId, attributeType, attributedTo).
const relFor = ba => ({ billerAccountId: ba.id, targetType: ba.attributeType, targetId: ba.attributedTo, status: "active" });

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
  const relationships = billerAccounts.map(relFor);
  const rows = getAttributedRelationships({ targetType: "person", targetId: "p1", billerAccounts, relationships, bills, refDate: today });
  assert.deepEqual(rows.map(r => r.billerAccount.id), ["ba1", "ba2", "ba3"]);
  assert.deepEqual(rows.map(r => r.state.kind), ["due", "paid", "none"]);
  assert.equal(getAttributedRelationships({ targetType: "group", targetId: "p1", billerAccounts, relationships, bills }).length, 1);
});

test("Paused or Ended relationships never appear — lifecycle lives on the relationship, not the Bill", () => {
  const billerAccounts = [
    { id: "ba1", name: "Jio", attributeType: "person", attributedTo: "p1" },
    { id: "ba2", name: "Cult.fit", attributeType: "person", attributedTo: "p1" },
  ];
  const relationships = [
    { billerAccountId: "ba1", targetType: "person", targetId: "p1", status: "active" },
    { billerAccountId: "ba2", targetType: "person", targetId: "p1", status: "paused" },
  ];
  const rows = getAttributedRelationships({ targetType: "person", targetId: "p1", billerAccounts, relationships, bills: [] });
  assert.deepEqual(rows.map(r => r.billerAccount.id), ["ba1"]);
  const ended = getAttributedRelationships({ targetType: "person", targetId: "p1", billerAccounts, relationships: [relationships[0], { ...relationships[1], status: "ended" }], bills: [] });
  assert.deepEqual(ended.map(r => r.billerAccount.id), ["ba1"]);
});

test("a pre-generalization relationship row (personId only, no targetType) still resolves", () => {
  const billerAccounts = [{ id: "ba1", name: "Gym", attributeType: "person", attributedTo: "p1" }];
  const relationships = [{ billerAccountId: "ba1", personId: "p1", status: "active" }];
  const rows = getAttributedRelationships({ targetType: "person", targetId: "p1", billerAccounts, relationships, bills: [] });
  assert.deepEqual(rows.map(r => r.billerAccount.id), ["ba1"]);
});

test("list-row summary: count plus the most urgent open Bill only", async () => {
  const { summarizeRelationships } = await import("./attributedAccounts.js");
  const billerAccounts = [
    { id: "a", name: "Water", attributeType: "group", attributedTo: "g1" },
    { id: "b", name: "Electricity", attributeType: "group", attributedTo: "g1" },
  ];
  const bills = [
    { billerAccountId: "a", status: "paid", paidDate: "2026-09-10" },
    { billerAccountId: "b", status: "unpaid", dueDate: "2026-09-20" },
  ];
  const relationships = billerAccounts.map(relFor);
  const s = summarizeRelationships(getAttributedRelationships({ targetType: "group", targetId: "g1", billerAccounts, relationships, bills, refDate: today }));
  assert.equal(s.count, 2);
  assert.equal(s.attention.kind, "overdue");
  assert.equal(s.attention.days, 6);
  const paidOnly = summarizeRelationships(getAttributedRelationships({ targetType: "group", targetId: "g1", billerAccounts: [billerAccounts[0]], relationships, bills, refDate: today }));
  assert.deepEqual(paidOnly, { count: 1, attention: null });
  assert.deepEqual(summarizeRelationships([]), { count: 0, attention: null });
});
