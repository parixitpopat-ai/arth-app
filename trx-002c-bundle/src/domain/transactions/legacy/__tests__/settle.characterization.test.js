import test from "node:test";
import assert from "node:assert/strict";
import { settleCharacterization as settle } from "../settleCharacterization.js";

const todayStr = () => "2026-08-03";

test("characterization: plain transaction settle reduces the person's share on that transaction", () => {
  const txns = [{
    id: "t1", desc: "Dinner", type: "expense",
    people: { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } },
  }];
  const t = { id: "t1", desc: "Dinner", people: txns[0].people };

  const result = settle({ t, pid: "p1", requestedAmt: 500, bills: [], txns, accId: "acc-1", settleDate: "2026-08-03", todayStr });

  assert.equal(result.settlementCreated, true);
  const settlementTxn = result.txns.find(x => x.type === "settlement_in");
  assert.ok(settlementTxn, "a real settlement_in transaction record is created");
  const originalTxn = result.txns.find(x => x.id === "t1");
  assert.equal(originalTxn.people.p1.settled, true);
  assert.equal(originalTxn.people.p1.remainingAmt, 0);
});

test("characterization: overpaying a plain transaction settle records the excess as extraAmt (advance)", () => {
  const txns = [{
    id: "t1", desc: "Dinner", type: "expense",
    people: { p1: { amount: 300, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 300 } },
  }];
  const t = { id: "t1", desc: "Dinner", people: txns[0].people };

  const result = settle({ t, pid: "p1", requestedAmt: 500, bills: [], txns, accId: "acc-1", settleDate: "2026-08-03", todayStr });

  assert.equal(result.appliedAmt, 300, "only what's actually owed gets applied");
  assert.equal(result.extraAmt, 200, "the ₹200 excess is tracked as extra/advance, matching the real observed 'kept as advance' behavior");
});

test("characterization: bill settle (_isBillSettle) reduces the bill's split and flips status to paid once fully settled", () => {
  const bills = [{
    id: "b1", name: "Water Bill", status: "unpaid",
    splitPeople: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
  }];
  const t = { _isBillSettle: true, _billIds: ["b1"], _txnIds: [], desc: "Water Bill" };

  const result = settle({ t, pid: "p1", requestedAmt: 858.40, bills, txns: [], accId: "acc-1", settleDate: "2026-08-03", todayStr });

  const settledBill = result.bills.find(b => b.id === "b1");
  assert.equal(settledBill.splitPeople.p1.settled, true);
  assert.equal(settledBill.status, "paid", "bill flips to paid once its only owed share is settled");
});

test("characterization: bill settle mirrors onto the bill's paidByTxnId transaction (real UG1/Public Works scenario shape)", () => {
  const bills = [{
    id: "b1", name: "Public Works Department (Goa)", status: "unpaid", paidByTxnId: "t1",
    splitPeople: { ug1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
  }];
  const txns = [{
    id: "t1", desc: "Utilities", type: "expense",
    people: { ug1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
  }];
  const t = { _isBillSettle: true, _billIds: ["b1"], _txnIds: [], desc: "Public Works Department (Goa)" };

  const result = settle({ t, pid: "ug1", requestedAmt: 858.40, bills, txns, accId: "acc-1", settleDate: "2026-08-03", todayStr });

  const settledBill = result.bills.find(b => b.id === "b1");
  assert.equal(settledBill.status, "paid");
  const mirroredTxn = result.txns.find(x => x.id === "t1");
  assert.equal(mirroredTxn.people.ug1.settled, true, "linked transaction share reflects the settlement via paidByTxnId mirroring");
});

test("characterization: no settlement created when requestedAmt is zero/falsy", () => {
  const txns = [{ id: "t1", desc: "Dinner", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } }];
  const t = { id: "t1", desc: "Dinner", people: txns[0].people };
  const result = settle({ t, pid: "p1", requestedAmt: 0, bills: [], txns, accId: "acc-1", settleDate: "2026-08-03", todayStr });
  assert.equal(result.settlementCreated, false);
});
