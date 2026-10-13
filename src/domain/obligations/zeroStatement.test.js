// A zero-amount card statement is something to check, never a payable and never overdue — and every reader of bill
// status agrees. Ordinary (non-statement) zero-amount bills keep their existing behaviour.
import test from "node:test";
import assert from "node:assert/strict";
import { getBillBadge, getBillBalance, isZeroAmountStatement, isOpenPayableBill, getStatementCheckText } from "./billBalance.js";
import { buildPaymentsView, getBadgeText } from "../bills/paymentsView.js";
import { getRelationshipBillState, summarizeRelationships } from "../relationships/attributedAccounts.js";
import { relationshipStatusText, relationshipSummaryText } from "../../components/people/relationshipText.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";
import { buildCommitmentTimeline } from "../futureMoney/commitmentTimeline.js";

const REF = new Date(2026, 9, 12, 12);
const stmt = (o = {}) => ({ id: "s1", isCcStatement: true, accId: "c1", name: "Amazon Visa Statement", amount: 0, arthAmount: 0, bankAmount: 1500, verification: "mismatch", status: "unpaid", dueDate: "2026-10-03", billerAccountId: "ba1", ...o });
const plain = (o = {}) => ({ id: "b1", name: "Electricity", amount: 0, status: "unpaid", dueDate: "2026-10-03", billerAccountId: "ba2", ...o });

test("a zero-amount mismatch statement past its due date is Check, not Overdue, and owes nothing", () => {
  const badge = getBillBadge(stmt(), [], REF);
  assert.equal(badge.kind, "check");
  assert.equal(badge.balance.remaining, 0);
  assert.equal(getBadgeText(badge, stmt()).text, "Check statement: bank says ₹1,500");
});

test("the bank figure is only ever text — it never becomes the amount", () => {
  const b = stmt();
  assert.equal(getBillBalance(b, []).amount, 0);
  assert.equal(getBillBalance(b, []).remaining, 0);
  assert.equal(getStatementCheckText(b), "Check statement: bank says ₹1,500");
  assert.equal(getStatementCheckText(stmt({ bankAmount: null })), "Check statement");
  assert.equal(getStatementCheckText(stmt({ bankAmount: 0 })), "Check statement");
});

test("a statement with an amount is unchanged: overdue when late, and payable", () => {
  const b = stmt({ amount: 2300, arthAmount: 2300, bankAmount: null, verification: "needs_verification" });
  assert.equal(getBillBadge(b, [], REF).kind, "overdue");
  assert.equal(isZeroAmountStatement(b), false);
  assert.equal(isOpenPayableBill(b), true);
});

test("paid and cancelled zero statements keep their own state", () => {
  assert.equal(getBillBadge(stmt({ status: "paid" }), [], REF).kind, "paid");
  assert.equal(getBillBadge(stmt({ status: "cancelled" }), [], REF).kind, "cancelled");
  assert.equal(isZeroAmountStatement(stmt({ status: "paid" })), false);
});

test("ordinary zero-amount bills are not covered by the statement rule", () => {
  const b = plain();
  assert.equal(isZeroAmountStatement(b), false);
  assert.equal(isOpenPayableBill(b), true);          // unchanged: still an open bill (e.g. amount not yet known)
  assert.equal(getBillBadge(b, [], REF).kind, "overdue");
});

test("Bills tab: the zero statement is in its own Check group, in no total or count", () => {
  const bills = [stmt(), stmt({ id: "s2", amount: 2300, arthAmount: 2300, bankAmount: null, verification: "needs_verification", dueDate: "2026-10-05" })];
  const v = buildPaymentsView({ bills, contributions: [], refDate: REF });
  assert.equal(v.groups.check.length, 1);
  assert.equal(v.groups.check[0].bill.id, "s1");
  assert.equal(v.groups.overdue.length, 1);
  assert.equal(v.groups.overdue[0].bill.id, "s2");
  assert.equal(v.totalUnpaid, 2300);
  assert.equal(v.openCount, 1);
});

test("a zero statement with no bank figure is an empty cycle: never overdue, never payable, never shown to check", () => {
  const empty = stmt({ bankAmount: null, verification: "needs_verification" });
  assert.equal(getBillBadge(empty, [], REF).kind, "check"); // never "overdue"
  assert.equal(isOpenPayableBill(empty), false);
  const v = buildPaymentsView({ bills: [empty], contributions: [], refDate: REF });
  assert.equal(v.groups.check.length, 0);
  assert.equal(v.groups.overdue.length, 0);
  assert.equal(getRelationshipBillState("ba1", [empty], REF).kind, "none");
});

test("Bills tab: only a zero statement means All bills paid (openCount 0) while still listing it to check", () => {
  const v = buildPaymentsView({ bills: [stmt()], contributions: [], refDate: REF });
  assert.equal(v.openCount, 0);
  assert.equal(v.totalUnpaid, 0);
  assert.equal(v.groups.check.length, 1);
});

test("relationship badge: Check ranks below a real payable and reads as a check, not overdue", () => {
  const only = getRelationshipBillState("ba1", [stmt()], REF);
  assert.equal(only.kind, "check");
  assert.equal(relationshipStatusText(only, "₹", n => String(n)).text, "Check statement: bank says ₹1,500");
  assert.notEqual(relationshipStatusText(only, "₹", n => String(n)).tone, "negative");
  const both = getRelationshipBillState("ba1", [stmt(), stmt({ id: "s2", amount: 900, arthAmount: 900, dueDate: "2026-11-20" })], REF);
  assert.equal(both.kind, "unpaid");
  assert.equal(both.bill.id, "s2");
  const sum = summarizeRelationships([{ state: only }]);
  assert.match(relationshipSummaryText(sum, "₹", n => String(n)), /Check statement: bank says ₹1,500/);
  assert.doesNotMatch(relationshipSummaryText(sum, "₹", n => String(n)), /overdue/);
});

test("Outlook / Money Required already ignore a zero-amount entry, so a zero statement is not in Needed", () => {
  const futureMoney = { committedSpending: [{ sourceType: "bill", sourceId: "s1", amount: 0, date: "2026-10-03", status: "unpaid" }, { sourceType: "bill", sourceId: "s2", amount: 2300, date: "2026-10-05", status: "unpaid" }], committedSaving: [], debtService: [] };
  const mr = getMoneyRequiredForPeriod({ futureMoney, today: "2026-10-12", horizonDays: 30 });
  assert.equal(mr.total, 2300);
  assert.equal(mr.count, 1);
  const tl = buildCommitmentTimeline({ futureMoney, openingBalance: 10000, today: "2026-10-12", horizonDays: 30 });
  assert.equal(tl.rows.length, 1);
  assert.equal(tl.buffer, 7700);
});
