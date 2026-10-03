import { test } from "node:test";
import assert from "node:assert/strict";
import { getBillBalance, projectStoredBillStatus, planBillPayment, getBillBadge, getBillLedger, getTxnUnallocated, getBillRemaining } from "./billBalance.js";

const c = (id, billId, txnId, amount, txnAmount = amount) => ({ id, obligationType: "bill", obligationId: String(billId), txnId: String(txnId), amount, txnAmount });
const bill = { id: "b1", amount: 3800, status: "unpaid", dueDate: "2026-10-08" };
const today = new Date(2026, 8, 26, 0, 30);

test("paid so far is the sum of the Bill's own Contributions, never more than the amount", () => {
  assert.deepEqual(getBillBalance(bill, []), { amount: 3800, paid: 0, remaining: 3800, status: "unpaid", historical: false });
  const part = [c("c1", "b1", "t1", 2500), c("x", "other", "t9", 999)];
  assert.deepEqual(getBillBalance(bill, part), { amount: 3800, paid: 2500, remaining: 1300, status: "partial", historical: false });
  const full = [c("c1", "b1", "t1", 2500), c("c2", "b1", "t2", 1300)];
  assert.equal(getBillBalance(bill, full).status, "paid");
  assert.equal(getBillBalance(bill, [c("c1", "b1", "t1", 5000)]).paid, 3800, "capped even if bad data exceeds the amount");
});

test("a legacy paid Bill with no Contributions stays paid (historical)", () => {
  const legacy = { ...bill, status: "paid" };
  assert.deepEqual(getBillBalance(legacy, []), { amount: 3800, paid: 3800, remaining: 0, status: "paid", historical: true });
  assert.equal(projectStoredBillStatus(legacy, []), "paid");
});

test("a paid Bill whose Contributions no longer cover it reopens", () => {
  assert.equal(projectStoredBillStatus({ ...bill, status: "paid" }, [c("c1", "b1", "t1", 1000)]), "unpaid");
});

test("stored status stays binary: a partially paid Bill is stored unpaid (still open)", () => {
  assert.equal(projectStoredBillStatus(bill, [c("c1", "b1", "t1", 2500)]), "unpaid");
  assert.equal(projectStoredBillStatus(bill, [c("c1", "b1", "t1", 3800)]), "paid");
  assert.equal(projectStoredBillStatus({ ...bill, status: "cancelled" }, []), "cancelled");
});

test("a payment applies at most the remaining; the excess is Unallocated", () => {
  assert.deepEqual(planBillPayment({ id: "j", amount: 699, status: "unpaid" }, [], 1000), { applied: 699, unallocated: 301, remaining: 699 });
  assert.deepEqual(planBillPayment(bill, [c("c1", "b1", "t1", 3500)], 300), { applied: 300, unallocated: 0, remaining: 300 });
  assert.deepEqual(planBillPayment(bill, [], 500), { applied: 500, unallocated: 0, remaining: 3800 });
  assert.equal(planBillPayment({ ...bill, status: "paid" }, [], 100).applied, 0, "nothing applies to a paid Bill");
});

test("D-16 badge order: Cancelled → Paid → Overdue → Partially paid → Due → Unpaid", () => {
  const b = (over) => ({ id: "b1", amount: 800, status: "unpaid", ...over });
  const paidHalf = [c("c1", "b1", "t1", 500)];
  assert.equal(getBillBadge(b({ status: "cancelled" }), [], today).kind, "cancelled");
  assert.equal(getBillBadge(b({ dueDate: "2026-09-20" }), [c("c1", "b1", "t1", 800)], today).kind, "paid");
  const od = getBillBadge(b({ dueDate: "2026-09-20" }), paidHalf, today);
  assert.equal(od.kind, "overdue", "overdue wins over partially paid");
  assert.equal(od.days, 6);
  assert.equal(od.balance.paid, 500);
  assert.equal(getBillBadge(b({ dueDate: "2026-10-08" }), paidHalf, today).kind, "partial");
  assert.equal(getBillBadge(b({ dueDate: "2026-09-26" }), [], today).kind, "due", "today counts as Due");
  assert.equal(getBillBadge(b({ dueDate: "2026-10-10" }), [], today).kind, "due", "day 14 is Due");
  assert.equal(getBillBadge(b({ dueDate: "2026-10-11" }), [], today).kind, "unpaid", "day 15 is Unpaid");
  assert.equal(getBillBadge(b({ dueDate: "" }), [], today).kind, "unpaid");
});

test("credit-card statement Bills keep their own stored status", () => {
  const st = { id: "s1", amount: 18420, status: "unpaid", isCcStatement: true };
  assert.equal(getBillBalance(st, [c("c1", "s1", "t1", 18420)]).status, "unpaid");
  assert.equal(getBillBalance({ ...st, status: "paid" }, []).status, "paid");
});

test("ledger: each payment with paid and applied, then balance, and Unallocated adds up", () => {
  const tata = { id: "tp", amount: 2140, status: "paid" };
  const txns = [{ id: "t1", amount: 2340, date: "2026-09-03", accId: "a1" }];
  const led = getBillLedger(tata, [c("c1", "tp", "t1", 2140, 2340)], txns);
  assert.equal(led.remaining, 0);
  assert.equal(led.rows[0].paidAmount, 2340);
  assert.equal(led.rows[0].applied, 2140);
  assert.equal(led.rows[0].unallocated, 200);
  assert.equal(led.unallocated, 200);
  assert.equal(led.amount - led.rows.reduce((s, r) => s + r.applied, 0), led.remaining, "Bill amount − applied = balance");
});

test("ledger rows are in date order and survive a missing transaction", () => {
  const led = getBillLedger(bill, [c("c2", "b1", "t2", 1000), c("c1", "b1", "t1", 2500)], [{ id: "t1", amount: 2500, date: "2026-09-12" }, { id: "t2", amount: 1000, date: "2026-09-20" }]);
  assert.deepEqual(led.rows.map(r => r.txnId), ["t1", "t2"]);
  const gone = getBillLedger(bill, [c("c1", "b1", "t404", 500)], []);
  assert.equal(gone.rows[0].txn, null);
  assert.equal(gone.rows[0].applied, 500);
});

test("Unallocated exists only for bill-linked transactions", () => {
  assert.equal(getTxnUnallocated({ id: "t1", amount: 1000 }, [c("c1", "j", "t1", 699)]), 301);
  assert.equal(getTxnUnallocated({ id: "t5", amount: 1000 }, [c("c1", "j", "t1", 699)]), 0, "no bill link → never unallocated");
  assert.equal(getBillRemaining(bill, [c("c1", "b1", "t1", 2500)]), 1300);
  assert.equal(getBillRemaining({ ...bill, status: "cancelled" }, []), 0);
});

test("projection: status follows Contributions; the first payment stays paidByTxnId", async () => {
  const { withProjectedBillStatuses, getPartialRemainingByBill } = await import("./billBalance.js");
  const txns = [{ id: "t1", date: "2026-09-12" }, { id: "t2", date: "2026-09-20" }];
  const b = { id: "b1", amount: 3800, status: "unpaid" };
  const part = withProjectedBillStatuses([b], [c("c1", "b1", "t1", 2500)], txns);
  assert.equal(part[0].status, "unpaid");
  assert.equal(part[0].paidByTxnId, "t1");
  const full = withProjectedBillStatuses(part, [c("c1", "b1", "t1", 2500), c("c2", "b1", "t2", 1300)], txns);
  assert.equal(full[0].status, "paid");
  assert.equal(full[0].paidDate, "2026-09-20", "paid on the latest payment's date");
  assert.equal(full[0].paidByTxnId, "t1");
  assert.equal(withProjectedBillStatuses(full, [c("c1", "b1", "t1", 2500), c("c2", "b1", "t2", 1300)], txns), full, "no change → same array");
  const reopened = withProjectedBillStatuses(full, [c("c1", "b1", "t1", 2500)], txns);
  assert.equal(reopened[0].status, "unpaid");
  assert.equal(reopened[0].paidDate, null);
  assert.deepEqual(getPartialRemainingByBill(reopened, [c("c1", "b1", "t1", 2500)]), { b1: 1300 });
});

test("projection leaves legacy, card-statement and cancelled Bills alone", async () => {
  const { withProjectedBillStatuses } = await import("./billBalance.js");
  const bills = [
    { id: "legacy", amount: 500, status: "paid", paidDate: "2025-01-01" },
    { id: "cc", amount: 900, status: "unpaid", isCcStatement: true },
    { id: "x", amount: 100, status: "cancelled" },
  ];
  assert.equal(withProjectedBillStatuses(bills, [c("c1", "cc", "t1", 900), c("c2", "x", "t2", 100)], []), bills);
});

test("the same payment stored twice for a Bill counts once (legacy duplicates)", () => {
  const bill = { id: "gym", amount: 8499, status: "paid" };
  const dup = [1, 2, 3, 4].map(n => ({ id: `c${n}`, obligationType: "bill", obligationId: "gym", txnId: "t1", amount: 8499 }));
  const ledger = getBillLedger(bill, dup, [{ id: "t1", amount: 8499, date: "2026-09-16" }]);
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.remaining, 0);
  assert.equal(ledger.unallocated, 0);
});

test("an extra applied to the next Bill is no longer Unallocated on the first Bill's ledger", () => {
  const b1 = { id: "b1", amount: 1000, status: "unpaid" };
  const txns = [{ id: "t1", amount: 1300, date: "2026-10-03" }];
  const contribs = [c("c1", "b1", "t1", 1000, 1300), c("c2", "b2", "t1", 300, 1300)];
  assert.equal(getBillLedger(b1, contribs, txns).unallocated, 0);
  assert.equal(getTxnUnallocated(txns[0], contribs), 0);
  // without the carry-forward the same 300 stays Unallocated
  assert.equal(getBillLedger(b1, [contribs[0]], txns).unallocated, 300);
});
